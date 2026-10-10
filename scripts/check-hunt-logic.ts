// Quick self-checks for the hunt URL filters and appraisal maths.
// Run: npx tsx scripts/check-hunt-logic.ts
import assert from "node:assert/strict";
import { postProcessAppraisal } from "../src/services/gemini.ts";
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
import { napoleonIIIProblem, siteQueries } from "../src/services/directSearch.ts";
import { candidateToMatch, crossListingKey, evaluateLot, periodProblemFor, finishDirect, searchDirectSites } from "../src/services/directSearch.ts";
import { allIn, budgetMin } from "../src/services/budget.ts";
import { localQueries } from "../src/services/huntGeo.ts";
import { frenchSiteQuery, frenchSiteQueries, headType, partlyPeriodProblem, pieceProblem, requestedStyleOnlyProblem, subtypeInQuery } from "../src/services/pieceWords.ts";
import { applyRanking } from "../src/services/hunting.ts";
import { auctionetItemId, drouotFullDescription, drouotPhotoUrls, lotFactsPrompt, pickAuctionetItem } from "../src/services/lotFetch.ts";
import { bandScore, dealerBands, saneDealerRange, reconcileDealerNegotiation, priceBandScore as pbs, decideBuy as decideBuyX, DEALER_WALK_AWAY_FACTOR } from "../src/services/appraisalMath.ts";
import { calibratedConfidence, confidenceLabel, normaliseConfidence, evidenceCheck, evidenceAsks, pieceKindOf, isBriefInput, periodStatedIn, centuryStatedIn, laterSignIn } from "../src/services/appraisalMath.ts";

import { detectMaker, makerStatusFromText, countPieces, materialOf, pieceOf, combineMakerStatus, findMaker } from "../src/services/makers.ts";
import { parseChristiesLot, parseBonhamsLot, priceOnPage, verifyComparable, anchorOnComparables, classifyStamp, type Comparable } from "../src/services/compsMath.ts";
import { buildNegotiationPlan, CASH_CAP_FR_RESIDENT_EUR, CASH_CAP_FR_NON_RESIDENT_EUR } from "../src/services/negotiation.ts";
import { findComparables, handleCompsRequest, parseLooseJson, COMPS_TOTAL_BUDGET_MS, COMPS_GEMINI_TIMEOUT_MS, COMPS_VERIFY_BUDGET_MS } from "../src/services/compsSearch.ts";
import { buildChecklist, checksEffect, checksPrompt, DENIAL_FACTOR } from "../src/services/checklist.ts";
import { COMPS_CLIENT_TIMEOUT_MS } from "../src/services/gemini.ts";
import { FIELD_NOTES, type FieldNoteCategory, type PieceTag } from "../src/content/fieldNotes.ts";
import { countsByCategory, filterNotes, matchNotesForPiece, periodTagsFromText, pieceTagsFromAppraisal, teaserNotes } from "../src/services/fieldNotes.ts";
import { EXPECTED_ILLUSTRATION_IDS, SCAM_ONLY_ILLUSTRATION_ID, illustrationBelongsOnlyToItsNote, scamIllustrationNotReused } from "../src/services/fieldNoteIllustrations.ts";
import { REGISTERED_ILLUSTRATION_IDS, hasIllustration } from "../src/components/fieldNotes/FieldNoteIllustration.tsx";
import { CASH_CAP_FR_RESIDENT_EUR as CASH_NOTE_CAP } from "../src/services/negotiation.ts";

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
    basis: ["good_buy"], min: 65, max: 80 },  // hammer 80 in the lower half of the hammer range (all-in 100 shown separately)
  { name: "private GBP900, market 300-900, retail 800-1600", in: { askingPrice: 900, isAuction: false, premiumPct: 0, marketLow: 300, marketHigh: 900, retailHigh: 1600 },
    basis: ["fair"], min: 45, max: 60 },
  { name: "auction EUR2000, market 1200-2000, retail 2000-3500", in: { askingPrice: 2000, isAuction: true, premiumPct: 25, marketLow: 1200, marketHigh: 2000, retailHigh: 3500 },
    basis: ["fair"], min: 45, max: 64 }, // fix 3: hammer 2000 = top of the hammer range -> fair (all-in 2500 shown separately)
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
  // auction, market (hammer) 50-150: smart buy hammer within [50, 100]; walk-away = top of the range (fix 3)
  const b = reconcileNegotiation({ good_buy_below: 30, opening_offer: 60, walk_away_price: 120 }, 50, 150, 25, true);
  const allIn = (h: number) => allInCost(h, 25, true);
  assert.ok(b.good_buy_below >= 50 && b.good_buy_below <= 100, JSON.stringify(b));
  assert.equal(b.walk_away_price, 150, JSON.stringify(b));
  assert.ok(b.opening_offer <= b.good_buy_below && b.good_buy_below <= b.walk_away_price, JSON.stringify(b));
  // smart buy at its upper limit still scores as a good buy (or better)
  const c = reconcileNegotiation({ good_buy_below: 99999 }, 1200, 2000, 25, true);
  assert.ok(["strong_buy", "good_buy"].includes(priceBandScore(c.good_buy_below, 1200, 2000, 3500)!.basis), JSON.stringify(c));
  assert.ok(allIn(c.walk_away_price) > 2000); // all-in is shown separately, above the hammer range
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
    // like with like (fix 3): hammer figures against the hammer range, no ÷1.25
    const r = reconcileNegotiation({ good_buy_below: 350, walk_away_price: 250 }, 80, 300, 25, auction);
    assert.ok(r.good_buy_below <= 190, JSON.stringify(r));          // mid = 190
    assert.ok(r.good_buy_below >= 80, JSON.stringify(r));
    assert.equal(r.walk_away_price, 300, JSON.stringify(r));        // walk-away = top of the range
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
  const ev = (id: string, p: any = { ...mirrorParams, periodOnly: false }, now = NOW_8_OCT) => evaluateLot(ie.find(l => l.id === id)!, p, planHunt(p), now);
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
  const anyAge = { ...mirrorParams, periodOnly: false };
  const cheap = { ...ie.find(l => l.id === "89224678")!, estimateLow: 100, estimateHigh: 150 };
  assert.equal(evaluateLot(cheap, anyAge, planHunt(anyAge), NOW_8_OCT).dropReason, "under_budget");
  assert.equal(evaluateLot({ ...cheap, soldOrEnded: true }, anyAge, planHunt(anyAge), NOW_8_OCT).dropReason, "sold_or_ended");
  // with period pieces only, an undated stucco mirror is not shown for a Napoléon III search
  assert.equal(evaluateLot(ie.find(l => l.id === "89224678")!, mirrorParams, mirrorPlan, NOW_8_OCT).dropReason, "not_period");
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
  const cands = ["89224678", "89209687", "89014385"].map(id => evaluateLot(lots.find(l => l.id === id)!, { ...mirrorParams, priceRange: "2000 EUR", periodOnly: false }, mirrorPlan, NOW_8_OCT).candidate!);
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
  assert.deepEqual(frenchSiteQueries("Napoleon III mirror"), ["miroir napoleon iii", "miroir xixe", "miroir epoque napoleon iii", "miroir stuc dore"]);
  // preview re-test: relevant lots were only found by form/material queries ("commode galbée", "miroir stuc doré"), so Drouot gets 6
  assert.deepEqual(siteQueries("drouot", "Louis XV commode"), ["commode louis xv", "commode xviiie", "commode epoque louis xv", "commode tombeau", "commode galbee", "commode arbalete"]);
  assert.deepEqual(siteQueries("drouot", "Napoleon III mirror").slice(3), ["miroir stuc dore", "glace napoleon iii", "miroir bois dore xixe"]);
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

check("fix 3: hammer compared with the hammer range, all-in shown separately, walk-away = top of the range", () => {
  // Real lot that sold for €2,600 hammer (28.8% fees) with a market range of €2,000–3,000: a fair price, not "Walk Away"
  const nf = reconcileNegotiation({ good_buy_below: 2200, walk_away_price: 2300 }, 2000, 3000, 28.8, true);
  assert.equal(nf.walk_away_price, 3000);
  const d = decideBuy({ askingPrice: 2600, isAuction: true, premiumPct: 28.8, hasPhotos: true, marketLow: 2000, marketHigh: 3000, retailHigh: 5000, smartBuy: nf.good_buy_below, walkAway: nf.walk_away_price });
  assert.equal(d.basis, "fair");
  assert.equal(d.comparePrice, 2600);
  assert.equal(d.effectivePrice, 3349);       // all-in, shown alongside
  assert.equal(d.walkAwayAllIn, 3864);
  assert.equal(decideBuy({ askingPrice: 3001, isAuction: true, premiumPct: 28.8, hasPhotos: true, marketLow: 2000, marketHigh: 3000, retailHigh: 5000, smartBuy: nf.good_buy_below, walkAway: nf.walk_away_price }).basis, "overpriced");
  const en = JSON.parse(readFileSync(new URL("../src/i18n/en.json", import.meta.url), "utf8"));
  assert.match(en.analysis.reason_hammer_suffix, /\{\{allIn\}\} all-in/);
  for (const lang of ["fr", "de", "es", "ja", "zh"]) {
    const j = JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), "utf8"));
    assert.ok(j.analysis.reason_hammer_suffix && j.analysis.hammer_word, lang);
  }
});

