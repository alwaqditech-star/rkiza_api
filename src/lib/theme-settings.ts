export const DEFAULT_THEME_ID = 'navy-gold';

export const VALID_THEME_IDS = new Set([
  'navy-gold',
  'forest-emerald',
  'royal-purple',
  'ocean-blue',
  'burgundy',
  'charcoal-copper',
]);

export function normalizeThemeId(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (trimmed && VALID_THEME_IDS.has(trimmed)) return trimmed;
  return DEFAULT_THEME_ID;
}
