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
  auctionetToMatch, budgetMax, pageShowsLot, planHunt, withinBudget,
} from "../src/services/hunting.ts";
import { analysisItems } from "../src/services/localFinds.ts";
import { parseJsLiteralAfter, parseJsLiteralAt } from "../src/services/sources/jsLiteral.ts";
import { parseDrouotLotPage, parseDrouotSearch, stripLotNumber } from "../src/services/sources/drouot.ts";
import { parseInterencheresSearch, parisDate } from "../src/services/sources/interencheres.ts";
import { clearSourceCache, fetchSource, requestUrlFor } from "../src/services/sources/fetchSource.ts";
import { siteQueries } from "../src/services/directSearch.ts";
import { candidateToMatch, crossListingKey, evaluateLot, periodProblemFor, finishDirect, searchDirectSites } from "../src/services/directSearch.ts";
import { allIn, budgetMin } from "../src/services/budget.ts";
import { localQueries } from "../src/services/huntGeo.ts";
import { frenchSiteQuery, frenchSiteQueries, headType, partlyPeriodProblem, pieceProblem, requestedStyleOnlyProblem, subtypeInQuery } from "../src/services/pieceWords.ts";
import { applyRanking } from "../src/services/hunting.ts";

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

check("a 200 page only counts as checked when it shows the lot (not a bot-check page)", () => {
  assert.equal(pageShowsLot("<html><title>Just a moment...</title><script>challenge</script></html>", "19th century Swedish painted commode", {}), false);
  assert.equal(pageShowsLot("<html><h1>19th Century Swedish Painted Commode, three drawers</h1></html>", "19TH CENTURY SWEDISH PAINTED COMMODE three drawers", {}), true);
  assert.equal(pageShowsLot("<html>bot check</html>", "anything", { estimateLow: 100 }), true);
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


// ---------------------------------------------------------------------------
// Direct auction-site search (Drouot, Interencheres) – parsers and filters, against saved pages (8 Oct 2026)
// ---------------------------------------------------------------------------
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const NOW_8_OCT = Date.UTC(2026, 9, 8, 7, 0, 0); // 8 Oct 2026, 09:00 Paris

check("embedded JS literal parser (SvelteKit data) handles void 0, new Date, escapes, quoted keys", () => {
  const src = 'x = [{type:"data",data:{lots:[{a:void 0,b:new Date(1338984000000),c:"l\\u00e9 \\"q\\"\\nx",d:-1.5,"e-f":[true,false,null],g:{}}],n:2}}];';
  const v: any = parseJsLiteralAfter(src, "data:{lots:");
  assert.equal(v.lots[0].a, undefined);
  assert.equal(v.lots[0].b, 1338984000000);
  assert.equal(v.lots[0].c, 'lé "q"\nx');
  assert.equal(v.lots[0].d, -1.5);
  assert.deepEqual(v.lots[0]["e-f"], [true, false, null]);
  assert.equal(v.n, 2);
  assert.equal(parseJsLiteralAt("{a:", 0), undefined);
  assert.equal(parseJsLiteralAfter("no marker here", "data:{lots:"), undefined);
});

check("Drouot search page (French) – embedded data: estimates, start price, fees, house, dates", () => {
  const r = parseDrouotSearch(fixture("drouot_search_fr_miroir_napoleon_iii.html"));
  assert.equal(r.lang, "fr");
  assert.equal(r.from, "data");
  assert.equal(r.lots.length, 7);
  const strasbourg = r.lots.find(l => l.id === "35219341")!;
  assert.equal(strasbourg.startingPrice, 150);
  assert.equal(strasbourg.estimateLow, undefined);
  assert.equal(strasbourg.premiumPct, 30);
  assert.equal(strasbourg.saleType, "online");
  assert.equal(strasbourg.house, "Alexandre Landre Strasbourg");
  assert.equal(strasbourg.saleDate?.toISOString(), "2026-10-14T18:02:30.000Z");
  assert.match(strasbourg.url, /^https:\/\/drouot\.com\/fr\/l\/35219341-grand-miroir/);
  assert.match(strasbourg.image || "", /^https:\/\/cdn\.drouot\.com\/d\/lot\/ftall\//);
  const artmark = r.lots.find(l => l.id === "35162138")!;
  assert.equal(artmark.estimateLow, 300);
  assert.equal(artmark.estimateHigh, 500);
  assert.match(artmark.title, /Miroir de style Napoléon III/);
  assert.ok(r.lots.every(l => !l.soldOrEnded));
});

check("Drouot search page served in English – parsed the same way, links kept on the French site", () => {
  const r = parseDrouotSearch(fixture("drouot_search_en_commode_louis_xv.html"));
  assert.equal(r.lang, "en");
  assert.equal(r.from, "data");
  assert.equal(r.lots.length, 33);
  assert.ok(r.lots.every(l => /^https:\/\/drouot\.com\/fr\/l\/\d+/.test(l.url)));
  const usd = r.lots.find(l => l.id === "35150586")!;
  assert.equal(usd.currency, "USD");
  assert.equal(usd.estimateLow, 300);
  assert.equal(usd.house, "ACES - All Country Estate Sales");
});

check("Drouot HTML-card fallback reads FR and EN labels (Estimation / Estimate, Mise à prix)", () => {
  const fr = parseDrouotSearch(fixture("drouot_search_fr_miroir_napoleon_iii.html").replace("data:{lots:", "data:{gone:"));
  assert.equal(fr.from, "cards");
  assert.equal(fr.lots.length, 3);
  assert.equal(fr.lots.find(l => l.id === "35219341")!.startingPrice, 150);
  assert.equal(fr.lots.find(l => l.id === "35091713")!.estimateLow, 800);
  assert.equal(fr.lots.find(l => l.id === "35091713")!.estimateHigh, 1000);
  const en = parseDrouotSearch(fixture("drouot_search_en_commode_louis_xv.html").replace("data:{lots:", "data:{gone:"));
  assert.equal(en.from, "cards");
  assert.ok(en.lots.length >= 3);
  assert.ok(en.lots.some(l => (l.estimateLow || 0) > 0), "EN 'Estimate' label parsed");
  assert.ok(en.lots.every(l => /^https:\/\/drouot\.com\/fr\/l\/\d+/.test(l.url)));
});

check("Drouot lot page gives city, country, house, fees and the full description", () => {
  const f = parseDrouotLotPage(fixture("drouot_lot_35314556.html"))!;
  assert.equal(f.id, "35314556");
  assert.equal(f.city, "Paris");
  assert.equal(f.countryId, 75);
  assert.equal(f.house, "Beaussant Lefèvre & Associés");
  assert.equal(f.premiumPct, 28.8);
  assert.equal(f.estimateLow, 200);
  assert.equal(f.estimateHigh, 300);
  assert.equal(f.lotNumber, 228);
  assert.equal(f.saleDate?.toISOString(), "2026-10-30T12:30:00.000Z");
  assert.match(f.description || "", /Style Louis XV, époque Napoléon III/);
  assert.equal(parseDrouotLotPage("<html>nothing</html>"), null);
  assert.equal(stripLotNumber("419 Buffet vaisselier à deux corps", 419), "Buffet vaisselier à deux corps");
  assert.equal(stripLotNumber("1850 commode", 18), "1850 commode");
});

check("Interencheres search cards: estimate, title, sale type, date (incl. 'À 14h00' today), house", () => {
  const lots = parseInterencheresSearch(fixture("interencheres_search_miroir_napoleon_iii.html"), NOW_8_OCT);
  assert.equal(lots.length, 7);
  const beaussant = lots.find(l => l.id === "89224678")!;
  assert.equal(beaussant.estimateLow, 200);
  assert.equal(beaussant.estimateHigh, 300);
  assert.equal(beaussant.saleType, "catalogue");
  assert.equal(beaussant.house, "BEAUSSANT LEFÈVRE & Associés");
  assert.equal(beaussant.dateOnly, true);
  assert.match(beaussant.url, /^https:\/\/www\.interencheres\.com\/art-decoration\/.+\/lot-89224678\.html$/);
  const today = lots.find(l => l.id === "89071358")!;
  assert.equal(today.saleDate?.toISOString(), "2026-10-08T12:00:00.000Z"); // 14:00 Paris (CEST)
  assert.equal(today.dateOnly, false);
  const chrono = lots.find(l => l.id === "89085542")!;
  assert.equal(chrono.saleType, "online");
  assert.equal(chrono.estimateLow, undefined);
  const coin = lots.find(l => l.id === "88592460")!;
  assert.equal(coin.estimateLow, 150);
  assert.equal(coin.estimateHigh, undefined);
  assert.equal(parisDate(2026, 12, 1, 14, 0).toISOString(), "2026-12-01T13:00:00.000Z"); // winter time
});

check("English -> French site keywords keep the period and the wood", () => {
  assert.equal(frenchSiteQuery("Napoleon III mirror"), "miroir napoleon iii");
  assert.equal(frenchSiteQuery("Louis XV commode walnut"), "commode louis xv noyer");
  assert.equal(frenchSiteQuery("Louis XV commode walnut", { fallback: true }), "commode louis xv");
  assert.equal(frenchSiteQuery("Welsh dresser oak"), "vaisselier chene");
  assert.equal(frenchSiteQuery("vaisselier"), "vaisselier");
  assert.equal(frenchSiteQuery("Gustavian cabinet"), "armoire gustavien");
  assert.equal(frenchSiteQuery("Second Empire gilt mirror"), "miroir napoleon iii dore");
  assert.deepEqual(localQueries("Napoleon III mirror").fr, ["miroir Napoléon III", "trumeau Napoléon III"]);
  assert.deepEqual(localQueries("Louis XV commode walnut").fr, ["commode Louis XV noyer"]);
  assert.deepEqual(localQueries("Welsh dresser oak").fr, ["vaisselier chêne", "buffet deux corps chêne"]);
  assert.equal(localQueries("Louis-Philippe commode").fr[0], "commode Louis-Philippe");
});

check("period rule: 'de style X, époque Napoléon III' is a period piece; 'style Napoléon III' alone is not", () => {
  assert.equal(failsPeriodRule("Miroir de cheminée. Style Louis XV, époque Napoléon III."), null);
  assert.equal(failsPeriodRule("Grand miroir Napoléon III de style Louis XV en bois et stuc"), null);
  assert.equal(failsPeriodRule("Commode de style Louis XVI, Epoque Louis-Philippe"), null);
  assert.ok(failsPeriodRule("Miroir de style Napoléon III, bois doré, fin du XIXe siècle"));
  assert.ok(failsPeriodRule("Miroir « trumeau » de style Napoléon III en bois doré"));
  assert.ok(failsPeriodRule("Commode de style Louis XV, époque XXe"));
  assert.ok(failsPeriodRule("Commode de style Louis XV, époque Napoléon III, reproduction"));
});

const mirrorParams = { query: "Napoleon III mirror", geographies: ["France"], platforms: [], priceRange: "250 - 500 EUR", currency: "EUR", periodOnly: true };
const mirrorPlan = planHunt(mirrorParams);

check("direct lots: all-in budget (estimate × (1 + premium)), period, type, sold/past and geography filters", () => {
  assert.deepEqual(mirrorPlan.directSites.sort(), ["drouot", "interencheres"]);
  assert.equal(budgetMin("250 - 500 EUR"), 250);
  assert.equal(budgetMin("2000 EUR"), null);
  assert.equal(allIn(200, 28.8), 258);
  const ie = parseInterencheresSearch(fixture("interencheres_search_miroir_napoleon_iii.html"), NOW_8_OCT);
  const ev = (id: string, p: any = mirrorParams, now = NOW_8_OCT) => evaluateLot(ie.find(l => l.id === id)!, p, planHunt(p), now);
  // €200–300 + 28% assumed fees = €256–384: in budget
  const ok = ev("89224678");
  assert.ok(ok.candidate, JSON.stringify(ok));
  assert.equal(ok.candidate!.allInLow, 256);
  assert.equal(ok.candidate!.allInHigh, 384);
  assert.equal(ok.candidate!.premiumAssumed, true);
  // €400–600 + 28% = €512 at the low estimate: over a €500 budget
  assert.equal(ev("89071358").dropReason, "over_budget");
  // a coin is not a mirror
  assert.equal(ev("88592460").dropReason, "not_requested_type");
  // the sale today at 14:00 is gone the next day
  assert.equal(ev("89071358", { ...mirrorParams, priceRange: "2000 EUR" }, Date.UTC(2026, 9, 9, 7)).dropReason, "past_sale");
  // too cheap for a 250–500 range (€100–150 + fees < 80% of €250)
  const cheap = { ...ie.find(l => l.id === "89224678")!, estimateLow: 100, estimateHigh: 150 };
  assert.equal(evaluateLot(cheap, mirrorParams, mirrorPlan, NOW_8_OCT).dropReason, "under_budget");
  assert.equal(evaluateLot({ ...cheap, soldOrEnded: true }, mirrorParams, mirrorPlan, NOW_8_OCT).dropReason, "sold_or_ended");
  const toy = { ...cheap, estimateLow: 300, estimateHigh: 400, title: "JOUETS. Ensemble de 6 meubles de poupée en bois : un buffet, un miroir", description: undefined };
  assert.equal(evaluateLot(toy, mirrorParams, mirrorPlan, NOW_8_OCT).dropReason, "not_requested_type");

  const dr = parseDrouotSearch(fixture("drouot_search_fr_miroir_napoleon_iii.html")).lots;
  const evd = (id: string, p: any = mirrorParams, requireRegion = false) => evaluateLot(dr.find(l => l.id === id)!, p, planHunt(p), NOW_8_OCT, requireRegion);
  // "Miroir de style Napoléon III, fin du XIXe" is rejected when period pieces only, kept otherwise
  assert.equal(evd("35162138").dropReason, "not_period");
  assert.ok(evd("35162138", { ...mirrorParams, periodOnly: false, geographies: [] }).candidate);
  // Napoléon III piece in Louis XV style, Strasbourg, start price €150 + 30% = €195
  const strasbourg = evd("35219341");
  assert.ok(strasbourg.candidate, JSON.stringify(strasbourg));
  assert.equal(strasbourg.candidate!.allInLow, 195);
  assert.equal(strasbourg.candidate!.premiumAssumed, false);
  // Spanish house (Bayeu Subastas / Balclis Barcelona) on Drouot: not shown for a France-only search
  const barcelona = { ...dr.find(l => l.id === "35278823")!, description: "Miroir trumeau, époque Napoléon III", title: "Miroir trumeau, époque Napoléon III" };
  assert.equal(evaluateLot(barcelona, mirrorParams, mirrorPlan, NOW_8_OCT).dropReason, "geo_location_mismatch");
  // unknown country once the lot page has been read (or could not be): not shown when a region is selected
  const unknown = { ...dr.find(l => l.id === "35219341")!, house: "Maison X", city: undefined };
  assert.equal(evaluateLot(unknown, mirrorParams, mirrorPlan, NOW_8_OCT, true).dropReason, "geo_location_unknown");
});

check("direct lot -> result card: verified, real estimate, all-in, fees, house, sale date, lot link", () => {
  const lot = { ...parseDrouotSearch(fixture("drouot_search_fr_miroir_napoleon_iii.html")).lots.find(l => l.id === "35219341")!, city: "Strasbourg", countryId: 75 };
  const c = evaluateLot(lot, mirrorParams, mirrorPlan, NOW_8_OCT, true).candidate!;
  const m = candidateToMatch(c, mirrorParams);
  assert.equal(m.verification, "verified");
  assert.equal(m.platform, "Drouot");
  assert.equal(m.source, "drouot_search");
  assert.equal(m.price, "Starting price €150");
  assert.equal(m.buyerPremiumPct, 30);
  assert.equal(m.allInLow, 195);
  assert.match(m.allInEstimate || "", /All-in ≈ €195 incl\. 30% fees \(from the starting price\)/);
  assert.equal(m.location, "Strasbourg, France");
  assert.equal(m.house, "Alexandre Landre Strasbourg");
  assert.match(m.date || "", /^Auction: 14 Oct 2026, 20:02 \(Paris\)$/);
  assert.match(m.url, /^https:\/\/drouot\.com\/fr\/l\/35219341-/);
  // the same lot listed on Drouot and Interencheres is recognised as one
  const a = { ...lot, site: "drouot" as const, estimateLow: 200, estimateHigh: 300, title: "Miroir de cheminée à encadrement cintré en bois et stuc doré", saleDate: new Date("2026-10-30T12:30:00Z") };
  const b = { ...a, site: "interencheres" as const, title: "Miroir de cheminée à encadrement cintré en bois et stuc doré…", saleDate: new Date("2026-10-30T21:59:00Z"), dateOnly: true };
  assert.equal(crossListingKey(a), crossListingKey(b));
});

check("ranker output only reorders/sets aside the real lots it was given", () => {
  const lots = parseInterencheresSearch(fixture("interencheres_search_miroir_napoleon_iii.html"), NOW_8_OCT);
  const cands = ["89224678", "89209687", "89014385"].map(id => evaluateLot(lots.find(l => l.id === id)!, { ...mirrorParams, priceRange: "2000 EUR" }, mirrorPlan, NOW_8_OCT).candidate!);
  const r = applyRanking(cands, { order: [
    { id: "interencheres:89014385", keep: true, dealerAnalysis: "Best" },
    { id: "interencheres:99999999", keep: true, dealerAnalysis: "invented" },
    { id: "interencheres:89209687", keep: false, dealerAnalysis: "not period" },
  ] });
  assert.deepEqual(r.kept.map(k => k.c.lot.id), ["89014385", "89224678"]);
  assert.equal(r.kept[0].analysis, "Best");
  assert.equal(r.rejected, 1);
  assert.deepEqual(applyRanking(cands, null).kept.map(k => k.c.lot.id), ["89224678", "89209687", "89014385"]);
});

check("optional fetch relay: only for the listed hosts, key sent as a header", () => {
  const env = { FETCH_RELAY_URL: "https://relay.example/fetch", FETCH_RELAY_KEY: "k1" };
  const ie = requestUrlFor("https://www.interencheres.com/recherche/lots?search=miroir", env);
  assert.equal(ie.viaRelay, true);
  assert.equal(ie.url, "https://relay.example/fetch?url=" + encodeURIComponent("https://www.interencheres.com/recherche/lots?search=miroir"));
  assert.equal(ie.headers["X-Relay-Key"], "k1");
  assert.equal(requestUrlFor("https://asgardgw.interencheres.com/v2/items/1", env).viaRelay, true);
  assert.equal(requestUrlFor("https://drouot.com/fr/s?query=x", env).viaRelay, false);
  assert.equal(requestUrlFor("https://www.interencheres.com/x", {}).viaRelay, false);
  assert.equal(requestUrlFor("https://drouot.com/fr/s?query=x", { ...env, FETCH_RELAY_HOSTS: "interencheres.com,drouot.com" }).viaRelay, true);
});

// ---------------------------------------------------------------------------
// Accuracy fixes (9 Oct 2026 road test)
// ---------------------------------------------------------------------------

check("fix 1: the site query keeps the user's own piece words", () => {
  assert.equal(frenchSiteQuery("secrétaire à abattant"), "secretaire a abattant");
  assert.equal(frenchSiteQuery("Louis XVI secrétaire à abattant"), "secretaire a abattant louis xvi");
  assert.equal(frenchSiteQuery("drop-front secretary"), "secretaire a abattant");
  assert.equal(frenchSiteQuery("buffet deux-corps"), "buffet deux corps");
  assert.equal(frenchSiteQuery("buffet deux corps en noyer"), "buffet deux corps noyer");
  assert.equal(frenchSiteQuery("bonnetière"), "bonnetiere");
  assert.equal(frenchSiteQuery("armoire Louis XV"), "armoire louis xv");
  assert.equal(frenchSiteQuery("vaisselier / Welsh dresser"), "vaisselier");
  assert.equal(frenchSiteQuery("Louis XV commode up to 2000"), "commode louis xv");
  assert.equal(frenchSiteQuery("George III chest of drawers"), "commode georgien");
  assert.equal(subtypeInQuery("Louis XV commode")?.key, undefined);
  assert.equal(subtypeInQuery("secretaire a abattant Louis XVI")?.key, "secretaire_abattant");
});

check("fix 1: chairs, lamps and writing accessories are not desks; a secrétaire search needs a secrétaire", () => {
  const q = "secrétaire à abattant", t = ["desk"];
  assert.equal(headType("Fauteuil de bureau en acajou et laiton doré"), "chair");
  assert.equal(pieceProblem(q, t, "Fauteuil de bureau en acajou et laiton doré"), "not_requested_type");
  assert.equal(pieceProblem(q, t, "Jean-Boris LACROIX - Lampe de bureau, structure en métal laqué"), "not_requested_type");
  assert.equal(pieceProblem(q, t, "[ACCESSOIRES D'ÉCRITURE] Ensemble d'écritoires et accessoires de bureau"), "not_requested_type");
  assert.equal(pieceProblem(q, t, "Bureau Davenporte en bois laqué noir, XIXe siècle"), "not_requested_subtype");
  assert.equal(pieceProblem(q, t, "Secrétaire à abattant à doucine en bois de placage, découvrant un écritoire"), null);
  assert.equal(pieceProblem(q, t, "Secrétaire en marqueterie de frisage à un abattant"), null);
  assert.equal(pieceProblem("bureau Louis XV", t, "Bureau plat en placage, époque Louis XV"), null);
  assert.equal(pieceProblem("bureau Louis XV", t, "Fauteuil de bureau canné"), "not_requested_type");
  assert.equal(pieceProblem("buffet deux corps", ["dresser"], "Buffet bas en noyer"), "not_requested_subtype");
  assert.equal(pieceProblem("buffet deux corps", ["dresser"], "Buffet deux corps en noyer, XVIIIe"), null);
  assert.equal(pieceProblem("Louis XV commode", ["commode"], "Commode galbée en bois de placage"), null);
  assert.equal(pieceProblem("chair", ["chair"], "Fauteuil cabriolet Louis XV"), null);
  assert.equal(pieceProblem("anything", [], "Lampe"), null);
});

check("fix 2: several Drouot queries per search, with period and form words", () => {
  assert.deepEqual(frenchSiteQueries("Louis XV commode"), ["commode louis xv", "commode xviiie", "commode epoque louis xv", "commode tombeau"]);
  assert.deepEqual(frenchSiteQueries("Napoleon III mirror"), ["miroir napoleon iii", "miroir xixe", "miroir epoque napoleon iii", "miroir bois dore xixe"]);
  assert.deepEqual(frenchSiteQueries("secrétaire à abattant", 3), ["secretaire a abattant", "secretaire a abattant xviiie", "secretaire a abattant xixe"]);
  assert.equal(frenchSiteQueries("Louis XV commode walnut")[0], "commode louis xv noyer");
  assert.equal(frenchSiteQueries("Louis XV commode walnut")[1], "commode louis xv");
  assert.deepEqual(frenchSiteQueries("something old and nice"), []);
  assert.equal(siteQueries("drouot", "something old and nice").length, 1);
  assert.equal(siteQueries("interencheres", "Louis XV commode").length, 2);
});

check("fix 7: partly-period, old-parts and later 'de style <requested style>' lots are not period", () => {
  assert.ok(partlyPeriodProblem("Commode en partie d'époque Louis XV"));
  assert.ok(partlyPeriodProblem("Buffet deux corps, en partie XVIIIème"));
  assert.ok(partlyPeriodProblem("Secrétaire composé d'éléments anciens"));
  assert.ok(partlyPeriodProblem("Armoire, éléments anciens"));
  assert.equal(partlyPeriodProblem("Commode en bois en partie doré, époque Louis XV"), null);
  const q = "Louis XV commode";
  assert.ok(requestedStyleOnlyProblem(q, "Commode de style Louis XV, piètement galbé. Époque XIXème"));
  assert.ok(requestedStyleOnlyProblem(q, "Commode style Louis XV en noyer, fin du XIXe siècle"));
  assert.equal(requestedStyleOnlyProblem(q, "Commode tombeau d'époque Louis XV en placage de palissandre"), null);
  assert.equal(requestedStyleOnlyProblem(q, "Commode galbée, XVIIIe siècle"), null);
  assert.equal(requestedStyleOnlyProblem("Napoleon III mirror", "Miroir Napoléon III de style Louis XV"), null);
  assert.ok(requestedStyleOnlyProblem("Louis XVI commode", "Commode de style Louis XVI, époque Napoléon III"));
  assert.equal(requestedStyleOnlyProblem("Louis XVI commode", "Commode de style Louis XV, époque Louis XVI"), null);
  // whole rule, as used by the direct search
  assert.ok(periodProblemFor(q, "Commode de style Louis XV", "piètement galbé, elle ouvre par trois tiroirs. Époque XIXème"));
  assert.equal(periodProblemFor(q, "Commode tombeau", "d'époque Louis XV, estampillée"), null);
});

check("fix 8: UK searches use Auctionet's UK houses; fix 9: Auctionet all-in, location never the house name", () => {
  const json = JSON.parse(readFileSync(new URL("./fixtures/auctionet_george_iii_chest.json", import.meta.url), "utf8"));
  const params = { query: "George III chest of drawers", geographies: ["United Kingdom"], platforms: ["The Saleroom", "easyLive Auction"], periodOnly: true, priceRange: "2000 EUR", currency: "EUR" };
  const plan = planHunt(params);
  assert.equal(plan.useAuctionet, true);
  const now = Date.UTC(2026, 9, 9, 8, 0, 0);
  const outs = json.items.map((it: any) => ({ id: it.id, ...auctionetToMatch(it, params, plan, now) }));
  const kept = outs.filter((o: any) => o.match);
  assert.ok(kept.length >= 3, JSON.stringify(outs.map((o: any) => [o.id, o.dropReason])));
  assert.equal(outs.find((o: any) => o.id === 5410718).dropReason, "not_period"); // "GEORGE III STYLE"
  for (const o of kept) {
    assert.match(o.match.location, /United Kingdom/);
    assert.match(o.match.allInEstimate || "", /^All-in ≈ €[\d,]+( – €[\d,]+)? ~25% fees assumed$/);
    assert.equal(o.match.premiumAssumed, true);
  }
  const m = kept.find((o: any) => o.id === 5401614).match;
  assert.ok(m.allInLow > 250 && m.allInLow < 350 && m.allInHigh > 500 && m.allInHigh < 700, `${m.allInLow}-${m.allInHigh}`);
  // a Sweden-only search does not take UK lots
  const sv = planHunt({ ...params, geographies: ["Sweden"], platforms: ["Auctionet"] });
  assert.equal(auctionetToMatch(json.items.find((i: any) => i.id === 5401614), params, sv, now).dropReason, "geo_location_mismatch");
  // Drouot lot with no city: the location is the region, never the auction house's name
  const lot = { site: "drouot" as const, id: "1", url: "https://drouot.com/fr/l/1", title: "Commode", currency: "EUR", house: "Ivoire – Galerie de Chartres – Maîtres Lelièvre" };
  const dm = candidateToMatch({ lot, score: 1, premiumPct: 25, premiumAssumed: true, styleMatch: null, region: "France" }, { query: "commode" });
  assert.equal(dm.location, "France");
  assert.equal(dm.house, "Ivoire – Galerie de Chartres – Maîtres Lelièvre");
});

{
  // End-to-end direct search with the network mocked: Drouot answers, Interencheres blocks (as from Vercel)
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (u: any) => {
    const url = String(u);
    calls.push(url);
    if (url.startsWith("https://drouot.com/fr/s?query=")) return new Response(fixture("drouot_search_fr_miroir_napoleon_iii.html"), { status: 200 });
    if (url.startsWith("https://drouot.com/fr/l/35219341")) return new Response(fixture("drouot_lot_35314556.html").replace("id:35314556", "id:35219341").replace(/city:"Paris"/, 'city:"Strasbourg"'), { status: 200 });
    if (url.startsWith("https://drouot.com/fr/l/")) return new Response("<html></html>", { status: 200 });
    return new Response("blocked", { status: 403 });
  }) as typeof fetch;
  clearSourceCache();
  try {
    const p1 = await searchDirectSites(mirrorParams, mirrorPlan, Date.now() + 5000, NOW_8_OCT);
    const res = await finishDirect(p1, mirrorParams, mirrorPlan, Date.now() + 3000);
    const ieStat = res.stats.find(s => s.site === "interencheres")!;
    const drStat = res.stats.find(s => s.site === "drouot")!;
    assert.equal(ieStat.status, 403);
    assert.equal(drStat.status, 200);
    assert.equal(drStat.found, 7);
    assert.deepEqual(res.coveredDomains, ["drouot.com"]);
    // fix 2: several Drouot queries (style + century + époque + form words); blocked Interencheres only once
    assert.equal(calls.filter(c => c.includes("/fr/s?query=")).length, siteQueries("drouot", mirrorParams.query).length, "one page per Drouot query");
    assert.ok(siteQueries("drouot", mirrorParams.query).length >= 3);
    assert.equal(calls.filter(c => c.includes("interencheres.com/recherche")).length, 1);
    const ids = res.candidates.map(c => c.lot.id);
    assert.ok(ids.includes("35219341"), ids.join());
    const c = res.candidates.find(x => x.lot.id === "35219341")!;
    assert.equal(c.lot.city, "Strasbourg");
    assert.equal(c.lot.enriched, true);
    assert.ok(!ids.includes("35162138"), "style Napoléon III (not period) dropped");
    // a blocked site is remembered: the next hunt does not hit it again for a while
    const again = await fetchSource("https://www.interencheres.com/recherche/lots?search=miroir%20napoleon%20iii", { timeoutMs: 1000, ttlMs: 1000 });
    assert.equal(again.cached, true);
    passed++; console.log("ok - direct search end-to-end (mocked network): Drouot lots verified + enriched, blocked Interencheres reported, several Drouot queries, one blocked Interencheres page");
  } finally {
    globalThis.fetch = realFetch;
    clearSourceCache();
  }
}

console.log(`\n${passed} checks passed`);