check("fix 5: a pasted lot link gives the real catalogue, estimate, fees and photos — never the result; unread links claim nothing", () => {
  const html = fixture("drouot_lot_35127780.html");
  const photos = drouotPhotoUrls(html);
  assert.ok(photos.length >= 2 && photos.every(u => u.startsWith("https://cdn.drouot.com/d/lot/ftall/")), photos.join());
  const desc = drouotFullDescription(html) || "";
  assert.match(desc, /Hache à Grenoble/);
  assert.match(desc, /XVIIIème siècle/);
  const facts = { ok: true, url: "https://drouot.com/fr/l/35127780", site: "drouot" as const, title: "Hache à Grenoble, commode sauteuse", description: desc,
    estimateLow: 1000, estimateHigh: 1200, currency: "EUR", premiumPct: 27, house: "Conan Belleville Hôtel d'Ainay", city: "Lyon", imageUrls: photos, ended: true };
  const p = lotFactsPrompt(facts);
  assert.match(p, /Auction house estimate: 1000 EUR – 1200 EUR \(hammer, before fees\)/);
  assert.match(p, /Buyer's premium published by the sale: 27%/);
  assert.ok(!/1800/.test(p), "the hammer result must never reach the appraisal");
  const none = lotFactsPrompt({ ...facts, estimateLow: undefined, estimateHigh: undefined });
  assert.match(none, /Auction house estimate: none published on the page/);
  const unread = lotFactsPrompt({ ok: false, url: "https://www.interencheres.com/x/lot-1.html", site: "interencheres", imageUrls: [], error: "status_403" });
  assert.match(unread, /could NOT be read/);
  assert.match(unread, /do not mention, guess or "anchor to" any catalogue estimate/);
  assert.equal(auctionetItemId("https://auctionet.com/en/5401614-a-george-iii-mahogany-chest-of-drawers"), "5401614");
  assert.equal(auctionetItemId("https://auctionet.com/en/events/1273-the-lord-christopher-sale/345-a-george-iii"), null);
  const api = JSON.parse(readFileSync(new URL("./fixtures/auctionet_george_iii_chest.json", import.meta.url), "utf8"));
  assert.equal(pickAuctionetItem(api, "5401614")?.estimate, 200);
  assert.equal(pickAuctionetItem(api, "1"), null);
  // the appraisal prompt no longer tells the model to fetch / anchor to an estimate it never saw
  const gem = readFileSync(new URL("../src/services/gemini.ts", import.meta.url), "utf8");
  assert.ok(!/prioritize fetching/i.test(gem));
  assert.ok(!/Anchored to auction house catalog estimate for this lot/i.test(gem));
  // a link alone can be submitted; decimal fees are accepted
  const form = readFileSync(new URL("../src/components/DescriptionInput.tsx", import.meta.url), "utf8");
  assert.match(form, /disabled=\{isAnalyzing \|\| \(!description\.trim\(\) && !\/\^https\?/);
  assert.match(form, /step="0\.01"/);
});

check("fix 6: confidence inputs on fixed scales, calibrated with the app's own evidence", () => {
  assert.deepEqual(normaliseConfidence({ evidence_quality: 0.9, identification_certainty: 0.9, risk_factors: 0.8 }), { evidence_quality: 36, identification_certainty: 27, risk_factors: 24 });
  assert.deepEqual(normaliseConfidence({ evidence_quality: 80, identification_certainty: 85, risk_factors: 90 }), { evidence_quality: 32, identification_certainty: 26, risk_factors: 27 });
  assert.deepEqual(normaliseConfidence({ evidence_quality: 8, identification_certainty: 9, risk_factors: 7 }), { evidence_quality: 8, identification_certainty: 9, risk_factors: 7 });
  assert.deepEqual(normaliseConfidence({ evidence_quality: 35, identification_certainty: 25, risk_factors: 20 }), { evidence_quality: 35, identification_certainty: 25, risk_factors: 20 });
  assert.deepEqual(normaliseConfidence({ evidence_quality: 9, identification_certainty: 8, risk_factors: 40 }), { evidence_quality: 9, identification_certainty: 8, risk_factors: 30 });
  // the same model answer on different scales gives the same confidence
  const ev = { hasPhotos: true, fetchedEstimate: false, closeComparables: 3, comparableSpread: 2, vague: false };
  assert.equal(calibratedConfidence(normaliseConfidence({ evidence_quality: 0.75, identification_certainty: 0.8, risk_factors: 0.7 }), ev),
               calibratedConfidence(normaliseConfidence({ evidence_quality: 75, identification_certainty: 80, risk_factors: 70 }), ev));
  // a real estimate and close comparables raise it; text-only and vague queries cap it
  const b = normaliseConfidence({ evidence_quality: 25, identification_certainty: 20, risk_factors: 20 });
  assert.ok(calibratedConfidence(b, { ...ev, fetchedEstimate: true }) > calibratedConfidence(b, ev));
  assert.ok(calibratedConfidence(b, { ...ev, closeComparables: 0 }) < calibratedConfidence(b, ev));
  assert.ok(calibratedConfidence(normaliseConfidence({ evidence_quality: 40, identification_certainty: 30, risk_factors: 30 }), { ...ev, hasPhotos: false }) < 60);
  assert.ok(calibratedConfidence(b, { ...ev, hasPhotos: false, vague: true }) <= 35);
  assert.equal(confidenceLabel(80), "high"); assert.equal(confidenceLabel(60), "medium"); assert.equal(confidenceLabel(40), "low"); assert.equal(confidenceLabel(10), "very_low");
});

check("step 1 split: the original valuation path (fixed reference price ranges, no comparables, no band correction)", () => {
  const gem = readFileSync(new URL("../src/services/gemini.ts", import.meta.url), "utf8");
  assert.match(gem, /Provincial walnut commode, 18th c\.: €300/);
  assert.ok(!/comparablesPrompt|bandFactor/.test(gem));
});

check("need more evidence: when it triggers (ambiguous period, possible copy, low confidence on a short note)", () => {
  const base = { confidence: "medium", typedText: "Set of four mahogany armchairs with gilded dolphin heads, sword-shaped front legs, Restoration period, minor restorations, modern upholstery", lotPageRead: false, hasPhotos: true, category: "furniture", title: "Set of four Restauration armchairs" };
  assert.equal(evidenceCheck({ ...base, periodCertainty: "confirmed_period" }).required, false);
  assert.equal(evidenceCheck({ ...base, periodCertainty: "probable_period" }).required, false);
  // a piece correctly identified as a later style piece gets a normal verdict at its (later) price
  assert.equal(evidenceCheck({ ...base, periodCertainty: "later_style_or_revival", reproductionRisk: true }).required, false);
  assert.deepEqual(evidenceCheck({ ...base, periodCertainty: "ambiguous", typedText: "Set of four mahogany armchairs with gilded dolphin heads and sword-shaped front legs, minor restorations, modern upholstery" }).reasons, ["period_ambiguous"]);
  const undated = { ...base, typedText: "" };
  assert.deepEqual(evidenceCheck({ ...undated, periodCertainty: "probable_period", reproductionRisk: true, confidence: "high" }).reasons, ["possible_reproduction"]);
  // low confidence alone: only on a short note (a full catalogue entry has already said what it can)
  assert.equal(evidenceCheck({ ...base, periodCertainty: "probable_period", confidence: "low" }).required, false);
  const brief = evidenceCheck({ ...base, periodCertainty: "probable_period", confidence: "low", typedText: "four 19th century armchairs" });
  assert.deepEqual(brief.reasons, ["low_confidence_brief"]);
  assert.ok(brief.asks.includes("catalogue_or_link"));
  assert.equal(isBriefInput("", false), true);
  assert.equal(isBriefInput("", true), false); // lot page read = catalogue text
});

check("need more evidence: a catalogue that dates the piece (or calls it a style piece) is not sent back for a possible copy", () => {
  assert.equal(periodStatedIn("Restoration period, minor restorations"), true);
  assert.equal(periodStatedIn("Commode d'époque Louis XV"), true);
  assert.equal(periodStatedIn("Travail français. Epoque: XVIIIème."), true);
  assert.equal(periodStatedIn("A George III mahogany chest, circa 1780"), true);
  assert.equal(periodStatedIn("A GEORGE III STYLE WALNUT CHEST"), false);
  assert.equal(periodStatedIn("four 19th century armchairs"), false);
  assert.equal(centuryStatedIn("Fin du XVIIIe siècle"), true);
  assert.equal(centuryStatedIn("Début du XIXème siècle"), true);
  const base = { confidence: "medium", periodCertainty: "probable_period", reproductionRisk: true, lotPageRead: false, hasPhotos: true, category: "furniture", title: "Commode" };
  const long = "Commode en noyer ouvrant par trois tiroirs, plateau de bois, entrées de serrure en bronze. XVIIIe siècle. Haut. 88 cm";
  assert.equal(evidenceCheck({ ...base, typedText: long }).required, false);
  assert.equal(evidenceCheck({ ...base, typedText: "Commode dans le style Louis XVI en noyer ouvrant à trois rangs de tiroirs, plateau marqueté, poignées en laiton" }).required, false);
  // a short note giving a century is not a catalogue dating: still asks
  assert.deepEqual(evidenceCheck({ ...base, typedText: "four 19th century armchairs" }).reasons, ["possible_reproduction"]);
  // an ambiguous period still asks when the text only gives a century
  assert.equal(evidenceCheck({ ...base, periodCertainty: "ambiguous", typedText: long }).required, true);
  // ...but a catalogue that states the period is sent back only on a concrete later sign
  const cat = "Set of four mahogany and mahogany veneered armchairs with gilded dolphin heads resting on sword-shaped front legs. Restoration period. Minor restorations, modern upholstery.";
  assert.equal(evidenceCheck({ ...base, periodCertainty: "ambiguous", typedText: cat, constructionEvidence: "None visible (modern upholstery covers the frame)." }).required, false);
  assert.deepEqual(evidenceCheck({ ...base, reproductionRisk: false, periodCertainty: "ambiguous", typedText: cat, constructionEvidence: "Machine-cut dovetails and Phillips screws on the seat rail" }).reasons, ["period_ambiguous"]);
  assert.equal(laterSignIn("modern upholstery"), false);
  assert.equal(laterSignIn("agrafes sous l'assise"), true);
});

check("need more evidence: photos or a short note only -> a period or revival call is not confirmed (Peter's chairs, photos only)", () => {
  const base = { confidence: "high", reproductionRisk: false, lotPageRead: false, hasPhotos: true, category: "furniture", title: "Set of Empire-style mahogany armchairs" };
  const photosOnly = "Analyze this antique from the images provided.";
  const rev = evidenceCheck({ ...base, typedText: photosOnly, periodCertainty: "later_style_or_revival", styleText: "Empire Revival Late 19th Century (Napoleon III)" });
  assert.deepEqual(rev.reasons, ["period_not_confirmed"]);
  assert.equal(rev.pieceKind, "seating");
  assert.deepEqual(evidenceCheck({ ...base, typedText: "four 19th century armchairs", periodCertainty: "probable_period", styleText: "Restauration c.1820" }).reasons, ["period_not_confirmed"]);
  // a plainly modern piece is not sent back
  assert.equal(evidenceCheck({ ...base, typedText: photosOnly, periodCertainty: "later_style_or_revival", styleText: "Mid-century modern 1960s" }).required, false);
  // with the catalogue entry, the same model call gives a normal verdict
  const cat = "Set of four mahogany and mahogany veneered armchairs with gilded dolphin heads resting on sword-shaped front legs. Restoration period. Minor restorations, modern upholstery.";
  assert.equal(evidenceCheck({ ...base, typedText: cat, periodCertainty: "probable_period", styleText: "Restauration" }).required, false);
  assert.equal(evidenceCheck({ ...base, typedText: cat, periodCertainty: "later_style_or_revival", styleText: "Empire Revival" }).required, false);
  for (const lang of ["en", "fr"]) {
    const j = JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), "utf8"));
    for (const r of ["period_ambiguous", "possible_reproduction", "low_confidence_brief", "period_not_confirmed"]) assert.ok(j.evidence.reasons[r], `${lang} ${r}`);
  }
});

