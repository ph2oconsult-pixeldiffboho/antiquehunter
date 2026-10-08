// One shared currency setting for the whole app (appraisal form, Settings, Find Me an Antique).
// Default is EUR for everyone. Only an explicit choice by the user is stored.
//
// Older builds wrote 'user_currency' automatically from the browser locale (en-US -> USD, en-GB -> GBP)
// and kept a separate 'hunt_currency', so those keys cannot be trusted as a user choice and are ignored.

export const SUPPORTED_CURRENCIES = ['EUR', 'GBP', 'USD', 'SEK', 'AUD', 'CNY', 'JPY'] as const;
export const DEFAULT_CURRENCY = 'EUR';
export const CURRENCY_STORAGE_KEY = 'ah_currency_v2';
const LEGACY_KEYS = ['user_currency', 'hunt_currency'];

export const isSupportedCurrency = (c: unknown): c is string =>
  typeof c === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(c);

export const loadCurrency = (storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): string => {
  try {
    const saved = storage?.getItem(CURRENCY_STORAGE_KEY);
    if (isSupportedCurrency(saved)) return saved;
  } catch { /* storage blocked */ }
  return DEFAULT_CURRENCY;
};

export const saveCurrency = (currency: string, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null) => {
  if (!isSupportedCurrency(currency)) return;
  try {
    storage?.setItem(CURRENCY_STORAGE_KEY, currency);
    for (const k of LEGACY_KEYS) storage?.removeItem(k);
  } catch { /* storage blocked */ }
};

export const currencySymbol = (c: string): string =>
  ({ EUR: '€', GBP: '£', USD: '$', SEK: 'kr', AUD: 'A$', CNY: '¥', JPY: '¥' } as Record<string, string>)[c] || c;
