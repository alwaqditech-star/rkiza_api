import type { RowDataPacket } from 'mysql2';
import { execute, query } from './db';
import { DEFAULT_THEME_ID, normalizeThemeId } from './theme-settings';

interface SettingRow extends RowDataPacket {
  setting_value: string;
}

async function ensureSystemSettingsTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function getThemeId(): Promise<string> {
  try {
    await ensureSystemSettingsTable();
    const rows = await query<SettingRow[]>(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'theme_id' LIMIT 1",
    );
    return normalizeThemeId(rows[0]?.setting_value);
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export async function setThemeId(themeId: string): Promise<string> {
  const normalized = normalizeThemeId(themeId);
  if (normalized !== themeId.trim()) {
    throw new Error('نموذج الألوان غير صالح');
  }

  await ensureSystemSettingsTable();
  await query(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES ('theme_id', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [normalized],
  );

  return normalized;
}