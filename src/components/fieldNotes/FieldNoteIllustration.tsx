import React from 'react';
import type { IllustrationId } from '../../content/fieldNotes';

/**
 * Optional WebP illustrations in /public/field-notes/.
 * Only notes with an accepted, feature-accurate image are listed.
 * illustration id on each note still equals the note id (1:1); missing here means no image.
 */
const IMAGE_IDS = [
  'cabinet-cornice',
  'cabinet-hardware',
  'chair-legs',
  'chair-nails-screws',
  'chair-pegged',
  'chair-seat-rail',
  'chair-webbing',
  'commode-dovetails',
  'commode-saw-marks',
  'mirror-backboards',
  'mirror-joints',
  'mirror-mercury',
  'mirror-regilding',
  'per-empire',
  'per-georgian',
  'per-gustavian',
  'per-louis-xv',
  'per-louis-xv-style',
  'per-louis-xvi',
  'per-lp',
  'per-lp-mirror',
  'per-n3',
  'per-regence',
  'per-regence-trap',
  'per-restauration-console',
  'per-restauration-gondole',
  'per-transition',
  'sec-fall-front',
  'sec-stamp-location',
  'stamp-where-case',
  'stamp-where-chairs',
  'table-gueridon',
] as const satisfies readonly IllustrationId[];

const IMAGE_SET = new Set<string>(IMAGE_IDS);

/** True when this id has an accepted WebP (not a generic fallback). */
export const hasIllustration = (id: string): id is IllustrationId => IMAGE_SET.has(id);

/** Every registered illustration id (subset of note ids; each equals its note). */
export const REGISTERED_ILLUSTRATION_IDS: IllustrationId[] = [...IMAGE_IDS];

/** Ids that must NEVER be used as a generic fallback for unrelated notes. */
export const SCAM_ONLY_ILLUSTRATION_ID: IllustrationId = 'buy-scam-listings';

function srcFor(id: IllustrationId): string {
  return `/field-notes/${id}.webp`;
}

export const FieldNoteIllustration: React.FC<{
  id: IllustrationId;
  className?: string;
  /** When true (list cards), lazy-load; detail views load eagerly. */
  lazy?: boolean;
}> = ({ id, className = '', lazy = false }) => {
  if (!hasIllustration(id)) {
    // No default / fallback image — render nothing rather than a wrong diagram.
    return null;
  }
  return (
    <div
      className={`aspect-[5/3] rounded-2xl overflow-hidden border border-border-custom bg-paper ${className}`}
      data-testid="field-note-illustration"
      data-illustration={id}
    >
      <img
        src={srcFor(id)}
        alt=""
        width={800}
        height={480}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        className="w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
};

export default FieldNoteIllustration;
