// Build src/data/soldComparables.json (fix 4) from harvested sold-lot results.
// Usage: npx tsx scripts/build-comparables.ts --exclude exclude.json <drouot_or_auctionet_json>...
//  - Drouot harvest files: { id: { id, description, result, low, high, currency, city, house, date, url } }
//  - Auctionet files: { id: { id, title, description, currency, estimate, upper_estimate, bids:[{amount}], state, ends_at, house, location, url } }
//  - exclude.json: { ids: ["drouot-…"], sales: [["house", "YYYY-MM-DD"]] } – the accuracy-test lots and their sales are kept out,
//    so the test never sees itself (or a sister lot of the same sale) as a comparable.
import { readFileSync, writeFileSync } from "node:fs";
import { featuresOf, type SoldComparable } from "../src/services/comparables.ts";
import { regionsInLocation } from "../src/services/huntGeo.ts";

// ECB reference rates, 8 Oct 2026 (approximate is fine for comparables)
const TO_EUR: Record<string, number> = { EUR: 1, GBP: 1 / 0.84698, SEK: 1 / 11.194, DKK: 1 / 7.4638, NOK: 1 / 11.72, CHF: 1 / 0.9355, USD: 1 / 1.1702 };
const args = process.argv.slice(2);
const exIdx = args.indexOf("--exclude");
const exclude = exIdx >= 0 ? JSON.parse(readFileSync(args[exIdx + 1], "utf8")) : { ids: [], sales: [] };
const files = args.filter((_, i) => i !== exIdx && i !== exIdx + 1);
const exIds = new Set<string>(exclude.ids);
const exSales = new Set<string>((exclude.sales as string[][]).map(([h, d]) => `${h}|${d}`));

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
    if (exSales.has(`${house}|${date}`)) { skipped.sameSale++; continue; }
    if (isAuctionet && r.category_id != null && !AUCTIONET_FURNITURE.has(Number(r.category_id))) { skipped.noType++; continue; }
    const fullText = isAuctionet ? `${strip(r.title)} ${strip(r.description)}` : String(r.description || "");
    const title = short(isAuctionet ? strip(r.title).replace(/\.\.$/, ".") : firstPart(String(r.description || "")));
    const place = isAuctionet ? (r.location || "") : (r.city || "");
    const region: SoldComparable["region"] = isAuctionet
      ? (cur === "SEK" ? "Sweden" : cur === "GBP" ? "United Kingdom" : "Europe")
      : (() => { const g = regionsInLocation(place); return g.has("France") || g.size === 0 ? (g.size === 0 ? "France" : "France") : (g.has("United Kingdom") ? "United Kingdom" : "Europe"); })();
    const feat = featuresOf(fullText.slice(0, 600), region);
    if (!feat.type) { skipped.noType++; continue; }
    if (!["commode", "dresser", "cabinet", "desk", "mirror", "console", "table"].includes(feat.type)) { skipped.noType++; continue; }
    const low = isAuctionet ? Number(r.estimate) : Number(r.low);
    const high = isAuctionet ? Number(r.upper_estimate || r.estimate) : Number(r.high);
    out.set(id, {
      id, url: String(r.url || ""), title, hammer: Math.round(hammerRaw * fx),
      ...(low > 0 ? { estLow: Math.round(low * fx), estHigh: Math.round((high > 0 ? high : low) * fx) } : {}),
      date, house: house || undefined, place: place || undefined, region, type: feat.type,
      ...(feat.style ? { style: feat.style } : {}), later: feat.later, century: feat.century, stamped: feat.stamped, mats: feat.mats,
    });
  }
}
const list = Array.from(out.values()).sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(new URL("../src/data/soldComparables.json", import.meta.url), JSON.stringify(list));
const by = (k: keyof SoldComparable) => list.reduce((m: Record<string, number>, c) => { const v = String(c[k]); m[v] = (m[v] || 0) + 1; return m; }, {});
console.log(list.length, "comparables", JSON.stringify(skipped), JSON.stringify(by("type")), JSON.stringify(by("region")));
