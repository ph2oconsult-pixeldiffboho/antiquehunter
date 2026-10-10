/** Search, filter and match Field Notes to an appraisal. */
import {
  FIELD_NOTES,
  type FieldNote,
  type FieldNoteCategory,
  type PeriodTag,
  type PieceTag,
} from '../content/fieldNotes';
import { pieceKindOf, type PieceKind } from './appraisalMath';

export type Lang = 'en' | 'fr';

export const langOf = (lng?: string): Lang => (String(lng || '').toLowerCase().startsWith('fr') ? 'fr' : 'en');

export const noteTitle = (n: FieldNote, lang: Lang) => n.title[lang];
export const noteBody = (n: FieldNote, lang: Lang) => n.body[lang];

const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

/** Piece tags implied by appraisal category / title. */
export const pieceTagsFromAppraisal = (category?: string, title?: string): PieceTag[] => {
  const kind: PieceKind = pieceKindOf(category, title);
  const t = norm(`${category || ''} ${title || ''}`);
  const tags: PieceTag[] = [];
  if (kind === 'mirror' || /mirror|miroir|trumeau|glace|spegel/.test(t)) tags.push('mirrors');
  if (kind === 'seating' || /chair|fauteuil|chaise|berg|armchair|stol/.test(t)) tags.push('chairs');
  if (kind === 'table' || /table|console|gueridon|guéridon|bord\b/.test(t)) tags.push('tables');
  if (/secretaire|secrétaire|secretary|escritoire|bureau\b/.test(t)) tags.push('secretaires');
  if (/commode|chest|chiffon|semainier|drawers|byrå|byra/.test(t)) tags.push('commodes');
  if (/armoire|cabinet|buffet|vaisselier|wardrobe|cupboard|skåp|skap|hogskap|högskåp|sideboard|bahut/.test(t)) {
    tags.push('cabinets');
  }
  if (kind === 'case' && tags.length === 0) tags.push('commodes', 'cabinets');
  return [...new Set(tags)];
};

/** Period tags from style / period text. */
export const periodTagsFromText = (...parts: Array<string | undefined>): PeriodTag[] => {
  const t = norm(parts.filter(Boolean).join(' '));
  const tags: PeriodTag[] = [];
  if (/louis\s*xiv|\bregence\b|\bregence\b/.test(t)) tags.push('louis_xiv_regence');
  // Louis XVI before XV so "louis xvi" is not swallowed as XV
  if (/louis\s*xvi|louis\s*16/.test(t)) tags.push('louis_xvi');
  else if (/louis\s*xv|louis\s*15|\brocaille\b/.test(t)) tags.push('louis_xv');
  if (/\btransition\b/.test(t)) tags.push('transition');
  if (/\bdirectoire\b|\bempire\b|bellang/.test(t)) tags.push('directoire_empire');
  if (/\brestauration\b|\brestoration\b/.test(t)) tags.push('restauration');
  if (/louis[- ]?philippe/.test(t)) tags.push('louis_philippe');
  if (/napoleon\s*iii|napol[eé]on\s*iii|second empire/.test(t)) tags.push('napoleon_iii');
  if (/gustav|swedish|suedois|rococo sued|halsing|skane|dalarna/.test(t)) tags.push('gustavian');
  if (/georgian|\bregency\b|george\s*[ivx]|chippendale|sheraton|hepplewhite/.test(t)) tags.push('georgian_regency');
  return [...new Set(tags)];
};

export interface NoteMatchInput {
  category?: string;
  title?: string;
  style?: string;
  period?: string;
  origin?: string;
  /** Maker name or status text from the appraisal */
  makerText?: string;
  hasMakerClaim?: boolean;
}

export interface RankedNote {
  note: FieldNote;
  score: number;
  reasons: string[];
}

