// Quick self-checks for the hunt URL filters and appraisal maths.
// Run: npx tsx scripts/check-hunt-logic.ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  allowedDomainsFor, cleanText, failsPeriodRule, interencheresLotId, isAllowedHost, isGenericUrl, isSpecificListingUrl,
  modernYearInTitle, parseInterencheresItem, parsePage,
} from "../src/services/huntValidation.ts";
import {
  alignProseRanges, allInCost, basisFromScore, clampToBand, decideBuy, maxHammerForMarketHigh, parseBudget, parsePriceInput, priceBandScore,
  reconcileNegotiation, sanitizeDeep, sanitizePriceTyping, sanitizeProse,
} from "../src/services/appraisalMath.ts";
import { checkGeography, itemTypesInQuery, matchesItemType, regionsFor, regionsInLocation } from "../src/services/huntGeo.ts";
import { CURRENCY_STORAGE_KEY, loadCurrency, saveCurrency } from "../src/services/currencyPref.ts";
import {
  UNVERIFIED_PRICE, validateMatch, GEMINI_TIMEOUT_MS, VALIDATION_BUDGET_MS, FUNCTION_BUDGET_MS, AUCTIONET_BUDGET_MS,
  auctionetToMatch, budgetMax, planHunt, withinBudget,
} from "../src/services/hunting.ts";
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
  assert.equal(isSpecificListingUrl("https://www.selency.fr/p/8G7ZRWYD/commode"), true);
  assert.equal(isSpecificListingUrl("https://www.the-saleroom.com/en-gb/auction-catalogues/rogersjones/catalogue-id-rogers10584/lot-edfa53d2-861c-4dfd-ab09-b32a00b9fb95"), true);
  assert.equal(isSpecificListingUrl("https://www.the-saleroom.com/en-gb/auction-catalogues/rogersjones/catalogue-id-rogers10584"), false);
  assert.equal(isSpecificListingUrl("https://www.easyliveauction.com/catalogue/lot/f79293ca7f90423cd9a03d86abedb1dc/0af8d24542e81eb9357e7ef448a6646f/antiques-lot-127/"), true);
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
  assert.ok(FUNCTION_BUDGET_MS <= 50_000);
  assert.ok(AUCTIONET_BUDGET_MS < GEMINI_TIMEOUT_MS);
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

// Unverified listing (site returns 403 to the server): the model's guessed estimate/date is never shown, not even as a hint
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
    assert.equal(out.match!.searchHint, undefined);
    assert.ok(!JSON.stringify(out.match).includes("150 - 250"), "model estimate leaked");
    const out2 = await validateMatch(
      { url: "https://www.bukowskis.com/en/lots/1741375-chest-of-drawers", title: "Chest of drawers, Late Gustavian, circa 1800", price: "Estimate: 8,000 SEK", date: "", location: "Stockholm", dealerAnalysis: "ok" },
      { query: "commode", geographies: ["Sweden"], platforms: ["Bukowskis"], periodOnly: true },
      allowedDomainsFor(["Bukowskis"]),
      Date.now() + 5000
    );
    assert.equal(out2.match!.price, UNVERIFIED_PRICE);
    assert.equal(out2.match!.searchHint, undefined);
    passed++; console.log("ok - unverified listing shows only 'Estimate: check listing' (no model figures)");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ---------------------------------------------------------------------------
// Round 3 (8 Oct 2026 road test)
// ---------------------------------------------------------------------------

