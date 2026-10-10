import React from 'react';
import type { IllustrationId } from '../../content/fieldNotes';

/**
 * Optional WebP illustrations in /public/field-notes/.
 * Only notes with an accepted, feature-accurate image are listed.
 * illustration id on each note still equals the note id (1:1); missing here means no image.
 */
const IMAGE_IDS = [
  'buy-absentee',
  'buy-cash-cap',
  'buy-cash-vs-transfer',
  'buy-condition',
  'buy-negotiate',
  'buy-premium',
  'buy-scam-listings',
  'buy-transport',
  'cabinet-cornice',
  'cabinet-doors',
  'cabinet-feet',
  'cabinet-hardware',
  'cabinet-interior',
  'cabinet-paint',
  'chair-legs',
  'chair-nails-screws',
  'chair-pegged',
  'chair-seat-rail',
  'chair-set-matching',
  'chair-webbing',
  'commode-backboards',
  'commode-dovetails',
  'commode-marble',
  'commode-married',
  'commode-mounts',
  'commode-oxidation',
  'commode-saw-marks',
  'mirror-backboards',
  'mirror-invoice',
  'mirror-joints',
  'mirror-mercury',
  'mirror-regilding',
  'mirror-size-value',
  'per-empire',
  'per-empire-stamp',
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
  'per-restauration',
  'per-restauration-bois-clair',
  'per-restauration-console',
  'per-restauration-copies',
  'per-restauration-gondole',
  'per-style-trap',
  'per-transition',
  'sec-fall-front',
  'sec-feet-plinth',
  'sec-interior-fit',
  'sec-marble-cylinder',
  'sec-stamp-location',
  'sec-veneer',
  'stamp-dealer-label',
  'stamp-fakes',
  'stamp-genuine-look',
  'stamp-invoice',
  'stamp-where-case',
  'stamp-where-chairs',
  'table-aprons',
  'table-english',
  'table-gueridon',
  'table-leaves',
  'table-leg-joinery',
  'table-top-joints',
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
