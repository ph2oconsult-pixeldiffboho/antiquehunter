// Quick self-checks for the hunt URL filters and appraisal maths.
// Run: npx tsx scripts/check-hunt-logic.ts
import assert from "node:assert/strict";
import {
  allowedDomainsFor, cleanText, failsPeriodRule, isAllowedHost, isGenericUrl, isSpecificListingUrl, parsePage,
} from "../src/services/huntValidation.ts";
import { allInCost, clampToBand, maxHammerForMarketHigh, priceBandScore } from "../src/services/appraisalMath.ts";

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
  // market 700-900, retail high 2000
  const at = (p: number) => priceBandScore(p, 700, 900, 2000)!.score;
  assert.ok(at(350) >= 80 && at(350) <= 95);
  assert.ok(at(700) >= 80 && at(700) <= 95);
  assert.ok(at(800) >= 50 && at(800) <= 70);
  assert.ok(at(900) >= 50 && at(900) <= 70);
  assert.ok(at(1000) < 35);
  assert.ok(at(2500) < 15);
  assert.notEqual(at(350), at(800));
  assert.equal(priceBandScore(0, 700, 900, 2000), null);
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
import { existsSync, readFileSync } from "node:fs";
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

console.log(`\n${passed} checks passed`);