// 1. Geography is enforced on the server
check("geography: UK-only drops French sites, keeps UK sites", () => {
  const uk = regionsFor(["United Kingdom"]);
  assert.equal(checkGeography("https://www.interencheres.com/meubles/vente-1/lot-89000001.html", ["Marseille"], uk).ok, false);
  assert.equal(checkGeography("https://www.interencheres.com/meubles/vente-1/lot-89000001.html", [""], uk).ok, false);
  assert.equal(checkGeography("https://www.ebay.fr/itm/123456789012", ["Lyon"], uk).ok, false);
  assert.equal(checkGeography("https://www.the-saleroom.com/en-gb/auction-catalogues/x/catalogue-id-1/lot-edfa53d2-861c-4dfd-ab09-b32a00b9fb95", ["Colwyn Bay, Conwy"], uk).ok, true);
  assert.equal(checkGeography("https://www.ebay.co.uk/itm/123456789012", ["Carmarthen, Wales"], uk).ok, true);
  assert.equal(checkGeography("https://www.ebay.co.uk/itm/123456789012", ["Lyon, France"], uk).ok, false);
  // multi-country houses need a matching location
  assert.equal(checkGeography("https://www.christies.com/en/lot/lot-123", ["London"], uk).ok, true);
  assert.equal(checkGeography("https://www.christies.com/en/lot/lot-123", ["Paris"], uk).ok, false);
  assert.equal(checkGeography("https://www.christies.com/en/lot/lot-123", [""], uk).ok, false);
  // Europe covers France / UK / Sweden; Global switches the filter off
  assert.equal(checkGeography("https://www.interencheres.com/x/v-1/lot-1.html", ["Paris"], regionsFor(["Europe"])).ok, true);
  assert.equal(checkGeography("https://auctionet.com/en/1-x", ["Norrköping"], regionsFor(["Sweden"])).ok, true);
  assert.equal(checkGeography("https://auctionet.com/en/1-x", ["Barcelona"], regionsFor(["Sweden"])).ok, false);
  assert.equal(regionsFor(["Global/Rest of World", "France"]), null);
  assert.equal(regionsInLocation("Kyiv, Ukraine").has("United Kingdom"), false);
});

check("geography: platforms follow the selected regions", () => {
  // Road test: UK only with the default (French) platforms selected
  const p = planHunt({ query: "Welsh dresser", geographies: ["United Kingdom"], platforms: ["Interencheres", "Drouot", "LeBonCoin", "Christie's"], periodOnly: true });
  assert.ok(!p.allowedDomains.includes("interencheres.com") && !p.allowedDomains.includes("drouot.com") && !p.allowedDomains.includes("leboncoin.fr"), p.allowedDomains.join());
  assert.ok(p.allowedDomains.includes("the-saleroom.com") && p.allowedDomains.includes("easyliveauction.com") && p.allowedDomains.includes("ebay.co.uk"), p.allowedDomains.join());
  assert.ok(!p.allowedDomains.includes("ebay.fr"));
  assert.deepEqual(p.ignoredPlatforms, ["Interencheres", "Drouot", "LeBonCoin"]);
  assert.deepEqual(p.itemTypes, ["dresser"]);
  const s = planHunt({ query: "Gustavian commode", geographies: ["Europe"], platforms: ["Interencheres", "Auctionet", "Bukowskis"], periodOnly: true });
  assert.equal(s.useAuctionet, true);
  assert.ok(s.local.sv.includes("gustaviansk byrå") && s.local.sv.includes("gustaviansk kommod"), s.local.sv.join());
  const f = planHunt({ query: "Louis XV commode", geographies: ["France"], platforms: ["Interencheres", "Drouot"], periodOnly: true });
  assert.equal(f.useAuctionet, false);
  assert.ok(f.local.fr.includes("commode Louis XV"));
});

check("relevance: results must be the requested type of piece (EN/FR/SV)", () => {
  assert.deepEqual(itemTypesInQuery("Welsh dresser"), ["dresser"]);
  assert.deepEqual(itemTypesInQuery("Gustavian commode"), ["commode"]);
  assert.deepEqual(itemTypesInQuery("Louis XVI console table"), ["console"]);
  assert.deepEqual(itemTypesInQuery("something old and nice for my hallway"), []);
  const d = ["dresser"];
  assert.equal(matchesItemType(d, "Buffet-vaisselier en chêne, XIXe"), true);
  assert.equal(matchesItemType(d, "An oak dresser base with boarded top"), true);
  assert.equal(matchesItemType(d, "Commode Louis XV en noyer"), false);
  assert.equal(matchesItemType(d, "Armoire normande"), false);
  const c = ["commode"];
  assert.equal(matchesItemType(c, "BYRÅ, 1800-talets början, sengustaviansk"), true);
  assert.equal(matchesItemType(c, "George III mahogany chest of drawers"), true);
  assert.equal(matchesItemType(c, "SKRIVBYRÅ med marmorskiva"), false);
  assert.equal(matchesItemType(c, "Console d'applique en bois doré"), false);
  assert.equal(matchesItemType([], "anything"), true);
});

check("period rule: modern years in titles, IKEA", () => {
  assert.equal(modernYearInTitle("BYRÅ, gustaviansk stil, Tibro, 1985."), "1985");
  assert.equal(modernYearInTitle("BYRÅ, 1800-talets början"), null);
  assert.equal(modernYearInTitle("Commode vers 1780"), null);
  assert.equal(modernYearInTitle("Dresser, 190 cm wide"), null);
  assert.ok(failsPeriodRule('BYRÅ, "Medevi", IKEA, 1700-talsserie.'));
});

