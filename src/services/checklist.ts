// "Before you buy": a checklist tailored to the piece type, period, maker claim and verdict. Each item can be answered
// Yes / No / Not sure; a re-run applies the answers: confirmations firm up confidence (and the range), denials lower
// them. Pure (unit-tested); the texts are in the i18n files (checklist.items.<id>).
import { fold, type MakerStatus } from "./makers.js";

export type CheckId =
  | 'stamp_every_piece' | 'stamp_present' | 'label_is_not_stamp' | 'matching_set' | 'joints_underneath' | 'seat_rails_webbing'
  | 'mirror_glass_original' | 'mirror_back_original' | 'crest_original' | 'gilding_original' | 'marble_original'
  | 'hardware_original' | 'veneer_sound' | 'no_major_restoration' | 'invoice_wording' | 'provenance_condition_report';
export type CheckAnswer = 'yes' | 'no' | 'unsure';
export type CheckAnswers = Partial<Record<CheckId, CheckAnswer>>;

export interface CheckItem { id: CheckId; important: boolean; vars?: Record<string, string | number> }

export interface ChecklistInput {
  pieceKind: 'case' | 'seating' | 'mirror' | 'table' | 'other';
  pieces: number;
  period?: string;
  maker?: { name: string; status: MakerStatus } | null;
  basis?: string;          // verdict basis (strong_buy, good_buy, fair, overpriced, walk_away, need_evidence, ...)
  text: string;            // user text + model title / description words
  category?: string;
}

/** The checks for this piece, most important first. Always ends with the invoice wording and provenance / condition report. */
export const buildChecklist = (i: ChecklistInput): CheckItem[] => {
  const t = fold(i.text);
  const out: CheckItem[] = [];
  const add = (id: CheckId, important = false, vars?: CheckItem['vars']) => { if (!out.some(x => x.id === id)) out.push({ id, important, vars }); };
  const maker = i.maker;
  const buying = ['strong_buy', 'good_buy', 'fair', 'need_evidence', 'no_price'].includes(String(i.basis || ''));
  if (maker && maker.status !== 'mentioned') {
    if (maker.status === 'dealer_label') add('label_is_not_stamp', true, { maker: maker.name });
    if (i.pieces > 1) add('stamp_every_piece', true, { maker: maker.name, n: i.pieces, where: i.pieceKind === 'seating' ? 'seat_rail' : 'carcass' });
    else add('stamp_present', true, { maker: maker.name, where: i.pieceKind === 'seating' ? 'seat_rail' : 'carcass' });
  }
  if (i.pieces > 1) add('matching_set', true, { n: i.pieces });
  if (i.pieceKind === 'mirror') {
    add('mirror_glass_original', true);
    add('mirror_back_original', true);
    if (/\b(crest|fronton|pediment|cresting|trophy|trophee|noeud|bow)\b/.test(t)) add('crest_original', true);
    add('gilding_original');
  } else {
    add('joints_underneath', buying);
    if (i.pieceKind === 'seating') add('seat_rails_webbing');
    if (/\b(marble|marbre)\b/.test(t)) add('marble_original', true);
    if (i.pieceKind === 'case' || /\b(bronze|ormolu|mounts?|hardware|handles?|poignees?|entrees?\s+de\s+serrure|sabots)\b/.test(t)) add('hardware_original');
    if (/\b(veneer|placage|marquet|plaque)\w*/.test(t) || i.pieceKind === 'case') add('veneer_sound');
    if (/\b(giltwood|gilt|dore|gilded)\b/.test(t)) add('gilding_original');
  }
  add('no_major_restoration');
  add('invoice_wording', true, { maker: maker && maker.status !== 'mentioned' && maker.status !== 'dealer_label' ? maker.name : '', period: i.period || '' });
  add('provenance_condition_report');
  return out;
};

/** What a denial does to the value (multiplier on the range) — confirmations never raise the value by themselves. */
export const DENIAL_FACTOR: Partial<Record<CheckId, number>> = {
  matching_set: 0.75, joints_underneath: 0.6, mirror_glass_original: 0.85, mirror_back_original: 0.9, crest_original: 0.85,
  gilding_original: 0.9, marble_original: 0.85, hardware_original: 0.9, veneer_sound: 0.85, no_major_restoration: 0.85, seat_rails_webbing: 0.95,
};

export interface ChecksEffect {
  confidenceDelta: number;     // added to the calibrated confidence score
  rangeFactor: number;         // multiplier on the market and retail ranges
  narrowLow: number;           // share of the range width the low end moves up (confirmations narrow the range)
  stampOverride?: 'confirmed' | 'denied';
  periodConfirmed: boolean;    // joints / construction confirmed by the buyer
  periodDenied: boolean;
  yes: CheckId[]; no: CheckId[]; unsure: CheckId[];
}

/** The effect of the buyer's answers (only answers to items that apply to this piece count). */
export const checksEffect = (answers: CheckAnswers | undefined, items?: CheckItem[]): ChecksEffect => {
  const ids = new Set((items || []).map(x => x.id));
  const e: ChecksEffect = { confidenceDelta: 0, rangeFactor: 1, narrowLow: 0, periodConfirmed: false, periodDenied: false, yes: [], no: [], unsure: [] };
  for (const [id, a] of Object.entries(answers || {}) as Array<[CheckId, CheckAnswer]>) {
    if (items && !ids.has(id)) continue;
    if (a === 'yes') e.yes.push(id); else if (a === 'no') e.no.push(id); else if (a === 'unsure') e.unsure.push(id);
  }
  const informative = (id: CheckId) => id !== 'invoice_wording' && id !== 'provenance_condition_report';
  e.confidenceDelta = Math.min(15, 4 * e.yes.filter(informative).length) - Math.min(25, 7 * e.no.filter(informative).length);
  for (const id of e.no) e.rangeFactor *= DENIAL_FACTOR[id] ?? 1;
  e.rangeFactor = Math.max(0.3, e.rangeFactor);
  e.narrowLow = Math.min(0.3, 0.06 * e.yes.filter(informative).length);
  const stampIds: CheckId[] = ['stamp_every_piece', 'stamp_present'];
  if (e.no.some(id => stampIds.includes(id))) e.stampOverride = 'denied';
  else if (e.yes.some(id => stampIds.includes(id))) e.stampOverride = 'confirmed';
  e.periodConfirmed = e.yes.includes('joints_underneath');
  e.periodDenied = e.no.includes('joints_underneath');
  return e;
};

/** The answers as plain text for the model (so its prose reflects them; the app applies the numbers). */
export const checksPrompt = (answers: CheckAnswers | undefined): string => {
  const rows = Object.entries(answers || {}).filter(([, a]) => a);
  if (!rows.length) return '';
  const word = (a: string) => a === 'yes' ? 'CONFIRMED by the buyer' : a === 'no' ? 'NOT the case (buyer says no)' : 'not sure';
  return `Buyer's checks on the piece (the app adjusts the range and confidence for these; reflect them in your text and risks, do not re-price for them):\n${rows.map(([id, a]) => `- ${id.replace(/_/g, ' ')}: ${word(String(a))}`).join('\n')}`;
};