/** Score notes for an appraisal; highest first. */
export const matchNotesForPiece = (input: NoteMatchInput, limit = 5): RankedNote[] => {
  const pieceTags = pieceTagsFromAppraisal(input.category, input.title);
  const periodTags = periodTagsFromText(input.style, input.period, input.origin, input.title);
  const maker = !!(input.hasMakerClaim || (input.makerText && /stamp|estamp|bellang|maker|label|attribu/i.test(input.makerText)));
  const ranked: RankedNote[] = [];

  for (const note of FIELD_NOTES) {
    let score = 0;
    const reasons: string[] = [];
    const pieceHit = note.pieceTags.some(t => pieceTags.includes(t));
    const periodHit = note.periodTags.some(t => periodTags.includes(t));
    if (pieceHit) { score += 3; reasons.push('piece'); }
    if (periodHit) { score += 3; reasons.push('period'); }
    if (note.makerRelated && maker) { score += 2; reasons.push('maker'); }
    if (note.category === 'buying' && score === 0) { score += 0.5; reasons.push('buying'); }
    // Prefer specific notes over generic buying when we have piece/period hits
    if (score >= 3) ranked.push({ note, score, reasons });
  }

  // Always include a buying note if we have room and none matched strongly on buying
  ranked.sort((a, b) => b.score - a.score || a.note.id.localeCompare(b.note.id));
  let out = ranked.slice(0, limit);

  if (out.length < limit) {
    const have = new Set(out.map(r => r.note.id));
    for (const note of FIELD_NOTES) {
      if (have.has(note.id)) continue;
      const pieceHit = note.pieceTags.some(t => pieceTags.includes(t));
      const periodHit = note.periodTags.some(t => periodTags.includes(t));
      const makerHit = note.makerRelated && maker;
      if (pieceHit || periodHit || makerHit || note.category === 'stamps' && maker || note.category === 'buying') {
        out.push({ note, score: pieceHit || periodHit ? 2 : 1, reasons: ['related'] });
        have.add(note.id);
      }
      if (out.length >= limit) break;
    }
  }

  // Guarantee 3–5 when possible
  if (out.length < 3) {
    const have = new Set(out.map(r => r.note.id));
    for (const id of ['buy-cash-cap', 'buy-negotiate', 'stamp-dealer-label', 'per-style-trap', 'commode-dovetails']) {
      const note = FIELD_NOTES.find(n => n.id === id);
      if (note && !have.has(note.id)) {
        out.push({ note, score: 0.2, reasons: ['fallback'] });
        have.add(note.id);
      }
      if (out.length >= 3) break;
    }
  }

  return out.slice(0, limit);
};

export interface FilterState {
  category?: FieldNoteCategory | 'all';
  pieceTag?: PieceTag | 'all';
  periodTag?: PeriodTag | 'all';
  query?: string;
}

export const filterNotes = (state: FilterState, lang: Lang = 'en'): FieldNote[] => {
  const q = norm(state.query || '');
  return FIELD_NOTES.filter(n => {
    if (state.category && state.category !== 'all' && n.category !== state.category) return false;
    if (state.pieceTag && state.pieceTag !== 'all' && !n.pieceTags.includes(state.pieceTag)) return false;
    if (state.periodTag && state.periodTag !== 'all' && !n.periodTags.includes(state.periodTag)) return false;
    if (!q) return true;
    const hay = norm([
      n.title[lang], n.body[lang], n.keywords[lang],
      n.title.en, n.body.en, n.keywords.en,
      n.pieceTags.join(' '), n.periodTags.join(' '), n.category,
    ].join(' '));
    return q.split(/\s+/).filter(Boolean).every(tok => hay.includes(tok));
  });
};

/** Home teaser: rotate by day, optionally bias to recent appraisal tags. */
export const teaserNotes = (opts?: { recent?: NoteMatchInput | null; count?: number; dayKey?: string }): FieldNote[] => {
  const count = opts?.count ?? 2;
  if (opts?.recent) {
    const matched = matchNotesForPiece(opts.recent, count);
    if (matched.length >= count) return matched.map(m => m.note);
  }
  const key = opts?.dayKey || new Date().toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const start = h % FIELD_NOTES.length;
  const out: FieldNote[] = [];
  for (let i = 0; i < FIELD_NOTES.length && out.length < count; i++) {
    out.push(FIELD_NOTES[(start + i) % FIELD_NOTES.length]);
  }
  return out;
};

export const countsByCategory = (): Record<FieldNoteCategory, number> => {
  const c: Record<FieldNoteCategory, number> = { piece: 0, period: 0, stamps: 0, buying: 0 };
  for (const n of FIELD_NOTES) c[n.category]++;
  return c;
};
