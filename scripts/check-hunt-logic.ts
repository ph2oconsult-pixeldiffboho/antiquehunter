// Quick self-checks for the hunt URL filters and appraisal maths.
// Run: npx tsx scripts/check-hunt-logic.ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  allowedDomainsFor, cleanText, failsPeriodRule, isAllowedHost, isGenericUrl, isSpecificListingUrl, parsePage,
} from "../src/services/huntValidation.ts";
import {
  alignProseRanges, allInCost, basisFromScore, clampToBand, decideBuy, maxHammerForMarketHigh, priceBandScore,
  reconcileNegotiation, sanitizeDeep, sanitizeProse,
} from "../src/services/appraisalMath.ts";
import { CURRENCY_STORAGE_KEY, loadCurrency, saveCurrency } from "../src/services/currencyPref.ts";
import { UNVERIFIED_PRICE, validateMatch, GEMINI_TIMEOUT_MS, VALIDATION_BUDGET_MS, FUNCTION_BUDGET_MS } from "../src/services/hunting.ts";
import { analysisItems } from "../src/services/localFinds.ts";

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed++; console.log("ok -", name); };

check("generic pages are rejected", () => {
  for (const u of [
    "https://www.leboncoin.fr/ck/ameublement/commode-transition",
    "https://www.leboncoin.fr/recherche?text=commode",
    "https://www.ebay.fr/b/Commodes-et-chiffonniers/114162/bn_59826481",
    "https://www.ebay.co.uk/sch/i.html?_nkw=commode",
    "https://www.drouot.com/en/search?query=commode",
    "https://www.interencheres.com/meubles-objets-art?search=commode",
    "https://www.example.com/category/commodes",
  ]) assert.equal(isGenericUrl(u), true, u);
});

check("specific listing urls are recognised", () => {
  for (const u of [
    "https://www.interencheres.com/art-decoration/belle-vente-mobiliere-685868/lot-89099730.html",
    "https://drouot.com/fr/l/35030886",
    "https://www.drouot.com/fr/l/35030886-petite-commode",
    "https://www.leboncoin.fr/ad/ameublement/2845123456",
    "https://www.leboncoin.fr/ameublement/2845123456.htm",
    "https://www.ebay.fr/itm/123456789012",
    "https://auctionet.com/en/4123456-a-gustavian-commode",
    "https://www.bukowskis.com/en/lots/1234567-byra",
    "https://www.bukowskis.com/sv/auctions/583/1347-byra-gustavianskt-stockholmsarbete-1700-talets-slut",
    "https://onlineonly.christies.com/s/irene-roosevelt-aitken-love-18th-century/george-i-oak-console-table-641/286363",
  ]) assert.equal(isSpecificListingUrl(u), true, u);
  assert.equal(isSpecificListingUrl("https://www.interencheres.com/art-decoration/belle-vente-mobiliere-685868"), false);
  assert.equal(isSpecificListingUrl("https://www.selency.fr/p/8G7ZRWYD/commode"), false);
});

check("platform filter maps names to domains", () => {
  const allowed = allowedDomainsFor(["Interencheres", "LeBonCoin", "eBay"]);
  assert.equal(isAllowedHost("https://www.interencheres.com/x/lot-1.html", allowed), true);
  assert.equal(isAllowedHost("https://www.ebay.co.uk/itm/1", allowed), true);
  assert.equal(isAllowedHost("https://www.selency.fr/p/X/y", allowed), false);
  assert.equal(isAllowedHost("https://drouot.com/fr/l/1", allowed), false);
  assert.equal(isAllowedHost("https://auctionet.com/en/1-x", allowedDomainsFor(["Auctionet"])), true);
});

