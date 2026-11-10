type RegionNames = { of(code: string): string | undefined };
const namesByLocale = new Map<string, RegionNames | undefined>();

// Display only: keep country codes and unknown backend/map names unchanged in data.
export function getCountryName(code: string, fallbackName = code, locale = 'en-US'): string {
  if (code === '__') return $localize`:@@netquery.location.anycast:Anycast`;
  if (!/^[A-Z]{2}$/.test(code) || code === 'ZZ') return fallbackName;

  locale = $localize.locale || locale;
  if (!namesByLocale.has(locale)) {
    const DisplayNames = (Intl as unknown as {
      DisplayNames?: new (locales: string[], options: { type: 'region'; fallback: 'none' }) => RegionNames;
    }).DisplayNames;
    try {
      namesByLocale.set(locale, DisplayNames ? new DisplayNames([locale], { type: 'region', fallback: 'none' }) : undefined);
    } catch {
      namesByLocale.set(locale, undefined);
    }
  }
  return namesByLocale.get(locale)?.of(code) ?? fallbackName;
}
