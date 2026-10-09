// The user's own piece words (fix 1), extra site queries per search (fix 2) and the stricter "style" rule (fix 7).
// Pure functions, unit-tested in scripts/check-hunt-logic.ts.
import { ITEM_TYPES, LOCAL_TERMS, itemTypesInQuery, materialsInQuery, normalise, styleInQuery } from "./huntGeo.js";

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ -]/g, '[ -]?');
const wordRe = (w: string) => new RegExp(`(^|[^a-z])${esc(w)}s?($|[^a-z])`, 'i');
const hasWord = (text: string, w: string) => wordRe(w).test(text);

/**
 * A specific kind of piece named by the user ("secrétaire à abattant", "buffet deux corps"). When the query names one,
 * the French site query uses the user's words (not the first word of the type group, e.g. "bureau"), and a lot must
 * name the same kind of piece (`require`) to be shown.
 */
export interface Subtype { key: string; type: string; triggers: string[]; fr: string; require?: string[] }

// Order matters: the most specific phrase first.
export const SUBTYPES: Subtype[] = [
  { key: 'secretaire_abattant', type: 'desk', fr: 'secretaire a abattant',
    triggers: ['secretaire a abattant', 'secretaire abattant', 'drop-front secretary', 'drop front secretary', 'fall-front secretary', 'fall front secretary', 'fall-front secretaire', 'fall front desk', 'drop-front desk', 'drop front desk'],
    require: ['secretaire', 'secretary', 'sekretar', 'chiffonnier secretaire'] },
  { key: 'secretaire', type: 'desk', fr: 'secretaire', triggers: ['secretaire', 'secretary', 'sekretar'], require: ['secretaire', 'secretary', 'sekretar'] },
  { key: 'bureau_pente', type: 'desk', fr: 'bureau de pente', triggers: ['bureau de pente', 'bureau en pente', 'slant-front desk', 'slant front desk', 'slope-front desk', 'scriban', 'bureau bookcase'],
    require: ['pente', 'scriban', 'slant', 'slope', 'bureau bookcase', 'dos d ane', "dos d'ane", 'skrivbyra'] },
  { key: 'bonheur_du_jour', type: 'desk', fr: 'bonheur du jour', triggers: ['bonheur du jour', 'bonheur-du-jour'], require: ['bonheur du jour', 'bonheur-du-jour'] },
  { key: 'bureau_plat', type: 'desk', fr: 'bureau plat', triggers: ['bureau plat', 'writing table'], require: ['bureau plat', 'writing table', 'table a ecrire', 'table de milieu formant bureau'] },
  { key: 'buffet_deux_corps', type: 'dresser', fr: 'buffet deux corps',
    triggers: ['buffet deux corps', 'buffet a deux corps', 'buffet 2 corps', 'deux corps', 'deux-corps', 'two-part buffet', 'two part buffet'],
    require: ['deux corps', 'deux-corps', '2 corps', 'two-part', 'two part'] },
  { key: 'vaisselier', type: 'dresser', fr: 'vaisselier', triggers: ['vaisselier', 'welsh dresser', 'dresser'] },
  { key: 'enfilade', type: 'dresser', fr: 'enfilade', triggers: ['enfilade', 'sideboard'] },
  { key: 'buffet', type: 'dresser', fr: 'buffet', triggers: ['buffet'] },
  { key: 'bonnetiere', type: 'cabinet', fr: 'bonnetiere', triggers: ['bonnetiere'], require: ['bonnetiere'] },
  { key: 'encoignure', type: 'cabinet', fr: 'encoignure', triggers: ['encoignure', 'corner cupboard', 'corner cabinet', 'hornskap'], require: ['encoignure', 'corner', 'hornskap', 'hornskapet'] },
  { key: 'armoire', type: 'cabinet', fr: 'armoire', triggers: ['armoire', 'wardrobe', 'linen press', 'press cupboard'],
    require: ['armoire', 'wardrobe', 'linen press', 'press cupboard', 'kladskap', 'skap'] },
  { key: 'trumeau', type: 'mirror', fr: 'trumeau', triggers: ['trumeau'], require: ['trumeau'] },
  { key: 'semainier', type: 'commode', fr: 'semainier', triggers: ['semainier'], require: ['semainier'] },
  { key: 'chiffonnier', type: 'commode', fr: 'chiffonnier', triggers: ['chiffonnier', 'chiffonniere'], require: ['chiffonnier', 'chiffonniere'] },
  { key: 'commode_tombeau', type: 'commode', fr: 'commode tombeau', triggers: ['commode tombeau'] },
  { key: 'commode_sauteuse', type: 'commode', fr: 'commode sauteuse', triggers: ['commode sauteuse'] },
  { key: 'commode_arbalete', type: 'commode', fr: 'commode arbalete', triggers: ['commode arbalete'] },
];