check("need more evidence: asks are specific to the kind of piece", () => {
  assert.equal(pieceKindOf("furniture", "Set of Four Empire-Style Mahogany Fauteuils"), "seating");
  assert.equal(pieceKindOf("chairs", "anything"), "seating");
  assert.equal(pieceKindOf("furniture", "Commode tombeau Louis XV"), "case");
  assert.equal(pieceKindOf("furniture", "Commode à miroir psyché"), "case"); // first piece word wins
  assert.equal(pieceKindOf("furniture", "Miroir en bois doré"), "mirror");
  assert.deepEqual(evidenceAsks("seating", { hasPhotos: true, hasCatalogue: false }), ["underside_back", "seat_frame_webbing", "hardware_mounts", "stamp_label", "catalogue_or_link"]);
  assert.deepEqual(evidenceAsks("case", { hasPhotos: true, hasCatalogue: true }), ["underside_back", "drawer_joints", "hardware_mounts", "stamp_label"]);
  assert.deepEqual(evidenceAsks("mirror", { hasPhotos: false, hasCatalogue: true }), ["photos", "underside_back", "hardware_mounts", "stamp_label"]);
});

check("need more evidence: no Strong/Good Buy or Fair verdict, but Overpriced/Walk Away still shown", () => {
  const d = (asking: number, needsEvidence: boolean) => decideBuy({ askingPrice: asking, isAuction: true, premiumPct: 28, hasPhotos: true, marketLow: 1000, marketHigh: 2500, retailHigh: 5000, smartBuy: 1200, walkAway: 2500, needsEvidence });
  assert.equal(d(850, false).basis, "strong_buy");
  assert.equal(d(850, true).basis, "need_evidence");
  assert.equal(d(850, true).score, 50);
  assert.equal(d(2000, true).basis, "need_evidence");
  assert.equal(d(3000, true).basis, "overpriced");
  assert.equal(d(9000, true).basis, "walk_away");
});

check("need more evidence: post-processing marks the range provisional and the verdict; prompt asks for construction evidence; EN/FR text", () => {
  const gem = readFileSync(new URL("../src/services/gemini.ts", import.meta.url), "utf8");
  assert.match(gem, /hand-cut dovetails/);
  assert.match(gem, /pegged mortise-and-tenon/);
  assert.match(gem, /Phillips or cross-head screws, staples/);
  assert.match(gem, /period_certainty: \{ type: Type.STRING, enum: \["confirmed_period", "probable_period", "ambiguous", "later_style_or_revival"\] \}/);
  const answer = (pc: string, b = { evidence_quality: 38, identification_certainty: 28, risk_factors: 28 }) => ({ items: [{
    item_summary: { title: "Set of Four Empire-Style Mahogany Fauteuils", likely_period: "19th c.", likely_style: "Empire", value_tier: "B", snap_judgement: "", confidence: "medium",
      confidence_breakdown: { ...b }, confidence_reason: "", period_certainty: pc, reproduction_risk: false, construction_evidence: "none shown" },
    buy_decision: { decision_summary: [] }, price_guidance: { estimated_market_range_low: 1000, estimated_market_range_high: 2500, pricing_reasoning: "" },
    negotiation_strategy: {}, scoring_inputs: { risk_penalty: 0 }, dealer_take: {}, }] });
  const ctx = { query: "Assess this antique from the images provided.", hasPhotos: true, askingPrice: 850, isAuction: true, premiumPct: 28, targetCurrency: "EUR", currencySymbol: "€", language: "en", sellerType: "Auction", fetchedEstimate: false, eurTo: (e: number) => e, category: "furniture" };
  const amb: any = postProcessAppraisal(answer("ambiguous"), ctx)[0];
  assert.equal(amb.buy_decision.price_basis, "need_evidence");
  assert.equal(amb.buy_decision.label, "Need More Evidence");
  assert.equal(amb.price_guidance.provisional, true);
  assert.equal(amb.evidence_check.pieceKind, "seating");
  assert.ok(amb.evidence_check.asks.includes("seat_frame_webbing"));
  const ok: any = postProcessAppraisal(answer("confirmed_period"), ctx)[0];
  assert.equal(ok.buy_decision.price_basis, "strong_buy");
  assert.equal(ok.price_guidance.provisional, undefined);
  // photos only (no typed text) with a weak identification: low confidence on a bare input -> need more evidence
  const weak: any = postProcessAppraisal(answer("probable_period", { evidence_quality: 20, identification_certainty: 12, risk_factors: 15 }), ctx)[0];
  assert.deepEqual(weak.evidence_check.reasons, ["low_confidence_brief"]);
  for (const lang of ["en", "fr"]) {
    const j = JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), "utf8"));
    assert.ok(j.analysis.verdict_need_evidence && j.analysis.reason_need_evidence && j.evidence.title && j.evidence.provisional_range);
    for (const a of ["photos", "underside_back", "drawer_joints", "hardware_mounts", "seat_frame_webbing", "stamp_label", "catalogue_or_link"]) assert.ok(j.evidence.asks[a], `${lang} ${a}`);
    for (const r of ["period_ambiguous", "possible_reproduction", "low_confidence_brief"]) assert.ok(j.evidence.reasons[r], `${lang} ${r}`);
    for (const k of ["case", "seating", "mirror", "table", "other"]) assert.ok(j.evidence.kind[k], `${lang} ${k}`);
  }
  assert.equal(JSON.parse(readFileSync(new URL("../src/i18n/fr.json", import.meta.url), "utf8")).evidence.title, "Il faut plus d'éléments");
});