check("period rule", () => {
  assert.ok(failsPeriodRule("Commode de style gustavien avec décor en marqueterie"));
  assert.ok(failsPeriodRule("Commode Louis XV, XXe siècle"));
  assert.ok(failsPeriodRule("Buffet, 20e siècle"));
  assert.ok(failsPeriodRule("Mid 20th century Swedish commode"));
  assert.ok(failsPeriodRule("Reproduction of a Louis XVI commode"));
  assert.ok(failsPeriodRule("Commode d'après Riesener"));
  assert.ok(failsPeriodRule("BYRÅ, gustaviansk stil, 1900-tal"));
  assert.ok(failsPeriodRule("Byrå, 1900-talets mitt"));
  assert.equal(failsPeriodRule("BYRÅ. Gustavianskt stockholmsarbete, 1700-talets slut."), null);
  assert.equal(failsPeriodRule("Commode d'époque Louis XV mouvementée sur trois faces"), null);
  assert.equal(failsPeriodRule("Buffet XIXème 2 corps en noyer"), null);
  assert.equal(failsPeriodRule("Commode gustavienne, vers 1790"), null);
});

check("text clean-up repairs corrupted accents and strips control chars", () => {
  assert.equal(cleanText("Commode de style gustavien avec d\tcor en marqueterie"), "Commode de style gustavien avec décor en marqueterie");
  assert.equal(cleanText("peints \u0000 partir de l'ann\te 1890"), "peints à partir de l'année 1890");
  assert.equal(cleanText("\u2001 1,200"), "€ 1,200");
  assert.equal(cleanText("abc\u0007def"), "abcdef");
});

check("buy score bands", () => {
  // market 700-900 (mid 800), retail high 2000
  const at = (p: number) => priceBandScore(p, 700, 900, 2000)!;
  assert.equal(at(350).basis, "strong_buy"); assert.ok(at(350).score >= 80 && at(350).score <= 95);
  assert.equal(at(700).basis, "strong_buy"); assert.equal(at(700).score, 80);
  assert.equal(at(750).basis, "good_buy"); assert.ok(at(750).score >= 65 && at(750).score <= 80);
  assert.equal(at(850).basis, "fair"); assert.ok(at(850).score >= 45 && at(850).score <= 65);
  assert.equal(at(900).basis, "fair"); assert.equal(at(900).score, 45);
  assert.equal(at(1000).basis, "overpriced"); assert.ok(at(1000).score < 35);
  assert.equal(at(2500).basis, "walk_away"); assert.ok(at(2500).score < 15);
  assert.ok(at(350).score > at(750).score && at(750).score > at(850).score && at(850).score > at(1000).score && at(1000).score > at(2500).score);
  assert.equal(priceBandScore(0, 700, 900, 2000), null);
  for (const sc of [95, 80, 79, 65, 64, 45, 44, 15, 14, 1]) assert.ok(basisFromScore(sc));
});

// The five live road-test appraisals (8 Oct 2026). Text-only, so the model typically sets a big risk_penalty
// ("cannot verify without photos"): that used to cap every score at 40 and show "Walk Away".
const roadTest = [
  { name: "auction EUR80, market 50-150, retail 200-400", in: { askingPrice: 80, isAuction: true, premiumPct: 25, marketLow: 50, marketHigh: 150, retailHigh: 400 },
    basis: ["good_buy"], min: 65, max: 80 },  // all-in 100 = market mid
  { name: "private GBP900, market 300-900, retail 800-1600", in: { askingPrice: 900, isAuction: false, premiumPct: 0, marketLow: 300, marketHigh: 900, retailHigh: 1600 },
    basis: ["fair"], min: 45, max: 60 },
  { name: "auction EUR2000, market 1200-2000, retail 2000-3500", in: { askingPrice: 2000, isAuction: true, premiumPct: 25, marketLow: 1200, marketHigh: 2000, retailHigh: 3500 },
    basis: ["overpriced"], min: 15, max: 34 }, // all-in 2500 > market high
  { name: "dealer EUR4500, market 2000-4000, retail 3500-5000", in: { askingPrice: 4500, isAuction: false, premiumPct: 0, marketLow: 2000, marketHigh: 4000, retailHigh: 5000 },
    basis: ["overpriced"], min: 15, max: 34 },
  { name: "1950s repro EUR600, market 80-350, retail 150-500", in: { askingPrice: 600, isAuction: false, premiumPct: 0, marketLow: 80, marketHigh: 350, retailHigh: 500 },
    basis: ["walk_away"], min: 1, max: 14 },
];
for (const tc of roadTest) {
  check(`road test: ${tc.name}`, () => {
    for (const riskPenalty of [0, -30, -40]) {
      const d = decideBuy({ ...tc.in, hasPhotos: false, riskPenalty, itemScore: 50 });
      assert.ok(tc.basis.includes(d.basis), `${tc.name} risk ${riskPenalty}: basis ${d.basis}`);
      assert.ok(d.score >= tc.min && d.score <= tc.max, `${tc.name} risk ${riskPenalty}: score ${d.score}`);
      // goal nudges (-5 / +5 / -3) can never move the score out of its band, so the label never flips
      for (const nudge of [-5, 5, -3]) {
        const adj = clampToBand(d.score + nudge, d.band);
        assert.ok(adj >= d.band.min && adj <= d.band.max);
      }
    }
  });
}

