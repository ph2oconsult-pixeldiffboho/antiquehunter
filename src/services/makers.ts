// Known makers (French ébénistes / menuisiers en sièges and a few later Paris houses), and how firmly the user's
// text ties the piece to one: a stamp the user has confirmed, a stamp stated in the text / catalogue, an attribution,
// or only a dealer's label. Pure functions, shared by the app and the /api/comps server function.

export interface Maker { key: string; name: string; search: string; re: RegExp }

const M = (key: string, name: string, search: string, re: RegExp): Maker => ({ key, name, search, re });

/** Accent-free lower case, for matching. */
export const fold = (s: string): string => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const MAKERS: Maker[] = [
  M('bellange', 'Bellangé', 'Bellangé', /\bbellange\b/),
  M('jacob-desmalter', 'Jacob-Desmalter', 'Jacob-Desmalter', /\bjacob[\s-]*d(es)?malter\b|\bjacob\s+freres\b/),
  M('jacob', 'Georges Jacob', 'Georges Jacob', /\b(g\.?|georges)\s*jacob\b|\bjacob\b(?=.{0,40}(estampill|stamp|menuisier|maitre|1765))|\b(attribue?e?s?\s+a|attributed\s+to|atelier\s+de|workshop\s+of|stamped|estampille\w*|by)\s+(g\.?\s*)?jacob\b/),
  M('riesener', 'Jean-Henri Riesener', 'Riesener', /\briesener\b/),
  M('migeon', 'Pierre Migeon', 'Migeon', /\bmigeon\b/),
  M('hache', 'Hache (Grenoble)', 'Hache Grenoble', /\bhache\b(?=.{0,60}grenoble)|\b(estampill\w*|stamped|stamp|signe\w*|by)\s+hache\b|\bjean[\s-]francois\s+hache\b|\bpierre\s+hache\b|\bthomas\s+hache\b|\bchristophe[\s-]andre\s+hache\b/),
  M('lebesgue', 'Lebesgue', 'Lebesgue', /\blebesgue\b/),
  M('mondon', 'François Mondon', 'Mondon', /\bmondon\b/),
  M('oeben', 'Jean-François Oeben', 'Oeben', /\b(o|oe)eben\b|\boeben\b/),
  M('weisweiler', 'Adam Weisweiler', 'Weisweiler', /\bweisweiler\b/),
  M('carlin', 'Martin Carlin', 'Martin Carlin', /\bmartin\s+carlin\b|\bcarlin\b(?=.{0,40}(estampill|stamp))|\b(estampill\w*|stamped|stamp|signe\w*|by)\s+(martin\s+)?carlin\b/),
  M('bvrb', 'Bernard II van Risenburgh (BVRB)', 'BVRB Van Risenburgh', /\bbvrb\b|\bvan\s+risen\s?burgh\b/),
  M('cressent', 'Charles Cressent', 'Cressent', /\bcressent\b/),
  M('boulle', 'André-Charles Boulle', 'Boulle', /\bandre[\s-]charles\s+boulle\b/),
  M('dubois', 'Jacques Dubois', 'Jacques Dubois', /\b(jacques|i\.?)\s*dubois\b|\brene\s+dubois\b|\b(estampill\w*|stamped|stamp|signe\w*|by)\s+(jacques\s+|rene\s+|i\.?\s*)?dubois\b|\bdubois\b(?=.{0,40}(estampill|stamp))/),
  M('sene', 'Sené', 'Sené', /\bsene\b(?=.{0,60}(estampill|stamp|menuisier|maitre|claude|jean[\s-]baptiste))|\b(claude|jean[\s-]baptiste[\s-]claude)\s+sene\b|\b(estampill\w*|stamped|stamp|signe\w*|by)\s+(claude\s+|jean[\s-]baptiste[\s-]claude\s+)?sene\b/),
  M('delanois', 'Louis Delanois', 'Delanois', /\bdelanois\b/),
  M('gourdin', 'Gourdin', 'Gourdin', /\bgourdin\b/),
  M('tilliard', 'Tilliard', 'Tilliard', /\btilliard\b/),
  M('foliot', 'Foliot', 'Foliot', /\bfoliot\b/),
  M('heurtaut', 'Nicolas Heurtaut', 'Heurtaut', /\bheurtaut\b/),
  M('nadal', 'Nadal', 'Nadal', /\bnadal\b(?=.{0,60}(estampill|stamp|menuisier|maitre))|\b(estampill\w*|stamped|stamp|signe\w*|by)\s+nadal\b/),
  M('avisse', 'Jean Avisse', 'Avisse', /\bavisse\b/),
  M('lelarge', 'Lelarge', 'Lelarge', /\blelarge\b/),
  M('boulard', 'Jean-Baptiste Boulard', 'Boulard', /\bboulard\b/),
  M('canabas', 'Canabas', 'Canabas', /\bcanabas\b/),
  M('topino', 'Charles Topino', 'Topino', /\btopino\b/),
  M('leleu', 'Jean-François Leleu', 'Leleu', /\bleleu\b(?=.{0,60}(estampill|stamp|maitre|jean[\s-]francois))|\bjean[\s-]francois\s+leleu\b|\b(estampill\w*|stamped|stamp|signe\w*|by)\s+(jean[\s-]francois\s+)?leleu\b/),
  M('saunier', 'Claude-Charles Saunier', 'Saunier', /\bsaunier\b/),
  M('montigny', 'Philippe-Claude Montigny', 'Montigny', /\bmontigny\b(?=.{0,60}(estampill|stamp|maitre))|\b(estampill\w*|stamped|stamp|signe\w*|by)\s+(philippe[\s-]claude\s+)?montigny\b/),
  M('levasseur', 'Levasseur', 'Levasseur', /\blevasseur\b/),
  M('molitor', 'Bernard Molitor', 'Molitor', /\bmolitor\b/),
  M('teune', 'François-Gaspard Teuné', 'Teuné', /\bteune\b/),
  M('criaerd', 'Criaerd', 'Criaerd', /\bcriaerd\b/),
  M('dautriche', 'Jacques Dautriche', 'Dautriche', /\bdautriche\b/),
  M('roussel', 'Pierre Roussel', 'Pierre Roussel', /\bpierre\s+roussel\b/),
  M('marchand', 'Nicolas-Jean Marchand', 'Marchand ébéniste', /\bn\.?\s*j\.?\s*marchand\b|\bnicolas[\s-]jean\s+marchand\b/),
  M('sormani', 'Paul Sormani', 'Sormani', /\bsormani\b/),
  M('linke', 'François Linke', 'Linke', /\blinke\b/),
  M('beurdeley', 'Beurdeley', 'Beurdeley', /\bbeurdeley\b/),
  M('dasson', 'Henry Dasson', 'Dasson', /\bdasson\b/),
  M('krieger', 'Krieger', 'Krieger', /\bkrieger\b(?=.{0,60}(estampill|stamp|maison|paris))/),
  M('jansen', 'Maison Jansen', 'Maison Jansen', /\bmaison\s+jansen\b/),
  M('majorelle', 'Louis Majorelle', 'Majorelle', /\bmajorelle\b/),
  M('galle', 'Émile Gallé', 'Gallé', /\bgalle\b(?=.{0,40}(marquet|signe|signed|nancy|emile))|\bemile\s+galle\b/),
  M('chippendale', 'Thomas Chippendale', 'Chippendale', /\bthomas\s+chippendale\b/),
  M('gillows', 'Gillows', 'Gillows', /\bgillows?\b(?=.{0,40}(of\s+lancaster|stamp|lancaster))|\bgillows\b/),
  M('haupt', 'Georg Haupt', 'Georg Haupt', /\bgeorg\s+haupt\b|\bhaupt\b(?=.{0,60}(stockholm|sweden|suede|ebenist|estampill|stamp))|\b(estampill\w*|stamped|stamp|signe\w*|by)\s+(georg\s+)?haupt\b/),
  M('malmsten', 'Carl Malmsten', 'Malmsten', /\bmalmsten\b/),
  M('boudin', 'Léonard Boudin', 'Boudin', /\b(l\.?\s*)?boudin\b|\bleonard\s+boudin\b/),
  M('delorme', 'Adrien Delorme', 'Delorme', /\b(a\.?\s*)?delorme\b|\badrien\s+delorme\b/),
  M('lardin', 'André-Antoine Lardin', 'Lardin', /\blardin\b/),
  M('pafrat', 'Claude-Charles Pafrat', 'Pafrat', /\bpafrat\b/),
  M('schwerdfeger', 'Ferdinand Schwerdfeger', 'Schwerdfeger', /\bschwerdfeger\b|\bschwerdtfeger\b/),
  M('beneman', 'Guillaume Beneman', 'Beneman', /\bbeneman\b|\bbennemann\b/),
  M('nogaret', 'Pierre Nogaret (Lyon)', 'Nogaret Lyon', /\bnogaret\b/),
];

