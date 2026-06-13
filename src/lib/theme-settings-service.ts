import type { RowDataPacket } from 'mysql2';
import { query } from './db';
import { DEFAULT_THEME_ID, normalizeThemeId } from './theme-settings';

interface SettingRow extends RowDataPacket {
  setting_value: string;
}

export async function getThemeId(): Promise<string> {
  try {
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

  await query(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES ('theme_id', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [normalized],
  );

  return normalized;
}
