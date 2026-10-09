// Geography + relevance rules for "Find Me an Antique" (pure, unit-tested in scripts/check-hunt-logic.ts).
// The model is told about these rules, but they are ENFORCED here on the server: a result is dropped when its
// site or its location does not match the regions the user selected, or when it is not the kind of piece asked for.
import { hostMatches, hostOf } from "./huntValidation.js";

export type Region = 'France' | 'United Kingdom' | 'Sweden' | 'Europe' | 'United States';

// UI geography chips -> regions they cover. "Europe" covers the European countries we know about.
// "Global/Rest of World" switches the geography filter off.
export const GLOBAL_GEOGRAPHY = 'Global/Rest of World';
const GEO_ALIASES: Record<string, Region[]> = {
  'france': ['France'],
  'united kingdom': ['United Kingdom'],
  'uk': ['United Kingdom'],
  'sweden': ['Sweden'],
  'europe': ['Europe', 'France', 'United Kingdom', 'Sweden'],
  'united states': ['United States'],
  'usa': ['United States'],
};

/** null = no geographic restriction (nothing selected, or Global selected) */
export const regionsFor = (geographies: string[]): Set<Region> | null => {
  const list = (geographies || []).map(g => String(g || '').trim().toLowerCase()).filter(Boolean);
  if (list.length === 0 || list.some(g => g.startsWith('global'))) return null;
  const out = new Set<Region>();
  for (const g of list) for (const r of GEO_ALIASES[g] || []) out.add(r);
  return out.size ? out : null;
};

// Where each site's listings are located. Sites marked 'multi' sell in several countries: for those the listing's
// own location (from the page, or the search result) must match a selected region.
/** Auctionet lists the house currency: a strong hint of the country when the city is not in our lists. */
export const auctionetCurrencyRegion = (currency?: string): Region | null =>
  currency === 'SEK' ? 'Sweden' : currency === 'GBP' ? 'United Kingdom' : currency === 'DKK' || currency === 'EUR' || currency === 'NOK' ? 'Europe' : null;

const DOMAIN_REGIONS: Array<[string, Region[] | 'multi']> = [
  ['interencheres.com', ['France']],
  ['drouot.com', ['France']],
  ['leboncoin.fr', ['France']],
  ['selency.fr', ['France']],
  ['ebay.fr', ['France']],
  ['the-saleroom.com', ['United Kingdom']],
  ['easyliveauction.com', ['United Kingdom']],
  ['ebay.co.uk', ['United Kingdom']],
  ['auctionet.com', 'multi'],     // mostly Swedish houses, also Danish/Finnish/German/Spanish ones
  ['bukowskis.com', ['Sweden']],
  ['ebay.com', ['United States']],
  ['ebay.de', ['Europe']], ['ebay.it', ['Europe']], ['ebay.es', ['Europe']], ['ebay.nl', ['Europe']], ['ebay.be', ['Europe']],
  ['catawiki.com', 'multi'],
  ['christies.com', 'multi'],
  ['sothebys.com', 'multi'],
  ['bonhams.com', 'multi'],
];

export const domainRegions = (url: string): Region[] | 'multi' | null => {
  const host = hostOf(url);
  for (const [d, r] of DOMAIN_REGIONS) if (hostMatches(host, d)) return r;
  return null;
};