check("Auctionet API results: only live period lots of the right type, in budget", () => {
  const json = JSON.parse(readFileSync(new URL("./fixtures/auctionet_gustaviansk_byra.json", import.meta.url), "utf8"));
  const params = { query: "Gustavian commode", geographies: ["Europe"], platforms: ["Auctionet"], periodOnly: true, priceRange: "2000 EUR", currency: "EUR" };
  const plan = planHunt(params);
  const now = Date.UTC(2026, 9, 8, 6, 0, 0);
  const kept = json.items.map((it: any) => auctionetToMatch(it, params, plan, now)).filter((o: any) => o.match).map((o: any) => o.match);
  const ids = kept.map((m: any) => m.url.match(/\/(\d+)-/)[1]);
  assert.deepEqual(ids.sort(), ["5380331", "5384954", "5408971"], ids.join());
  for (const m of kept) {
    assert.equal(m.verification, "verified");
    assert.match(m.price, /^Estimate SEK/);
    assert.ok(m.date && /^Auction: /.test(m.date));
    assert.match(m.location, /Sweden/);
  }
  // Sweden-only search drops the Spanish house (EUR) and a tight budget drops the expensive lot
  assert.equal(auctionetToMatch(json.items.find((i: any) => i.id === 5329913), { ...params, periodOnly: false, query: "antique" }, planHunt({ ...params, geographies: ["Sweden"], query: "antique" }), now).dropReason, "geo_location_mismatch");
  assert.equal(auctionetToMatch(json.items.find((i: any) => i.id === 5384954), { ...params, priceRange: "300 EUR" }, plan, now).dropReason, "over_budget");
  assert.equal(budgetMax("500 – 2 000 EUR"), 2000);
  assert.equal(withinBudget(6000, "SEK", 2000, "EUR"), true);
  assert.equal(withinBudget(60000, "SEK", 2000, "EUR"), false);
});

// 2. Interencheres: real estimate / date / city / fees from the lot's public JSON
check("Interencheres lot JSON gives the real estimate, sale date, city and fees", () => {
  const json = JSON.parse(readFileSync(new URL("./fixtures/interencheres_item_89074306.json", import.meta.url), "utf8"));
  const f = parseInterencheresItem(json)!;
  assert.equal(f.estimateLow, 600);
  assert.equal(f.estimateHigh, 800);
  assert.equal(f.saleDate?.toISOString(), "2026-11-05T13:30:00.000Z");
  assert.equal(f.location, "Biarritz, France");
  assert.equal(f.buyerPremiumPct, 28.8);
  assert.ok(f.image?.startsWith("https://thumbor-indbupload.interencheres.com/"));
  assert.ok(!f.soldOrEnded);
  assert.equal(parseInterencheresItem({ data: { ...json.data, sale: { ...json.data.sale, live: { has_ended: true } } } })!.soldOrEnded, true);
  assert.equal(interencheresLotId("https://www.interencheres.com/art-decoration/collections-dautomne-678390/lot-89074306.html"), "89074306");
});