export type MakerStatus = 'stamped_confirmed' | 'stamped_stated' | 'stamp_in_photo' | 'attributed' | 'dealer_label' | 'doubtful_stamp' | 'mentioned';

export interface MakerMatch { key: string; name: string; search: string; status: MakerStatus; source: 'text' | 'photo'; jme?: boolean }

/** The first known maker named in the text (null when none). */
export const findMaker = (text: string): Maker | null => {
  const t = fold(text);
  let best: { m: Maker; at: number } | null = null;
  for (const m of MAKERS) {
    const r = t.match(m.re);
    if (r && r.index !== undefined && (!best || r.index < best.at)) best = { m, at: r.index };
  }
  return best ? best.m : null;
};

const LABEL_RE = /\b(label|etiquette|ticket|tag|card)\b|dealer\s+(says|said|claims)|selon\s+le\s+(marchand|vendeur)|d'apres\s+le\s+(marchand|vendeur)/;
const ATTR_RE = /\b(attribu\w*|attr\.|workshop|atelier|entourage|circle\s+of|manner\s+of|dans\s+le\s+gout|in\s+the\s+style|style\s+of|follower|suiveur|probably|probablement|possibly|peut[\s-]etre|modele\s+repertorie)\b/;
/** Period/style wording that must never be read as a stamp claim on its own. */
const STYLE_ONLY_RE = /\b(dans\s+le\s+gout|dans\s+le\s+style|in\s+the\s+style|style\s+of|style\s+(louis|empire|regence|restauration|napoleon)|style\s+louis)\b/;
const STAMP_RE = /\b(estampill\w*|stamped|stamp|stamps|signed|signe|signee|branded|marque\s+au\s+fer|poincon\w*)\b/;
const CONFIRM_RE = /\b(confirmed|confirme\w*|verified|verifie\w*|i\s+(saw|have\s+seen)|seen\s+(it|the\s+stamp)|visible|lisible|legible|present\s+on\s+(each|every|all)|sur\s+chaque|on\s+each)\b/;
/** Explicit denial / absence of a stamp — never STAMPED or CONFIRMED. */
const NO_STAMP_RE = /\b(pas\s+d['']estampill\w*|non\s+estampill\w*|sans\s+estampill\w*|no\s+stamp|without\s+(a\s+)?stamp|unstamped|not\s+yet\s+(checked|confirmed|verified)|not\s+(checked|confirmed|verified)|unchecked|unconfirmed|non\s+confirme\w*|stamp\s+not\s+(yet\s+)?(checked|confirmed|verified))\b/;
/** Transplanted / fake / suspicious stamp — Doubtful stamp, no maker premium. */
const DOUBTFUL_RE = /\b(transplant\w*|rapport[eée]e?s?|fausse?\s+estampill|fake\s+stamp|forged|forgery|spurious|regrav[eée]\w*|suspicious|doubtful|through\s+new\s+varnish|replaced\s+rail|machine\s+screws|machine[\s-]cut\s+dovetail|circular[\s-]saw|likely\s+fake|probably\s+fake|fraudulent)\b/;
const JME_RE = /\b(j\.?\s*m\.?\s*e\.?|jurande|marque\s+de\s+jurande)\b/;