// Location words per region (lower-case, accents removed). Used for 'multi' sites and for the model's location.
const REGION_PLACES: Record<Region, string[]> = {
  'France': ['france', 'paris', 'lyon', 'marseille', 'bordeaux', 'toulouse', 'nice', 'nantes', 'lille', 'strasbourg', 'rennes',
    'montpellier', 'biarritz', 'avignon', 'dijon', 'beaune', 'tours', 'rouen', 'caen', 'orleans', 'reims', 'monaco', 'fontainebleau',
    'versailles', 'deauville', 'chartres', 'angers', 'limoges', 'clermont', 'grenoble', 'pau', 'bayonne', 'vendome', 'saint-'],
  'United Kingdom': ['united kingdom', 'uk', 'u.k.', 'england', 'wales', 'scotland', 'northern ireland', 'great britain', 'britain',
    'london', 'edinburgh', 'glasgow', 'cardiff', 'swansea', 'manchester', 'birmingham', 'bristol', 'leeds', 'york', 'bath', 'oxford',
    'cambridge', 'chester', 'shropshire', 'ludlow', 'cheshire', 'yorkshire', 'devon', 'cornwall', 'somerset', 'dorset', 'kent', 'sussex',
    'surrey', 'essex', 'suffolk', 'norfolk', 'gloucestershire', 'cotswolds', 'wiltshire', 'hampshire', 'lancashire', 'cumbria',
    'powys', 'gwynedd', 'conwy', 'colwyn bay', 'carmarthen', 'pembroke', 'herefordshire', 'worcestershire', 'derbyshire', 'nottingham',
    'leicester', 'lincoln', 'newcastle', 'durham', 'northumberland', 'liverpool', 'sheffield', 'exeter', 'plymouth', 'belfast'],
  'Sweden': ['sweden', 'sverige', 'swedish', 'stockholm', 'goteborg', 'gothenburg', 'malmo', 'uppsala', 'norrkoping', 'linkoping',
    'orebro', 'vasteras', 'helsingborg', 'lund', 'jonkoping', 'kalmar', 'karlstad', 'gavle', 'sundsvall', 'umea', 'visby', 'vaxjo',
    'halmstad', 'eskilstuna', 'falun', 'borlange', 'kristianstad', 'skane', 'dalarna', 'ystad', 'varberg', 'ostersund', 'skovde',
    'mjolby', 'nykoping', 'hudiksvall', 'soderhamn', 'bollnas', 'falkenberg', 'angelholm', 'trelleborg', 'kristinehamn', 'arvika',
    'boras', 'alingsas', 'kungsbacka', 'molndal', 'harnosand', 'ornskoldsvik', 'skelleftea', 'lulea', 'motala', 'enkoping',
    'sigtuna', 'sodertalje', 'nacka', 'lidingo', 'djursholm', 'saltsjobaden', 'vastervik', 'oskarshamn', 'karlskrona', 'landskrona',
    'eslov', 'hoor', 'simrishamn', 'tomelilla', 'uddevalla', 'trollhattan', 'vanersborg', 'lidkoping', 'mariestad', 'kumla', 'nora',
    'leksand', 'rattvik', 'mora', 'avesta', 'sala', 'koping', 'arboga', 'strangnas', 'katrineholm', 'flen', 'vimmerby', 'nassjo'],
  'Europe': ['europe', 'denmark', 'danmark', 'copenhagen', 'kobenhavn', 'finland', 'helsinki', 'norway', 'oslo', 'germany', 'deutschland',
    'berlin', 'munich', 'munchen', 'hamburg', 'cologne', 'koln', 'belgium', 'belgique', 'brussels', 'bruxelles', 'antwerp', 'netherlands',
    'amsterdam', 'italy', 'italia', 'milan', 'rome', 'florence', 'spain', 'espana', 'madrid', 'barcelona', 'austria', 'vienna', 'wien',
    'switzerland', 'geneva', 'geneve', 'zurich', 'portugal', 'lisbon', 'ireland', 'dublin', 'luxembourg', 'poland', 'czech', 'prague',
    'kopenhamn', 'aarhus', 'odense', 'vejle', 'aalborg', 'ringsted', 'helsingfors', 'turku', 'abo', 'tampere', 'bergen', 'trondheim',
    'dusseldorf', 'frankfurt', 'stuttgart', 'valencia', 'sevilla', 'bruges', 'gent', 'ghent'],
  'United States': ['united states', 'usa', 'u.s.', 'new york', 'los angeles', 'chicago', 'boston', 'philadelphia', 'dallas', 'houston',
    'san francisco', 'miami', 'new orleans', 'washington', 'atlanta', 'seattle'],
};

