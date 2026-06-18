import type { RowDataPacket } from 'mysql2';
import { execute, query } from './db';

export type MediaScope = 'admin' | 'association' | 'org-stamp' | 'org-logo';

const VALID_SCOPES = new Set<string>(['admin', 'association', 'org-stamp', 'org-logo']);

interface MediaRow extends RowDataPacket {
  content_type: string;
  data: Buffer;
}

let tableReady: Promise<void> | null = null;

async function ensureMediaAssetsTable(): Promise<void> {
  if (!tableReady) {
    tableReady = execute(`
      CREATE TABLE IF NOT EXISTS media_assets (
        media_key VARCHAR(100) NOT NULL PRIMARY KEY,
        content_type VARCHAR(80) NOT NULL,
        data LONGBLOB NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined);
  }
  await tableReady;
}

export function isMediaScope(value: string): value is MediaScope {
  return VALID_SCOPES.has(value);
}

export function mediaKey(scope: MediaScope, ownerId: number): string {
  return `${scope}:${ownerId}`;
}

export function mediaPublicPath(scope: MediaScope, ownerId: number): string {
  return `/api/media/${scope}/${ownerId}?v=${Date.now()}`;
}

export async function saveMediaAsset(
  scope: MediaScope,
  ownerId: number,
  contentType: string,
  buffer: Buffer,
): Promise<string> {
  await ensureMediaAssetsTable();
  const key = mediaKey(scope, ownerId);
  await query(
    `INSERT INTO media_assets (media_key, content_type, data)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       content_type = VALUES(content_type),
       data = VALUES(data),
       updated_at = CURRENT_TIMESTAMP`,
    [key, contentType, buffer],
  );
  return mediaPublicPath(scope, ownerId);
}

export async function getMediaAsset(
  scope: MediaScope,
  ownerId: number,
): Promise<{ contentType: string; data: Buffer } | null> {
  await ensureMediaAssetsTable();
  const rows = await query<MediaRow[]>(
    'SELECT content_type, data FROM media_assets WHERE media_key = ? LIMIT 1',
    [mediaKey(scope, ownerId)],
  );
  if (!rows.length) return null;
  return {
    contentType: rows[0].content_type,
    data: rows[0].data,
  };
}

export function parseMediaPath(pathname: string): { scope: MediaScope; ownerId: number } | null {
  const match = /^\/api\/media\/([^/]+)\/(\d+)$/.exec(pathname);
  if (!match || !isMediaScope(match[1])) return null;
  return { scope: match[1], ownerId: Number(match[2]) };
}
