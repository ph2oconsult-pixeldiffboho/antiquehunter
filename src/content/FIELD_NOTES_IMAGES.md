# Field Notes illustrations — sources and licences

Raster illustrations live in `public/field-notes/*.webp` (sepia / ink line on warm paper,
about 800 px wide, typically under 80 KB each; total under ~3 MB).

**Generation:** These are **programmatically drawn technical line illustrations** in an
antique-engraving style (SVG geometry → PNG → WebP). The `GenerateImage` tool in the
`cursor` namespace was **not available** in the agent environment that produced them, so
they are not diffusion / multimodal AI generations. They are original drawings made for
this app; no third-party photos, no museum objects, no real brands or people, and no
readable maker names inside the images (labels stay in the UI captions). The JME guild
mark letters are the subject of that note and are intentional.

Rules:
- **One asset per note id** (`illustration === note.id`). Filename stem equals the note id.
- **Images are optional.** Notes without an accepted, feature-accurate image show no
  illustration (`FieldNoteIllustration` returns `null`) — never a wrong or generic fallback.
- The €1 “faire offre” scam diagram is not reused as decoration for other notes.
- List cards lazy-load WebP; detail views load the full image eagerly.

Accepted image count and ids are listed in
`src/components/fieldNotes/FieldNoteIllustration.tsx` (`IMAGE_IDS` /
`REGISTERED_ILLUSTRATION_IDS`).

Licence: same as the application source.
