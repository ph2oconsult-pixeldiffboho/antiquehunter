import React from 'react';
import type { IllustrationId } from '../../content/fieldNotes';

/** Engraving / line-drawing style. One dedicated drawing per note id — no shared fallbacks. */
const ink = '#1c1b19';
const gold = '#856820';
const mute = '#8a847c';
const paper = '#F7F4EF';
const wash = '#E8E2D8';
const shell = '#3d2a1f';
const brass = '#b8953e';

const Frame: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => (
  <svg viewBox="0 0 200 120" className="w-full h-full" role="img" aria-label={label}>
    <rect width="200" height="120" rx="14" fill={paper} stroke={wash} strokeWidth="1.25" />
    {children}
  </svg>
);

type DrawFn = () => React.ReactElement;

const DRAWINGS: Record<IllustrationId, DrawFn> = {
  'commode-dovetails': () => (
    <Frame label="Drawer dovetails: hand-cut vs machine">

      <text x="22" y="16" fontSize="7.5" fill={mute} fontFamily="Georgia, serif">Hand-cut</text>
      <path d="M14 28 h42" stroke={ink} strokeWidth="1.1" />
      <path d="M16 28 l4 17 h-6 l3-8 h7 l3 8 h-6 l4-17" fill="none" stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M32 28 l5 19 h-7 l3-10 h8 l3 10 h-7 l5-19" fill="none" stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M48 28 l3 15 h-5 l2-7 h6 l2 7 h-5 l3-15" fill="none" stroke={ink} strokeWidth="1.3" />
      <rect x="14" y="54" width="50" height="40" fill="none" stroke={ink} strokeWidth="1.05" />
      <path d="M22 54 v12 M31 54 v20 M40 54 v10 M48 54 v16" stroke={gold} strokeWidth="1.45" strokeLinecap="round" />
      <text x="120" y="16" fontSize="7.5" fill={mute} fontFamily="Georgia, serif">Machine</text>
      <path d="M112 28 h72" stroke={ink} strokeWidth="1.1" />
      <path d="M118 28 v16 h7 v-16 M128 28 v16 h7 v-16 M138 28 v16 h7 v-16 M148 28 v16 h7 v-16 M158 28 v16 h7 v-16 M168 28 v16 h7 v-16" fill="none" stroke={ink} strokeWidth="1.2" />
      <rect x="112" y="54" width="72" height="40" fill="none" stroke={ink} strokeWidth="1.05" />
      <path d="M121 54 v14 M131 54 v14 M141 54 v14 M151 54 v14 M161 54 v14 M171 54 v14" stroke={gold} strokeWidth="1.35" />

    </Frame>
  ),
  'commode-saw-marks': () => (
    <Frame label="Saw marks on drawer bottoms and backs">

      <text x="18" y="16" fontSize="7.5" fill={mute} fontFamily="Georgia, serif">Frame / pit saw</text>
      <rect x="14" y="24" width="80" height="72" rx="2" fill={wash} stroke={ink} strokeWidth="0.9" />
      <path d="M18 32 h72 M18 39 h72 M18 46 h72 M18 53 h72 M18 60 h72 M18 67 h72 M18 74 h72 M18 81 h72 M18 88 h72" stroke={ink} strokeWidth="0.65" opacity="0.75" />
      <text x="114" y="16" fontSize="7.5" fill={mute} fontFamily="Georgia, serif">Circular saw</text>
      <rect x="110" y="24" width="76" height="72" rx="2" fill={wash} stroke={ink} strokeWidth="0.9" />
      <path d="M122 90 A18 18 0 0 1 148 72" fill="none" stroke={gold} strokeWidth="0.85" />
      <path d="M122 90 A28 28 0 0 1 158 68" fill="none" stroke={gold} strokeWidth="0.85" />
      <path d="M122 90 A38 38 0 0 1 168 62" fill="none" stroke={gold} strokeWidth="0.85" />
      <path d="M122 90 A48 48 0 0 1 176 54" fill="none" stroke={gold} strokeWidth="0.85" />
      <path d="M122 90 A58 58 0 0 1 180 44" fill="none" stroke={gold} strokeWidth="0.85" />

    </Frame>
  ),
  'commode-oxidation': () => (
    <Frame label="Oxidation and colour inside drawers">

      <rect x="18" y="18" width="72" height="80" rx="3" fill="#7a5c3a" stroke={ink} strokeWidth="1" />
      <rect x="28" y="30" width="52" height="24" fill="#5c432c" stroke={ink} strokeWidth="0.55" />
      <rect x="28" y="60" width="52" height="24" fill="#6b4e32" stroke={ink} strokeWidth="0.55" />
      <text x="30" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Aged interior</text>
      <rect x="110" y="18" width="72" height="80" rx="3" fill="#efe6d4" stroke={ink} strokeWidth="1" />
      <rect x="120" y="30" width="52" height="24" fill="#f5efe3" stroke={ink} strokeWidth="0.55" />
      <rect x="120" y="60" width="52" height="24" fill="#faf6ee" stroke={ink} strokeWidth="0.55" />
      <text x="120" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Fresh timber</text>

    </Frame>
  ),
  'commode-backboards': () => (
    <Frame label="Backboards: panels, nails, and later plywood">

      <rect x="14" y="16" width="18" height="80" fill={wash} stroke={ink} strokeWidth="0.9" />
      <rect x="34" y="16" width="18" height="80" fill={wash} stroke={ink} strokeWidth="0.9" />
      <rect x="54" y="16" width="18" height="80" fill={wash} stroke={ink} strokeWidth="0.9" />
      <rect x="74" y="16" width="18" height="80" fill={wash} stroke={ink} strokeWidth="0.9" />
      <circle cx="23" cy="36" r="2" fill={ink} /><circle cx="23" cy="72" r="2" fill={ink} />
      <circle cx="43" cy="40" r="2" fill={ink} /><circle cx="43" cy="76" r="2" fill={ink} />
      <circle cx="63" cy="34" r="2" fill={ink} /><circle cx="63" cy="70" r="2" fill={ink} />
      <circle cx="83" cy="42" r="2" fill={ink} /><circle cx="83" cy="78" r="2" fill={ink} />
      <text x="18" y="112" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">Boards · forged nails</text>
      <rect x="112" y="16" width="74" height="80" fill="#d5cbbd" stroke={ink} strokeWidth="0.9" />
      <path d="M112 42 h74 M112 68 h74" stroke={mute} strokeWidth="0.7" strokeDasharray="3 2" />
      <text x="122" y="112" fontSize="6.5" fill={gold} fontFamily="Georgia, serif">Plywood?</text>

    </Frame>
  ),
  'commode-mounts': () => (
    <Frame label="Bronze mounts: hand-filed backs and old nuts">

      <ellipse cx="50" cy="50" rx="34" ry="30" fill={wash} stroke={ink} strokeWidth="1.1" />
      <path d="M28 40 q6 12 0 20 M38 32 q8 18 0 36 M50 30 q8 20 0 40 M62 32 q8 18 0 36 M72 40 q6 12 0 20" fill="none" stroke={ink} strokeWidth="0.85" />
      <circle cx="50" cy="50" r="4.5" fill={gold} stroke={ink} strokeWidth="0.5" />
      <text x="22" y="100" fontSize="7" fill={mute} fontFamily="Georgia, serif">Filed reverse</text>
      <ellipse cx="148" cy="50" rx="34" ry="30" fill="#c9bba8" stroke={ink} strokeWidth="1.1" />
      <circle cx="148" cy="50" r="4.5" fill={gold} stroke={ink} strokeWidth="0.5" />
      <path d="M132 50 h32 M148 34 v32" stroke={mute} strokeWidth="0.65" />
      <path d="M142 44 l12 12 M154 44 l-12 12" stroke={ink} strokeWidth="0.5" opacity="0.35" />
      <text x="122" y="100" fontSize="7" fill={mute} fontFamily="Georgia, serif">Cast · machine screw</text>

    </Frame>
  ),
  'commode-marble': () => (
    <Frame label="Marble tops: thickness, moulding, and fit">

      <path d="M22 34 h156 l-8 14 H30 z" fill="#aeb6be" stroke={ink} strokeWidth="1.1" />
      <path d="M26 34 h148" stroke="#d5dbe0" strokeWidth="2" opacity="0.55" />
      <path d="M34 48 h132 v42 H34 z" fill="#c4a57a" stroke={ink} strokeWidth="1.1" />
      <path d="M42 58 h44 M42 70 h30" stroke={gold} strokeWidth="1" />
      <path d="M34 48 v-14" stroke={gold} strokeWidth="1.3" />
      <text x="38" y="26" fontSize="6.5" fill={gold} fontFamily="Georgia, serif">thickness · moulding</text>
      <text x="55" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Close fit on the carcase</text>

    </Frame>
  ),
  'commode-married': () => (
    <Frame label="Married pieces: top, base, and drawer sets that do not match">

      <rect x="20" y="20" width="70" height="30" fill="#c4a06a" stroke={ink} strokeWidth="1" />
      <rect x="110" y="20" width="70" height="30" fill="#5a4030" stroke={ink} strokeWidth="1" />
      <text x="92" y="40" fontSize="16" fill={gold} fontFamily="Georgia, serif">≠</text>
      <rect x="28" y="62" width="54" height="36" fill="#5a4030" stroke={ink} strokeWidth="1" />
      <rect x="118" y="62" width="54" height="36" fill="#c4a06a" stroke={ink} strokeWidth="1" />
      <text x="50" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Parts not made together</text>

    </Frame>
  ),
  'mirror-mercury': () => (
    <Frame label="Mercury glass vs modern silvering">

      <rect x="14" y="14" width="80" height="80" rx="3" fill="#9aa4aa" stroke={ink} strokeWidth="1.2" />
      <ellipse cx="36" cy="38" rx="15" ry="11" fill="#7a8489" opacity="0.55" />
      <ellipse cx="64" cy="70" rx="12" ry="9" fill="#8a9398" opacity="0.5" />
      <circle cx="72" cy="34" r="3.2" fill="#c0c8cc" opacity="0.75" />
      <circle cx="30" cy="74" r="2.4" fill="#c0c8cc" opacity="0.65" />
      <path d="M20 86 q22 -8 44 2 q14 6 26 -4" fill="none" stroke="#657074" strokeWidth="1.15" opacity="0.55" />
      <text x="24" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Mercury · blooms</text>
      <rect x="106" y="14" width="80" height="80" rx="3" fill="#e8eef2" stroke={ink} strokeWidth="1.2" />
      <path d="M118 34 h56 M118 50 h56 M118 66 h56" stroke="#c8d0d6" strokeWidth="0.85" />
      <path d="M128 26 l36 36" stroke="#d5dde3" strokeWidth="1.1" />
      <text x="118" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Modern · uniform</text>

    </Frame>
  ),
  'mirror-backboards': () => (
    <Frame label="Mirror backs: boards, paper, and modern backing">

      <rect x="38" y="8" width="124" height="92" rx="3" fill={wash} stroke={ink} strokeWidth="1.25" />
      <line x1="100" y1="8" x2="100" y2="100" stroke={ink} strokeWidth="1" />
      <path d="M38 38 q31 5 62 0 q31 -5 62 0" fill="none" stroke={ink} strokeWidth="0.4" opacity="0.3" />
      <circle cx="60" cy="28" r="2.5" fill={ink} /><path d="M58 28 h4 M60 26 v4" stroke={gold} strokeWidth="0.55" />
      <circle cx="60" cy="78" r="2.5" fill={ink} /><path d="M58 78 h4 M60 76 v4" stroke={gold} strokeWidth="0.55" />
      <circle cx="140" cy="28" r="2.5" fill={ink} /><path d="M138 28 h4 M140 26 v4" stroke={gold} strokeWidth="0.55" />
      <circle cx="140" cy="78" r="2.5" fill={ink} /><path d="M138 78 h4 M140 76 v4" stroke={gold} strokeWidth="0.55" />
      <text x="55" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Planks · hand-forged nails</text>

    </Frame>
  ),
  'mirror-regilding': () => (
    <Frame label="Gilding and later cream paint on frames">

      <path d="M28 80 Q55 16 100 40 Q145 16 172 80 Z" fill="#e6d3a0" stroke={ink} strokeWidth="1.15" />
      <path d="M48 64 Q100 26 152 64" fill="none" stroke={gold} strokeWidth="3.2" opacity="0.35" />
      <path d="M58 72 Q100 40 142 72" fill="none" stroke="#b8924a" strokeWidth="2" />
      <path d="M70 52 q12 -10 22 0 q10 8 20 -2" fill="none" stroke={ink} strokeWidth="0.65" opacity="0.45" />
      <ellipse cx="100" cy="56" rx="9" ry="5" fill="#c4a35a" opacity="0.35" />
      <text x="48" y="102" fontSize="7" fill={mute} fontFamily="Georgia, serif">Wear in hollows · bole colour</text>

    </Frame>
  ),
  'mirror-joints': () => (
    <Frame label="Frame joints and corner blocks on mirrors">

      <path d="M34 18 h132 v84 H34 z" fill="none" stroke={ink} strokeWidth="7" />
      <path d="M34 18 l24 24 M166 18 l-24 24 M34 102 l24 -24 M166 102 l-24 -24" stroke={gold} strokeWidth="1.55" />
      <rect x="86" y="48" width="28" height="18" fill={wash} stroke={ink} strokeWidth="0.9" />
      <text x="90" y="60" fontSize="6" fill={mute} fontFamily="sans-serif">block</text>
      <text x="52" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Mitres · corner glue blocks</text>

    </Frame>
  ),
  'mirror-size-value': () => (
    <Frame label="Size and type matter more than '19th century' alone">

      <path d="M48 12 h104 a14 14 0 0 1 14 14 v72 H34 V26 a14 14 0 0 1 14 -14 z" fill="none" stroke={ink} strokeWidth="3.2" />
      <path d="M60 28 h80 v60 H60 z" fill="#c5cdd3" stroke={ink} strokeWidth="0.75" />
      <path d="M48 12 q52 -10 104 0" fill="none" stroke={gold} strokeWidth="1.15" />
      <text x="58" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Large scale · rounded corners</text>

    </Frame>
  ),
  'mirror-invoice': () => (
    <Frame label="Get original glass written on the invoice">

      <rect x="38" y="12" width="124" height="86" rx="3" fill="#fffef9" stroke={ink} strokeWidth="1.15" />
      <line x1="50" y1="30" x2="150" y2="30" stroke={wash} strokeWidth="2.2" />
      <line x1="50" y1="44" x2="132" y2="44" stroke={wash} strokeWidth="2.2" />
      <line x1="50" y1="60" x2="150" y2="60" stroke={gold} strokeWidth="2.5" />
      <text x="52" y="64" fontSize="5.5" fill={gold} fontFamily="Georgia, serif">glace au mercure d'origine</text>
      <line x1="50" y1="76" x2="112" y2="76" stroke={wash} strokeWidth="2.2" />
      <text x="46" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Invoice wording for glass</text>

    </Frame>
  ),
  'chair-seat-rail': () => (
    <Frame label="Seat rails: the first place to look for a stamp">

      <path d="M30 32 h140 v10 H30 z" fill="#7a5a28" stroke={ink} strokeWidth="1.15" />
      <path d="M42 42 v48 M158 42 v48" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M42 90 h116" stroke={ink} strokeWidth="2.4" />
      <rect x="78" y="50" width="44" height="16" rx="1.5" fill="none" stroke={gold} strokeWidth="1.5" />
      <text x="84" y="61" fontSize="7" fill={gold} fontFamily="Georgia, serif">STAMP</text>
      <path d="M78 50 q4 -3 8 0" fill="none" stroke={ink} strokeWidth="0.5" opacity="0.4" />
      <text x="48" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Inner face of seat rail</text>

    </Frame>
  ),
  'chair-webbing': () => (
    <Frame label="Webbing, springs, and upholstery clues">

      <rect x="40" y="14" width="120" height="84" fill="none" stroke={ink} strokeWidth="2.2" />
      <path d="M40 30 h120 M40 46 h120 M40 62 h120 M40 78 h120" stroke={gold} strokeWidth="2.1" />
      <path d="M58 14 v84 M78 14 v84 M98 14 v84 M118 14 v84 M138 14 v84" stroke={ink} strokeWidth="1.4" opacity="0.7" />
      <text x="62" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Traditional webbing grid</text>

    </Frame>
  ),
  'chair-pegged': () => (
    <Frame label="Pegged mortise-and-tenon joints">

      <rect x="28" y="44" width="144" height="18" fill={wash} stroke={ink} strokeWidth="1.15" />
      <rect x="86" y="16" width="20" height="84" fill="#c4a882" stroke={ink} strokeWidth="1.15" />
      <circle cx="96" cy="53" r="5.5" fill={gold} stroke={ink} strokeWidth="1" />
      <circle cx="96" cy="53" r="2" fill={ink} />
      <path d="M86 44 h20 M86 62 h20" stroke={ink} strokeWidth="0.5" opacity="0.4" />
      <text x="55" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Pegged mortise-and-tenon</text>

    </Frame>
  ),
  'chair-legs': () => (
    <Frame label="Leg profiles: cabriole, sabre, fluted taper, and turned">

      <text x="22" y="16" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">Cabriole</text>
      <path d="M40 22 Q22 55 42 95" fill="none" stroke={ink} strokeWidth="2.3" />
      <path d="M40 22 Q58 55 38 95" fill="none" stroke={ink} strokeWidth="2.3" />
      <path d="M30 92 q10 8 20 -2" fill="none" stroke={gold} strokeWidth="1.4" />
      <text x="78" y="16" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">Sabre</text>
      <path d="M95 22 Q88 50 110 95" fill="none" stroke={ink} strokeWidth="2.3" />
      <path d="M102 22 Q108 55 118 95" fill="none" stroke={ink} strokeWidth="2.1" />
      <text x="138" y="16" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">Fluted</text>
      <path d="M155 22 L162 95" stroke={ink} strokeWidth="2.2" />
      <path d="M168 22 L162 95" stroke={ink} strokeWidth="2.2" />
      <path d="M157 30 l4 55 M160 28 l2 58 M163 30 l-2 55" stroke={gold} strokeWidth="0.7" />
      <text x="40" y="114" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">Match the leg to the period claim</text>

    </Frame>
  ),
  'chair-set-matching': () => (
    <Frame label="Matching a set of chairs">

      <path d="M24 50 h40 v40 H24 z" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M28 50 v-20 h32 v20" fill="none" stroke={ink} strokeWidth="1.3" />
      <path d="M68 50 h40 v40 H68 z" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M72 50 v-20 h32 v20" fill="none" stroke={ink} strokeWidth="1.3" />
      <path d="M112 50 h40 v40 H112 z" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M116 50 v-18 h32 v18" fill="none" stroke={gold} strokeWidth="1.3" />
      <text x="124" y="40" fontSize="8" fill={gold} fontFamily="Georgia, serif">?</text>
      <text x="36" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Compare rails · carve · patina</text>

    </Frame>
  ),
  'chair-nails-screws': () => (
    <Frame label="Nails vs screws in chair repairs">

      <path d="M48 20 v70" stroke={ink} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M38 20 h20 l-4 10 h-12 z" fill={ink} />
      <text x="28" y="108" fontSize="7" fill={mute} fontFamily="Georgia, serif">Cut / wrought nail</text>
      <path d="M140 28 v62" stroke={gold} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="140" cy="26" r="9" fill="none" stroke={gold} strokeWidth="2" />
      <path d="M140 19 v14 M133 26 h14" stroke={gold} strokeWidth="1.6" />
      <text x="118" y="108" fontSize="7" fill={mute} fontFamily="Georgia, serif">Phillips screw</text>

    </Frame>
  ),
  'cabinet-doors': () => (
    <Frame label="Door panels, raised fields, and later glass">

      <rect x="36" y="10" width="128" height="90" fill={wash} stroke={ink} strokeWidth="1.3" />
      <line x1="100" y1="10" x2="100" y2="100" stroke={ink} strokeWidth="1" />
      <rect x="48" y="28" width="40" height="52" fill="none" stroke={ink} strokeWidth="1.05" />
      <rect x="52" y="34" width="32" height="40" fill="none" stroke={ink} strokeWidth="0.7" />
      <rect x="112" y="28" width="40" height="52" fill="none" stroke={ink} strokeWidth="1.05" />
      <rect x="116" y="34" width="32" height="40" fill="none" stroke={ink} strokeWidth="0.7" />
      <circle cx="82" cy="54" r="2.2" fill={gold} />
      <circle cx="118" cy="54" r="2.2" fill={gold} />
      <text x="55" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Raised panels · lock plates</text>

    </Frame>
  ),
  'cabinet-interior': () => (
    <Frame label="Interiors: shelves, peg holes, and later fittings">

      <rect x="40" y="12" width="120" height="88" fill="none" stroke={ink} strokeWidth="1.4" />
      <path d="M48 32 h104 M48 52 h104 M48 72 h104" stroke={ink} strokeWidth="1.1" />
      <circle cx="52" cy="32" r="2" fill={gold} /><circle cx="52" cy="52" r="2" fill={gold} /><circle cx="52" cy="72" r="2" fill={gold} />
      <circle cx="148" cy="32" r="2" fill={gold} /><circle cx="148" cy="52" r="2" fill={gold} /><circle cx="148" cy="72" r="2" fill={gold} />
      <text x="48" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Shelf pegs · oxidised wood</text>

    </Frame>
  ),
  'cabinet-cornice': () => (
    <Frame label="Cornices, plinths, and two-part carcases">

      <path d="M30 28 h140 l-10 12 H40 z" fill={wash} stroke={ink} strokeWidth="1.15" />
      <rect x="44" y="40" width="112" height="36" fill="#c4a882" stroke={ink} strokeWidth="1.1" />
      <rect x="40" y="76" width="120" height="20" fill={wash} stroke={ink} strokeWidth="1.1" />
      <path d="M44 40 v-0" stroke={gold} strokeWidth="1" />
      <text x="70" y="22" fontSize="6.5" fill={gold} fontFamily="Georgia, serif">cornice</text>
      <text x="78" y="90" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">plinth</text>
      <text x="42" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Two-part carcase must agree</text>

    </Frame>
  ),
  'cabinet-hardware': () => (
    <Frame label="Locks, hinges, and iron mounts on cabinets">

      <rect x="50" y="20" width="100" height="70" rx="2" fill={wash} stroke={ink} strokeWidth="1.15" />
      <rect x="88" y="42" width="24" height="30" rx="2" fill="#4a453e" stroke={ink} strokeWidth="1" />
      <circle cx="100" cy="52" r="3" fill={gold} />
      <path d="M92 62 h16" stroke={gold} strokeWidth="1.2" />
      <path d="M56 30 h8 M136 30 h8" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <text x="48" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Iron lock · hand-filed hinges</text>

    </Frame>
  ),
  'cabinet-paint': () => (
    <Frame label="Original paint vs later overpaint on provincial cabinets">

      <rect x="36" y="18" width="128" height="72" rx="3" fill="#d4cec2" stroke={ink} strokeWidth="1.15" />
      <path d="M36 54 h128" stroke="#b8b0a2" strokeWidth="10" opacity="0.45" />
      <path d="M60 26 q16 28 -8 56" fill="none" stroke="#F7F4EF" strokeWidth="5" opacity="0.85" />
      <path d="M130 30 q-12 24 6 50" fill="none" stroke={gold} strokeWidth="1.2" opacity="0.4" />
      <text x="48" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Edge wear · early paint layers</text>

    </Frame>
  ),
  'cabinet-feet': () => (
    <Frame label="Feet, skirting, and later castors">

      <rect x="40" y="16" width="120" height="48" fill={wash} stroke={ink} strokeWidth="1.15" />
      <path d="M55 64 v32 M85 64 v26 M115 64 v26 M145 64 v32" stroke={ink} strokeWidth="2.8" strokeLinecap="round" />
      <path d="M48 96 h20 M128 90 h24" stroke={gold} strokeWidth="2.2" />
      <text x="55" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Replaced bun feet · castors?</text>

    </Frame>
  ),
  'table-top-joints': () => (
    <Frame label="Table tops: boards, breadboard ends, and veneers">

      <rect x="24" y="28" width="152" height="14" rx="1" fill={wash} stroke={ink} strokeWidth="1.15" />
      <path d="M24 35 h152" stroke={ink} strokeWidth="0.4" opacity="0.35" />
      <path d="M70 28 v14 M110 28 v14 M150 28 v14" stroke={ink} strokeWidth="0.7" />
      <path d="M40 42 v40 M160 42 v40" stroke={ink} strokeWidth="2" />
      <path d="M40 70 h120" stroke={gold} strokeWidth="1.1" />
      <text x="48" y="20" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">Joined boards · underside marks</text>
      <text x="55" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Feel the underside for tools</text>

    </Frame>
  ),
  'table-aprons': () => (
    <Frame label="Aprons, stretchers, and console backs">

      <rect x="30" y="24" width="140" height="10" fill={wash} stroke={ink} strokeWidth="1.1" />
      <path d="M40 34 v50 M160 34 v50" stroke={ink} strokeWidth="2.2" />
      <path d="M40 55 h120" stroke={ink} strokeWidth="1.5" />
      <path d="M55 34 v40 M145 34 v40" stroke={ink} strokeWidth="1.6" />
      <rect x="70" y="38" width="60" height="28" fill="none" stroke={gold} strokeWidth="1" strokeDasharray="3 2" />
      <text x="78" y="55" fontSize="6.5" fill={gold} fontFamily="Georgia, serif">console back?</text>
      <text x="42" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Apron · stretchers · wall back</text>

    </Frame>
  ),
  'table-leaves': () => (
    <Frame label="Leaves, pull-out systems, and later tops">

      <rect x="70" y="30" width="60" height="50" fill="#c4a882" stroke={ink} strokeWidth="1.1" />
      <rect x="30" y="36" width="40" height="38" fill={wash} stroke={ink} strokeWidth="1" />
      <rect x="130" y="36" width="40" height="38" fill={wash} stroke={ink} strokeWidth="1" />
      <path d="M70 40 h-8 M70 56 h-8 M130 40 h8 M130 56 h8" stroke={gold} strokeWidth="1.3" />
      <text x="48" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Leaves must match the top</text>

    </Frame>
  ),
  'table-leg-joinery': () => (
    <Frame label="How legs meet the frieze">

      <rect x="30" y="28" width="140" height="12" fill={wash} stroke={ink} strokeWidth="1.1" />
      <path d="M50 40 v50 M100 40 v50 M150 40 v50" stroke={ink} strokeWidth="2.3" />
      <rect x="42" y="40" width="16" height="12" fill="#c4a882" stroke={ink} strokeWidth="0.8" />
      <rect x="92" y="40" width="16" height="12" fill="#c4a882" stroke={ink} strokeWidth="0.8" />
      <rect x="142" y="40" width="16" height="12" fill={gold} opacity="0.35" stroke={gold} strokeWidth="0.9" />
      <text x="38" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Corner blocks · consistent screws?</text>

    </Frame>
  ),
  'table-gueridon': () => (
    <Frame label="Guéridons and small stands: proportion and stability">

      <ellipse cx="100" cy="28" rx="48" ry="10" fill={wash} stroke={ink} strokeWidth="1.15" />
      <path d="M100 38 v40" stroke={ink} strokeWidth="3" />
      <path d="M70 95 Q100 78 130 95" fill="none" stroke={ink} strokeWidth="2" />
      <path d="M78 95 L100 78 L122 95" fill="none" stroke={gold} strokeWidth="1.2" />
      <text x="48" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Proportion · pedestal logic</text>

    </Frame>
  ),
  'table-english': () => (
    <Frame label="English vs French table construction habits">

      <text x="24" y="20" fontSize="7" fill={mute} fontFamily="Georgia, serif">English lining</text>
      <rect x="18" y="28" width="70" height="55" fill="#c4a882" stroke={ink} strokeWidth="1" />
      <rect x="28" y="40" width="50" height="30" fill="#d8c4a0" stroke={ink} strokeWidth="0.7" />
      <text x="30" y="58" fontSize="6" fill={mute} fontFamily="sans-serif">oak</text>
      <text x="118" y="20" fontSize="7" fill={mute} fontFamily="Georgia, serif">French mount</text>
      <rect x="112" y="28" width="70" height="55" fill="#b8956a" stroke={ink} strokeWidth="1" />
      <ellipse cx="147" cy="55" rx="14" ry="10" fill={gold} opacity="0.35" stroke={gold} strokeWidth="1" />
      <text x="40" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Different habits · same checks</text>

    </Frame>
  ),
  'sec-fall-front': () => (
    <Frame label="Fall fronts: hinges, leather, and writing surface">

      <path d="M48 14 h104 v40 H48 z" fill={wash} stroke={ink} strokeWidth="1.15" />
      <path d="M48 54 l40 32 h104 l-40 -32 H48" fill="#c4a882" stroke={ink} strokeWidth="1.15" />
      <line x1="48" y1="54" x2="152" y2="54" stroke={gold} strokeWidth="1.6" />
      <path d="M70 66 h50" stroke={ink} strokeWidth="0.6" opacity="0.4" />
      <text x="48" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Fall · hinges · writing surface</text>

    </Frame>
  ),
  'sec-interior-fit': () => (
    <Frame label="Interior architecture and later inserts">

      <rect x="36" y="14" width="128" height="84" fill="none" stroke={ink} strokeWidth="1.3" />
      <rect x="44" y="22" width="28" height="20" fill={wash} stroke={ink} strokeWidth="0.8" />
      <rect x="78" y="22" width="28" height="20" fill={wash} stroke={ink} strokeWidth="0.8" />
      <rect x="112" y="22" width="40" height="20" fill={wash} stroke={ink} strokeWidth="0.8" />
      <rect x="44" y="50" width="108" height="36" fill="#efe6d4" stroke={gold} strokeWidth="1" strokeDasharray="3 2" />
      <text x="70" y="72" fontSize="7" fill={gold} fontFamily="Georgia, serif">later insert?</text>
      <text x="42" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Pigeonholes must fit the logic</text>

    </Frame>
  ),
  'sec-stamp-location': () => (
    <Frame label="Where secrétaires are stamped">

      <path d="M40 30 h120 l-8 10 H48 z" fill="#aeb6be" stroke={ink} strokeWidth="1" />
      <rect x="50" y="40" width="100" height="55" fill="#c4a882" stroke={ink} strokeWidth="1.1" />
      <rect x="50" y="40" width="8" height="55" fill="#a67c52" stroke={ink} strokeWidth="0.7" />
      <rect x="52" y="48" width="5" height="14" fill="none" stroke={gold} strokeWidth="1.2" />
      <text x="64" y="58" fontSize="6.5" fill={gold} fontFamily="Georgia, serif">stamp under marble</text>
      <text x="42" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Side upright · ask before lifting</text>

    </Frame>
  ),
  'sec-marble-cylinder': () => (
    <Frame label="Marble tops and cylinder variants">

      <path d="M36 22 h128 l-6 10 H42 z" fill="#aeb6be" stroke={ink} strokeWidth="1" />
      <path d="M50 32 h100 v20 H50 z" fill="#c4a882" stroke={ink} strokeWidth="1" />
      <path d="M50 52 q50 28 100 0" fill="#b8956a" stroke={ink} strokeWidth="1.1" />
      <path d="M50 52 q50 14 100 0" fill="none" stroke={gold} strokeWidth="1.2" />
      <text x="70" y="78" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">cylinder / tambour</text>
      <text x="40" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Marble plan · mechanism wear</text>

    </Frame>
  ),
  'sec-veneer': () => (
    <Frame label="Veneer thickness and pattern on secrétaires">

      <rect x="30" y="18" width="60" height="70" fill="#8b5a2b" stroke={ink} strokeWidth="1" />
      <path d="M40 30 h40 M40 42 h40 M40 54 h40 M40 66 h40" stroke={gold} strokeWidth="1.5" />
      <text x="36" y="100" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">Thicker early</text>
      <rect x="110" y="18" width="60" height="70" fill="#c4a06a" stroke={ink} strokeWidth="1" />
      <path d="M118 28 h44 M118 34 h44 M118 40 h44 M118 46 h44 M118 52 h44 M118 58 h44 M118 64 h44 M118 70 h44" stroke={ink} strokeWidth="0.45" opacity="0.5" />
      <text x="114" y="100" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">Paper-thin later</text>

    </Frame>
  ),
  'sec-feet-plinth': () => (
    <Frame label="Bracket feet, plinths, and later bases on secrétaires">

      <rect x="50" y="16" width="100" height="50" fill="#c4a882" stroke={ink} strokeWidth="1.1" />
      <path d="M50 66 L40 96 h30 L60 66" fill={wash} stroke={ink} strokeWidth="1.1" />
      <path d="M150 66 L140 96 h30 L160 66" fill={gold} opacity="0.25" stroke={gold} strokeWidth="1.2" />
      <text x="130" y="88" fontSize="7" fill={gold} fontFamily="Georgia, serif">≠</text>
      <text x="40" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Bracket feet vs later base</text>

    </Frame>
  ),
  'per-regence': () => (
    <Frame label="Louis XIV to Régence: mass, Boulle, and early curves">

      <rect x="40" y="20" width="120" height="70" fill="#5a4030" stroke={ink} strokeWidth="1.2" />
      <path d="M40 20 h120 l-8 14 H48 z" fill={brass} stroke={ink} strokeWidth="1" opacity="0.85" />
      <path d="M55 45 h30 v25 H55 z M115 45 h30 v25 H115 z" fill="none" stroke={brass} strokeWidth="1.1" />
      <path d="M70 50 q10 8 20 0 q-10 8 -20 0" fill={shell} opacity="0.7" />
      <text x="55" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Mass · Boulle · early curve</text>

    </Frame>
  ),
  'per-regence-trap': () => (
    <Frame label="Trap: 19th-century 'Boulle' and Régence revival">

      <rect x="30" y="18" width="140" height="72" fill="#2a1f18" stroke={ink} strokeWidth="1.2" />
      <path d="M40 30 h50 v20 H40 z M110 30 h50 v20 H110 z M40 58 h50 v20 H40 z M110 58 h50 v20 H110 z" fill={brass} opacity="0.55" stroke={brass} strokeWidth="0.8" />
      <path d="M45 35 q15 6 30 0 q-15 6 -30 0" fill={shell} />
      <path d="M115 63 q15 6 30 0" fill={shell} opacity="0.8" />
      <text x="100" y="55" fontSize="18" fill={gold} fontFamily="Georgia, serif" opacity="0.9">?</text>
      <text x="32" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Boulle surface ≠ early date</text>

    </Frame>
  ),
  'per-louis-xv': () => (
    <Frame label="Louis XV: asymmetry, cabriole legs, and rocaille mounts">

      <path d="M70 14 Q48 50 72 100" fill="none" stroke={ink} strokeWidth="2.6" />
      <path d="M70 14 Q92 50 68 100" fill="none" stroke={ink} strokeWidth="2.6" />
      <path d="M58 94 q14 10 26 -4" fill="none" stroke={gold} strokeWidth="1.6" />
      <path d="M78 40 q18 -6 28 8 q8 12 -4 20" fill="none" stroke={gold} strokeWidth="1.2" />
      <path d="M100 28 q20 4 24 22" fill="none" stroke={ink} strokeWidth="0.8" opacity="0.45" />
      <path d="M120 20 q30 20 20 50 q-8 16 -28 22" fill="none" stroke={ink} strokeWidth="1.3" opacity="0.35" />
      <text x="118" y="48" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">rocaille</text>
      <text x="42" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Cabriole · scroll foot · bombé</text>

    </Frame>
  ),
  'per-louis-xv-style': () => (
    <Frame label="Period vs 'style Louis XV'">

      <rect x="24" y="16" width="70" height="78" rx="2" fill="#fffef9" stroke={ink} strokeWidth="1.1" />
      <text x="32" y="36" fontSize="7" fill={ink} fontFamily="Georgia, serif">époque</text>
      <text x="32" y="52" fontSize="7" fill={gold} fontFamily="Georgia, serif">Louis XV</text>
      <path d="M32 62 h48" stroke={gold} strokeWidth="1.5" />
      <rect x="106" y="16" width="70" height="78" rx="2" fill="#fffef9" stroke={ink} strokeWidth="1.1" />
      <text x="114" y="36" fontSize="7" fill={mute} fontFamily="Georgia, serif">de style</text>
      <text x="114" y="52" fontSize="7" fill={mute} fontFamily="Georgia, serif">Louis XV</text>
      <path d="M114 62 h48" stroke={mute} strokeWidth="1.2" strokeDasharray="3 2" />
      <text x="36" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Catalogue words are not equal</text>

    </Frame>
  ),
  'per-transition': () => (
    <Frame label="Transition: between rococo and neoclassical">

      <path d="M40 30 Q55 55 40 90" fill="none" stroke={ink} strokeWidth="2" opacity="0.45" />
      <path d="M70 22 L78 95" stroke={ink} strokeWidth="2.2" />
      <path d="M86 22 L78 95" stroke={ink} strokeWidth="2.2" />
      <rect x="110" y="28" width="60" height="55" fill={wash} stroke={ink} strokeWidth="1" />
      <path d="M118 40 h44 M118 52 h44 M118 64 h44" stroke={gold} strokeWidth="1.1" />
      <path d="M118 40 v24 M140 40 v24 M162 40 v24" stroke={gold} strokeWidth="1.1" />
      <text x="36" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Curve meets geometry</text>

    </Frame>
  ),
  'per-louis-xvi': () => (
    <Frame label="Louis XVI: fluted legs, symmetry, and classical ornament">

      <path d="M85 14 L95 100" stroke={ink} strokeWidth="2.5" />
      <path d="M105 14 L95 100" stroke={ink} strokeWidth="2.5" />
      <path d="M88 24 l5 68 M91 22 l3 72 M94 24 l1 68 M97 22 l-1 72 M100 24 l-4 68" stroke={gold} strokeWidth="0.85" />
      <path d="M120 30 q30 0 30 20 q0 16 -20 16" fill="none" stroke={ink} strokeWidth="1.1" />
      <path d="M125 38 q10 2 18 0" fill="none" stroke={gold} strokeWidth="0.9" />
      <text x="128" y="70" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">guilloche</text>
      <text x="40" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Fluted taper · neoclassical</text>

    </Frame>
  ),
  'per-empire': () => (
    <Frame label="Directoire and Empire: mahogany, sabre legs, and gilt bronze">

      <path d="M55 18 Q48 55 85 102" fill="none" stroke={ink} strokeWidth="2.6" />
      <path d="M68 18 Q72 58 95 102" fill="none" stroke={ink} strokeWidth="2.4" />
      <path d="M120 30 h50 v40 H120 z" fill="#5a4030" stroke={ink} strokeWidth="1.1" />
      <path d="M128 42 h34 M128 52 h34 M128 62 h34" stroke={gold} strokeWidth="1.3" />
      <circle cx="145" cy="38" r="4" fill={gold} opacity="0.5" />
      <text x="36" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Sabre leg · gilt mounts</text>

    </Frame>
  ),
  'per-empire-stamp': () => (
    <Frame label="Empire chairs and the stamp premium">

      <path d="M28 34 h144 v9 H28 z" fill="#6b4a1e" stroke={ink} strokeWidth="1.1" />
      <path d="M40 43 v42 M160 43 v42" stroke={ink} strokeWidth="2.2" />
      <path d="M40 85 h120" stroke={ink} strokeWidth="2.2" />
      <rect x="70" y="52" width="60" height="18" rx="1" fill="none" stroke={gold} strokeWidth="1.5" />
      <text x="76" y="64" fontSize="7.5" fill={gold} fontFamily="Georgia, serif">BELLANGÉ</text>
      <text x="40" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Stamp premium · check every rail</text>

    </Frame>
  ),
  'per-restauration': () => (
    <Frame label="Restauration overview: after Empire, before Louis-Philippe bulk">

      <path d="M50 20 Q100 8 150 20 Q160 55 150 90 Q100 102 50 90 Q40 55 50 20" fill="none" stroke={ink} strokeWidth="1.8" />
      <path d="M70 35 Q100 28 130 35" fill="none" stroke={gold} strokeWidth="1.3" />
      <path d="M65 70 Q100 58 135 70" fill="none" stroke={ink} strokeWidth="1.2" />
      <text x="78" y="52" fontSize="7" fill={mute} fontFamily="Georgia, serif">softened</text>
      <text x="36" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">After Empire · before LP bulk</text>

    </Frame>
  ),
  'per-restauration-bois-clair': () => (
    <Frame label="Restauration bois clair: citronnier, ash, elm burr">

      <rect x="30" y="18" width="140" height="70" fill="#e8d9b5" stroke={ink} strokeWidth="1.15" />
      <path d="M40 30 h120 M40 48 h120 M40 66 h120" stroke="#2a1f18" strokeWidth="1.4" />
      <path d="M50 30 v36 M100 30 v36 M150 30 v36" stroke="#2a1f18" strokeWidth="0.9" />
      <text x="55" y="55" fontSize="8" fill={mute} fontFamily="Georgia, serif">citronnier · filets</text>
      <text x="32" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Bois clair with dark stringing</text>

    </Frame>
  ),
  'per-restauration-gondole': () => (
    <Frame label="Gondola chairs and crosse arms">

      <path d="M55 95 Q40 50 70 22 Q100 8 130 22 Q160 50 145 95" fill="none" stroke={ink} strokeWidth="2.2" />
      <path d="M70 95 Q75 60 95 48 Q115 60 120 95" fill="none" stroke={ink} strokeWidth="1.6" />
      <path d="M55 70 Q45 55 58 42" fill="none" stroke={gold} strokeWidth="1.8" />
      <path d="M145 70 Q155 55 142 42" fill="none" stroke={gold} strokeWidth="1.8" />
      <text x="85" y="78" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">crosse</text>
      <text x="48" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Gondola back · crook arms</text>

    </Frame>
  ),
  'per-restauration-console': () => (
    <Frame label="Restauration consoles: lighter classicism">

      <path d="M30 28 h140 l-6 10 H36 z" fill="#aeb6be" stroke={ink} strokeWidth="1.1" />
      <path d="M55 38 v45 M145 38 v45" stroke={ink} strokeWidth="2.4" />
      <path d="M55 50 q10 -6 20 0 q10 6 20 0 q10 -6 20 0 q10 6 20 0" fill="none" stroke={gold} strokeWidth="1" opacity="0.6" />
      <ellipse cx="55" cy="88" rx="10" ry="4" fill={wash} stroke={ink} strokeWidth="0.8" />
      <ellipse cx="145" cy="88" rx="10" ry="4" fill={wash} stroke={ink} strokeWidth="0.8" />
      <text x="40" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Lighter classicism · marble</text>

    </Frame>
  ),
  'per-restauration-copies': () => (
    <Frame label="Later copies: Restauration vs Empire vs Louis-Philippe">

      <rect x="16" y="22" width="50" height="60" fill="#5a4030" stroke={ink} strokeWidth="1" />
      <text x="22" y="55" fontSize="6.5" fill={gold} fontFamily="Georgia, serif">Empire</text>
      <rect x="75" y="22" width="50" height="60" fill="#e8d9b5" stroke={ink} strokeWidth="1" />
      <text x="80" y="55" fontSize="6.5" fill={ink} fontFamily="Georgia, serif">Rest.</text>
      <rect x="134" y="22" width="50" height="60" fill="#3d2a1f" stroke={ink} strokeWidth="1" />
      <text x="142" y="55" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">L-P</text>
      <text x="30" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Three eras · revival blur</text>

    </Frame>
  ),
  'per-lp': () => (
    <Frame label="Louis-Philippe: comfort, volume, and dark veneers">

      <path d="M45 18 h110 a10 10 0 0 1 10 10 v60 H35 V28 a10 10 0 0 1 10 -10 z" fill="none" stroke={ink} strokeWidth="2.8" />
      <path d="M55 32 h90 v48 H55 z" fill="#5a4030" stroke={ink} strokeWidth="0.8" />
      <path d="M45 18 q55 -8 110 0" fill="none" stroke={gold} strokeWidth="1.1" />
      <text x="48" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Comfort · dark veneers · volume</text>

    </Frame>
  ),
  'per-lp-mirror': () => (
    <Frame label="Louis-Philippe mirrors: rounded corners and scale">

      <path d="M50 10 h100 a16 16 0 0 1 16 16 v70 H34 V26 a16 16 0 0 1 16 -16 z" fill="none" stroke={ink} strokeWidth="3" />
      <path d="M62 28 h76 v58 H62 z" fill="#c8d0d6" stroke={ink} strokeWidth="0.7" />
      <circle cx="50" cy="26" r="3" fill="none" stroke={gold} strokeWidth="1.2" />
      <circle cx="150" cy="26" r="3" fill="none" stroke={gold} strokeWidth="1.2" />
      <text x="48" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Rounded corners · large glass</text>

    </Frame>
  ),
  'per-n3': () => (
    <Frame label="Napoleon III: revival styles and blackened wood">

      <rect x="40" y="16" width="120" height="72" fill="#1a1512" stroke={ink} strokeWidth="1.2" />
      <path d="M55 30 h40 v20 H55 z M105 30 h40 v20 H105 z M55 58 h90 v18 H55 z" fill="none" stroke={brass} strokeWidth="1.2" />
      <path d="M70 36 q10 6 20 0" fill={brass} opacity="0.4" />
      <text x="70" y="50" fontSize="7" fill={brass} fontFamily="Georgia, serif">revival</text>
      <text x="36" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Ebonised · 19th-c. revivals</text>

    </Frame>
  ),
  'per-gustavian': () => (
    <Frame label="Gustavian and Swedish Rococo: paint, light woods, restraint">

      <rect x="40" y="14" width="120" height="78" fill="#d8d2c6" stroke={ink} strokeWidth="1.2" />
      <path d="M55 30 L60 80 M140 30 L145 80" stroke={ink} strokeWidth="1.5" />
      <path d="M58 35 l2 40 M62 35 l1 40 M143 35 l2 40" stroke={gold} strokeWidth="0.7" />
      <path d="M40 20 h120" stroke="#F7F4EF" strokeWidth="4" opacity="0.5" />
      <text x="42" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Light wood · fluting · paint</text>

    </Frame>
  ),
  'per-georgian': () => (
    <Frame label="Georgian and Regency UK: mahogany, oak linings, brass">

      <rect x="35" y="20" width="130" height="65" fill="#6b4a2a" stroke={ink} strokeWidth="1.15" />
      <rect x="50" y="35" width="45" height="35" fill="#c4a882" stroke={ink} strokeWidth="0.9" />
      <text x="58" y="56" fontSize="6.5" fill={mute} fontFamily="sans-serif">oak lining</text>
      <rect x="110" y="40" width="40" height="12" fill={brass} opacity="0.55" stroke={brass} strokeWidth="0.8" />
      <text x="40" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Georgian case · Regency brass</text>

    </Frame>
  ),
  'per-style-trap': () => (
    <Frame label="General trap: style name without construction">

      <rect x="30" y="20" width="140" height="60" rx="3" fill="#fffef9" stroke={ink} strokeWidth="1.15" />
      <text x="48" y="48" fontSize="11" fill={mute} fontFamily="Georgia, serif">"Louis XV"</text>
      <text x="48" y="68" fontSize="7" fill={gold} fontFamily="Georgia, serif">style or époque?</text>
      <path d="M40 88 h120" stroke={ink} strokeWidth="0.8" strokeDasharray="4 3" />
      <text x="36" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Tag alone is not a date</text>

    </Frame>
  ),
  'stamp-where-chairs': () => (
    <Frame label="Where to find stamps on seating">

      <path d="M28 36 h144 v8 H28 z" fill="#7a5a28" stroke={ink} strokeWidth="1.1" />
      <path d="M40 44 v40 M160 44 v40" stroke={ink} strokeWidth="2.2" />
      <path d="M40 84 h120" stroke={ink} strokeWidth="2.2" />
      <rect x="85" y="52" width="30" height="12" fill="none" stroke={gold} strokeWidth="1.4" />
      <path d="M100 44 v8" stroke={gold} strokeWidth="1.2" strokeDasharray="2 1" />
      <text x="45" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Look under the upholstery line</text>

    </Frame>
  ),
  'stamp-where-case': () => (
    <Frame label="Where to find stamps on case furniture">

      <path d="M36 24 h128 l-8 12 H44 z" fill="#aeb6be" stroke={ink} strokeWidth="1.05" />
      <rect x="48" y="36" width="104" height="52" fill="#c4a882" stroke={ink} strokeWidth="1.1" />
      <rect x="48" y="36" width="10" height="52" fill="#8b6914" stroke={ink} strokeWidth="0.7" />
      <rect x="50" y="44" width="6" height="16" fill="none" stroke={gold} strokeWidth="1.3" />
      <text x="66" y="55" fontSize="6.5" fill={gold} fontFamily="Georgia, serif">top of upright</text>
      <text x="40" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Under the marble · with permission</text>

    </Frame>
  ),
  'stamp-genuine-look': () => (
    <Frame label="What a genuine estampille tends to look like">

      <rect x="30" y="22" width="140" height="58" rx="2" fill="#a67c52" stroke={ink} strokeWidth="1.15" />
      <rect x="55" y="38" width="90" height="26" rx="2" fill="none" stroke={ink} strokeWidth="1.6" />
      <text x="68" y="55" fontSize="10" fill={ink} fontFamily="Georgia, serif" fontWeight="bold">JACOB</text>
      <path d="M55 38 q8 4 0 8" fill="none" stroke={ink} strokeWidth="0.7" opacity="0.5" />
      <text x="42" y="100" fontSize="7" fill={mute} fontFamily="Georgia, serif">Impressed in the fibre</text>
      <text x="48" y="112" fontSize="6.5" fill={gold} fontFamily="Georgia, serif">not ink on a label</text>

    </Frame>
  ),
  'stamp-jme': () => (
    <Frame label="The JME guild mark (jurande)">

      <circle cx="100" cy="52" r="34" fill="none" stroke={ink} strokeWidth="2.2" />
      <circle cx="100" cy="52" r="28" fill="none" stroke={gold} strokeWidth="1" />
      <text x="78" y="58" fontSize="18" fill={gold} fontFamily="Georgia, serif" fontWeight="bold">JME</text>
      <text x="48" y="106" fontSize="7" fill={mute} fontFamily="Georgia, serif">Paris jurande mark · verify</text>

    </Frame>
  ),
  'stamp-fakes': () => (
    <Frame label="Fake and transplanted stamps">

      <rect x="30" y="20" width="140" height="70" fill="#c4a882" stroke={ink} strokeWidth="1.15" />
      <rect x="70" y="36" width="60" height="36" fill="#8b6914" stroke={gold} strokeWidth="1.6" strokeDasharray="4 2" />
      <text x="80" y="58" fontSize="8" fill={ink} fontFamily="Georgia, serif">STAMP</text>
      <path d="M70 36 l60 36 M130 36 l-60 36" stroke={gold} strokeWidth="0.7" opacity="0.4" />
      <text x="36" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Transplanted wood patch</text>

    </Frame>
  ),
  'stamp-dealer-label': () => (
    <Frame label="A dealer label is not a stamp">

      <rect x="50" y="22" width="100" height="58" rx="2" fill="#f5f0e0" stroke={ink} strokeWidth="1" strokeDasharray="3 2" />
      <text x="68" y="48" fontSize="8" fill={mute} fontFamily="Georgia, serif">Dealer label</text>
      <text x="78" y="66" fontSize="9" fill={gold} fontFamily="Georgia, serif">≠ stamp</text>
      <text x="48" y="104" fontSize="7" fill={mute} fontFamily="Georgia, serif">A lead — not proof of maker</text>

    </Frame>
  ),
  'stamp-invoice': () => (
    <Frame label="Invoice wording for stamped pieces">

      <rect x="38" y="12" width="124" height="84" rx="3" fill="#fffef9" stroke={ink} strokeWidth="1.15" />
      <line x1="50" y1="28" x2="150" y2="28" stroke={wash} strokeWidth="2" />
      <line x1="50" y1="48" x2="150" y2="48" stroke={gold} strokeWidth="2.4" />
      <text x="52" y="52" fontSize="5.5" fill={gold} fontFamily="Georgia, serif">estampillé X, époque Y</text>
      <line x1="50" y1="68" x2="120" y2="68" stroke={wash} strokeWidth="2" />
      <text x="42" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Get the stamp on the invoice</text>

    </Frame>
  ),
  'buy-cash-cap': () => (
    <Frame label="French cash cap for paying a professional">

      <rect x="24" y="28" width="66" height="40" rx="4" fill={gold} opacity="0.22" stroke={gold} strokeWidth="1.3" />
      <text x="36" y="54" fontSize="14" fill={ink} fontFamily="Georgia, serif">€1k</text>
      <text x="30" y="82" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">FR resident</text>
      <rect x="110" y="28" width="70" height="40" rx="4" fill={wash} stroke={ink} strokeWidth="1.2" />
      <text x="120" y="54" fontSize="13" fill={ink} fontFamily="Georgia, serif">€15k</text>
      <text x="118" y="82" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">non-resident</text>
      <text x="55" y="104" fontSize="7" fill={gold} fontFamily="Georgia, serif">CMF art. D112-3</text>

    </Frame>
  ),
  'buy-cash-vs-transfer': () => (
    <Frame label="Cash vs instant transfer as a closing lever">

      <rect x="30" y="30" width="50" height="32" rx="3" fill={gold} opacity="0.25" stroke={gold} strokeWidth="1.1" />
      <text x="38" y="50" fontSize="8" fill={ink} fontFamily="Georgia, serif">CASH</text>
      <path d="M90 46 h20" stroke={ink} strokeWidth="1.5" markerEnd="url(#a)" />
      <text x="96" y="40" fontSize="8" fill={mute} fontFamily="Georgia, serif">or</text>
      <rect x="120" y="30" width="56" height="32" rx="3" fill={wash} stroke={ink} strokeWidth="1.1" />
      <text x="126" y="50" fontSize="7" fill={ink} fontFamily="Georgia, serif">TRANSFER</text>
      <text x="40" y="90" fontSize="7" fill={mute} fontFamily="Georgia, serif">Under cap → cash leverage</text>
      <text x="40" y="104" fontSize="7" fill={mute} fontFamily="Georgia, serif">Over cap → instant transfer</text>

    </Frame>
  ),
  'buy-premium': () => (
    <Frame label="Buyer's premiums at auction (and TVA on fees)">

      <rect x="28" y="50" width="50" height="36" fill={wash} stroke={ink} strokeWidth="1.1" />
      <text x="34" y="72" fontSize="7" fill={ink} fontFamily="Georgia, serif">Hammer</text>
      <text x="38" y="42" fontSize="8" fill={mute} fontFamily="Georgia, serif">100</text>
      <rect x="88" y="30" width="84" height="56" fill={gold} opacity="0.18" stroke={gold} strokeWidth="1.25" />
      <text x="100" y="52" fontSize="8" fill={ink} fontFamily="Georgia, serif">+20–30%</text>
      <text x="105" y="68" fontSize="7" fill={mute} fontFamily="Georgia, serif">premium+TVA</text>
      <text x="95" y="100" fontSize="8" fill={gold} fontFamily="Georgia, serif">≈ 120–130 all-in</text>

    </Frame>
  ),
  'buy-condition': () => (
    <Frame label="Condition reports and viewing">

      <rect x="40" y="14" width="120" height="78" rx="3" fill="#fffef9" stroke={ink} strokeWidth="1.15" />
      <text x="55" y="36" fontSize="8" fill={ink} fontFamily="Georgia, serif">Condition report</text>
      <line x1="52" y1="48" x2="148" y2="48" stroke={wash} strokeWidth="2" />
      <line x1="52" y1="60" x2="130" y2="60" stroke={wash} strokeWidth="2" />
      <line x1="52" y1="72" x2="140" y2="72" stroke={gold} strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="52" y="84" fontSize="6" fill={gold} fontFamily="Georgia, serif">still view in person</text>
      <text x="48" y="110" fontSize="7" fill={mute} fontFamily="Georgia, serif">Reports miss things</text>

    </Frame>
  ),
  'buy-absentee': () => (
    <Frame label="Absentee and phone bids">

      <path d="M50 70 L90 30 h60 v50 H50 z" fill={wash} stroke={ink} strokeWidth="1.15" />
      <path d="M90 30 v50" stroke={ink} strokeWidth="0.8" />
      <text x="100" y="58" fontSize="8" fill={ink} fontFamily="Georgia, serif">MAX</text>
      <path d="M60 85 h80" stroke={gold} strokeWidth="2" />
      <text x="70" y="100" fontSize="6.5" fill={gold} fontFamily="Georgia, serif">walk-away line</text>
      <text x="40" y="114" fontSize="7" fill={mute} fontFamily="Georgia, serif">Absentee = true all-in max</text>

    </Frame>
  ),
  'buy-scam-listings': () => (
    <Frame label="Red flags on classifieds and 'faire offre' ads">

      <rect x="45" y="16" width="110" height="70" rx="4" fill="#fff" stroke={ink} strokeWidth="1.2" />
      <text x="78" y="48" fontSize="16" fill={gold} fontFamily="Georgia, serif">€1</text>
      <text x="68" y="68" fontSize="7" fill={mute} fontFamily="Georgia, serif">faire offre</text>
      <circle cx="140" cy="28" r="12" fill="none" stroke="#8B2E2E" strokeWidth="2.2" />
      <path d="M133 21 l14 14 M147 21 l-14 14" stroke="#8B2E2E" strokeWidth="2.2" />
      <text x="36" y="108" fontSize="7" fill={mute} fontFamily="Georgia, serif">Stock photos · pressure · off-platform</text>

    </Frame>
  ),
  'buy-transport': () => (
    <Frame label="Transport, packing, and insurance">

      <rect x="40" y="36" width="90" height="42" rx="3" fill={wash} stroke={ink} strokeWidth="1.15" />
      <path d="M40 57 h90" stroke={mute} strokeWidth="0.9" strokeDasharray="4 2" />
      <circle cx="58" cy="86" r="7" fill="none" stroke={ink} strokeWidth="1.5" />
      <circle cx="112" cy="86" r="7" fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M130 42 l28 -10 v36 l-28 10" fill={gold} opacity="0.28" stroke={gold} strokeWidth="1.1" />
      <text x="42" y="28" fontSize="6.5" fill={mute} fontFamily="Georgia, serif">crate · insure</text>
      <text x="48" y="112" fontSize="7" fill={mute} fontFamily="Georgia, serif">Written quote · stairs · cover</text>

    </Frame>
  ),
  'buy-negotiate': () => (
    <Frame label="Negotiation: open below walk-away, use checklist answers">

      <rect x="40" y="68" width="120" height="14" fill={wash} stroke={ink} strokeWidth="1" />
      <text x="150" y="78" fontSize="6" fill={mute} fontFamily="sans-serif">walk</text>
      <rect x="50" y="46" width="90" height="14" fill={gold} opacity="0.25" stroke={gold} strokeWidth="1" />
      <text x="145" y="56" fontSize="6" fill={mute} fontFamily="sans-serif">happy</text>
      <rect x="60" y="24" width="55" height="14" fill={gold} opacity="0.4" stroke={gold} strokeWidth="1" />
      <text x="122" y="34" fontSize="6" fill={mute} fontFamily="sans-serif">open</text>
      <text x="40" y="104" fontSize="7" fill={mute} fontFamily="Georgia, serif">Open below · never above walk-away</text>

    </Frame>
  ),
};

/** True when this id has a dedicated drawing (tests use this). */
export const hasIllustration = (id: string): id is IllustrationId =>
  Object.prototype.hasOwnProperty.call(DRAWINGS, id);

/** Every registered illustration id (must equal FIELD_NOTES[].illustration). */
export const REGISTERED_ILLUSTRATION_IDS: IllustrationId[] = Object.keys(DRAWINGS) as IllustrationId[];

/** Ids that must NEVER be used as a generic fallback for unrelated notes. */
export const SCAM_ONLY_ILLUSTRATION_ID: IllustrationId = 'buy-scam-listings';

export const FieldNoteIllustration: React.FC<{ id: IllustrationId; className?: string }> = ({ id, className = '' }) => {
  const draw = DRAWINGS[id];
  if (!draw) {
    // No default / fallback image — render nothing rather than a wrong diagram.
    return null;
  }
  return (
    <div className={`aspect-[5/3] rounded-2xl overflow-hidden border border-border-custom bg-paper ${className}`} data-testid="field-note-illustration" data-illustration={id}>
      {draw()}
    </div>
  );
};

export default FieldNoteIllustration;
