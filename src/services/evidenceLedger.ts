// Facts / claims / photo features / hypotheses / unknowns — split evidence ledger.
// Pure helpers; the model fills the ledger, postProcess normalises, UI renders.

export type EvidenceKind = 'user_fact' | 'catalogue_claim' | 'photo_feature' | 'model_hypothesis' | 'unknown';
export type DefectSeverity = 'minor' | 'moderate' | 'major' | 'structural';

export interface EvidenceItem {
  kind: EvidenceKind;
  text: string;
}

export interface DefectItem {
  text: string;
  severity: DefectSeverity;
  location: string; // e.g. "seat rail", "marble top left corner", "unknown"
}

export interface EvidenceLedger {
  facts: string[];                 // buyer-stated or catalogue-confirmed facts
  claims: string[];                // catalogue / dealer claims not yet verified
  photo_features: string[];        // features supported by photos
  hypotheses: string[];            // model inferences
  unknowns: string[];              // explicitly unknown / "not sure"
  defects: DefectItem[];
  style_note: string | null;       // "Style X" design description (not a period claim)
}

const asArr = (x: unknown): string[] =>
  Array.isArray(x) ? x.map(s => String(s || '').trim()).filter(Boolean) : [];

const SEV: DefectSeverity[] = ['minor', 'moderate', 'major', 'structural'];

export const normaliseEvidenceLedger = (raw: any, opts?: { hasPhotos?: boolean; styleText?: string }): EvidenceLedger => {
  const facts = asArr(raw?.facts);
  const claims = asArr(raw?.claims);
  const photo_features = asArr(raw?.photo_features);
  const hypotheses = asArr(raw?.hypotheses);
  const unknowns = asArr(raw?.unknowns);
  // "Not sure" / "unsure" / "unknown" phrasing stays in unknowns, never promoted
  const isUnsure = (s: string) => /\b(not sure|unsure|unknown|inconnu|pas s[uû]r|ne sais pas)\b/i.test(s);
  const cleanHyp = hypotheses.filter(h => !isUnsure(h));
  const moreUnknown = [...unknowns, ...hypotheses.filter(isUnsure), ...facts.filter(isUnsure), ...claims.filter(isUnsure)];
  const defectsRaw = Array.isArray(raw?.defects) ? raw.defects : [];
  const defects: DefectItem[] = defectsRaw.map((d: any) => ({
    text: String(d?.text || d || '').trim(),
    severity: (SEV.includes(d?.severity) ? d.severity : 'moderate') as DefectSeverity,
    location: String(d?.location || 'unspecified').trim() || 'unspecified',
  })).filter((d: DefectItem) => d.text);
  // Style X stays a design description, never a period claim
  let style_note: string | null = raw?.style_note ? String(raw.style_note).trim() : null;
  const styleText = String(opts?.styleText || '');
  if (!style_note && /\bstyle\b/i.test(styleText) && !/\b[ée]poque\b|\bperiod\b/i.test(styleText)) {
    style_note = styleText.trim() || null;
  }
  if (!opts?.hasPhotos && photo_features.length) {
    // Without photos, photo_features are hypotheses at best
    cleanHyp.push(...photo_features.map(f => `(unverified without photo) ${f}`));
    photo_features.length = 0;
  }
  return {
    facts: facts.filter(f => !isUnsure(f)),
    claims: claims.filter(c => !isUnsure(c)),
    photo_features,
    hypotheses: cleanHyp,
    unknowns: [...new Set(moreUnknown)],
    defects,
    style_note,
  };
};

export const ledgerHasContent = (e: EvidenceLedger): boolean =>
  !!(e.facts.length || e.claims.length || e.photo_features.length || e.hypotheses.length || e.unknowns.length || e.defects.length || e.style_note);
