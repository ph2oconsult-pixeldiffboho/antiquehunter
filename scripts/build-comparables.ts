// Build src/data/soldComparables.json (fix 4) from harvested sold-lot results.
// Usage: npx tsx scripts/build-comparables.ts --exclude exclude.json <drouot_or_auctionet_json>...
//  - Drouot harvest files: { id: { id, description, result, low, high, currency, city, house, date, url } }
//  - Auctionet files: { id: { id, title, description, currency, estimate, upper_estimate, bids:[{amount}], state, ends_at, house, location, url } }
//  - exclude.json: { ids: ["drouot-…"], sales: [["house", "YYYY-MM-DD"]], drouot_sale_ids: ["182146"] } – the accuracy-test lots and their sales are kept out,
//    so the test never sees itself (or a sister lot of the same sale) as a comparable.
import { readFileSync, writeFileSync } from "node:fs";
import { featuresOf, NOT_FURNITURE_RE, type SoldComparable } from "../src/services/comparables.ts";
import { headType } from "../src/services/pieceWords.ts";
import { regionsInLocation } from "../src/services/huntGeo.ts";

// ECB reference rates, 8 Oct 2026 (approximate is fine for comparables)
const TO_EUR: Record<string, number> = { EUR: 1, GBP: 1 / 0.84698, SEK: 1 / 11.194, DKK: 1 / 7.4638, NOK: 1 / 11.72, CHF: 1 / 0.9355, USD: 1 / 1.1702 };
const args = process.argv.slice(2);
// --exclude may be given several times (old and new test lots); the lists are merged
const exclude = { ids: [] as string[], sales: [] as string[][], drouot_sale_ids: [] as string[] };
const files: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--exclude") {
    const e = JSON.parse(readFileSync(args[++i], "utf8"));
    exclude.ids.push(...(e.ids || [])); exclude.sales.push(...(e.sales || [])); exclude.drouot_sale_ids.push(...(e.drouot_sale_ids || []));
  } else files.push(args[i]);
}
const exIds = new Set<string>(exclude.ids);
const exSales = new Set<string>((exclude.sales as string[][]).map(([h, d]) => `${h}|${d}`));
const exSaleIds = new Set<string>((exclude.drouot_sale_ids || []).map(String));

// Auctionet categories that hold furniture and mirrors (others: clarinets "Buffet Crampon", lamps, books…)
const AUCTIONET_FURNITURE = new Set([17, 18, 19, 20, 22, 23, 24, 42, 47, 122, 279]);
const day = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
const strip = (s: unknown) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const firstPart = (s: string) => s.split(/\n/)[0].replace(/\s+/g, " ").trim();
const short = (s: string, n = 150) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

const out = new Map<string, SoldComparable>();
let skipped = { excluded: 0, sameSale: 0, noType: 0, noPrice: 0 };
for (const f of files) {
  const data = JSON.parse(readFileSync(f, "utf8"));
  for (const r of Object.values<any>(data)) {
    const isAuctionet = "bids" in r || /auctionet\.com/.test(String(r.url || ""));
    const id = `${isAuctionet ? "auctionet" : "drouot"}-${r.id}`;
    if (out.has(id)) continue;
    const cur = String(r.currency || "EUR");
    const fx = TO_EUR[cur];
    const hammerRaw = isAuctionet ? (r.state === "sold" ? Number(r.bids?.[0]?.amount) : 0) : Number(r.result);
    if (!fx || !(hammerRaw > 0)) { skipped.noPrice++; continue; }
    const date = day(isAuctionet ? r.ends_at : r.date);
    const house = String(r.house || "").trim();
    if (exIds.has(id)) { skipped.excluded++; continue; }
    if (exSales.has(`${house}|${date}`) || (!isAuctionet && r.saleId != null && exSaleIds.has(String(Math.round(Number(r.saleId)))))) { skipped.sameSale++; continue; }
    if (!isAuctionet && !(Number(r.date) > 0)) { skipped.noPrice++; continue; } // undated Drouot lot: cannot be checked against the test sales
    if (isAuctionet && r.category_id != null && !AUCTIONET_FURNITURE.has(Number(r.category_id))) { skipped.noType++; continue; }
    const fullText = isAuctionet ? `${strip(r.title)} ${strip(r.description)}` : String(r.description || "");
    const title = short(isAuctionet ? strip(r.title).replace(/\.\.$/, ".") : firstPart(String(r.description || "")));
    const place = isAuctionet ? (r.location || "") : (r.city || "");
    const region: SoldComparable["region"] = isAuctionet
      ? (cur === "SEK" ? "Sweden" : cur === "GBP" ? "United Kingdom" : "Europe")
      : (() => { const g = regionsInLocation(place); return g.has("France") || g.size === 0 ? (g.size === 0 ? "France" : "France") : (g.has("United Kingdom") ? "United Kingdom" : "Europe"); })();
    const feat = featuresOf(fullText.slice(0, 600), region);
    if (!feat.type) { skipped.noType++; continue; }
    // "Service à glace en argent", "Bracelet semainier en or", paintings, books: not furniture although a furniture word appears
    // the piece word must head the entry (not "Six poignées et trois entrées de serrure … de commode"), no hardware/parts lots, no artworks
    const head = isAuctionet ? strip(r.title) : firstPart(String(r.description || ""));
    if (headType(head.slice(0, 120)) !== feat.type) { skipped.noType++; continue; }
    if (/(poign[ée]es|entr[ée]es de serrure|[ée]l[ée]ments? de|fragments?|pi[eè]ces d[e']|lot de|ensemble de|parts? of|handles|\(\d{4}\s*-\s*\d{4}\))/i.test(head.slice(0, 80))) { skipped.noType++; continue; }
    if (NOT_FURNITURE_RE.test((isAuctionet ? strip(r.title) : firstPart(String(r.description || ""))).slice(0, 90))) { skipped.noType++; continue; }
    if (!["commode", "dresser", "cabinet", "desk", "mirror", "console", "table"].includes(feat.type)) { skipped.noType++; continue; }
    const low = isAuctionet ? Number(r.estimate) : Number(r.low);
    const high = isAuctionet ? Number(r.upper_estimate || r.estimate) : Number(r.high);
    out.set(id, {
      id, url: String(r.url || ""), title, hammer: Math.round(hammerRaw * fx),
      ...(low > 0 ? { estLow: Math.round(low * fx), estHigh: Math.round((high > 0 ? high : low) * fx) } : {}),
      date, house: house || undefined, place: place || undefined, region, type: feat.type,
      ...(feat.style ? { style: feat.style } : {}), later: feat.later, century: feat.century, stamped: feat.stamped, mats: feat.mats,
      ...(feat.size ? { size: feat.size } : {}),
    });
  }
}
const list = Array.from(out.values()).sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(new URL("../src/data/soldComparables.json", import.meta.url), JSON.stringify(list));
const by = (k: keyof SoldComparable) => list.reduce((m: Record<string, number>, c) => { const v = String(c[k]); m[v] = (m[v] || 0) + 1; return m; }, {});
console.log(list.length, "comparables", JSON.stringify(skipped), JSON.stringify(by("type")), JSON.stringify(by("region")));
