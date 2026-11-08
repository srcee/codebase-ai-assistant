const FORMATTERS = new Map();

/** Shows an amount in cents as a localised currency string, for example 1250 as 12,50 EUR. */
export function formatPrice(cents, currency = 'EUR', locale = 'de-DE') {
  const key = `${locale}:${currency}`;
  if (!FORMATTERS.has(key)) {
    FORMATTERS.set(key, new Intl.NumberFormat(locale, { style: 'currency', currency }));
  }
  return FORMATTERS.get(key).format(cents / 100);
}
