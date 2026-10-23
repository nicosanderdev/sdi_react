export type LocalizedLanguage = 'en' | 'es' | 'pt';

export const LOCALIZED_LANGUAGES: LocalizedLanguage[] = ['es', 'en', 'pt'];

export const LOCALIZED_LANGUAGE_LABELS: Record<LocalizedLanguage, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
};

export type LocalizedTextByLanguage = Partial<Record<LocalizedLanguage, string>>;

function localizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function pruneLocalizedText(text?: LocalizedTextByLanguage): LocalizedTextByLanguage {
  if (!text || typeof text !== 'object') return {};
  const out: LocalizedTextByLanguage = {};
  for (const lang of LOCALIZED_LANGUAGES) {
    const v = localizedString(text[lang]);
    if (v) out[lang] = v;
  }
  return out;
}

export function hasLocalizedText(text?: LocalizedTextByLanguage): boolean {
  if (!text || typeof text !== 'object') return false;
  return LOCALIZED_LANGUAGES.some(lang => !!localizedString(text[lang]));
}

export function pickLocalizedText(
  text: LocalizedTextByLanguage | undefined,
  preferredLocale?: string
): string | undefined {
  if (!text || typeof text !== 'object') return undefined;
  const pref = preferredLocale?.toLowerCase().slice(0, 2) as LocalizedLanguage | undefined;
  const order: LocalizedLanguage[] = [];
  if (pref && LOCALIZED_LANGUAGES.includes(pref)) order.push(pref);
  for (const lang of LOCALIZED_LANGUAGES) {
    if (!order.includes(lang)) order.push(lang);
  }
  for (const lang of order) {
    const v = localizedString(text[lang]);
    if (v) return v;
  }
  return undefined;
}

export function interpolateLocalizedText(
  text: LocalizedTextByLanguage | undefined,
  slots?: Record<string, string>
): LocalizedTextByLanguage {
  const pruned = pruneLocalizedText(text);
  if (!slots || Object.keys(slots).length === 0) return pruned;
  const out: LocalizedTextByLanguage = {};
  for (const lang of LOCALIZED_LANGUAGES) {
    const original = pruned[lang];
    if (!original) continue;
    let next = original;
    for (const [key, value] of Object.entries(slots)) {
      next = next.split(`{${key}}`).join(value ?? '');
    }
    out[lang] = next;
  }
  return pruneLocalizedText(out);
}
