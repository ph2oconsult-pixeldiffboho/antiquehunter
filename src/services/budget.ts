// Budget helpers shared by the hunt sources (pure, unit-tested).

// Approximate rates, ONLY used to compare an estimate with the user's budget (never shown).
export const APPROX_EUR: Record<string, number> = { EUR: 1, SEK: 0.088, DKK: 0.134, NOK: 0.086, GBP: 1.17, USD: 0.92, CHF: 1.07 };

const budgetNumbers = (priceRange?: string): number[] => {
  const nums = String(priceRange || '').replace(/(\d)[\s\u00a0.,](?=\d{3}\b)/g, '$1').match(/\d+(?:[.,]\d+)?/g);
  if (!nums) return [];
  return nums.map(n => Number(n.replace(',', '.'))).filter(n => n > 0);
};

/** Upper end of the typed budget ("2000 EUR", "500 – 2000 EUR"), in the user's currency. */
export const budgetMax = (priceRange?: string): number | null => {
  const vals = budgetNumbers(priceRange);
  return vals.length ? Math.max(...vals) : null;
};

/** Lower end of the budget when a range was typed ("250 - 500 EUR" -> 250); null for a single figure. */
export const budgetMin = (priceRange?: string): number | null => {
  const vals = budgetNumbers(priceRange);
  return vals.length >= 2 ? Math.min(...vals) : null;
};

/** Convert an amount between currencies with the approximate table (null when a currency is unknown). */
export const convertApprox = (amount: number, from: string | undefined, to: string | undefined): number | null => {
  const a = APPROX_EUR[String(from || 'EUR').toUpperCase()];
  const b = APPROX_EUR[String(to || 'EUR').toUpperCase()];
  if (!a || !b) return null;
  return (amount * a) / b;
};

export const withinBudget = (estimateLow: number | undefined, estCurrency: string | undefined, maxBudget: number | null, budgetCurrency = 'EUR'): boolean => {
  if (!maxBudget || !estimateLow) return true;
  const a = APPROX_EUR[String(estCurrency || '').toUpperCase()];
  const b = APPROX_EUR[String(budgetCurrency || '').toUpperCase()];
  if (!a || !b) return true;
  return estimateLow * a <= maxBudget * b * 1.1;
};

/** Buyer's premium assumed for the budget check when a sale does not publish it (typical French sale, incl. VAT). */
export const DEFAULT_PREMIUM_PCT = 28;

/** All-in cost = hammer × (1 + premium). */
export const allIn = (amount: number, premiumPct: number) => Math.round(amount * (1 + premiumPct / 100));
