// Stable ranges for repeat runs. Diagnosis (14 Oct 2026, n=8 identical text-only runs): the primary model at
// temperature 0 + fixed seed returned the same range every time (€200–€600 auction, €500–€1,200 dealer); the spread
// came from the fallback model (served when the primary is busy), which priced the same piece €400–€900 / €1,000–€2,500.
// The venue and the asking price are also in the prompt and move the model's numbers.
// Fix: the model's range is keyed on the PIECE (text, photos, category, currency, location, lot link), not on the venue,
// asking price, motivation or budget, and the first answer from the primary model is reused for repeat runs. A fallback
// answer is used only while no primary answer is known, and is replaced by the next primary answer.
export interface CachedRange { low: number; high: number; fair_low: number; fair_high: number; model: string; primary: boolean; ts: number }
export interface RangeStore { get(k: string): string | null; set(k: string, v: string): void }
export const RANGE_TTL_MS = 30 * 24 * 3600 * 1000;
const PREFIX = 'ah_range_v1:';

/** Key version: v2 drops category and location (they made the same piece hash differently across devices). Old v1
 *  entries are simply never looked up again and expire (device 30 days, shared store 90 days). */
export const PIECE_KEY_VERSION = 'v2';
/** Text as the piece is described: case, accents, punctuation and whitespace do not matter. */
export const normPieceText = (s?: string) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * FNV-1a 32-bit over what describes the piece and what changes its price figures:
 *  - the description text (normalised) and the photos (length + sampled characters, so large photos stay cheap);
 *  - the currency (the stored figures are in it).
 * Not in the key: the category dropdown (same piece whether it is set to Furniture or left on Unknown), the typed
 * location (free text, and the app's range is an auction-level range, not a regional one), the venue, the asking
 * price, motivation and budget (the app derives those from the range). Lot links never use the store.
 */
export const pieceKey = (i: { text?: string; images?: string[]; category?: string; currency?: string; location?: string; lotUrl?: string }): string => {
  const img = (i.images || []).map(x => { const s = String(x || ''); let h = s.length.toString(36); for (let k = 0; k < s.length; k += Math.max(1, Math.floor(s.length / 64))) h += s[k]; return h; }).join('|');
  const src = [PIECE_KEY_VERSION, normPieceText(i.text), img, String(i.currency || '').trim().toUpperCase()].join('\u0001');
  let h = 0x811c9dc5;
  for (let k = 0; k < src.length; k++) { h ^= src.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
};

export const browserStore = (): RangeStore | null => {
  try { if (typeof localStorage === 'undefined') return null; return { get: k => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v) }; } catch { return null; }
};

/**
 * Returns the range to use for this piece: the cached primary answer when there is one (and fresh), else this answer.
 * Stores this answer when it is from the primary model, or when nothing is cached yet.
 */
export const stableRange = (store: RangeStore | null, key: string, fresh: Omit<CachedRange, 'ts'>, now = Date.now()): { range: CachedRange; reused: boolean } => {
  const cur: CachedRange = { ...fresh, ts: now };
  if (!store || !(fresh.high > 0)) return { range: cur, reused: false };
  let old: CachedRange | null = null;
  try { const raw = store.get(PREFIX + key); old = raw ? JSON.parse(raw) : null; } catch { old = null; }
  if (old && (now - old.ts > RANGE_TTL_MS || !(old.high > 0))) old = null;
  if (old && (old.primary || !fresh.primary)) return { range: old, reused: true };
  try { store.set(PREFIX + key, JSON.stringify(cur)); } catch { /* storage full: no caching */ }
  return { range: cur, reused: false };
};
