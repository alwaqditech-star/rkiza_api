import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getRequestContext } from '@/lib/request-context';
import type { AdminSession, AuthSession, ClientSession } from '@/lib/types';
import {
  getClientPermissions,
  type ClientPermissions,
} from '@/lib/client-permissions';

export type { AdminSession, ClientSession, AuthSession };

export const AUTH_COOKIE_NAME = 'rikaz_token';
const BCRYPT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: AdminSession | ClientSession): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AuthSession {
  return jwt.verify(token, getJwtSecret()) as AuthSession;
}

function readAuthToken(): string | null {
  const ctx = getRequestContext();
  if (!ctx) return null;

  const cookieToken = ctx.req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken) return cookieToken;

  const authHeader = ctx.req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export async function setAuthCookie(token: string): Promise<void> {
  const ctx = getRequestContext();
  if (!ctx) return;

  ctx.res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const ctx = getRequestContext();
  if (!ctx) return;

  ctx.res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function getSessionFromCookie(): Promise<AuthSession | null> {
  const token = readAuthToken();
  if (!token) return null;

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getSessionFromCookie();
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function requireClientSession(): Promise<ClientSession> {
  const session = await getSessionFromCookie();
  if (!session || session.role !== 'client') {
    throw new Error('Unauthorized');
  }
  return session;
}

export function buildAdminSession(admin: {
  id: number;
  username: string;
  name: string;
  avatar_url?: string | null;
}): AdminSession {
  return {
    role: 'admin',
    id: admin.id,
    username: admin.username,
    name: admin.name,
    avatar_url: admin.avatar_url ?? null,
  };
}

export function buildClientSession(association: {
  id: number;
  username: string;
  association_name: string;
  avatar_url?: string | null;
  is_first_login: boolean | number;
  subscription_end: string;
  status: ClientSession['status'];
}): ClientSession {
  return {
    role: 'client',
    id: association.id,
    username: association.username,
    association_name: association.association_name,
    avatar_url: association.avatar_url ?? null,
    is_first_login: Boolean(association.is_first_login),
    subscription_end: association.subscription_end,
    status: association.status,
  };
}

export function buildClientSessionFromSubUser(input: {
  association_id: number;
  association_name: string;
  avatar_url?: string | null;
  subscription_end: string;
  status: ClientSession['status'];
  user_id: number;
  username: string;
  display_name: string;
  role: ClientSession['sub_user_role'];
}): ClientSession {
  return {
    role: 'client',
    id: input.association_id,
    username: input.username,
    association_name: input.association_name,
    avatar_url: input.avatar_url ?? null,
    is_first_login: false,
    subscription_end: input.subscription_end,
    status: input.status,
    sub_user_id: input.user_id,
    sub_user_role: input.role,
    is_sub_user: true,
    display_name: input.display_name,
  };
}

export class ClientPermissionError extends Error {
  constructor(message = 'ليس لديك صلاحية لهذا الإجراء') {
    super(message);
    this.name = 'ClientPermissionError';
  }
}

async function requireClientSessionWithPermission(
  check: (permissions: ClientPermissions) => boolean,
  message?: string,
): Promise<ClientSession> {
  const session = await requireClientSession();
  const permissions = getClientPermissions(session);
  if (!check(permissions)) {
    throw new ClientPermissionError(message);
  }
  return session;
}

export async function requireClientWrite(
  message = 'ليس لديك صلاحية إجراء عمليات الإدخال أو التعديل',
): Promise<ClientSession> {
  return requireClientSessionWithPermission((p) => p.canWrite, message);
}

export async function requireClientDelete(
  message = 'ليس لديك صلاحية الحذف',
): Promise<ClientSession> {
  return requireClientSessionWithPermission((p) => p.canDelete, message);
}

export async function requireClientSettings(
  message = 'ليس لديك صلاحية الوصول إلى إعدادات النظام',
): Promise<ClientSession> {
  return requireClientSessionWithPermission((p) => p.canSettings, message);
}

export async function requirePrimaryClientAccount(
  message = 'هذا الإجراء متاح لمدير الجمعية فقط',
): Promise<ClientSession> {
  const session = await requireClientSession();
  if (session.is_sub_user) {
    throw new ClientPermissionError(message);
  }
  return session;
}