export const normalise = (s: unknown): string =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const placeRegex = (place: string) =>
  new RegExp(`(^|[^a-z])${place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${place.endsWith('-') ? '' : '($|[^a-z])'}`, 'i');

/** Regions mentioned in a location text ("Biarritz, France" -> France). Empty when unknown. */
export const regionsInLocation = (location: unknown): Set<Region> => {
  const text = normalise(location);
  const out = new Set<Region>();
  if (!text.trim()) return out;
  for (const [region, places] of Object.entries(REGION_PLACES) as Array<[Region, string[]]>) {
    if (places.some(p => placeRegex(p).test(text))) out.add(region);
  }
  return out;
};

export interface GeoVerdict { ok: boolean; reason?: 'geo_site_mismatch' | 'geo_location_mismatch' | 'geo_location_unknown' }

/**
 * Does this listing match the selected regions?
 *  - site tied to one country (Interencheres = France, The Saleroom = UK...): the site's country must be selected,
 *    and a location that clearly names another selected-out country also drops it;
 *  - multi-country site (Christie's, Auctionet, Catawiki...): the listing's location must name a selected region.
 */
export const checkGeography = (url: string, locations: Array<string | undefined | null>, regions: Set<Region> | null): GeoVerdict => {
  if (!regions) return { ok: true };
  const siteRegions = domainRegions(url);
  const found = new Set<Region>();
  for (const loc of locations) for (const r of regionsInLocation(loc)) found.add(r);
  const anySelected = (rs: Iterable<Region>) => Array.from(rs).some(r => regions.has(r));
  if (Array.isArray(siteRegions)) {
    if (!anySelected(siteRegions)) return { ok: false, reason: 'geo_site_mismatch' };
    // e.g. eBay UK listing located in France while only the UK is selected
    if (found.size > 0 && !anySelected(found)) return { ok: false, reason: 'geo_location_mismatch' };
    return { ok: true };
  }
  // multi-country or unknown site: location must be known and selected
  if (found.size === 0) return { ok: false, reason: 'geo_location_unknown' };
  return anySelected(found) ? { ok: true } : { ok: false, reason: 'geo_location_mismatch' };
};

// Selectable platforms -> the region they serve (used to build the list of sites the search may use).
export const PLATFORM_REGIONS: Record<string, Region[] | 'multi'> = {
  interencheres: ['France'], drouot: ['France'], leboncoin: ['France'], selency: ['France'],
  'the saleroom': ['United Kingdom'], 'easylive auction': ['United Kingdom'],
  auctionet: ['Sweden', 'Europe'], bukowskis: ['Sweden'],
  ebay: 'multi', "christie's": 'multi', "sotheby's": 'multi', bonhams: 'multi', catawiki: 'multi',
};

// Sources searched by default for a region when none of the user's selected platforms serves it
// (e.g. "United Kingdom only" with the default French platforms selected used to return French lots).
export const REGION_DEFAULT_PLATFORMS: Record<Region, string[]> = {
  'France': ['Interencheres', 'Drouot', 'LeBonCoin'],
  'United Kingdom': ['The Saleroom', 'easyLive Auction', 'eBay', 'Bonhams'],
  'Sweden': ['Auctionet', 'Bukowskis'],
  'Europe': ['Auctionet', 'Catawiki'],
  'United States': ['eBay', "Christie's", "Sotheby's"],
};