/** True when the text mentions a JME / jurande guild mark (supporting evidence, not a maker). */
export const hasJmeMention = (text: string): boolean => JME_RE.test(fold(text));

/**
 * How firmly the user's text ties the piece to the maker.
 * - stamped_confirmed: buyer has confirmed a real stamp
 * - stamped_stated: catalogue / text says estampillé (and does not deny it)
 * - attributed: attribué à / dans le goût / style — never stamped
 * - dealer_label: label or dealer's word only
 * - doubtful_stamp: transplanted / fake / suspicious stamp language — no maker premium
 * - mentioned: name only
 * Phrases like "not yet checked", "pas d'estampille", "attribué à", "dans le goût de", "style" never yield STAMPED/CONFIRMED.
 */
export const makerStatusFromText = (text: string): MakerStatus => {
  const t = fold(text);
  const stamp = STAMP_RE.test(t);
  const label = LABEL_RE.test(t);
  const attr = ATTR_RE.test(t) || STYLE_ONLY_RE.test(t);
  const confirm = CONFIRM_RE.test(t);
  const noStamp = NO_STAMP_RE.test(t);
  const doubtful = DOUBTFUL_RE.test(t);

  if (doubtful && (stamp || /\b(bellange|riesener|boudin|jacob|oeben|hache)\b/.test(t) || stamp)) return 'doubtful_stamp';
  if (doubtful && stamp) return 'doubtful_stamp';

  // Explicit absence / not checked: never stamped or confirmed
  if (noStamp) {
    if (label) return 'dealer_label';
    if (attr) return 'attributed';
    return 'mentioned';
  }

  // Attribution / style wording without a positive stamp claim
  if (attr && !stamp) return 'attributed';
  if (attr && stamp && (STYLE_ONLY_RE.test(t) || /\battribu\w*/.test(t)) && !confirm) {
    // "attribué… estampille" traces, or style piece "carrying a stamp" handled above as doubtful when fake words present
    if (/\b(trace|traces|partial|illegible|illisible|effac)\w*/.test(t)) return 'attributed';
    // "attribuée à X (pas d'estampille)" already caught by noStamp; plain attribuée stays attributed
    if (/\battribu\w*/.test(t)) return 'attributed';
  }

  if (stamp && confirm) return 'stamped_confirmed';
  if (label && attr && !stamp) return 'attributed';
  if (label && !(stamp && /\b(and|et)\b[^.]{0,30}\b(stamp|estampill)/.test(t) && !/label\s+says|etiquette\s+(dit|indique)/.test(t))) return 'dealer_label';
  if (attr && stamp && /\b(trace|traces|partial|illegible|illisible|effac)\w*/.test(t)) return 'attributed';
  if (stamp) return 'stamped_stated';
  if (attr) return 'attributed';
  return 'mentioned';
};