/** The most specific kind of piece named in the query, if any. */
export const subtypeInQuery = (query: string): Subtype | undefined => {
  const q = normalise(query);
  const types = itemTypesInQuery(query);
  return SUBTYPES.find(s => (types.length === 0 || types.includes(s.type)) && s.triggers.some(t => hasWord(q, t)));
};

// Things that are never the piece asked for when they are the HEAD of a lot title ("Fauteuil de bureau",
// "Lampe de bureau", "Accessoires d'écriture"): the first piece word of the title decides what the lot is.
const NOT_FURNITURE_HEADS: Record<string, string[]> = {
  lamp: ['lampe', 'lamp', 'lampadaire', 'applique', 'lustre', 'chandelier', 'bougeoir', 'flambeau', 'candelabre'],
  accessory: ['accessoires', 'accessoire', 'ecritoire', 'encrier', 'sous-main', 'plumier', 'necessaire', 'coffret', 'boite', 'presse-papier',
    'garniture de bureau', 'tapis', 'maquette'],
};
const BLOCKING_HEADS = new Set(['chair', 'sofa', 'clock', 'bed', 'chandelier', 'lamp', 'accessory']);

/** Type group of the first piece word in a title ("Fauteuil de bureau" -> 'chair'), or null. */
export const headType = (title: string): string | null => {
  const t = normalise(title);
  let best: { pos: number; type: string } | null = null;
  const groups: Record<string, string[]> = { ...ITEM_TYPES, ...NOT_FURNITURE_HEADS };
  for (const [type, words] of Object.entries(groups)) {
    for (const w of words) {
      const m = wordRe(w).exec(t);
      if (!m) continue;
      const pos = m.index + m[1].length;
      if (!best || pos < best.pos) best = { pos, type };
    }
  }
  return best ? best.type : null;
};

/**
 * Is this lot the kind of piece the user asked for? Returns a drop reason or null.
 *  - its title must not be headed by a chair / lamp / clock / writing accessory when the user asked for something else;
 *  - when the user named a specific kind of piece (secrétaire, buffet deux corps…), the lot must name it too.
 * (The broad type check — matchesItemType — runs before this.)
 */
export const pieceProblem = (query: string, types: string[], title?: string | null, description?: string | null): string | null => {
  if (!types.length) return null;
  const head = headType(String(title || ''));
  if (head && BLOCKING_HEADS.has(head) && !types.includes(head)) return 'not_requested_type';
  const sub = subtypeInQuery(query);
  if (sub?.require) {
    const text = normalise(`${title || ''} \n ${String(description || '').slice(0, 300)}`);
    if (!sub.require.some(w => hasWord(text, w))) return 'not_requested_subtype';
  }
  return null;
};

/** The piece word to search French sites with: the user's own subtype if any, else the type's usual French word. */
export const frenchTypeWord = (query: string): string => {
  const sub = subtypeInQuery(query);
  if (sub) return sub.fr;
  const types = itemTypesInQuery(query);
  return types.length ? normalise(LOCAL_TERMS[types[0]]?.fr[0] || '') : '';
};

// ---------------------------------------------------------------------------
// Fix 2: several site queries per search (style + period / form words)
// ---------------------------------------------------------------------------

// Century of a style, as French catalogues write it ("XVIIIe siècle"), and typical form words for that style
const STYLE_CENTURY: Record<string, 'xviiie' | 'xixe'> = {
  'Louis XV': 'xviiie', 'Louis XVI': 'xviiie', 'Régence': 'xviiie', 'Transition': 'xviiie', 'Louis XIV': 'xviiie', 'gustavien': 'xviiie', 'georgien': 'xviiie',
  'Napoléon III': 'xixe', 'Louis-Philippe': 'xixe', 'Charles X': 'xixe', 'Restauration': 'xixe', 'Empire': 'xixe', 'Directoire': 'xixe', 'victorien': 'xixe',
};
const FORM_WORDS: Record<string, Record<string, string[]>> = {
  commode: { 'Louis XV': ['commode tombeau', 'commode galbee'], 'Régence': ['commode tombeau'], 'Transition': ['commode ressaut'], 'Louis XVI': ['commode marbre xviiie'] },
  mirror: { 'Napoléon III': ['miroir bois dore xixe'], 'Louis XVI': ['miroir bois dore xviiie'], 'Louis XV': ['miroir bois dore xviiie'] },
  cabinet: { 'Louis XV': ['armoire chantournee'] },
};
const ascii = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Keyword queries for a French auction site, most specific first (deduplicated, at most `max`):
 * user's piece word + style + wood; + style; + "époque <style>"; + century; + typical form words for the style.
 */