check("fix 9: appraisals are repeatable (temperature 0, fixed seed)", () => {
  const gem = readFileSync(new URL("../src/services/gemini.ts", import.meta.url), "utf8");
  assert.match(gem, /temperature: 0,/);
  assert.match(gem, /seed: APPRAISAL_SEED/);
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

check("preview re-test: toy furniture and 'modern'/'twentieth century' UK titles are dropped", () => {
  const q = "vaisselier / Welsh dresser"; const t = itemTypesInQuery(q);
  assert.equal(pieceProblem(q, t, "QTY OF DOLLS HOUSE FURNITURE & ACCESSORIES - KITCHEN ITEMS."), "not_requested_type");
  assert.equal(pieceProblem(q, t, "AN 18TH CENTURY OAK DRESSER & RACK."), null);
  assert.equal(pieceProblem("commode miniature", itemTypesInQuery("commode miniature"), "Commode miniature Louis XV"), null);
  assert.ok(failsPeriodRule("AN EARLY TWENTIETH CENTURY GLAZED DISPLAY CABINET."));
  assert.ok(failsPeriodRule("PAIR OF MODERN PINE CORNER CUPBOARDS."));
  assert.equal(failsPeriodRule("A GEORGE III OAK DRESSER, circa 1780", "with modern handles"), null);
});

check("step 1: Napoleon III with periodOnly needs Napoléon III / Second Empire in the lot text; London lots show the country", () => {
  const q = "Napoleon III mirror";
  assert.equal(napoleonIIIProblem(q, "Miroir à parcloses, cadre bois et stuc doré époque XIXe"), "napoleon_iii_not_stated");
  assert.equal(napoleonIIIProblem(q, "Grand miroir Napoléon III de style Louis XV en bois et stuc"), null);
  assert.equal(napoleonIIIProblem(q, "Miroir en bois et stuc doré", "Style Louis XV, Epoque Napoléon III"), null);
  assert.equal(napoleonIIIProblem(q, "Miroir de style Napoléon III"), "napoleon_iii_style_only");
  assert.equal(napoleonIIIProblem("Louis XV commode", "Commode XVIIIe"), null);
  const lot: any = { site: "drouot", id: "1", url: "https://drouot.com/fr/l/1", title: "Armoire en pin", city: "London", currency: "GBP", estimateLow: 80, estimateHigh: 120 };
  const m = candidateToMatch({ lot, score: 1, region: "United Kingdom" } as any, { query: "armoire", currency: "EUR" } as any);
  assert.equal(m.location, "London, United Kingdom");
});

// ---------------------------------------------------------------------------
// Maker attribution + verified auction comparables; "Before you buy" checklist
// ---------------------------------------------------------------------------
const BELL_CONF = "Set of four mahogany armchairs, Empire period, stamped P. Bellangé (Pierre-Antoine Bellangé, reçu maître 1788), stamp confirmed.";
const BELL_LABEL = "Set of four mahogany armchairs, Empire period; dealer label says Pierre-Antoine Bellangé, reçu maître 1788.";

check("makers: stamped (confirmed / stated), attributed and dealer's label are told apart", () => {
  assert.deepEqual([detectMaker(BELL_CONF)?.key, detectMaker(BELL_CONF)?.status], ["bellange", "stamped_confirmed"]);
  assert.equal(detectMaker(BELL_LABEL)?.status, "dealer_label");
  assert.equal(detectMaker("PAIRE DE FAUTEUILS D'EPOQUE EMPIRE ESTAMPILLE DE PIERRE-ANTOINE BELLANGE")?.status, "stamped_stated");
  assert.equal(detectMaker("Paire de fauteuils attribués à Jacob, époque Louis XVI")?.status, "attributed");
  assert.equal(detectMaker("Commode attribuée à Pierre Migeon")?.key, "migeon");
  assert.equal(detectMaker("Hache à Grenoble, commode. Traces d'une ancienne étiquette. Modèle répertorié de Jean-François Hache")?.status, "attributed");
  assert.equal(detectMaker("Secrétaire. Estampillé à deux reprises François-Gaspard TEUNÉ")?.status, "stamped_stated");
  assert.equal(detectMaker("Commode Louis XV, estampille de Lebesgue")?.key, "lebesgue");
  assert.equal(detectMaker("Four 19th century armchairs"), null);
  assert.equal(makerStatusFromText("Empire fauteuil attributed to Bellangé, trace of a stamp"), "attributed");
  // the model reads a stamp in a photo: used when the text named no maker, never over a dealer's label
  assert.equal(combineMakerStatus(null, { name: "P. Bellangé", status: "stamp_visible_in_photo" })?.status, "stamp_in_photo");
  assert.equal(combineMakerStatus(detectMaker(BELL_LABEL), { name: "Bellangé", status: "stamp_visible_in_photo" })?.status, "dealer_label");
  assert.equal(combineMakerStatus(null, { name: "", status: "none" }), null);
  assert.equal(countPieces(BELL_CONF), 4);
  assert.equal(countPieces("PAIRE DE FAUTEUILS"), 2);
  assert.equal(countPieces("A SET OF FOUR EMPIRE GILTWOOD FAUTEUILS"), 4);
  assert.equal(countPieces("Suite de six chaises"), 6);
  assert.equal(countPieces("Fauteuil d'époque Empire"), 1);
  assert.equal(materialOf(BELL_CONF), "mahogany");
  assert.equal(materialOf("en acajou, ornementation de bronze ciselé et doré"), "mahogany");
  assert.equal(materialOf("in carved and gilded beech"), "giltwood");
  assert.equal(pieceOf(BELL_CONF)?.key, "armchair");
});

const christiesHtml = (id: string, other: string) => `<html><script>{"lots":[{"object_id":"${other}","title_primary_txt":"A COMMODE","title_secondary_txt":"BY RIESENER","price_realised":8750.0,"price_realised_txt":"EUR 8,750","end_date":"2021-04-27T00:00Z"},{"object_id":"${id}","title_primary_txt":"FAUTEUIL D'EPOQUE EMPIRE","title_secondary_txt":"ESTAMPILLE DE PIERRE-ANTOINE BELLANGE, DEBUT DU XIXe SIECLE","estimate_low":2000.0,"price_realised":2250.0,"price_realised_txt":"EUR 2,250","end_date":"2021-04-27T00:00Z"}]}</script><span class="chr-lot-section__accordion--text">FAUTEUIL<br>En acajou mouluré et sculpté, estampillé sur la traverse avant BELLANGE</span></html>`;
const bonhamsHtml = `<html><head><meta property="og:title" content="Bonhams : Empire Fauteuil a Chassis Attributed to Pierre-Antoine Bellangé,"></head><body><h1>Empire Fauteuil a Chassis Attributed to Pierre-Antoine Bellangé,</h1><p>Sold for US$4,096 inc. premium</p><p>in carved and gilded beech, trace of a stamp</p><div>Other lot: Commode stamped Dussautoy Sold for US$9,000 inc. premium</div></body></html>`;

check("comparables: Christie's lot data (the page's own lot, not a neighbour), Bonhams 'Sold for … inc. premium', a price printed next to a result word", () => {
  const p = parseChristiesLot(christiesHtml("6314500", "6314499"), "https://www.christies.com/en/lot/lot-6314500");
  assert.deepEqual([p?.price, p?.currency, p?.date], [2250, "EUR", "2021-04-27"]);
  assert.match(String(p?.description), /acajou/);
  const b = parseBonhamsLot(bonhamsHtml, 4096);
  assert.deepEqual([b?.price, b?.currency], [4096, "USD"]);
  assert.equal(priceOnPage("<p>Adjugé 3 200 € frais compris</p>", 3200), true);
  assert.equal(priceOnPage("<p>Estimation 3 200 - 4 000 €</p><p>Lot 32000</p>", 3200), false);
  assert.equal(classifyStamp("A SET OF FOUR EMPIRE GILTWOOD FAUTEUILS, BY PIERRE-ANTOINE BELLANGE"), "by");
  assert.equal(classifyStamp("Paire de fauteuils, chacun estampillé P.BELLANGE"), "stamped");
  const re = /\b(arm\s?chairs?|fauteuils?)\b/;
  const v = verifyComparable(christiesHtml("6314500", "1"), "https://www.christies.com/en/lot/lot-6314500", null, "bellange", re);
  assert.deepEqual([v.comp?.stamp, v.comp?.pieces, v.comp?.feesIncluded, v.comp?.perPieceAllInEur, v.comp?.material], ["stamped", 1, true, 2250, "mahogany"]);
  assert.equal(verifyComparable(christiesHtml("6314500", "1"), "https://www.christies.com/en/lot/lot-6314500", null, "jacob", re).reason, "maker_not_on_page");
  assert.equal(verifyComparable(christiesHtml("6314500", "1"), "https://www.christies.com/en/lot/lot-6314500", null, "bellange", /\bcommodes?\b/).reason, "other_piece");
  assert.equal(verifyComparable(bonhamsHtml, "https://www.bonhams.com/auction/31313/lot/152/x/", { url: "", price: 4096, currency: "USD", sale_date: "2025-05-07" }, "bellange", re).comp?.stamp, "attributed");
  // a claimed price that is not on the page is never accepted
  assert.equal(verifyComparable("<html><title>Fauteuil estampillé Bellangé</title><p>Adjugé 1 500 €</p></html>", "https://www.example-auction.fr/lot/1", { url: "", price: 9999, currency: "EUR" }, "bellange", re).reason, "price_not_on_page");
});

const comp = (o: Partial<Comparable>): Comparable => ({ url: `https://x/${Math.random()}`, house: "Christie's", title: "fauteuil Bellangé", pieces: 1, stamp: "stamped", price: 0, currency: "EUR", feesIncluded: true, allInEur: 0, hammerEur: 0, perPieceAllInEur: 0, perPieceHammerEur: 0, verifiedBy: "christies_lot_data", ...o });
const BELL_COMPS: Comparable[] = [
  comp({ date: "2021-04-27", material: "mahogany", perPieceAllInEur: 2250, perPieceHammerEur: 1772 }),
  comp({ date: "2024-06-18", material: "giltwood", pieces: 4, stamp: "by", perPieceAllInEur: 2029, perPieceHammerEur: 1597 }),
  comp({ date: "2021-07-12", material: "giltwood", pieces: 2, perPieceAllInEur: 3510, perPieceHammerEur: 2764 }),
  comp({ date: "2004-04-22", material: "mahogany", pieces: 2, perPieceAllInEur: 2056, perPieceHammerEur: 1619 }),
  comp({ date: "2025-05-07", material: "giltwood", stamp: "attributed", house: "Bonhams", perPieceAllInEur: 3768, perPieceHammerEur: 2967 }),
];

check("comparables anchor the range, scaled to the number of pieces (stamped on stamped, never on a dealer's label)", () => {
  const a = anchorOnComparables(BELL_COMPS, { status: "stamped_confirmed", pieces: 4, material: "mahogany", isAuction: false, eurTo: (e) => e });
  assert.equal(a.applied, true);
  assert.equal(a.used.length, 3); // 2018+ stamped/by results; the attributed one and the 2004 sale are not used
  assert.equal(a.perPieceMedianEur, 2250);
  assert.deepEqual([a.low, a.high], [7650, 11500]); // about €8–9k for four at auction, incl. fees
  const h = anchorOnComparables(BELL_COMPS, { status: "stamped_stated", pieces: 4, isAuction: true, eurTo: (e) => e });
  assert.equal(h.basis, "hammer"); assert.ok(h.high < a.high);
  assert.equal(anchorOnComparables(BELL_COMPS, { status: "dealer_label", pieces: 4, isAuction: false, eurTo: (e) => e }).applied, false);
  assert.equal(anchorOnComparables(BELL_COMPS, { status: "attributed", pieces: 4, isAuction: false, eurTo: (e) => e }).reason, "too_few");
  assert.equal(anchorOnComparables([], { status: "stamped_confirmed", pieces: 4, isAuction: false, eurTo: (e) => e }).reason, "none");
});

const bellRaw = () => ({ items: [{
  item_summary: { title: "Set of Four Empire Mahogany Fauteuils (Attributed to P. Bellangé)", category: "Chairs", likely_origin: "France", likely_style: "Empire", likely_period: "Early 19th Century", value_tier: "B", snap_judgement: "Standard Empire form.", confidence: "low", confidence_score: 40, confidence_breakdown: { evidence_quality: 20, identification_certainty: 15, risk_factors: 15 }, confidence_reason: "Photos of the chairs.", confidence_improvement_suggestions: [], evidence_gaps: [], period_certainty: "probable_period", reproduction_risk: false, construction_evidence: "none shown", maker: { name: "Pierre-Antoine Bellangé", status: "stamped_stated", evidence: "buyer's text" } },
  buy_decision: { score: 20, label: "Walk Away", confidence: "low", decision_summary: [], investment_insight: "", must_have_insight: "", resale_insight: "" },
  price_guidance: { currency: "EUR", estimated_market_range_low: 2500, estimated_market_range_high: 5500, good_buy_below: 3500, fair_price_low: 6000, fair_price_high: 9000, overpaying_above: 5500, pricing_reasoning: "Standard Empire chairs." },
  dealer_take: { target_buy_price_low: 2000, target_buy_price_high: 3500, resale_strategy: "", dealer_view: [] },
  negotiation_strategy: { opening_offer: 2500, target_price_low: 3000, target_price_high: 4500, walk_away_price: 5500, points_to_raise: [] },
  walk_away_if: [], top_checks: [], red_flags: [], market_insight: { demand: "", resale_ease: "", drivers_of_value: [] },
  scoring_inputs: { authenticity: 15, condition: 10, rarity_desirability: 10, market_demand: 8, price_vs_market: 2, liquidity: 5, risk_penalty: -5 }, disclaimer: "", teaser_insight: "",
}] });
const dealerCtx = (query: string, extra: any = {}) => ({ query, hasPhotos: true, askingPrice: 12000, isAuction: false, premiumPct: 0, targetCurrency: "EUR", currencySymbol: "€", language: "en", sellerType: "Antique Shop", fetchedEstimate: false, eurTo: (e: number) => e, category: "chairs", ...extra });
const COMPS_RESP = { ok: true, comparables: BELL_COMPS, searched: [], unreachable: ["Drouot (results need an account)"], stats: { candidates: 5, verified: 5, dropped: {} } };

check("dealer mode: asking prices are judged against the dealer range (Strong <= auction mid, Good <= min(auction high, dealer low), Fair <= dealer high, Overpriced <= 1.5x, then Walk Away)", () => {
  // the generic bands reproduce the auction bands exactly
  for (const p of [50, 300, 450, 500, 699, 700, 701, 900, 1100, 1500, 3000]) assert.deepEqual(pbs(p, 300, 700, 1100), bandScore(p, { strongTop: 300, goodTop: 500, fairTop: 700, overTop: 1100 }), String(p));
  // sane dealer range: low >= auction mid, high >= auction high and >= low; missing -> defaults
  assert.deepEqual(saneDealerRange(300, 700, 700, 1100), { low: 700, high: 1100, clamped: false });
  assert.deepEqual(saneDealerRange(300, 700, 350, 600), { low: 500, high: 700, clamped: true });
  assert.deepEqual(saneDealerRange(300, 700, 2000, 1500), { low: 2000, high: 2000, clamped: true });
  assert.equal(saneDealerRange(300, 700).low, 500); assert.equal(saneDealerRange(300, 700).high, 1400);
  const b = dealerBands(300, 700, 700, 1100);
  assert.deepEqual(b, { strongTop: 500, goodTop: 700, fairTop: 1100, overTop: 1100 * DEALER_WALK_AWAY_FACTOR });
  assert.equal(dealerBands(300, 700, 600, 1100).goodTop, 600); assert.equal(dealerBands(300, 700, 900, 1100).goodTop, 700);
  // the Provençal mirror: auction €800–3,000, dealer €2,200–3,500 -> Good Buy ends at €2,200, €3,000 is Fair
  const pb = dealerBands(800, 3000, 2200, 3500); assert.equal(pb.goodTop, 2200);
  assert.equal(decideBuyX({ askingPrice: 3000, isAuction: false, premiumPct: 0, hasPhotos: true, marketLow: 800, marketHigh: 3000, retailHigh: 3500, smartBuy: 2200, walkAway: 3500, bands: pb }).basis, "fair");
  assert.equal(decideBuyX({ askingPrice: 2100, isAuction: false, premiumPct: 0, hasPhotos: true, marketLow: 800, marketHigh: 3000, retailHigh: 3500, smartBuy: 2200, walkAway: 3500, bands: pb }).basis, "good_buy");
  const v = (ask: number) => decideBuyX({ askingPrice: ask, isAuction: false, premiumPct: 0, hasPhotos: true, marketLow: 300, marketHigh: 700, retailHigh: 1100, smartBuy: 700, walkAway: 1100, bands: b }).basis;
  assert.deepEqual([450, 500, 650, 700, 800, 950, 1100, 1300, 1650, 1700].map(v), ["strong_buy", "strong_buy", "good_buy", "good_buy", "fair", "fair", "fair", "overpriced", "overpriced", "walk_away"]);
  // scores never rise as the price rises
  let last = 101; for (let p = 100; p <= 3000; p += 25) { const d = decideBuyX({ askingPrice: p, isAuction: false, premiumPct: 0, hasPhotos: true, marketLow: 300, marketHigh: 700, retailHigh: 1100, smartBuy: 700, walkAway: 1100, bands: b }); assert.ok(d.score <= last, String(p)); last = d.score; }
  // negotiation figures: walk-away = dealer high, opening anchored toward the dealer low, all <= walk-away
  const nf = reconcileDealerNegotiation(b, 700);
  assert.equal(nf.walk_away_price, 1100); assert.equal(nf.good_buy_below, 700); assert.equal(nf.opening_offer, 630); assert.equal(nf.target_price_low, 700); assert.equal(nf.target_price_high, 900);
  for (const [lo, hi, dl, dh] of [[100, 300, 50, 80], [2500, 5500, 6000, 9000], [7650, 11500, 9945, 18400], [0, 0, 0, 0]]) {
    const dr = saneDealerRange(lo, hi, dl, dh); const bb = dealerBands(lo, hi, dr.low, dr.high); const x = reconcileDealerNegotiation(bb, dr.low);
    assert.ok(x.opening_offer <= x.good_buy_below && x.good_buy_below <= x.walk_away_price && x.target_price_low <= x.target_price_high && x.target_price_high <= x.walk_away_price, `${lo} ${hi}`);
  }
});

check("dealer mode wired: the Louis-Philippe mirror (auction €300–700, dealer €700–1,100) is Fair at €950 and €800; offers <= the dealer high; auction mode unchanged", () => {
  const lpRaw = () => { const r: any = bellRaw(); const it = r.items[0];
    it.item_summary.title = "Large Louis-Philippe Painted Mirror"; it.item_summary.category = "Mirrors"; it.item_summary.maker = null; it.item_summary.period_certainty = "confirmed_period"; it.item_summary.confidence_breakdown = { evidence_quality: 30, identification_certainty: 25, risk_factors: 20 };
    Object.assign(it.price_guidance, { estimated_market_range_low: 300, estimated_market_range_high: 700, good_buy_below: 400, fair_price_low: 700, fair_price_high: 1100, overpaying_above: 700, pricing_reasoning: "Painted Louis-Philippe mirror." });
    Object.assign(it.negotiation_strategy, { opening_offer: 300, target_price_low: 400, target_price_high: 600, walk_away_price: 700 }); return r; };
  const q = "Large Louis-Philippe mirror, 1.7 m × 1.2 m, painted cream frame with moulded decoration; the dealer says the glass is original 19th-century mercury glass.";
  for (const ask of [950, 800]) {
    const a: any = postProcessAppraisal(lpRaw(), dealerCtx(q, { askingPrice: ask, category: "mirrors" }))[0];
    assert.equal(a.buy_decision.label, "Fair Price", String(ask)); assert.equal(a.buy_decision.price_scale, "dealer");
    assert.deepEqual([a.price_guidance.estimated_market_range_low, a.price_guidance.estimated_market_range_high, a.price_guidance.fair_price_low, a.price_guidance.fair_price_high], [300, 700, 700, 1100]);
    assert.equal(a.negotiation_strategy.walk_away_price, 1100); assert.equal(a.price_guidance.overpaying_above, 1100);
    const np = a.negotiation_plan; assert.ok(np.opening_offer <= np.happy_at && np.happy_at <= 1100 && np.happy_at < ask, JSON.stringify(np));
    assert.ok(np.opening_offer >= 700 - 1, String(np.opening_offer)); // anchored toward the dealer low
    assert.equal(np.payment.mode, "cash");
    assert.deepEqual(a.buy_decision.dealer_bands, { strong_buy_to: 500, good_buy_to: 700, fair_to: 1100, overpriced_to: 1650 });
  }
  const at950: any = postProcessAppraisal(lpRaw(), dealerCtx(q, { askingPrice: 950, category: "mirrors" }))[0];
  assert.deepEqual([at950.negotiation_plan.opening_offer, at950.negotiation_plan.happy_at], [760, 830]);
  assert.equal(postProcessAppraisal(lpRaw(), dealerCtx(q, { askingPrice: 650, category: "mirrors" }))[0].buy_decision.label, "Good Buy");
  assert.equal(postProcessAppraisal(lpRaw(), dealerCtx(q, { askingPrice: 1400, category: "mirrors" }))[0].buy_decision.label, "Overpriced");
  assert.equal(postProcessAppraisal(lpRaw(), dealerCtx(q, { askingPrice: 2000, category: "mirrors" }))[0].buy_decision.label, "Walk Away");
  // private seller: same dealer range scale
  assert.equal(postProcessAppraisal(lpRaw(), dealerCtx(q, { askingPrice: 950, category: "mirrors", sellerType: "Market/Fair" }))[0].buy_decision.price_scale, "dealer");
  // the model's dealer range out of line: clamped (low >= auction mid, high >= auction high)
  const bad = lpRaw(); Object.assign(bad.items[0].price_guidance, { fair_price_low: 320, fair_price_high: 650 });
  const c: any = postProcessAppraisal(bad, dealerCtx(q, { askingPrice: 950, category: "mirrors" }))[0];
  assert.deepEqual([c.price_guidance.fair_price_low, c.price_guidance.fair_price_high], [500, 700]); assert.equal(c.buy_decision.label, "Overpriced");
  // auction mode: the auction range, its walk-away and bands as before
  const au: any = postProcessAppraisal(lpRaw(), dealerCtx(q, { askingPrice: 950, category: "mirrors", isAuction: true, premiumPct: 25, sellerType: "Auction" }))[0];
  assert.equal(au.buy_decision.price_scale, "auction"); assert.equal(au.buy_decision.dealer_bands, null);
  assert.equal(au.negotiation_strategy.walk_away_price, 700); assert.equal(au.buy_decision.label, "Overpriced");
  const bad2 = lpRaw(); Object.assign(bad2.items[0].price_guidance, { fair_price_low: 320, fair_price_high: 650 });
  const au2: any = postProcessAppraisal(bad2, dealerCtx(q, { askingPrice: 950, category: "mirrors", isAuction: true, premiumPct: 25, sellerType: "Auction" }))[0];
  assert.deepEqual([au2.price_guidance.fair_price_low, au2.price_guidance.fair_price_high], [320, 700]); // not clamped in auction mode (unchanged)
  // the model's notes never contradict the verdict (dealer mode); auction prose untouched
  const wordy = () => { const r = lpRaw(); const it = r.items[0];
    it.item_summary.snap_judgement = "A decorative piece. At 950 EUR this is a full retail price.";
    it.buy_decision.decision_summary = ["Large size is desirable.", "Too expensive for a dealer purchase.", "Painted finish limits the audience."];
    it.buy_decision.resale_insight = "The asking price is full retail, leaving little margin.";
    it.dealer_take.dealer_view = ["Trop cher pour un achat marchand.", "La peinture est un risque."];
    it.price_guidance.pricing_reasoning = "Louis-Philippe mirrors are common. 950 EUR is a full retail price; auction hammers fall between 300 and 700 EUR."; return r; };
  const w: any = postProcessAppraisal(wordy(), dealerCtx(q, { askingPrice: 950, category: "mirrors" }))[0];
  assert.equal(w.buy_decision.label, "Fair Price");
  const prose = JSON.stringify([w.item_summary.snap_judgement, w.buy_decision.decision_summary, w.buy_decision.resale_insight, w.dealer_take.dealer_view, w.price_guidance.pricing_reasoning]);
  assert.ok(!/full retail|too expensive|trop cher/i.test(prose), prose);
  assert.deepEqual(w.buy_decision.decision_summary, ["Large size is desirable.", "Painted finish limits the audience."]);
  assert.deepEqual(w.dealer_take.dealer_view, ["La peinture est un risque."]);
  assert.equal(w.item_summary.snap_judgement, "A decorative piece.");
  assert.match(w.price_guidance.pricing_reasoning, /^€950 is within the dealer range \(€700–€1,100\): a fair shop price\. At auction it would make about €300–€700 \(hammer\)\. Louis-Philippe mirrors are common\. Auction hammers fall between 300 and 700 EUR\.$/);
  assert.ok(w.buy_decision.resale_insight && !/retail/.test(w.buy_decision.resale_insight)); // emptied -> the verdict line
  assert.ok(w.buy_decision.prose_sentences_removed >= 5);
  const wf: any = postProcessAppraisal(wordy(), dealerCtx(q, { askingPrice: 950, category: "mirrors", language: "fr" }))[0];
  assert.match(wf.price_guidance.pricing_reasoning, /dans la fourchette marchand/);
  // Overpriced: "a bargain" style sentences go instead
  const ov = wordy(); ov.items[0].buy_decision.decision_summary = ["A bargain for the size.", "Check the glass."];
  const o: any = postProcessAppraisal(ov, dealerCtx(q, { askingPrice: 1400, category: "mirrors" }))[0];
  assert.equal(o.buy_decision.label, "Overpriced"); assert.deepEqual(o.buy_decision.decision_summary, ["Check the glass."]);
  // auction mode: the model's prose is not touched
  const wa: any = postProcessAppraisal(wordy(), dealerCtx(q, { askingPrice: 500, category: "mirrors", isAuction: true, premiumPct: 25, sellerType: "Auction" }))[0];
  assert.ok(wa.buy_decision.decision_summary.includes("Too expensive for a dealer purchase.")); assert.equal(wa.buy_decision.prose_sentences_removed, undefined);
  // texts in EN and FR
  for (const lang of ["en", "fr"]) {
    const j = JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), "utf8")).analysis;
    for (const k of ["auction_range", "dealer_range", "dealer_scale_note", "reason_dealer_strong_buy", "reason_dealer_good_buy", "reason_dealer_fair", "reason_dealer_overpriced", "reason_dealer_walk_away"]) assert.ok(j[k], `${lang} ${k}`);
  }
});