check("road test: verdict reasons follow the band (no 'at or above retail' for cheap items)", () => {
  const en = JSON.parse(readFileSync(new URL("../src/i18n/en.json", import.meta.url), "utf8"));
  const d = decideBuy({ ...roadTest[0].in, hasPhotos: false, riskPenalty: -30 });
  const reason = en.analysis[`reason_${d.basis}`] as string;
  assert.ok(!/retail/i.test(reason), reason);
  assert.equal(en.analysis[`verdict_${d.basis}`], "Good Buy");
  for (const b of ["strong_buy", "good_buy", "fair", "overpriced", "walk_away", "high_risk", "no_price"]) {
    assert.ok(en.analysis[`verdict_${b}`], b);
    assert.ok(en.analysis[`reason_${b}`], b);
  }
  assert.match(en.analysis.reason_walk_away, /retail/);
});

check("risk cap only applies when photos show the problem; no-price stays below Good buy", () => {
  const base = { askingPrice: 80, isAuction: true, premiumPct: 25, marketLow: 50, marketHigh: 150, retailHigh: 400 };
  assert.equal(decideBuy({ ...base, hasPhotos: true, riskPenalty: -30 }).basis, "high_risk");
  assert.equal(decideBuy({ ...base, hasPhotos: true, riskPenalty: -30 }).score, 40);
  assert.equal(decideBuy({ ...base, hasPhotos: true, riskPenalty: -10 }).basis, "good_buy");
  const np = decideBuy({ ...base, askingPrice: undefined, hasPhotos: false, itemScore: 95 });
  assert.equal(np.basis, "no_price"); assert.ok(np.score <= 60);
  assert.ok(decideBuy({ ...base, askingPrice: 0, hasPhotos: false, itemScore: 95, valueTier: "D" }).score <= 30);
});

check("smart buy / negotiation figures are consistent", () => {
  // private sale, market 300-900 (mid 600): smart buy within [300, 600]; opening <= smart <= walk-away <= 900
  const a = reconcileNegotiation({ good_buy_below: 200, opening_offer: 250, target_price_low: 100, target_price_high: 1200, walk_away_price: 1100 }, 300, 900, 0, false);
  assert.ok(a.good_buy_below >= 300 && a.good_buy_below <= 600, JSON.stringify(a));
  assert.ok(a.opening_offer <= a.good_buy_below && a.good_buy_below <= a.walk_away_price && a.walk_away_price <= 900, JSON.stringify(a));
  assert.ok(a.opening_offer <= a.target_price_low && a.target_price_low <= a.target_price_high && a.target_price_high <= a.walk_away_price, JSON.stringify(a));
  // auction, market 50-150, 25%: smart buy all-in within [50, 100]; walk-away all-in <= 150
  const b = reconcileNegotiation({ good_buy_below: 30, opening_offer: 60, walk_away_price: 150 }, 50, 150, 25, true);
  const allIn = (h: number) => allInCost(h, 25, true);
  assert.ok(allIn(b.good_buy_below) >= 50 && allIn(b.good_buy_below) <= 100, JSON.stringify(b));
  assert.ok(allIn(b.walk_away_price) <= 150, JSON.stringify(b));
  assert.ok(b.opening_offer <= b.good_buy_below && b.good_buy_below <= b.walk_away_price, JSON.stringify(b));
  // smart buy at its upper limit still scores as a good buy (or better)
  const c = reconcileNegotiation({ good_buy_below: 99999 }, 1200, 2000, 25, true);
  assert.ok(["strong_buy", "good_buy"].includes(priceBandScore(allIn(c.good_buy_below), 1200, 2000, 3500)!.basis), JSON.stringify(c));
});