export const detectMaker = (text: string): MakerMatch | null => {
  const m = findMaker(text);
  if (!m) return null;
  return { key: m.key, name: m.name, search: m.search, status: makerStatusFromText(text), source: 'text', jme: hasJmeMention(text) };
};

/** A stamp (stated, confirmed or seen) anchors on stamped comparables; an attribution on attributed ones; a label on none. */
export const anchorGroupFor = (s: MakerStatus): 'stamped' | 'attributed' | null =>
  s === 'stamped_confirmed' || s === 'stamped_stated' || s === 'stamp_in_photo' ? 'stamped' : s === 'attributed' ? 'attributed' : null;
// doubtful_stamp / dealer_label / mentioned → no comps anchor

const STATUS_RANK: Record<MakerStatus, number> = { stamped_confirmed: 6, stamped_stated: 5, stamp_in_photo: 4, attributed: 3, dealer_label: 2, doubtful_stamp: 2, mentioned: 1 };

/** The user's own words win; the model adds a stamp it read in a photo, or a maker the text did not name. */
export const combineMakerStatus = (fromText: MakerMatch | null, model: { name?: string; status?: string } | null | undefined): MakerMatch | null => {
  const modelMaker = model?.name ? findMaker(model.name) : null;
  const ms = String(model?.status || '');
  const modelStatus: MakerStatus | null = ms === 'stamp_visible_in_photo' ? 'stamp_in_photo' : ms === 'attributed' ? 'attributed' : ms === 'dealer_label' ? 'dealer_label' : ms === 'stamped_stated' ? 'stamped_stated' : ms === 'doubtful_stamp' ? 'doubtful_stamp' : null;
  if (fromText) {
    // Text wins on doubtful / no-stamp / label — never let a photo upgrade those to stamped
    if (fromText.status === 'doubtful_stamp' || fromText.status === 'dealer_label' || fromText.status === 'mentioned')
      return fromText;
    if (modelStatus === 'stamp_in_photo' && (!modelMaker || modelMaker.key === fromText.key) && STATUS_RANK.stamp_in_photo > STATUS_RANK[fromText.status])
      return { ...fromText, status: 'stamp_in_photo', source: 'photo' };
    return fromText;
  }
  if (modelMaker && modelStatus) return { key: modelMaker.key, name: modelMaker.name, search: modelMaker.search, status: modelStatus, source: 'photo' };
  return null;
};

// ---------------------------------------------------------------------------
// What kind of piece, how many, what material (for the comparables search and the per-piece scaling)
// ---------------------------------------------------------------------------

