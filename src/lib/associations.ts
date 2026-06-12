import type { RowDataPacket } from "mysql2";
import { hashPassword } from "@/lib/auth";
import { ensureCoaSeeded } from "@/lib/coa-service";
import { execute, query } from "@/lib/db";

export interface AssociationRow extends RowDataPacket {
  id: number;
  association_name: string;
  username: string;
  is_first_login: number | boolean;
  subscription_start: string | Date;
  subscription_end: string | Date;
  status: "active" | "expired";
  created_at: string | Date;
}

export interface EnrichedAssociation extends AssociationRow {
  days_remaining: number;
  subscription_alert: boolean;
}

export function getSubscriptionDaysRemaining(endDate: string | Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function enrichAssociation(assoc: AssociationRow): EnrichedAssociation {
  const daysRemaining = getSubscriptionDaysRemaining(assoc.subscription_end);
  return {
    ...assoc,
    is_first_login: !!assoc.is_first_login,
    days_remaining: daysRemaining,
    subscription_alert: daysRemaining <= 60,
  };
}

export function generateUsername(associationName: string): string {
  const name = associationName.trim();
  return name || "assoc";
}

export function generatePassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

export function formatDateYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

export async function listAssociationsForAdmin(): Promise<EnrichedAssociation[]> {
  const rows = await query<AssociationRow[]>(
    `SELECT id, association_name, username, is_first_login,
            subscription_start, subscription_end, status, created_at
     FROM associations
     ORDER BY created_at DESC`,
  );
  return rows.map(enrichAssociation);
}

async function resolveUniqueUsername(base: string): Promise<string> {
  const trimmed = base.trim() || "assoc";
  let suffix = 0;

  while (suffix < 100) {
    const candidate = suffix === 0 ? trimmed : `${trimmed}${suffix}`;
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM associations WHERE username = ? LIMIT 1",
      [candidate],
    );
    if (existing.length === 0) return candidate;
    suffix += 1;
  }

  throw new Error("تعذّر إنشاء اسم مستخدم فريد للجمعية");
}

export interface CreateAssociationResult {
  id: number;
  association_name: string;
  username: string;
  password: string;
  subscription_start: string;
  subscription_end: string;
  status: "active" | "expired";
}

export async function createAssociation(input: {
  association_name: string;
  subscription_start?: string;
  subscription_end?: string;
  status?: "active" | "expired";
}): Promise<CreateAssociationResult> {
  const trimmedName = input.association_name.trim();
  const today = new Date();
  const subscriptionStart = input.subscription_start || formatDateYMD(today);
  const subscriptionEnd =
    input.subscription_end || formatDateYMD(addYears(today, 1));
  const status = input.status || "active";
  const username = await resolveUniqueUsername(generateUsername(trimmedName));
  const plainPassword = generatePassword();
  const passwordHash = await hashPassword(plainPassword);

  const result = await execute(
    `INSERT INTO associations
     (association_name, username, password_hash, is_first_login,
      subscription_start, subscription_end, status)
     VALUES (?, ?, ?, 1, ?, ?, ?)`,
    [
      trimmedName,
      username,
      passwordHash,
      subscriptionStart,
      subscriptionEnd,
      status,
    ],
  );

  await ensureCoaSeeded(result.insertId);

  return {
    id: result.insertId,
    association_name: trimmedName,
    username,
    password: plainPassword,
    subscription_start: subscriptionStart,
    subscription_end: subscriptionEnd,
    status,
  };
}

export async function renewAssociationSubscription(
  associationId: number,
): Promise<{ subscription_end: string; status: "active" | "expired" }> {
  const rows = await query<AssociationRow[]>(
    `SELECT id, subscription_end, status
     FROM associations
     WHERE id = ?`,
    [associationId],
  );

  if (rows.length === 0) {
    throw new Error("الجمعية غير موجودة");
  }

  const current = rows[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentEnd = new Date(current.subscription_end);
  currentEnd.setHours(0, 0, 0, 0);
  const baseDate = currentEnd.getTime() >= today.getTime() ? currentEnd : today;
  const newEnd = formatDateYMD(addYears(baseDate, 1));

  await execute(
    `UPDATE associations
     SET subscription_end = ?, status = 'active'
     WHERE id = ?`,
    [newEnd, associationId],
  );

  return { subscription_end: newEnd, status: "active" };
}