check("a confirmed Bellangé stamp changes the valuation: comps-anchored range, 'Fair' at a dealer's €12k (within the dealer range), not 'Overpriced'; a dealer's label stays plain Empire", () => {
  const conf: any = postProcessAppraisal(bellRaw(), dealerCtx(BELL_CONF, { comps: COMPS_RESP }))[0];
  assert.equal(conf.maker_attribution.status, "stamped_confirmed");
  assert.equal(conf.comparables.status, "anchored");
  assert.deepEqual([conf.price_guidance.estimated_market_range_low, conf.price_guidance.estimated_market_range_high], [7650, 11500]);
  // shop price judged against the dealer range (comps x1.3 .. x1.6 = €9,950–18,400): €12k is a fair shop price
  assert.deepEqual([conf.price_guidance.fair_price_low, conf.price_guidance.fair_price_high], [9945, 18400]);
  assert.equal(conf.buy_decision.label, "Fair Price"); assert.equal(conf.buy_decision.price_scale, "dealer");
  assert.equal(conf.negotiation_strategy.walk_away_price, 18400);
  assert.match(conf.item_summary.title, /stamped Bellangé/); assert.ok(!/Attributed/i.test(conf.item_summary.title));
  assert.match(conf.price_guidance.pricing_reasoning, /Anchored on 3 verified auction results/);
  const label: any = postProcessAppraisal(bellRaw(), dealerCtx(BELL_LABEL, { comps: COMPS_RESP }))[0];
  assert.equal(label.maker_attribution.status, "dealer_label");
  assert.equal(label.comparables.status, "shown");
  assert.equal(label.price_guidance.estimated_market_range_high, 5500);
  assert.equal(label.buy_decision.label, "Overpriced"); // above the dealer high (€9,000), not 1.5x above it
  // no verified comparables: says so and falls back to the appraiser's range
  const none: any = postProcessAppraisal(bellRaw(), dealerCtx(BELL_CONF, { comps: { ...COMPS_RESP, comparables: [] } }))[0];
  assert.equal(none.comparables.status, "none_verified");
  assert.equal(none.price_guidance.estimated_market_range_high, 5500);
  const failed: any = postProcessAppraisal(bellRaw(), dealerCtx(BELL_CONF, { comps: null }))[0];
  assert.equal(failed.comparables.status, "error");
});