export const frenchSiteQueries = (query: string, max = 4): string[] => {
  const word = frenchTypeWord(query);
  const style = styleInQuery(query);
  const material = materialsInQuery(query)[0];
  if (!word) return [];
  const out: string[] = [];
  const add = (...parts: Array<string | undefined>) => { const q = ascii(parts.filter(Boolean).join(' ')); if (q) out.push(q); };
  add(word, style?.fr, material?.fr);
  add(word, style?.fr);
  const types = itemTypesInQuery(query);
  if (style) {
    const century = STYLE_CENTURY[style.fr];
    if (century) add(word, century);
    add(word, 'epoque', style.fr);
    for (const f of FORM_WORDS[types[0]]?.[style.fr] || []) add(f);
  } else {
    add(word, 'xviiie');
    add(word, 'xixe');
  }
  return Array.from(new Set(out)).slice(0, max);
};

/** Without "Louis XV" in the text, an 18th-century date or form word still suggests the requested style (ranking only). */
export const impliedStyleMatch = (query: string, text: string): boolean => {
  const style = styleInQuery(query);
  if (!style) return false;
  const t = normalise(text);
  const century = STYLE_CENTURY[style.fr];
  const centuryHit = century === 'xviiie' ? /(xviii|18th|1[67]\d\d|1700-tal)/.test(t) : century === 'xixe' ? /(xix|19th|18\d\d|1800-tal)/.test(t) : false;
  if (!centuryHit) return false;
  const forms = style.fr === 'Louis XV' ? /(tombeau|galbe|arbalete|sauteuse|chantourn|mouvemente|rocaille)/ : style.fr === 'Louis XVI' ? /(cannelure|ressaut|droit|demi-lune)/ : null;
  return forms ? forms.test(t) : true;
};

// ---------------------------------------------------------------------------
// Fix 7: stricter period rule for a requested 18th-century style
// ---------------------------------------------------------------------------

// Partly period / assembled from old parts: never an authentic period piece
const PARTLY_PERIOD = [
  /en partie (d['’]\s*)?[ée]poque/i,
  /en partie (du |de la fin du )?(xviii|xix|18)/i,
  /partly (period|18th|19th)/i,
  /[ée]l[ée]ments anciens/i,
  /parties anciennes/i,
  /compos[ée]e?s? (d['’]|de )[ée]l[ée]ments/i,
  /dans le go[uû]t (de|du)\b/i,
  /later (top|carcass|alterations)|made up from|incorporating (some )?(18th|19th|period|old) /i,
];

export const partlyPeriodProblem = (...texts: Array<string | undefined | null>): string | null => {
  const t = texts.filter(Boolean).join(' \n ');
  for (const re of PARTLY_PERIOD) { const m = t.match(re); if (m) return m[0]; }
  return null;
};

const EIGHTEENTH_STYLES: Record<string, string[]> = {
  'Louis XV': ['louis xv'], 'Louis XVI': ['louis xvi'], 'Régence': ['regence'], 'Transition': ['transition'], 'Louis XIV': ['louis xiv'],
};

/**
 * The user asked for an 18th-century style (e.g. Louis XV) with period pieces only: a lot "de style Louis XV" that is
 * not "époque Louis XV" / 18th-century is a later piece in that style (e.g. "Commode de style Louis XV, époque XIXe"),
 * so it is not what was asked for, even though it is a genuine 19th-century antique.
 */
export const requestedStyleOnlyProblem = (query: string, ...texts: Array<string | undefined | null>): string | null => {
  const style = styleInQuery(query);
  const names = style ? EIGHTEENTH_STYLES[style.fr] : undefined;
  if (!names) return null;
  const t = normalise(texts.filter(Boolean).join(' \n '));
  for (const n of names) {
    const styleRe = new RegExp(`(de |dans le |in the |en )?style\\s+${n}(?![a-z])|${n}[\\s-]+style|${n} revival`);
    const m = t.match(styleRe);
    if (!m) continue;
    if (new RegExp(`(epoque|period)\\s+(de\\s+|du\\s+)?${n}(?![a-z])|${n}\\s+period`).test(t)) continue;
    const c18 = /(xviii|18th|17\d\d|1700-tal)/.test(t);
    const later = /(xix|19th|18[0-9]\d|1800-tal|napoleon|louis[\s-]*philippe|restauration|charles x|xx|20th|19\d\d|1900-tal)/.test(t);
    if (c18 && !later) continue;
    return m[0].trim();
  }
  return null;
};

/**
 * The ONE main keyword query for a French auction site (kept for callers that need a single query):
 * the user's piece word + style + wood; `fallback` drops the wood. Unknown type: the user's own words.
 */
export const frenchSiteQuery = (query: string, opts: { fallback?: boolean } = {}): string => {
  const word = frenchTypeWord(query);
  const style = styleInQuery(query);
  const material = opts.fallback ? undefined : materialsInQuery(query)[0];
  if (!word) {
    const own = query.replace(/\b(antique|period|french|authentic|old|vintage|for sale|a|an|the)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    return ascii(own || [style?.fr, material?.fr].filter(Boolean).join(' ')).slice(0, 80);
  }
  return ascii([word, style?.fr, material?.fr].filter(Boolean).join(' '));
};
