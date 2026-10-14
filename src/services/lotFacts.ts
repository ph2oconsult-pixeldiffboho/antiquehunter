// Pure lot-facts shape + prompt formatting. No network/Node imports, so this is safe to import
// from client code (the appraisal prompt builder in gemini.ts) without pulling the server-only
// fetch chain (fetchSource -> ssrfGuard -> node:dns) into the browser bundle.

export interface LotFacts {
  ok: boolean;
  url: string;
  site: 'drouot' | 'auctionet' | 'interencheres' | 'other';
  title?: string;
  description?: string;
  estimateLow?: number;
  estimateHigh?: number;
  currency?: string;
  premiumPct?: number;
  saleDate?: string;      // ISO
  house?: string;
  city?: string;
  imageUrls: string[];
  /** Photos as data URLs (JPEG), read on the server so the browser does not hit cross-origin limits */
  images?: string[];
  /** The sale has ended (the result is NOT returned) */
  ended?: boolean;
  error?: string;
}

/** The lot facts as prompt text. Only what was read; says so when the estimate is missing. */
export const lotFactsPrompt = (f: LotFacts | null | undefined, fmt: (n: number, cur: string) => string = (n, c) => `${Math.round(n)} ${c}`): string => {
  if (!f) return '';
  if (!f.ok) return `LOT LINK: ${f.url}\nThe lot page could NOT be read. You have NOT seen its catalogue, estimate or photos: do not mention, guess or "anchor to" any catalogue estimate for this lot.`;
  const est = f.estimateLow || f.estimateHigh
    ? `${fmt(f.estimateLow || f.estimateHigh!, f.currency || 'EUR')}${f.estimateHigh && f.estimateLow && f.estimateHigh !== f.estimateLow ? ` – ${fmt(f.estimateHigh, f.currency || 'EUR')}` : ''} (hammer, before fees)`
    : 'none published on the page';
  return [
    `LOT LINK (read from the auction site): ${f.url}`,
    f.house || f.city ? `Auction house: ${[f.house, f.city].filter(Boolean).join(', ')}` : '',
    f.title ? `Catalogue title: ${f.title}` : '',
    f.description ? `Catalogue description: ${f.description}` : '',
    `Auction house estimate: ${est}`,
    f.premiumPct ? `Buyer's premium published by the sale: ${f.premiumPct}%` : '',
    f.ended ? 'This sale has ended (the result is not given to you).' : '',
    f.images?.length ? `${f.images.length} catalogue photo(s) from the lot page are attached.` : '',
  ].filter(Boolean).join('\n');
};