/** Platforms actually searched: the selected ones that can serve the selected regions, plus regional defaults. */
export const platformsForRegions = (platforms: string[], regions: Set<Region> | null): { platforms: string[]; ignored: string[] } => {
  if (!regions) return { platforms: [...platforms], ignored: [] };
  const keep: string[] = [];
  const ignored: string[] = [];
  const served = new Set<Region>();
  for (const p of platforms) {
    const r = PLATFORM_REGIONS[String(p).trim().toLowerCase()];
    if (r === 'multi') { keep.push(p); continue; }       // checked per listing (location)
    if (!r) { keep.push(p); continue; }
    if (r.some(x => regions.has(x))) { keep.push(p); r.forEach(x => served.add(x)); }
    else ignored.push(p);
  }
  for (const region of regions) {
    if (region === 'Europe' && (served.has('France') || served.has('Sweden') || served.has('United Kingdom'))) continue;
    if (!served.has(region)) for (const p of REGION_DEFAULT_PLATFORMS[region]) if (!keep.some(k => k.toLowerCase() === p.toLowerCase())) keep.push(p);
  }
  return { platforms: keep, ignored };
};

// ---------------------------------------------------------------------------
// Relevance: is this listing the kind of piece the user asked for?
// ---------------------------------------------------------------------------

// Each group lists the words for one type of piece in EN / FR / SV (+ a few DE/IT/ES). A query that names a
// type (e.g. "Welsh dresser") only accepts listings whose title or description name the same type.
export const ITEM_TYPES: Record<string, string[]> = {
  commode: ['commode', 'chest of drawers', 'chest-of-drawers', 'chest of three drawers', 'bombe chest', 'serpentine chest', 'byra', 'kommod',
    'kommode', 'cassettone', 'comoda', 'semainier', 'chiffonnier', 'chiffoniere', 'commodes'],
  dresser: ['dresser', 'welsh dresser', 'dresser base', 'vaisselier', 'buffet-vaisselier', 'buffet vaisselier', 'buffet deux corps',
    'buffet a deux corps', 'buffet 2 corps', 'deux-corps', 'deux corps', 'buffet', 'dressoir', 'potboard', 'skank', 'kokskank',
    'hutch', 'credenza', 'enfilade', 'sideboard'],
  cabinet: ['cabinet', 'armoire', 'wardrobe', 'cupboard', 'linen press', 'press cupboard', 'bonnetiere', 'skap', 'kladskap', 'schrank',
    'vitrine', 'display cabinet', 'bookcase', 'bibliotheque', 'bokhylla', 'cabinet-on-stand', 'homme debout', 'corner cupboard', 'encoignure', 'hornskap'],
  table: ['table', 'tables', 'gueridon', 'bord', 'tisch', 'tavolo', 'mesa', 'bouillotte', 'console', 'konsolbord', 'pier table', 'side table', 'bureau plat'],
  console: ['console', 'konsolbord', 'pier table', 'side table', 'table console', 'consolle'],
  desk: ['desk', 'bureau', 'secretaire', 'secretary', 'escritoire', 'davenport', 'skrivbord', 'sekretar', 'scriban', 'bonheur du jour', 'writing table', 'pupitre'],
  chair: ['chair', 'chairs', 'armchair', 'fauteuil', 'fauteuils', 'chaise', 'chaises', 'bergere', 'cabriolet', 'stol', 'stolar', 'karmstol', 'stuhl', 'sedia', 'silla', 'settle'],
  sofa: ['sofa', 'settee', 'canape', 'soffa', 'daybed', 'meridienne', 'chaise longue', 'banquette'],
  mirror: ['mirror', 'miroir', 'glace', 'trumeau', 'spegel', 'pier glass', 'looking glass', 'girandole'],
  clock: ['clock', 'horloge', 'pendule', 'cartel', 'regulateur', 'longcase', 'grandfather', 'golvur', 'moraklocka', 'bracket clock'],
  bed: ['bed', 'lit', 'sang', 'bett', 'daybed'],
  chandelier: ['chandelier', 'lustre', 'ljuskrona', 'candelabra', 'candelabre', 'sconce', 'applique', 'lamp', 'lampe'],
};