check("before you buy: a checklist for the piece, maker claim and set; answers re-run (confirm firms up, deny lowers)", () => {
  const items = buildChecklist({ pieceKind: "seating", pieces: 4, period: "Empire", maker: { name: "Bellangé", status: "stamped_confirmed" }, basis: "overpriced", text: BELL_CONF });
  const ids = items.map(i => i.id);
  for (const id of ["stamp_every_piece", "matching_set", "joints_underneath", "seat_rails_webbing", "invoice_wording", "provenance_condition_report"]) assert.ok(ids.includes(id as any), id);
  assert.equal(items[0].id, "stamp_every_piece"); assert.equal(items[0].vars?.where, "seat_rail");
  assert.ok(buildChecklist({ pieceKind: "seating", pieces: 4, maker: { name: "Bellangé", status: "dealer_label" }, text: BELL_LABEL }).some(i => i.id === "label_is_not_stamp"));
  const mirror = buildChecklist({ pieceKind: "mirror", pieces: 1, period: "Louis XVI", maker: null, basis: "walk_away", text: "Louis XVI mirror carved giltwood with crest, glass original" }).map(i => i.id);
  for (const id of ["mirror_glass_original", "mirror_back_original", "crest_original", "gilding_original", "invoice_wording"]) assert.ok(mirror.includes(id as any), id);
  assert.ok(!mirror.includes("stamp_present"));
  assert.ok(buildChecklist({ pieceKind: "case", pieces: 1, text: "Commode à plateau de marbre, bronzes, placage" }).some(i => i.id === "marble_original"));
  const yes = checksEffect({ stamp_every_piece: "yes", matching_set: "yes", joints_underneath: "yes" }, items);
  assert.ok(yes.confidenceDelta > 0); assert.equal(yes.rangeFactor, 1); assert.equal(yes.stampOverride, "confirmed"); assert.equal(yes.periodConfirmed, true);
  const no = checksEffect({ stamp_every_piece: "no", matching_set: "no" }, items);
  assert.ok(no.confidenceDelta < 0); assert.equal(no.rangeFactor, DENIAL_FACTOR.matching_set); assert.equal(no.stampOverride, "denied");
  assert.equal(checksEffect({ mirror_glass_original: "unsure" }).confidenceDelta, 0);
  assert.match(checksPrompt({ mirror_glass_original: "yes" }), /mirror glass original: CONFIRMED/);
  // in the appraisal: stamp denied -> no maker premium, lower confidence; glass + back confirmed -> higher confidence, narrower range
  const confirmed: any = postProcessAppraisal(bellRaw(), dealerCtx(BELL_CONF, { comps: COMPS_RESP }))[0];
  const denied: any = postProcessAppraisal(bellRaw(), dealerCtx(BELL_CONF, { comps: COMPS_RESP, checkAnswers: { stamp_every_piece: "no" } }))[0];
  assert.equal(denied.comparables.status, "shown"); assert.equal(denied.price_guidance.estimated_market_range_high, 5500);
  assert.ok(denied.item_summary.confidence_score < confirmed.item_summary.confidence_score);
  assert.ok(denied.checklist.items.some((i: any) => i.id === "stamp_every_piece")); // the question stays, with its answer
  assert.equal(denied.checklist.answers.stamp_every_piece, "no");
  const firm: any = postProcessAppraisal(bellRaw(), dealerCtx(BELL_CONF, { comps: COMPS_RESP, checkAnswers: { stamp_every_piece: "yes", matching_set: "yes", joints_underneath: "yes" } }))[0];
  assert.ok(firm.item_summary.confidence_score > confirmed.item_summary.confidence_score);
  assert.ok(firm.price_guidance.estimated_market_range_low > confirmed.price_guidance.estimated_market_range_low);
  const set: any = postProcessAppraisal(bellRaw(), dealerCtx(BELL_CONF, { comps: COMPS_RESP, checkAnswers: { matching_set: "no" } }))[0];
  assert.ok(set.price_guidance.estimated_market_range_high < confirmed.price_guidance.estimated_market_range_high);
});

