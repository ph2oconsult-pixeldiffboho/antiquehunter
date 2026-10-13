// Thin-evidence high cap (shared, pure). When nothing corroborates a high figure — no confirmed period, no stamp or
// top maker, no period construction seen, no verified comparables anchoring the range, and the model is not highly
// confident — the displayed upper figure is kept near the model's own mid estimate instead of a generous stretch.
// The low is left as is; the walk-away / max price follows the (capped) high through the normal reconciliation.

export const THIN_HIGH_MID_FACTOR = 1.3;

const TOP_MAKER_RE = /\b(riesener|oeben|bvrb|van\s+risen\s?burgh|weisweiler|carlin|cressent|roentgen|leleu|dubois|jacob|desmalter|bellang[ée]|hache|delanois|tilliard|foliot|s[ée]n[ée]|gourdin|boulle|majorelle|gall[ée]|ruhlmann|linke|sormani|zwiener|beurdeley)(?![a-z])/i;
const STAMP_RE = /\b(stamped|stamp|estampill\w*|jme|sign[ée]e?|signed|marked)\b/i;
const PERIOD_CONSTRUCTION_RE = /\b(hand[\s-]?cut|pit[\s-]?saw\w*|pegged|chevill\w*|hand[\s-]?forged|rose[\s-]?head|oxidi[sz]\w*|period\s+(joinery|construction|nails|screws))\b/i;
const NEGATED_RE = /\b(no|without|not|lacks?)\s+(\w+\s+){0,3}(hand[\s-]?cut|pegged|period|oxidi[sz]ed|hand[\s-]?forged)/i;

export interface ThinEvidenceInput {
  low: number;
  high: number;
  periodCertainty?: string;
  confidence?: string;
  /** user text + catalogue text + model title (stamp / top-maker names) */
  text?: string;
  makerStatus?: string | null;
  constructionEvidence?: string;
  compsAnchored?: boolean;
}

export const isThinEvidence = (i: ThinEvidenceInput): boolean => {
  if (i.compsAnchored) return false;
  if (i.periodCertainty === 'confirmed_period') return false;
  if (i.confidence === 'high') return false;
  const t = String(i.text || '');
  if (TOP_MAKER_RE.test(t) || STAMP_RE.test(t)) return false;
  if (['stamped_confirmed', 'stamped_stated', 'stamp_in_photo', 'stamp_visible_in_photo'].includes(String(i.makerStatus || ''))) return false;
  const ce = String(i.constructionEvidence || '');
  if (PERIOD_CONSTRUCTION_RE.test(ce) && !NEGATED_RE.test(ce)) return false;
  return true;
};

const r = (x: number) => x >= 1000 ? Math.round(x / 50) * 50 : Math.round(x / 10) * 10;

export const applyThinEvidenceCap = (i: ThinEvidenceInput): { low: number; high: number; applied: boolean } => {
  const low = Math.max(0, Number(i.low) || 0);
  const high = Math.max(low, Number(i.high) || low);
  if (!(high > 0) || !isThinEvidence(i)) return { low, high, applied: false };
  const cap = ((low + high) / 2) * THIN_HIGH_MID_FACTOR;
  if (high <= cap) return { low, high, applied: false };
  return { low, high: Math.max(low, r(cap)), applied: true };
};