// Words that NAME a type in a query (subset of the group, avoiding words that are too generic in queries).
const QUERY_TRIGGERS: Record<string, string[]> = {
  commode: ['commode', 'chest of drawers', 'byra', 'kommod', 'semainier', 'chiffonnier'],
  dresser: ['dresser', 'vaisselier', 'dressoir', 'skank', 'deux corps', 'deux-corps', 'buffet', 'sideboard', 'enfilade', 'credenza', 'hutch'],
  cabinet: ['armoire', 'wardrobe', 'cupboard', 'linen press', 'bonnetiere', 'cabinet', 'vitrine', 'bookcase', 'bibliotheque', 'encoignure'],
  console: ['console', 'pier table', 'konsolbord'],
  desk: ['desk', 'bureau', 'secretaire', 'secretary', 'davenport', 'skrivbord', 'scriban', 'bonheur du jour'],
  chair: ['chair', 'armchair', 'fauteuil', 'chaise', 'bergere', 'karmstol'],
  sofa: ['sofa', 'settee', 'canape', 'soffa', 'daybed', 'meridienne'],
  mirror: ['mirror', 'miroir', 'trumeau', 'spegel', 'pier glass', 'girandole'],
  clock: ['clock', 'horloge', 'pendule', 'cartel', 'longcase', 'golvur'],
  bed: ['bed'],
  chandelier: ['chandelier', 'lustre', 'ljuskrona', 'sconce'],
  table: ['table', 'gueridon', 'tisch', 'bord'],
};

