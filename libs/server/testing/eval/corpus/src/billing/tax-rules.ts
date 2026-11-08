const EU_VAT_RATES: Record<string, number> = {
  DE: 0.19,
  FR: 0.2,
  ES: 0.21,
  NL: 0.21,
  BG: 0.2,
};

const REDUCED_RATE_CATEGORIES = new Set(['books', 'food', 'medicine']);

/** Standard VAT rate for the customer's country; sales outside the EU carry none. */
export function vatRateForCountry(countryCode: string): number {
  const code = countryCode.toUpperCase();
  if (code === 'US' || code === 'CA') return 0;
  const rate = EU_VAT_RATES[code];
  if (rate === undefined) {
    throw new Error(`Unsupported tax country: ${countryCode}`);
  }
  return rate;
}

export function isReducedRateCategory(category: string): boolean {
  return REDUCED_RATE_CATEGORIES.has(category.toLowerCase());
}
