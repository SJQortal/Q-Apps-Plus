/**
 * The languages a seller answers in (Simon, 2026-10-25: a marketplace "for
 * anyone and everyone"): a buyer abroad sees whether they can talk to the
 * shop before ordering. In the shop's JSON as `languages: [code…]`
 * (additive; ISO 639-1 codes of the list below), shown in their own names.
 */
export const LANGUAGES: readonly { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "nl", name: "Nederlands" },
  { code: "pl", name: "Polski" },
  { code: "cs", name: "Čeština" },
  { code: "sk", name: "Slovenčina" },
  { code: "hu", name: "Magyar" },
  { code: "ro", name: "Română" },
  { code: "bg", name: "Български" },
  { code: "el", name: "Ελληνικά" },
  { code: "sv", name: "Svenska" },
  { code: "no", name: "Norsk" },
  { code: "da", name: "Dansk" },
  { code: "fi", name: "Suomi" },
  { code: "is", name: "Íslenska" },
  { code: "et", name: "Eesti" },
  { code: "lv", name: "Latviešu" },
  { code: "lt", name: "Lietuvių" },
  { code: "uk", name: "Українська" },
  { code: "ru", name: "Русский" },
  { code: "tr", name: "Türkçe" },
  { code: "ar", name: "العربية" },
  { code: "he", name: "עברית" },
  { code: "fa", name: "فارسی" },
  { code: "hi", name: "हिन्दी" },
  { code: "bn", name: "বাংলা" },
  { code: "ur", name: "اردو" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "ms", name: "Bahasa Melayu" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "th", name: "ไทย" },
  { code: "tl", name: "Filipino" },
  { code: "sw", name: "Kiswahili" },
];

export const MAX_LANGUAGES = 8;
const NAMES = new Map(LANGUAGES.map((l) => [l.code, l.name]));

/** The shop's languages, known codes only, each once, in its order. */
export function languagesOf(shop: { languages?: unknown } | null | undefined): string[] {
  const raw = shop?.languages;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((c): c is string => typeof c === "string" && NAMES.has(c)))].slice(0, MAX_LANGUAGES);
}

export function languageName(code: string): string {
  return NAMES.get(code) ?? code;
}

/** "English, Português and Deutsch". */
export function languagesText(codes: readonly string[]): string {
  const names = codes.map(languageName);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
