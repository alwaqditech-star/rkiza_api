import type { RowDataPacket } from 'mysql2';
import { execute, query } from '@/lib/db';
import type { AssociationSettings } from '@/lib/types';

interface SettingsRow extends RowDataPacket {
  association_id: number;
  association_name: string;
  name_en: string | null;
  cr_number: string | null;
  license_number: string | null;
  founded_date: string | Date | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  fiscal_year_start: number;
  current_fiscal_year: number;
  currency: string;
  journal_seq_start: number;
  stamp_url: string | null;
  logo_url: string | null;
}

function formatDate(value: string | Date | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function isMissingSettingsTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('association_settings') || message.includes("doesn't exist");
}

function defaultSettings(associationId: number, associationName: string): AssociationSettings {
  return {
    association_id: associationId,
    association_name: associationName,
    name_en: null,
    cr_number: null,
    license_number: null,
    founded_date: null,
    city: null,
    address: null,
    phone: null,
    email: null,
    website: null,
    description: null,
    fiscal_year_start: 1,
    current_fiscal_year: new Date().getFullYear(),
    currency: 'SAR',
    journal_seq_start: 1,
    stamp_url: null,
    logo_url: null,
  };
}

export async function getAssociationSettings(
  associationId: number,
): Promise<AssociationSettings> {
  try {
    const rows = await query<SettingsRow[]>(
      `SELECT a.id AS association_id, a.association_name,
              s.name_en, s.cr_number, s.license_number, s.founded_date, s.city, s.address,
              s.phone, s.email, s.website, s.description, s.fiscal_year_start,
              s.current_fiscal_year, s.currency, s.journal_seq_start, s.stamp_url, s.logo_url
       FROM associations a
       LEFT JOIN association_settings s ON s.association_id = a.id
       WHERE a.id = ?`,
      [associationId],
    );

    if (!rows.length) {
      throw new Error('الجمعية غير موجودة');
    }

    const row = rows[0];
    const base = defaultSettings(associationId, row.association_name);

    if (!row.current_fiscal_year) {
      return base;
    }

    return {
      ...base,
      name_en: row.name_en,
      cr_number: row.cr_number,
      license_number: row.license_number,
      founded_date: formatDate(row.founded_date),
      city: row.city,
      address: row.address,
      phone: row.phone,
      email: row.email,
      website: row.website,
      description: row.description,
      fiscal_year_start: Number(row.fiscal_year_start ?? 1),
      current_fiscal_year: Number(row.current_fiscal_year),
      currency: row.currency ?? 'SAR',
      journal_seq_start: Number(row.journal_seq_start ?? 1),
      stamp_url: row.stamp_url,
      logo_url: row.logo_url,
    };
  } catch (error) {
    if (isMissingSettingsTable(error)) {
      const rows = await query<RowDataPacket[]>(
        'SELECT association_name FROM associations WHERE id = ?',
        [associationId],
      );
      return defaultSettings(associationId, String(rows[0]?.association_name ?? ''));
    }
    throw error;
  }
}

export async function upsertAssociationSettings(
  associationId: number,
  input: Partial<AssociationSettings> & { association_name?: string },
): Promise<void> {
  if (input.association_name) {
    await execute('UPDATE associations SET association_name = ? WHERE id = ?', [
      input.association_name,
      associationId,
    ]);
  }

  try {
    await execute(
      `INSERT INTO association_settings
       (association_id, name_en, cr_number, license_number, founded_date, city, address,
        phone, email, website, description, fiscal_year_start, current_fiscal_year,
        currency, journal_seq_start, stamp_url, logo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name_en = VALUES(name_en),
         cr_number = VALUES(cr_number),
         license_number = VALUES(license_number),
         founded_date = VALUES(founded_date),
         city = VALUES(city),
         address = VALUES(address),
         phone = VALUES(phone),
         email = VALUES(email),
         website = VALUES(website),
         description = VALUES(description),
         fiscal_year_start = VALUES(fiscal_year_start),
         current_fiscal_year = VALUES(current_fiscal_year),
         currency = VALUES(currency),
         journal_seq_start = VALUES(journal_seq_start),
         stamp_url = COALESCE(VALUES(stamp_url), stamp_url),
         logo_url = COALESCE(VALUES(logo_url), logo_url)`,
      [
        associationId,
        input.name_en ?? null,
        input.cr_number ?? null,
        input.license_number ?? null,
        input.founded_date ?? null,
        input.city ?? null,
        input.address ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.website ?? null,
        input.description ?? null,
        input.fiscal_year_start ?? 1,
        input.current_fiscal_year ?? new Date().getFullYear(),
        input.currency ?? 'SAR',
        input.journal_seq_start ?? 1,
        input.stamp_url ?? null,
        input.logo_url ?? null,
      ],
    );
  } catch (error) {
    if (isMissingSettingsTable(error)) {
      throw new Error('يرجى تشغيل database/patch-settings.sql على قاعدة البيانات');
    }
    throw error;
  }
}

export async function updateAssociationMedia(
  associationId: number,
  fields: { stamp_url?: string; logo_url?: string },
): Promise<void> {
  const current = await getAssociationSettings(associationId);
  await upsertAssociationSettings(associationId, {
    ...current,
    stamp_url: fields.stamp_url ?? current.stamp_url,
    logo_url: fields.logo_url ?? current.logo_url,
  });
}