export interface PieceQuery { key: string; en: string; fr: string; re: RegExp }
export const PIECES: PieceQuery[] = [
  { key: 'bergere', en: 'bergère', fr: 'bergère', re: /\bbergeres?\b/ },
  { key: 'armchair', en: 'armchair fauteuil', fr: 'fauteuil', re: /\b(arm\s?chairs?|fauteuils?|elbow\s?chairs?|karmstol\w*)\b/ },
  { key: 'chair', en: 'chair', fr: 'chaise', re: /\b(chairs?|chaises?|side\s?chairs?|stolar|stol)\b/ },
  { key: 'sofa', en: 'sofa canapé', fr: 'canapé', re: /\b(sofas?|settees?|canapes?|banquettes?|soffa)\b/ },
  { key: 'commode', en: 'commode', fr: 'commode', re: /\b(commodes?|chests?\s+of\s+drawers|byra)\b/ },
  { key: 'secretaire', en: 'secrétaire', fr: 'secrétaire', re: /\b(secretaires?|secretary|secretaries)\b/ },
  { key: 'desk', en: 'bureau plat desk', fr: 'bureau', re: /\b(bureau(x)?\s+plats?|desks?|bureaux?)\b/ },
  { key: 'table', en: 'table', fr: 'table', re: /\b(tables?|gueridons?|consoles?)\b/ },
  { key: 'cabinet', en: 'cabinet', fr: 'meuble', re: /\b(cabinets?|armoires?|bibliotheques?|bookcases?|encoignures?|corner\s+cupboards?|chiffonniers?|semainiers?)\b/ },
  { key: 'mirror', en: 'mirror', fr: 'miroir', re: /\b(mirrors?|miroirs?|trumeaux?)\b/ },
];

export const pieceOf = (text: string, category?: string): PieceQuery | null => {
  const t = fold(text);
  let best: { p: PieceQuery; at: number } | null = null;
  for (const p of PIECES) {
    const r = t.match(p.re);
    if (r && r.index !== undefined && (!best || r.index < best.at)) best = { p, at: r.index };
  }
  if (best) return best.p;
  if (category === 'chairs') return PIECES.find(p => p.key === 'armchair')!;
  if (category === 'mirrors') return PIECES.find(p => p.key === 'mirror')!;
  return null;
};

const NUM_WORDS: Record<string, number> = {
  one: 1, single: 1, un: 1, une: 1, two: 2, deux: 2, pair: 2, paire: 2, three: 3, trois: 3, four: 4, quatre: 4, five: 5, cinq: 5,
  six: 6, seven: 7, sept: 7, eight: 8, huit: 8, ten: 10, dix: 10, twelve: 12, douze: 12,
};

/** Number of seats / pieces in the lot ("set of four", "paire de", "suite de six", "4 fauteuils"); 1 when not stated. */
export const countPieces = (text: string): number => {
  const t = fold(text);
  const SEAT = '(arm\\s?chairs?|fauteuils?|chairs?|chaises?|bergeres?|stools?|tabourets?|pieces?|elements?|karmstolar|stolar)';
  const m1 = t.match(new RegExp(`\\b(set|suite|serie|series|ensemble|lot)\\s+(of|de|d')\\s*(\\d{1,2}|${Object.keys(NUM_WORDS).join('|')})\\b`));
  if (m1) { const n = Number(m1[3]) || NUM_WORDS[m1[3]]; if (n) return n; }
  const m2 = t.match(new RegExp(`\\b(\\d{1,2}|${Object.keys(NUM_WORDS).join('|')})\\s+(\\w+\\s+){0,3}?${SEAT}`));
  if (m2) { const n = Number(m2[1]) || NUM_WORDS[m2[1]]; if (n && n > 1) return n; }
  if (/\b(a\s+)?pair\s+of\b|\bpaire\s+de\b|\bparet\b/.test(t)) return 2;
  const m3 = t.match(/\((\d{1,2})\)\s*$/);
  if (m3) return Number(m3[1]);
  return 1;
};

export const materialOf = (text: string): string | undefined => {
  const t = fold(text);
  if (/\b(bois\s+dore|giltwood|gilt\s?wood|gilded\s+(beech|wood)|hetre\s+(sculpte\s+et\s+)?dore|bois\s+(sculpte\s+et\s+|relaque\s+et\s+)?dore|carved\s+and\s+gilded)/.test(t)) return 'giltwood';
  if (/\b(acajou|mahogany|mahogny)\b/.test(t)) return 'mahogany';
  if (/\b(noyer|walnut|valnot)\b/.test(t)) return 'walnut';
  if (/\b(hetre|beech)\b/.test(t)) return 'beech';
  if (/\b(bois\s+de\s+rose|tulipwood|rosewood|amarante|kingwood|marquet)/.test(t)) return 'veneer';
  if (/\b(laque|lacquer|peint|painted)\b/.test(t)) return 'painted';
  return undefined;
};
