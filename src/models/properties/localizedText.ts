export type LocalizedLanguage = 'en' | 'es' | 'pt';

export const LOCALIZED_LANGUAGES: LocalizedLanguage[] = ['es', 'en', 'pt'];

export const LOCALIZED_LANGUAGE_LABELS: Record<LocalizedLanguage, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
};

export type LocalizedTextByLanguage = Partial<Record<LocalizedLanguage, string>>;

export function pruneLocalizedText(text?: LocalizedTextByLanguage): LocalizedTextByLanguage {
  if (!text) return {};
  const out: LocalizedTextByLanguage = {};
  for (const lang of LOCALIZED_LANGUAGES) {
    const v = text[lang]?.trim();
    if (v) out[lang] = v;
  }
  return out;
}

export function hasLocalizedText(text?: LocalizedTextByLanguage): boolean {
  if (!text) return false;
  return LOCALIZED_LANGUAGES.some(lang => !!text[lang]?.trim());
}

export function pickLocalizedText(
  text: LocalizedTextByLanguage | undefined,
  preferredLocale?: string
): string | undefined {
  if (!text) return undefined;
  const pref = preferredLocale?.toLowerCase().slice(0, 2) as LocalizedLanguage | undefined;
  const order: LocalizedLanguage[] = [];
  if (pref && LOCALIZED_LANGUAGES.includes(pref)) order.push(pref);
  for (const lang of LOCALIZED_LANGUAGES) {
    if (!order.includes(lang)) order.push(lang);
  }
  for (const lang of order) {
    const v = text[lang]?.trim();
    if (v) return v;
  }
  return undefined;
}