check("checklist re-run: starts from the range the checklist was shown with (a fresh model call cannot move it), unless the stamp basis changed", () => {
  const first: any = postProcessAppraisal(bellRaw(), dealerCtx(BELL_CONF, { comps: { ...COMPS_RESP, comparables: [] } }))[0];
  assert.deepEqual([first.checklist.base.low, first.checklist.base.high, first.checklist.base.maker_status], [2500, 5500, "stamped_confirmed"]);
  const drift = () => { const r: any = bellRaw(); Object.assign(r.items[0].price_guidance, { estimated_market_range_low: 900, estimated_market_range_high: 1600, fair_price_low: 2000, fair_price_high: 3000 }); return r; };
  const yes: any = postProcessAppraisal(drift(), dealerCtx(BELL_CONF, { comps: { ...COMPS_RESP, comparables: [] }, checkAnswers: { stamp_every_piece: "yes", matching_set: "yes" }, previousBase: first.checklist.base }))[0];
  assert.equal(yes.price_guidance.estimated_market_range_high, 5500); assert.ok(yes.price_guidance.estimated_market_range_low > 2500);
  assert.ok(yes.item_summary.confidence_score > first.item_summary.confidence_score);
  const no: any = postProcessAppraisal(drift(), dealerCtx(BELL_CONF, { comps: { ...COMPS_RESP, comparables: [] }, checkAnswers: { stamp_every_piece: "no" }, previousBase: first.checklist.base }))[0];
  assert.equal(no.price_guidance.estimated_market_range_high, 1600);
  const t: any = bellRaw(); t.items[0].item_summary.title = "Set of four Empire mahogany armchairs, attributed to Pierre-Antoine Bellangé";
  assert.equal((postProcessAppraisal(t, dealerCtx(BELL_CONF, { comps: null }))[0] as any).item_summary.title, "Set of four Empire mahogany armchairs (stamped Bellangé)");
});

check("negotiate: opening / happy-at from the app's own figures, never above the walk-away; cash only where French law allows (art. D112-3)", () => {
  // mirror asked €950 at a dealer, app walk-away €1,200: opening near €800, cash allowed (≤ €1,000)
  const m = buildNegotiationPlan({ sellerType: "Antique Shop", isAuction: false, askingPrice: 950, currency: "EUR", walkAway: 1200, openingOffer: 600, targetHigh: 1000 });
  assert.equal(m.kind, "dealer"); assert.equal(m.opening_offer, 810); assert.equal(m.happy_at, 880);
  assert.equal(m.payment?.mode, "cash"); assert.deepEqual(m.payment?.discount_amount, [40, 90]);
  // asking above the walk-away: the suggestions stay at or below it
  const m2 = buildNegotiationPlan({ sellerType: "Antique Shop", isAuction: false, askingPrice: 950, currency: "EUR", walkAway: 700, openingOffer: 400, targetHigh: 630 });
  assert.ok(m2.happy_at! <= 700 && m2.opening_offer! <= m2.happy_at!); assert.equal(m2.asking_over_walk_pct, 36);
  // Bellangé chairs €12k at a dealer: no cash (over €1,000 to a professional), pay by instant transfer / card
  const b = buildNegotiationPlan({ sellerType: "Antique Shop", isAuction: false, askingPrice: 12000, currency: "EUR", walkAway: 8000, openingOffer: 3200, targetHigh: 7200, maker: "Bellangé", text: "fauteuils acajou" });
  assert.equal(b.payment?.mode, "transfer"); assert.equal(b.payment?.discount_amount, undefined); assert.ok(b.happy_at! <= 8000);
  assert.equal(CASH_CAP_FR_RESIDENT_EUR, 1000); assert.equal(CASH_CAP_FR_NON_RESIDENT_EUR, 15000);
  assert.ok(b.invoice.terms.includes("estampille") && b.invoice.terms.includes("epoque"));
  // private seller: cash is fine with a receipt (flag when a trader would be over the cap)
  const p = buildNegotiationPlan({ sellerType: "Market/Fair", isAuction: false, askingPrice: 2500, currency: "EUR", walkAway: 3000 });
  assert.equal(p.kind, "private"); assert.equal(p.payment?.mode, "cash_private_receipt"); assert.equal(p.payment?.over_cap, true);
  // in another currency the cap is checked in EUR
  assert.equal(buildNegotiationPlan({ sellerType: "Antique Shop", isAuction: false, askingPrice: 1000, currency: "GBP", walkAway: 1200 }).payment?.mode, "transfer"); // £930 ≈ €1,088
  assert.equal(buildNegotiationPlan({ sellerType: "Antique Shop", isAuction: false, askingPrice: 1000, currency: "EUR", walkAway: 1200 }).payment?.mode, "cash"); // €930
  // a 'No' in the checklist becomes a lever
  const f = buildNegotiationPlan({ sellerType: "Antique Shop", isAuction: false, askingPrice: 3000, currency: "EUR", walkAway: 3000, pieceKind: "mirror", text: "carved giltwood mirror",
    checklist: [{ id: "mirror_glass_original", important: true }, { id: "invoice_wording", important: true }], answers: { mirror_glass_original: "no", invoice_wording: "no" } });
  assert.equal(f.levers[0].id, "flaws"); assert.deepEqual(f.levers[0].flaws, ["mirror_glass_original"]);
  assert.ok(f.invoice.terms.includes("glace") && !f.invoice.terms.includes("bronzes"));
  assert.ok(buildNegotiationPlan({ isAuction: false, currency: "EUR", walkAway: 5000, text: "commode tombeau, bronzes dorés, marbre" }).invoice.terms.includes("bronzes"));
  // auction: bidding tips (max incl. fees), no cash
  const a = buildNegotiationPlan({ sellerType: "Auction", isAuction: true, askingPrice: 850, currency: "EUR", walkAway: 1400, premiumPct: 28 });
  assert.equal(a.kind, "auction"); assert.equal(a.payment, undefined); assert.equal(a.opening_offer, undefined); assert.deepEqual(a.bidding, { max_hammer: 1400, max_all_in: 1792, premium_pct: 28 });
  // property: never above the walk-away
  for (const walk of [90, 450, 999, 1001, 5500, 12000]) for (const ask of [undefined, 50, walk * 0.8, walk, walk * 1.5]) for (const th of [undefined, walk * 0.5, walk * 2]) {
    const x = buildNegotiationPlan({ sellerType: "Antique Shop", isAuction: false, askingPrice: ask, currency: "EUR", walkAway: walk, targetHigh: th, openingOffer: th });
    assert.ok(x.happy_at! <= walk && x.opening_offer! <= x.happy_at!, `${walk} ${ask} ${th}`);
  }
  // wired into the appraisal (dealer mode)
  const pp: any = postProcessAppraisal(bellRaw(), dealerCtx(BELL_CONF, { comps: null }))[0];
  assert.equal(pp.negotiation_plan.kind, "dealer"); assert.equal(pp.negotiation_plan.payment.mode, "transfer");
  assert.ok(pp.negotiation_plan.happy_at <= pp.negotiation_strategy.walk_away_price);
  // texts in EN and FR
  for (const lang of ["en", "fr"]) {
    const j = JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), "utf8")).negotiate;
    for (const k of ["title", "bidding_title", "opening", "happy_at", "suggestion_note", "pay_cash", "pay_cash_private", "pay_transfer", "invoice", "bid_absentee", "bid_max_prefix", "bid_max_locked"]) assert.ok(j[k], `${lang} ${k}`);
    assert.match(j.pay_transfer, /D112-3/); assert.match(j.pay_transfer, /\{\{cap\}\}/);
    for (const id of ["bundle", "flaws", "delivery", "timing"]) assert.ok(j.levers[id]);
    for (const id of ["epoque", "estampille", "bronzes", "marbre", "glace", "restaurations"]) assert.ok(j.invoice_terms[id]);
  }
  const view = readFileSync(new URL("../src/components/AnalysisView.tsx", import.meta.url), "utf8");
  assert.match(view, /<Negotiate embedded/); assert.match(view, /<Negotiate plan=/);
});

check("checklist and comparables texts exist in EN and FR (every item, status and fallback)", () => {
  const ids = ["stamp_every_piece", "stamp_present", "label_is_not_stamp", "matching_set", "joints_underneath", "seat_rails_webbing", "mirror_glass_original", "mirror_back_original", "crest_original", "gilding_original", "marble_original", "hardware_original", "veneer_sound", "no_major_restoration", "invoice_wording", "provenance_condition_report"];
  for (const lang of ["en", "fr"]) {
    const j = JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), "utf8"));
    for (const id of ids) assert.ok(j.checklist.items[id], `${lang} ${id}`);
    for (const k of ["yes", "no", "unsure", "rerun", "title", "title_embedded"]) assert.ok(j.checklist[k], `${lang} ${k}`);
    for (const st of ["stamped_confirmed", "stamped_stated", "stamp_in_photo", "attributed", "dealer_label", "mentioned"]) { assert.ok(j.comps.status[st]); assert.ok(j.comps.status_note[st]); }
    for (const f of ["too_few", "not_stamped", "none_verified", "error", "not_searched"]) assert.ok(j.comps.fallback[f], `${lang} ${f}`);
    assert.match(j.comps.stamp_warning, /(EVERY|CHAQUE)/);
    assert.match(j.comps.stamp_warning, /(invoice|facture)/);
  }
  const view = readFileSync(new URL("../src/components/AnalysisView.tsx", import.meta.url), "utf8");
  assert.match(view, /<MakerAndComparables/); assert.match(view, /<BeforeYouBuy embedded/); assert.match(view, /<BeforeYouBuy items/);
});

check("comps server function: within the 50 s budget; never returns an unverified result; says so when nothing is verified", () => {
  assert.ok(COMPS_TOTAL_BUDGET_MS <= 47_000 && COMPS_GEMINI_TIMEOUT_MS + COMPS_VERIFY_BUDGET_MS <= COMPS_TOTAL_BUDGET_MS);
  assert.ok(COMPS_CLIENT_TIMEOUT_MS <= 50_000);
  const vj = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(vj.functions["api/comps.ts"].maxDuration, 60);
  assert.match(readFileSync(new URL("../api/comps.ts", import.meta.url), "utf8"), /handleCompsRequest/);
  assert.match(readFileSync(new URL("../server.ts", import.meta.url), "utf8"), /\/api\/comps/);
});

