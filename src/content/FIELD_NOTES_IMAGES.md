# Field Notes illustrations — sources and licences

Raster illustrations live in `public/field-notes/*.webp` (sepia / ink line with
cross-hatching on warm cream paper, about 800 px on the long edge, typically
40–90 KB each).

**Generation:** These are **AI-generated illustrations** (GenerateImage), reviewed
for period accuracy before acceptance. No third-party photos, no museum objects,
no real brands or people. No text or labels inside the images (captions stay in
the app UI). Maker-stamp marks may appear as stylised impressed strokes when that
is the subject of the note.

Rules:
- **One asset per note id** (`illustration === note.id`). Filename stem equals the note id.
- **Images are optional.** Notes without an accepted, feature-accurate image show no
  illustration (`FieldNoteIllustration` returns `null`) — never a wrong or generic fallback.
- The €1 “faire offre” scam diagram is not reused as decoration for other notes.
- List cards lazy-load WebP; detail views load the full image eagerly.

Accepted image ids are listed in
`src/components/fieldNotes/FieldNoteIllustration.tsx` (`IMAGE_IDS` /
`REGISTERED_ILLUSTRATION_IDS`).

Licence: same as the application source.
