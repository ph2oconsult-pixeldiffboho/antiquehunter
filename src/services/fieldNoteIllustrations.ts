/** Illustration registry checks (no JSX) — used by unit tests. */
import { FIELD_NOTES, type IllustrationId } from '../content/fieldNotes';

/** Every note must have illustration === id (1:1 identity). Visual assets are optional. */
export const EXPECTED_ILLUSTRATION_IDS: IllustrationId[] = FIELD_NOTES.map(n => n.illustration);

export const SCAM_ONLY_ILLUSTRATION_ID: IllustrationId = 'buy-scam-listings';

/** Illustration ids that are allowed only for their matching note id (no cross-use). */
export const illustrationBelongsOnlyToItsNote = (): boolean =>
  FIELD_NOTES.every(n => n.illustration === n.id);

export const scamIllustrationNotReused = (): boolean =>
  FIELD_NOTES.filter(n => n.illustration === SCAM_ONLY_ILLUSTRATION_ID).length === 1
  && FIELD_NOTES.find(n => n.illustration === SCAM_ONLY_ILLUSTRATION_ID)?.id === SCAM_ONLY_ILLUSTRATION_ID;