const wordRegex = (w: string) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ -]/g, '[ -]?')}s?($|[^a-z])`, 'i');

/** Types of piece named in the query (e.g. "Welsh dresser" -> ['dresser']). Empty = no type check. */
export const itemTypesInQuery = (query: string): string[] => {
  const q = normalise(query);
  const hits = Object.entries(QUERY_TRIGGERS).filter(([, words]) => words.some(w => wordRegex(w).test(q))).map(([k]) => k);
  // "console table" / "writing table": the specific type wins over the generic "table"
  return hits.length > 1 ? hits.filter(h => h !== 'table') : hits;
};

/** True when the listing text names one of the requested types (or no type was requested). */
export const matchesItemType = (types: string[], ...texts: Array<string | undefined | null>): boolean => {
  if (!types.length) return true;
  const text = normalise(texts.filter(Boolean).join(' \n '));
  if (!text.trim()) return false;
  return types.some(type => (ITEM_TYPES[type] || []).some(w => wordRegex(w).test(text)));
};

// Search words per type and language, given to the model (and to the Auctionet search) so it searches each
// region's sites in their own language ("gustaviansk byrå" on Auctionet, "vaisselier" on Interencheres).
export const LOCAL_TERMS: Record<string, { en: string[]; fr: string[]; sv: string[] }> = {
  commode: { en: ['chest of drawers', 'commode'], fr: ['commode'], sv: ['byrå', 'kommod'] },
  dresser: { en: ['dresser', 'Welsh dresser', 'dresser base'], fr: ['vaisselier', 'buffet deux corps'], sv: ['skänk'] },
  cabinet: { en: ['cupboard', 'cabinet', 'linen press'], fr: ['armoire', 'bonnetière'], sv: ['skåp'] },
  console: { en: ['console table', 'pier table'], fr: ['console'], sv: ['konsolbord'] },
  desk: { en: ['desk', 'bureau'], fr: ['bureau', 'secrétaire'], sv: ['skrivbord', 'sekretär'] },
  chair: { en: ['chair', 'armchair'], fr: ['fauteuil', 'chaise'], sv: ['stol', 'karmstol'] },
  sofa: { en: ['sofa', 'settee'], fr: ['canapé'], sv: ['soffa'] },
  mirror: { en: ['mirror', 'pier glass'], fr: ['miroir', 'trumeau'], sv: ['spegel'] },
  clock: { en: ['clock', 'longcase clock'], fr: ['pendule', 'horloge', 'cartel'], sv: ['golvur', 'ur'] },
  bed: { en: ['bed'], fr: ['lit'], sv: ['säng'] },
  chandelier: { en: ['chandelier'], fr: ['lustre'], sv: ['ljuskrona'] },
  table: { en: ['table'], fr: ['table', 'guéridon'], sv: ['bord'] },
};

// Period / style names in a query -> the words French and Swedish catalogues use, plus the words that show a lot
// is in that style (used to rank direct auction results). Order matters: the first match wins
// ("Louis XVI" before "Louis XV", "Louis-Philippe" before "Louis").
export interface StyleTerm { fr: string; sv: string; en: string; match: string[] }
export const STYLE_TERMS: Array<[RegExp, StyleTerm]> = [
  [/napol[eé]on\s*(iii|3)\b|second\s*empire|nap\s*iii/i, { fr: 'Napoléon III', sv: 'Napoleon III', en: 'Napoleon III', match: ['napoleon iii', 'napoleon 3', 'second empire', 'nap. iii'] }],
  [/louis[\s-]*philippe/i, { fr: 'Louis-Philippe', sv: 'Louis Philippe', en: 'Louis Philippe', match: ['louis-philippe', 'louis philippe'] }],
  [/charles\s*x\b/i, { fr: 'Charles X', sv: 'Charles X', en: 'Charles X', match: ['charles x'] }],
  [/restauration|restoration period/i, { fr: 'Restauration', sv: 'empire', en: 'Restauration', match: ['restauration'] }],
  [/gustavian/i, { fr: 'gustavien', sv: 'gustaviansk', en: 'Gustavian', match: ['gustavien', 'gustavienne', 'gustaviansk', 'gustavian'] }],
  [/louis\s*xvi\b|louis\s*16|louis seize/i, { fr: 'Louis XVI', sv: 'gustaviansk', en: 'Louis XVI', match: ['louis xvi', 'louis 16'] }],
  [/louis\s*xv\b|louis\s*15|rococo|rocaille/i, { fr: 'Louis XV', sv: 'rokoko', en: 'Louis XV', match: ['louis xv', 'louis 15', 'rocaille', 'rococo', 'rokoko'] }],
  [/louis\s*xiv\b|louis\s*14/i, { fr: 'Louis XIV', sv: 'barock', en: 'Louis XIV', match: ['louis xiv', 'louis 14'] }],
  [/louis\s*xiii\b|louis\s*13/i, { fr: 'Louis XIII', sv: 'barock', en: 'Louis XIII', match: ['louis xiii', 'louis 13'] }],
  [/transition/i, { fr: 'Transition', sv: 'övergångsstil', en: 'Transition', match: ['transition', 'overgangsstil'] }],
  [/directoire/i, { fr: 'Directoire', sv: 'sengustaviansk', en: 'Directoire', match: ['directoire'] }],
  [/\bempire\b/i, { fr: 'Empire', sv: 'empire', en: 'Empire', match: ['empire'] }],
  [/r[eé]gence\b/i, { fr: 'Régence', sv: 'frihetstid', en: 'Régence', match: ['regence'] }],
  [/henri\s*(ii|2)\b/i, { fr: 'Henri II', sv: 'renässans', en: 'Henri II', match: ['henri ii'] }],
  [/biedermeier/i, { fr: 'Biedermeier', sv: 'biedermeier', en: 'Biedermeier', match: ['biedermeier'] }],
  [/regency/i, { fr: 'Regency', sv: 'regency', en: 'Regency', match: ['regency'] }],
  [/georgian|george\s*(ii|iii|iv)\b/i, { fr: 'georgien', sv: 'georgiansk', en: 'Georgian', match: ['georgian', 'george ii', 'george iii', 'george iv', 'georgien'] }],
  [/victorian/i, { fr: 'victorien', sv: 'viktoriansk', en: 'Victorian', match: ['victorian', 'victorien'] }],
];

// Woods and materials (the old translation dropped them: "Louis XV commode walnut" searched just "commode Louis XV")
export const MATERIAL_TERMS: Array<[RegExp, { fr: string; sv: string; match: string[] }]> = [
  [/\boak\b|ch[eê]ne/i, { fr: 'chêne', sv: 'ek', match: ['oak', 'chene'] }],
  [/walnut|noyer/i, { fr: 'noyer', sv: 'valnöt', match: ['walnut', 'noyer'] }],
  [/cherry|merisier/i, { fr: 'merisier', sv: 'körsbär', match: ['cherry', 'merisier'] }],
  [/mahogany|acajou/i, { fr: 'acajou', sv: 'mahogny', match: ['mahogany', 'acajou'] }],
  [/rosewood|palissandre/i, { fr: 'palissandre', sv: 'jakaranda', match: ['rosewood', 'palissandre'] }],
  [/\belm\b|orme/i, { fr: 'orme', sv: 'alm', match: ['elm', 'orme'] }],
  [/\bpine\b|sapin/i, { fr: 'sapin', sv: 'furu', match: ['pine', 'sapin', 'pin'] }],
  [/fruitwood|bois fruitier/i, { fr: 'bois fruitier', sv: 'fruktträ', match: ['fruitwood', 'fruitier'] }],
  [/\bbirch\b|bouleau/i, { fr: 'bouleau', sv: 'björk', match: ['birch', 'bouleau'] }],
  [/marquetry|marqueterie/i, { fr: 'marqueterie', sv: 'intarsia', match: ['marquetry', 'marqueterie'] }],
  [/\bgilt\b|gilded|giltwood|dor[ée]/i, { fr: 'doré', sv: 'förgylld', match: ['gilt', 'dore', 'doree'] }],
  [/painted|peint/i, { fr: 'peint', sv: 'målad', match: ['painted', 'peint', 'laque'] }],
  [/marble|marbre/i, { fr: 'marbre', sv: 'marmor', match: ['marble', 'marbre'] }],
];

export const styleInQuery = (query: string): StyleTerm | undefined => STYLE_TERMS.find(([re]) => re.test(query))?.[1];
export const materialsInQuery = (query: string) => MATERIAL_TERMS.filter(([re]) => re.test(query)).map(([, m]) => m);

export interface LocalQueries { fr: string[]; sv: string[]; en: string[] }

/** Local-language search phrases for a query (e.g. "Gustavian commode" -> sv: "gustaviansk byrå", "gustaviansk kommod"). */
export const localQueries = (query: string): LocalQueries => {
  const types = itemTypesInQuery(query);
  const style = styleInQuery(query);
  const material = materialsInQuery(query)[0];
  const out: LocalQueries = { fr: [], sv: [], en: [] };
  for (const t of types) {
    const terms = LOCAL_TERMS[t];
    if (!terms) continue;
    for (const w of terms.fr) out.fr.push([w, style?.fr, material?.fr].filter(Boolean).join(' '));
    for (const w of terms.sv) out.sv.push([style?.sv, w, material?.sv].filter(Boolean).join(' '));
    for (const w of terms.en) out.en.push([style?.en, material ? material.match[0] : '', w].filter(Boolean).join(' '));
  }
  // No known type: keep the style / material words so the search is never just one generic noun
  if (!types.length && (style || material)) {
    out.fr.push([style?.fr, material?.fr].filter(Boolean).join(' '));
    out.sv.push([style?.sv, material?.sv].filter(Boolean).join(' '));
  }
  return { fr: Array.from(new Set(out.fr)).slice(0, 3), sv: Array.from(new Set(out.sv)).slice(0, 3), en: Array.from(new Set(out.en)).slice(0, 3) };
};

// The French site query (frenchSiteQuery / frenchSiteQueries) lives in pieceWords.ts: it uses the user's own piece words.

/** Does a lot text name the style asked for in the query? (null = no style in the query) */
export const matchesStyle = (query: string, ...texts: Array<string | undefined | null>): boolean | null => {
  const style = styleInQuery(query);
  if (!style) return null;
  const text = normalise(texts.filter(Boolean).join(' '));
  return style.match.some(w => text.includes(w));
};
