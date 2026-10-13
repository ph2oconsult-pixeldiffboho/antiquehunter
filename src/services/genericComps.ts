// No-maker comparables: the request built from piece type, period / style, material and region, and the client call.
// Why this lives outside gemini.ts: gemini.ts only asks /api/comps when a maker is named (gemini.ts:279-282, 469-472)
// and is on the security hold list. The app passes this lookup in through AppraisalExtra.comps instead.
import { countPieces, detectMaker, fold, materialOf, pieceOf } from "./makers";
import type { CompsResponse } from "./compsMath";

export interface GenericCompsRequest {
  maker: ''; generic: true; piece: string; period?: string; material?: string; region?: string; pieces: number; language: string;
}

const PERIODS: Array<[RegExp, string]> = [
  [/\blouis[\s-]*xiv\b/, 'Louis XIV'], [/\bregence\b/, 'Régence'], [/\btransition\b/, 'Transition'],
  [/\blouis[\s-]*xvi\b/, 'Louis XVI'], [/\blouis[\s-]*xv\b/, 'Louis XV'], [/\bdirectoire\b/, 'Directoire'],
  [/\bconsulat\b/, 'Consulat'], [/\bcharles[\s-]*x\b/, 'Charles X'], [/\brestauration\b|\brestoration\b/, 'Restauration'],
  [/\blouis[\s-]*philippe\b/, 'Louis-Philippe'], [/\bnapoleon[\s-]*iii\b|\bsecond\s+empire\b/, 'Napoléon III'], [/\bempire\b/, 'Empire'],
  [/\bgustavian\w*\b|\bgustaviansk\w*/, 'Gustavian'], [/\bgeorge\s+(i|ii|iii|iv)\b|\bgeorgian\b/, 'Georgian'],
  [/\bregency\b/, 'Regency'], [/\bvictorian\b/, 'Victorian'],
  [/\b(xviii\s*e?|18th|18e|dix-huitieme)\b/, '18th century'], [/\b(xix\s*e?|19th|19e|dix-neuvieme)\b/, '19th century'],
];
const REGIONS: Array<[RegExp, string]> = [
  [/\bprovencal\w*|\bprovence\b|\barlesien\w*/, 'Provence'], [/\bnormand\w*|\bnormandie\b|\bnormandy\b/, 'Normandy'],
  [/\bbreton\w*|\bbretagne\b|\bbrittany\b/, 'Brittany'], [/\blyonnais\w*|\blyon\b/, 'Lyon'], [/\bbordelais\w*|\bbordeaux\b/, 'Bordeaux'],
  [/\balsacien\w*|\balsace\b/, 'Alsace'], [/\bdauphinois\w*|\bgrenoble\b|\bdauphine\b/, 'Dauphiné'], [/\bbourguignon\w*|\bbourgogne\b|\bburgund\w*/, 'Burgundy'],
  [/\bparisien\w*|\bparis\b/, 'Paris'], [/\bswedish\b|\bsuedois\w*|\bsverige\b/, 'Sweden'], [/\benglish\b|\banglais\w*\b|\bengland\b/, 'England'],
];

export const periodOf = (text: string): string | undefined => { const t = fold(text); for (const [re, p] of PERIODS) if (re.test(t)) return p; return undefined; };
export const regionOf = (text: string): string | undefined => { const t = fold(text); for (const [re, r] of REGIONS) if (re.test(t)) return r; return undefined; };

/** null when a maker is named (the maker search runs instead) or the kind of piece is unknown (nothing to match on). */
export const genericCompsRequestFor = (text: string, category: string | undefined, location: string | undefined, language: string): GenericCompsRequest | null => {
  if (detectMaker(text)) return null;
  const piece = pieceOf(text, category);
  if (!piece) return null;
  return {
    maker: '', generic: true, piece: piece.key, period: periodOf(text), material: materialOf(text),
    region: regionOf(text) || regionOf(location || ''), pieces: countPieces(text), language,
  };
};

export const GENERIC_COMPS_CLIENT_TIMEOUT_MS = 50_000;

export const fetchGenericComps = async (req: GenericCompsRequest, f: typeof fetch = fetch): Promise<CompsResponse | null> => {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), GENERIC_COMPS_CLIENT_TIMEOUT_MS);
  try {
    const res = await f('/api/comps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal: c.signal });
    if (!res.ok) return null;
    const j = await res.json();
    return j && Array.isArray(j.comparables) ? { ...j, generic: true } as CompsResponse : null;
  } catch { return null; } finally { clearTimeout(timer); }
};
