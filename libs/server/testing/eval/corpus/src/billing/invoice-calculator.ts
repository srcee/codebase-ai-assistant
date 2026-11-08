import { vatRateForCountry } from './tax-rules';

export interface InvoiceLine {
  sku: string;
  unitPriceCents: number;
  quantity: number;
}

export interface Invoice {
  lines: InvoiceLine[];
  countryCode: string;
  discountCode?: string;
}

const DISCOUNT_CODES: Record<string, number> = {
  WELCOME10: 0.1,
  SPRING25: 0.25,
};

/** Adds up the lines, subtracts any discount and applies the VAT of the customer's country. */
export function computeInvoiceTotal(invoice: Invoice): number {
  const subtotal = invoice.lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );
  const discounted = subtotal - applyDiscountCode(subtotal, invoice.discountCode);
  const vat = discounted * vatRateForCountry(invoice.countryCode);
  return roundToCents(discounted + vat);
}

export function applyDiscountCode(subtotal: number, code?: string): number {
  if (!code) return 0;
  const rate = DISCOUNT_CODES[code.toUpperCase()];
  if (rate === undefined) throw new Error(`Unknown discount code ${code}`);
  return roundToCents(subtotal * rate);
}

export function roundToCents(amount: number): number {
  return Math.round(amount);
}