{
  const realFetch = globalThis.fetch;
  const fixture = readFileSync(new URL("./fixtures/interencheres_item_89074306.json", import.meta.url), "utf8");
  globalThis.fetch = (async (u: any) => String(u).includes("asgardgw.interencheres.com/v2/items/89074306")
    ? new Response(fixture, { status: 200, headers: { "content-type": "application/json" } })
    : new Response("blocked", { status: 403 })) as typeof fetch;
  try {
    const out = await validateMatch(
      { url: "https://www.interencheres.com/art-decoration/collections-dautomne-678390/lot-89074306.html", title: "Commode Louis XV", price: "1 000 - 1 500 €", date: "5 Nov", location: "Biarritz", dealerAnalysis: "ok" },
      { query: "Louis XV commode", geographies: ["France"], platforms: ["Interencheres"], periodOnly: true },
      planHunt({ query: "Louis XV commode", geographies: ["France"], platforms: ["Interencheres"], periodOnly: true }),
      Date.now() + 5000
    );
    assert.ok(out.match, JSON.stringify(out));
    assert.equal(out.match!.verification, "verified");
    assert.equal(out.match!.price, "Estimate €600 – €800");
    assert.equal(out.match!.buyerPremiumPct, 28.8);
    assert.match(out.match!.date || "", /5 Nov 2026/);
    // UK-only: the same lot is dropped before any network call
    const uk = await validateMatch(
      { url: "https://www.interencheres.com/art-decoration/collections-dautomne-678390/lot-89074306.html", title: "Buffet vaisselier", location: "Biarritz", dealerAnalysis: "ok" },
      { query: "Welsh dresser", geographies: ["United Kingdom"], platforms: ["Interencheres"], periodOnly: true },
      { ...planHunt({ query: "Welsh dresser", geographies: ["United Kingdom"], platforms: ["Interencheres"], periodOnly: true }), allowedDomains: ["interencheres.com"] },
      Date.now() + 5000
    );
    assert.equal(uk.dropReason, "geo_site_mismatch");
    // wrong type of piece is dropped (road test: Welsh dresser search returned commodes/buffets from France)
    const wrongType = await validateMatch(
      { url: "https://www.interencheres.com/art-decoration/collections-dautomne-678390/lot-89074306.html", title: "Commode Louis XV", location: "Biarritz", dealerAnalysis: "ok" },
      { query: "Welsh dresser", geographies: ["France"], platforms: ["Interencheres"], periodOnly: true },
      planHunt({ query: "Welsh dresser", geographies: ["France"], platforms: ["Interencheres"], periodOnly: true }),
      Date.now() + 5000
    );
    assert.equal(wrongType.dropReason, "not_requested_type");
    passed++; console.log("ok - interencheres lot verified from its JSON (real estimate, fees), off-region / wrong-type lots dropped");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// 3. The verdict can never contradict the smart-buy / walk-away figures
const verdictCases = [
  { name: "auction EUR80 (EUR100 all-in) vs smart buy EUR60 (EUR75 all-in), walk-away EUR100 (EUR125 all-in) -> Fair",
    in: { askingPrice: 80, isAuction: true, premiumPct: 25, marketLow: 50, marketHigh: 150, retailHigh: 400, smartBuy: 60, walkAway: 100 },
    basis: "fair", cap: "above_smart_buy" },
  { name: "auction EUR2,000 (EUR2,500 all-in) vs walk-away EUR1,600 (EUR2,000 all-in) -> Overpriced",
    in: { askingPrice: 2000, isAuction: true, premiumPct: 25, marketLow: 1200, marketHigh: 2000, retailHigh: 3500, smartBuy: 1100, walkAway: 1600 },
    basis: "overpriced", cap: "above_walk_away" },
  { name: "private GBP900 vs walk-away GBP650 (market 300-900) -> Overpriced",
    in: { askingPrice: 900, isAuction: false, premiumPct: 0, marketLow: 300, marketHigh: 900, retailHigh: 1600, smartBuy: 450, walkAway: 650 },
    basis: "overpriced", cap: "above_walk_away" },
  { name: "auction EUR60 (EUR75 all-in) = smart buy -> Good Buy",
    in: { askingPrice: 60, isAuction: true, premiumPct: 25, marketLow: 50, marketHigh: 150, retailHigh: 400, smartBuy: 60, walkAway: 100 },
    basis: "good_buy", cap: undefined },
];
for (const tc of verdictCases) {
  check(`verdict vs walk-away: ${tc.name}`, () => {
    for (const hasPhotos of [false]) {
      const d = decideBuy({ ...tc.in, hasPhotos, riskPenalty: -30, itemScore: 50 });
      assert.equal(d.basis, tc.basis, JSON.stringify(d));
      assert.equal(d.cap, tc.cap, JSON.stringify(d));
      assert.ok(d.score >= d.band.min && d.score <= d.band.max, JSON.stringify(d));
    }
  });
}

check("verdict invariants over many prices: never Fair+ above walk-away, never Good+ above smart buy", () => {
  const en = JSON.parse(readFileSync(new URL("../src/i18n/en.json", import.meta.url), "utf8"));
  assert.match(en.analysis.reason_above_walk_away, /\{\{walkAway\}\}/);
  assert.match(en.analysis.reason_above_smart_buy, /\{\{smartBuy\}\}/);
  for (const auction of [true, false]) {
    for (const [lo, hi, rh] of [[50, 150, 400], [300, 900, 1600], [1200, 2000, 3500], [2000, 4200, 6000]]) {
      const nf = reconcileNegotiation({}, lo, hi, 25, auction);
      for (let price = 10; price <= rh * 1.5; price += Math.max(5, Math.round(hi / 40))) {
        const d = decideBuy({ askingPrice: price, isAuction: auction, premiumPct: 25, hasPhotos: false, marketLow: lo, marketHigh: hi, retailHigh: rh, smartBuy: nf.good_buy_below, walkAway: nf.walk_away_price });
        const eff = allInCost(price, 25, auction);
        if (eff > d.walkAwayAllIn!) assert.ok(["overpriced", "walk_away"].includes(d.basis), `${price}: ${d.basis}`);
        if (eff > d.smartBuyAllIn!) assert.ok(!["strong_buy", "good_buy"].includes(d.basis), `${price}: ${d.basis}`);
        assert.ok(d.basis !== "no_price");
      }
    }
  }
});

// 4. Contiguous bands: every price maps to exactly one band, and "Overpaying" = walk-away
check("price bands are contiguous; overpaying threshold = walk-away", () => {
  // market top 4,200, old 'overpaying' 5,000, price 4,500 used to fall in no displayed band
  const nf = reconcileNegotiation({ good_buy_below: 2500, walk_away_price: 4000 }, 2000, 4200, 0, false);
  const at = (p: number) => decideBuy({ askingPrice: p, isAuction: false, premiumPct: 0, hasPhotos: false, marketLow: 2000, marketHigh: 4200, retailHigh: 6000, smartBuy: nf.good_buy_below, walkAway: nf.walk_away_price });
  assert.equal(at(4500).basis, "overpriced");
  assert.equal(at(nf.walk_away_price).basis, "fair");
  assert.equal(at(nf.walk_away_price + 1).basis, "overpriced");
  assert.equal(at(nf.good_buy_below).basis, "good_buy");
  assert.equal(at(nf.good_buy_below + 1).basis, "fair");
  assert.equal(at(6001).basis, "walk_away");
  let prev = 100;
  for (let p = 500; p <= 8000; p += 50) { const s = at(p).score; assert.ok(s <= prev, `score rises at ${p}`); prev = s; }
  const gem = readFileSync(new URL("../src/services/gemini.ts", import.meta.url), "utf8");
  assert.match(gem, /pg\.overpaying_above = nf\.walk_away_price/);
});

// 5. Smart buy never above market mid (and never above market high)
check("smart buy is clamped within [market low, market mid]", () => {
  for (const auction of [false, true]) {
    const f = auction ? 1.25 : 1;
    const r = reconcileNegotiation({ good_buy_below: 350, walk_away_price: 400 }, 80, 300, 25, auction);
    assert.ok(r.good_buy_below * f <= 190 + 1, JSON.stringify(r));          // mid = 190
    assert.ok(r.good_buy_below * f >= 80 - 1, JSON.stringify(r));
    assert.ok(r.walk_away_price * f <= 300, JSON.stringify(r));
    assert.ok(r.good_buy_below <= r.walk_away_price);
  }
});

// 11. Price input: numbers only, common separators, currency symbols stripped
check("price input parsing", () => {
  const cases: Array<[string, number | null]> = [
    ["1500", 1500], ["1 500", 1500], ["1,500", 1500], ["1.500", 1500], ["€1,500", 1500], ["1 500 €", 1500], ["£900", 900],
    ["1.500,50", 1500.5], ["1,500.50", 1500.5], ["99.5", 99.5], ["2 000 000", 2000000], ["900 EUR", 900],
    ["abc", null], ["12abc", null], ["", null], ["0", null], [".", null], ["-5", null],
  ];
  for (const [raw, want] of cases) assert.equal(parsePriceInput(raw), want, raw);
  assert.equal(sanitizePriceTyping("€1,5a00x"), "1,500");
  assert.equal(sanitizePriceTyping("12e3"), "123");
  assert.deepEqual(parseBudget("1 500"), [1500]);
  assert.deepEqual(parseBudget("500 – 2 000"), [500, 2000]);
  assert.deepEqual(parseBudget("500-2000"), [500, 2000]);
  assert.equal(parseBudget("cheap"), null);
  assert.equal(parseBudget("1-2-3"), null);
});

check("confidence: one label set (top badge and gauge agree)", () => {
  const en = JSON.parse(readFileSync(new URL("../src/i18n/en.json", import.meta.url), "utf8"));
  for (const lvl of ["high", "medium", "low", "very_low"]) {
    const top = en.analysis[`confidence_${lvl}`].toLowerCase();
    const gauge = en.analysis[`conf_level_${lvl}`].toLowerCase();
    assert.ok(top.startsWith(gauge + " confidence"), `${lvl}: "${top}" vs "${gauge}"`);
  }
});

console.log(`\n${passed} checks passed`);