await (async () => {
  const r400 = await handleCompsRequest({}, "x");
  assert.equal(r400.status, 400);
  const noKey = await findComparables({ maker: "Bellangé", piece: "armchair" }, undefined);
  assert.equal(noKey.error, "no_api_key"); assert.equal(noKey.comparables.length, 0);
  const pages: Record<string, string> = {
    "https://www.christies.com/en/lot/lot-6314500": christiesHtml("6314500", "1"),
    "https://www.bonhams.com/auction/31313/lot/152/x/": bonhamsHtml,
    "https://www.example-auction.fr/lot/9": "<html><title>Paire de fauteuils estampillés Bellangé</title><p>Estimation 3 000 €</p></html>",
  };
  const res = await findComparables({ maker: "Bellangé", piece: "armchair", material: "mahogany", pieces: 4 }, undefined, Date.now(), {
    search: async () => ({ text: JSON.stringify({ results: [
      { url: "https://www.christies.com/en/lot/lot-6314500", house: "Christie's", title: "x", price: 2250, currency: "EUR" },
      { url: "https://www.bonhams.com/auction/31313/lot/152/x/", house: "Bonhams", title: "x", price: 4096, currency: "USD", sale_date: "2025-05-07" },
      { url: "https://www.example-auction.fr/lot/9", house: "X", title: "invented", price: 7000, currency: "EUR" },
      { url: "https://www.christies.com/en/lot/lot-404", house: "Christie's", title: "invented", price: 5000, currency: "EUR" },
    ] }), grounded: [] }),
    fetchHtml: async (url) => pages[url] ? { status: 200, html: pages[url], finalUrl: url } : { status: 404, finalUrl: url },
  });
  assert.equal(res.ok, true);
  assert.equal(res.comparables.length, 2);
  assert.deepEqual(res.comparables.map(c => c.house).sort(), ["Bonhams", "Christie's"]);
  assert.equal(res.stats.dropped.price_not_on_page, 1); assert.equal(res.stats.dropped.http_404, 1);
  assert.ok(res.checked?.some(c => c.result === 'verified') && res.checked?.some(c => c.result === 'http_404'));
  passed++; console.log("ok - comps server function: only page-verified results are returned (invented or unreachable ones are dropped)");
  // parallel scoped searches: one failing scope does not lose the others; all failing reports the error
  const part = await findComparables({ maker: "Bellangé", piece: "armchair", material: "mahogany", pieces: 4 }, undefined, Date.now(), {
    search: async (prompt) => {
      const scope = (prompt.match(/Where to look: ([^\n]*)/) || [])[1] || "";
      if (scope.startsWith("Bonhams")) throw new Error("boom");
      if (scope.startsWith("French")) return { text: "not json", grounded: ["https://www.christies.com/en/lot/lot-6314500"] };
      return { text: JSON.stringify({ results: [{ url: "https://www.bonhams.com/auction/31313/lot/152/x/", house: "Bonhams", title: "x", price: 4096, currency: "USD" }] }), grounded: [] };
    },
    fetchHtml: async (url) => pages[url] ? { status: 200, html: pages[url], finalUrl: url } : { status: 404, finalUrl: url },
  });
  assert.equal(part.comparables.length, 2); assert.equal(part.error, undefined); assert.ok(part.partial?.length && part.partial.every(e => e === "boom"));
  const all = await findComparables({ maker: "Bellangé", piece: "armchair" }, undefined, Date.now(), { search: async () => { throw new Error("down"); }, fetchHtml: async (url) => ({ status: 404, finalUrl: url }) });
  assert.equal(all.error, "down"); assert.equal(all.comparables.length, 0);
  const blocked = await findComparables({ maker: "Bellangé", piece: "armchair" }, undefined, Date.now(), {
    search: async () => ({ text: JSON.stringify({ results: [{ url: "https://www.bonhams.com/auction/1/lot/2/", house: "Bonhams", title: "x", price: 1, currency: "USD" }] }), grounded: [] }),
    fetchHtml: async (url) => ({ status: 403, finalUrl: url }),
  });
  assert.equal(blocked.comparables.length, 0); assert.ok(blocked.unreachable.some(u => /Bonhams/.test(u)));
  assert.equal(parseLooseJson('Here:\n```json\n{"results":[{"url":"u"}]}\n```').results[0].url, "u");
  assert.deepEqual(parseLooseJson("no json here"), {});
  passed++; console.log("ok - comps server function: scoped searches run in parallel; a failed scope keeps the others' verified results");
})();




check("field notes: content coverage (piece / period / stamps / buying)", () => {
  const counts = countsByCategory();
  assert.ok(counts.piece >= 30, `piece notes ${counts.piece}`);
  assert.ok(counts.period >= 15, `period notes ${counts.period}`);
  assert.ok(counts.stamps >= 6, `stamps ${counts.stamps}`);
  assert.ok(counts.buying >= 6, `buying ${counts.buying}`);
  assert.equal(FIELD_NOTES.length, counts.piece + counts.period + counts.stamps + counts.buying);
  for (const n of FIELD_NOTES) {
    assert.ok(n.title.en && n.title.fr, n.id);
    assert.ok(n.body.en.length > 40 && n.body.fr.length > 40, n.id);
    assert.equal(n.illustration, n.id, `illustration must equal note id (${n.id})`);
  }
  const pieceTags = new Set(FIELD_NOTES.flatMap(n => n.pieceTags));
  for (const tag of ["commodes", "mirrors", "chairs", "cabinets", "tables", "secretaires"] as PieceTag[]) {
    assert.ok(pieceTags.has(tag), tag);
    assert.ok(FIELD_NOTES.filter(n => n.pieceTags.includes(tag)).length >= 5, `${tag} checks`);
  }
  // Restauration / Charles X coverage
  const rest = FIELD_NOTES.filter(n => n.periodTags.includes("restauration"));
  assert.ok(rest.length >= 4, `restauration notes ${rest.length}`);
  assert.ok(rest.some(n => /bois clair|citronnier|gondol|console|Charles X|copie|copy/i.test(n.title.en + n.body.en)));
});

check("field notes: every illustration is unique and registered (no fallbacks)", () => {
  assert.ok(illustrationBelongsOnlyToItsNote(), "illustration must equal note id for every note");
  assert.ok(scamIllustrationNotReused(), "€1 faire offre drawing only on buy-scam-listings");
  const ills = FIELD_NOTES.map(n => n.illustration);
  assert.equal(new Set(ills).size, ills.length, "duplicate illustration ids");
  assert.equal(EXPECTED_ILLUSTRATION_IDS.length, FIELD_NOTES.length);
  for (const n of FIELD_NOTES) {
    assert.ok(hasIllustration(n.illustration), `missing drawing for ${n.illustration}`);
  }
  assert.equal(REGISTERED_ILLUSTRATION_IDS.length, FIELD_NOTES.length);
  assert.deepEqual([...REGISTERED_ILLUSTRATION_IDS].sort(), [...EXPECTED_ILLUSTRATION_IDS].sort());
  assert.equal(SCAM_ONLY_ILLUSTRATION_ID, "buy-scam-listings");
  for (const id of ["per-regence-trap", "per-louis-xv-style", "per-style-trap", "stamp-fakes", "per-louis-xv", "per-louis-xvi", "mirror-mercury"]) {
    const n = FIELD_NOTES.find(x => x.id === id);
    assert.ok(n, id);
    assert.equal(n!.illustration, id);
    assert.notEqual(n!.illustration, "buy-scam-listings");
  }
});

check("field notes: EN/FR search and category filters", () => {
  assert.ok(filterNotes({ query: "dovetail" }, "en").some(n => n.id === "commode-dovetails"));
  assert.ok(filterNotes({ query: "queue d'aronde" }, "fr").some(n => n.id === "commode-dovetails"));
  assert.ok(filterNotes({ query: "mercure" }, "fr").some(n => n.id === "mirror-mercury"));
  assert.ok(filterNotes({ category: "stamps" }, "en").every(n => n.category === "stamps"));
  assert.ok(filterNotes({ category: "piece", pieceTag: "chairs" }, "en").every(n => n.pieceTags.includes("chairs")));
  assert.ok(filterNotes({ category: "buying", query: "D112-3" }, "en").some(n => n.id === "buy-cash-cap"));
  assert.ok(filterNotes({ query: "gondole" }, "fr").some(n => n.id === "per-restauration-gondole"));
});

check("field notes: period and piece tag detection", () => {
  assert.deepEqual(periodTagsFromText("Louis XVI fauteuil"), ["louis_xvi"]);
  assert.ok(periodTagsFromText("époque Empire", "Bellangé").includes("directoire_empire"));
  assert.ok(periodTagsFromText("Louis-Philippe mercury mirror").includes("louis_philippe"));
  assert.ok(periodTagsFromText("Gustavian painted cupboard").includes("gustavian"));
  assert.ok(periodTagsFromText("Restauration citronnier").includes("restauration"));
  assert.ok(pieceTagsFromAppraisal("mirrors", "Large Provençal giltwood mirror").includes("mirrors"));
  assert.ok(pieceTagsFromAppraisal("chairs", "Four Empire mahogany armchairs").includes("chairs"));
  assert.ok(pieceTagsFromAppraisal(undefined, "Commode tombeau Transition").includes("commodes"));
});

check("field notes: appraisal matching (Provençal mirror & Bellangé chairs)", () => {
  const mirror = matchNotesForPiece({
    category: "mirrors",
    title: "Louis XVI Provençal giltwood mirror",
    style: "Louis XVI",
    period: "circa 1780",
    origin: "Provence",
  }, 5);
  assert.ok(mirror.length >= 3 && mirror.length <= 5);
  assert.ok(mirror.some(r => r.note.pieceTags.includes("mirrors") || r.note.id.includes("mirror")));

  const chairs = matchNotesForPiece({
    category: "chairs",
    title: "Set of four Empire mahogany fauteuils",
    style: "Empire",
    period: "Empire",
    makerText: "Bellangé stamped_confirmed",
    hasMakerClaim: true,
  }, 5);
  assert.ok(chairs.length >= 3);
  assert.ok(chairs.some(r => r.note.makerRelated || r.note.pieceTags.includes("chairs")));
});

check("field notes: cash-cap note matches negotiation constants", () => {
  const note = FIELD_NOTES.find(n => n.id === "buy-cash-cap");
  assert.ok(note);
  assert.ok(note!.body.en.includes("1,000") || note!.body.en.includes("1000"));
  assert.ok(note!.body.en.includes("15,000") || note!.body.en.includes("15000"));
  assert.ok(note!.body.en.includes("D112-3"));
  assert.equal(CASH_NOTE_CAP, 1000);
  assert.ok(teaserNotes({ count: 2 }).length === 2);
});


console.log(`
${passed} checks passed`);