check("raw JSON field names never reach the prose", () => {
  assert.equal(sanitizeProse("The 'fair_price' of €200-€400 reflects dealer retail."), "The fair retail price of €200-€400 reflects dealer retail.");
  assert.equal(sanitizeProse("Stay below the good_buy_below and never exceed walk_away_price."), "Stay below the smart-buy price and never exceed walk-away price.");
  assert.equal(sanitizeProse('Your "estimated_market_range_high" is the ceiling.'), "Your market range is the ceiling.");
  const deep = sanitizeDeep({ a: ["x fair_price_low y"], b: { c: "`overpaying_above`" }, n: 3 });
  assert.deepEqual(deep, { a: ["x fair retail price y"], b: { c: "overpaying threshold" }, n: 3 });
  assert.ok(!/\b[a-z]+_[a-z_]+\b/.test(sanitizeProse("The 'fair_price' and estimated_market_range_low.")));
});

check("restated ranges in prose match the cards", () => {
  const fmt = (n: number) => `€${n.toLocaleString("en")}`;
  const ranges = { market: [50, 150] as [number, number], retail: [200, 400] as [number, number] };
  assert.equal(alignProseRanges("The fair retail price of €250-€450 is typical.", ranges, fmt), "The fair retail price of €200–€400 is typical.");
  assert.equal(alignProseRanges("A market range of 60–180 € fits.", ranges, fmt), "A market range of €50–€150 fits.");
  assert.equal(alignProseRanges("The market range of €50–€150 is right.", ranges, fmt), "The market range of €50–€150 is right.");
  // catalogue estimates and unrelated numbers are left alone
  assert.equal(alignProseRanges("Catalogue estimate €700–900 for lot 12.", ranges, fmt), "Catalogue estimate €700–900 for lot 12.");
  assert.equal(alignProseRanges("Made 1780-1790 in Paris.", ranges, fmt), "Made 1780-1790 in Paris.");
});

check("currency defaults to EUR and ignores old auto-detected keys", () => {
  const mem = new Map<string, string>();
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  assert.equal(loadCurrency(storage), "EUR");
  mem.set("user_currency", "USD"); mem.set("hunt_currency", "GBP"); // written by older builds from the browser locale
  assert.equal(loadCurrency(storage), "EUR");
  saveCurrency("GBP", storage);
  assert.equal(loadCurrency(storage), "GBP");
  assert.equal(mem.get(CURRENCY_STORAGE_KEY), "GBP");
  assert.equal(mem.has("user_currency"), false);
  saveCurrency("XYZ", storage);
  assert.equal(loadCurrency(storage), "GBP");
  assert.equal(loadCurrency(null), "EUR");
});

check("saved finds: analysis stored as a map and read back from any old shape", () => {
  const item = { item_summary: { title: "x" } };
  assert.deepEqual(analysisItems({ items: [item] }), [item]);
  assert.deepEqual(analysisItems([item]), [item]);
  assert.deepEqual(analysisItems(item), [item]);
  assert.deepEqual(analysisItems(null), []);
});

check("hunt time budget stays well under Vercel's 60 s", () => {
  assert.ok(GEMINI_TIMEOUT_MS + VALIDATION_BUDGET_MS <= FUNCTION_BUDGET_MS);
  assert.ok(FUNCTION_BUDGET_MS <= 52_000);
});

check("auction walk-away cap and all-in maths", () => {
  // Walnut commode case: market high 506 -> walk-away x 1.25 must be <= 506
  const cap = maxHammerForMarketHigh(506, 25);
  assert.ok(cap * 1.25 <= 506, String(cap));
  assert.equal(allInCost(950, 25, true), 1188);
  assert.equal(allInCost(950, 25, true) - 950, 238); // premium shown = all-in minus hammer, so totals always add up
  assert.equal(allInCost(950, 25, false), 950);
  assert.equal(clampToBand(97, { min: 80, max: 95 }), 95);
  assert.equal(clampToBand(75, { min: 80, max: 95 }), 80);
});

// Parser checks against saved pages, if available on this machine
const pagesDir = process.env.HUNT_PAGES_DIR;
if (pagesDir && existsSync(`${pagesDir}/p8.html`)) {
  check("interencheres page parsing", () => {
    const f = parsePage("https://www.interencheres.com/art-decoration/grande-vente-cataloguee-dart-classique-684028/lot-88969755.html", readFileSync(`${pagesDir}/p8.html`, "utf8"));
    assert.equal(f.saleDate?.toISOString(), "2026-10-11T08:30:00.000Z");
    assert.equal(f.estimateLow, 1000);
    assert.equal(f.estimateHigh, 1500);
    assert.ok(f.image?.startsWith("https://"));
    assert.ok(f.title?.startsWith("400 Console"));
  });
}
if (pagesDir && existsSync(`${pagesDir}/timed_sale.html`)) {
  check("interencheres timed sale uses the closing date", () => {
    const f = parsePage("https://www.interencheres.com/art-decoration/greniers-bourguignons-690292/lot-89097887.html", readFileSync(`${pagesDir}/timed_sale.html`, "utf8"));
    assert.equal(f.saleDate?.toISOString(), "2026-10-14T19:29:00.000Z");
    assert.ok(!/[\r\n]/.test(f.title || ""));
  });
}
if (process.env.DROUOT_PAGE && existsSync(process.env.DROUOT_PAGE)) {
  check("drouot page parsing", () => {
    const f = parsePage("https://drouot.com/fr/l/35030886", readFileSync(process.env.DROUOT_PAGE!, "utf8"));
    assert.equal(f.estimateLow, 700);
    assert.equal(f.estimateHigh, 900);
    assert.ok(f.saleDate && f.saleDate.getUTCFullYear() === 2026);
    assert.ok(f.image?.startsWith("https://cdn.drouot.com/"));
  });
}

if (process.env.AUCTIONET_PAGE && existsSync(process.env.AUCTIONET_PAGE)) {
  check("auctionet closed lot is detected", () => {
    const f = parsePage("https://auctionet.com/en/5391667-chest-of-drawers-gustavian-18th-century", readFileSync(process.env.AUCTIONET_PAGE!, "utf8"));
    assert.equal(f.soldOrEnded, true);
    assert.equal(f.saleDate?.toISOString(), "2026-10-03T18:21:00.000Z");
  });
}

// Unverified listing (site returns 403 to the server): the model's guessed estimate is never shown as the price
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("blocked", { status: 403 })) as typeof fetch;
  try {
    const out = await validateMatch(
      { url: "https://www.interencheres.com/art-decoration/vente-123/lot-89000001.html", title: "Petite commode Louis XV", price: "150 - 250 €", date: "12 Oct 2026", location: "Marseille", dealerAnalysis: "ok" },
      { query: "commode", geographies: ["France"], platforms: ["Interencheres"], periodOnly: true },
      allowedDomainsFor(["Interencheres"]),
      Date.now() + 5000
    );
    assert.ok(out.match, JSON.stringify(out));
    assert.equal(out.match!.verification, "unverified");
    assert.equal(out.match!.price, UNVERIFIED_PRICE);
    assert.equal(out.match!.date, undefined);
    assert.match(out.match!.searchHint || "", /^~150 - 250 € · 12 Oct 2026 \(unverified\)$/);
    passed++; console.log("ok - unverified listing shows 'check listing', guessed estimate only as a labelled hint");
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log(`\n${passed} checks passed`);
