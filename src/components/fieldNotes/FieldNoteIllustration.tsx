import React from 'react';
import type { IllustrationId } from '../../content/fieldNotes';

/** Shared visual language: ink strokes on paper, gold accent. */
const ink = '#1a1a1a';
const gold = '#856820';
const mute = '#9a9590';
const paper = '#F7F4EF';
const wash = '#E5E0D8';

type CoreId =
  | 'dovetails'
  | 'saw_marks'
  | 'oxidation'
  | 'backboards'
  | 'mount_backs'
  | 'marble_top'
  | 'married'
  | 'mercury_glass'
  | 'mirror_back'
  | 'gilding'
  | 'seat_rail'
  | 'webbing'
  | 'pegged'
  | 'legs'
  | 'nails_screws'
  | 'stamp'
  | 'jme'
  | 'label'
  | 'invoice'
  | 'cash'
  | 'premium'
  | 'scam'
  | 'transport'
  | 'period'
  | 'cabinet'
  | 'table'
  | 'frame'
  | 'negotiate'
  | 'paint'
  | 'fall_front'
  | 'feet';

const RESOLVE: Record<IllustrationId, CoreId> = {
  dovetails: 'dovetails',
  saw_marks: 'saw_marks',
  oxidation: 'oxidation',
  backboards: 'backboards',
  mount_backs: 'mount_backs',
  marble_top: 'marble_top',
  married: 'married',
  mercury_glass: 'mercury_glass',
  mirror_back: 'mirror_back',
  gilding: 'gilding',
  frame_joints: 'frame',
  mirror_size: 'mirror_back',
  invoice: 'invoice',
  seat_rail_stamp: 'seat_rail',
  webbing: 'webbing',
  pegged_joint: 'pegged',
  legs: 'legs',
  chair_set: 'seat_rail',
  nails_screws: 'nails_screws',
  cabinet_doors: 'cabinet',
  cabinet_interior: 'cabinet',
  cornice: 'cabinet',
  cabinet_hw: 'mount_backs',
  paint_surface: 'paint',
  feet: 'feet',
  table_top: 'table',
  table_apron: 'table',
  table_leaves: 'table',
  table_leg_join: 'pegged',
  gueridon: 'table',
  table_en_fr: 'table',
  fall_front: 'fall_front',
  sec_interior: 'cabinet',
  sec_stamp: 'stamp',
  sec_marble: 'marble_top',
  sec_veneer: 'dovetails',
  sec_feet: 'feet',
  period_regence: 'period',
  period_trap: 'scam',
  period_transition: 'period',
  period_empire: 'period',
  period_restauration: 'period',
  period_lp: 'period',
  period_n3: 'period',
  case_stamp: 'stamp',
  estampille_look: 'stamp',
  jme_mark: 'jme',
  fake_stamp: 'scam',
  dealer_label: 'label',
  cash_cap: 'cash',
  payment: 'cash',
  premium: 'premium',
  condition_report: 'invoice',
  absentee: 'negotiate',
  scam: 'scam',
  transport: 'transport',
  negotiate: 'negotiate',
};

const Frame: React.FC<{ children: React.ReactNode; label?: string }> = ({ children, label }) => (
  <svg viewBox="0 0 160 100" className="w-full h-full" role="img" aria-label={label || 'Field note diagram'}>
    <rect width="160" height="100" rx="12" fill={paper} stroke={wash} strokeWidth="1.5" />
    {children}
  </svg>
);

function Core({ id }: { id: CoreId }) {
  switch (id) {
    case 'dovetails':
      return (
        <Frame label="Hand-cut vs machine dovetails">
          <text x="28" y="18" fontSize="7" fill={mute} fontFamily="sans-serif">Hand</text>
          <path d="M12 28 h36 l6 14 h-8 l-4-8 h-8 l-4 8 h-8 l-4-8 h-8 l-6 14 h36" fill="none" stroke={ink} strokeWidth="1.6" />
          <path d="M12 55 h36 v28 H12 z" fill="none" stroke={ink} strokeWidth="1.2" />
          <path d="M20 55 v10 M28 55 v14 M36 55 v9 M42 55 v12" stroke={gold} strokeWidth="1.4" />
          <text x="98" y="18" fontSize="7" fill={mute} fontFamily="sans-serif">Machine</text>
          <path d="M88 28 h50" stroke={ink} strokeWidth="1.2" />
          {[0, 1, 2, 3, 4].map(i => (
            <path key={i} d={`M${96 + i * 9} 28 v14 h5 v-14`} fill="none" stroke={ink} strokeWidth="1.4" />
          ))}
          <path d="M88 55 h50 v28 H88 z" fill="none" stroke={ink} strokeWidth="1.2" />
          {[0, 1, 2, 3, 4].map(i => (
            <path key={i} d={`M${96 + i * 9} 55 v12`} stroke={gold} strokeWidth="1.4" />
          ))}
        </Frame>
      );
    case 'saw_marks':
      return (
        <Frame label="Straight saw marks vs circular arcs">
          <text x="20" y="20" fontSize="7" fill={mute} fontFamily="sans-serif">Frame / pit</text>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <line key={i} x1="16" y1={30 + i * 5} x2="70" y2={28 + i * 5} stroke={ink} strokeWidth="1" opacity={0.7} />
          ))}
          <text x="96" y="20" fontSize="7" fill={mute} fontFamily="sans-serif">Circular</text>
          {[18, 26, 34, 42, 50].map((r, i) => (
            <path key={i} d={`M95 ${55 + r * 0.15} A${r} ${r} 0 0 1 ${95 + r * 0.7} ${52 - r * 0.2}`} fill="none" stroke={gold} strokeWidth="1.2" />
          ))}
        </Frame>
      );
    case 'oxidation':
      return (
        <Frame label="Oxidised secondary wood vs fresh timber">
          <rect x="18" y="22" width="55" height="56" rx="4" fill="#8B7355" stroke={ink} strokeWidth="1" />
          <rect x="26" y="30" width="39" height="18" fill="#6B5344" />
          <rect x="26" y="52" width="39" height="18" fill="#7A6248" />
          <text x="28" y="88" fontSize="6" fill={mute} fontFamily="sans-serif">Aged</text>
          <rect x="88" y="22" width="55" height="56" rx="4" fill="#E8DCC8" stroke={ink} strokeWidth="1" />
          <rect x="96" y="30" width="39" height="18" fill="#F3EAD8" />
          <rect x="96" y="52" width="39" height="18" fill="#F7F0E4" />
          <text x="100" y="88" fontSize="6" fill={mute} fontFamily="sans-serif">Fresh</text>
        </Frame>
      );
    case 'backboards':
      return (
        <Frame label="Vertical backboards vs plywood sheet">
          {[0, 1, 2, 3].map(i => (
            <rect key={i} x={16 + i * 16} y="20" width="14" height="60" fill={wash} stroke={ink} strokeWidth="1" />
          ))}
          <circle cx="23" cy="35" r="1.5" fill={ink} />
          <circle cx="39" cy="50" r="1.5" fill={ink} />
          <circle cx="55" cy="40" r="1.5" fill={ink} />
          <rect x="90" y="20" width="54" height="60" fill="#D9D0C4" stroke={ink} strokeWidth="1" />
          <path d="M90 40 h54 M90 60 h54" stroke={mute} strokeWidth="0.8" strokeDasharray="3 2" />
          <text x="100" y="88" fontSize="6" fill={gold} fontFamily="sans-serif">Plywood?</text>
        </Frame>
      );
    case 'mount_backs':
      return (
        <Frame label="Hand-filed mount back vs machine casting">
          <ellipse cx="45" cy="48" rx="28" ry="22" fill={wash} stroke={ink} strokeWidth="1.2" />
          <path d="M30 40 q5 8 0 16 M40 35 q8 12 0 26 M50 35 q8 12 0 26 M60 40 q5 8 0 16" fill="none" stroke={ink} strokeWidth="1" />
          <circle cx="45" cy="48" r="4" fill={gold} />
          <text x="24" y="88" fontSize="6" fill={mute} fontFamily="sans-serif">Filed back</text>
          <ellipse cx="115" cy="48" rx="28" ry="22" fill="#C4B9A8" stroke={ink} strokeWidth="1.2" />
          <circle cx="115" cy="48" r="4" fill={gold} />
          <path d="M100 48 h30 M115 33 v30" stroke={mute} strokeWidth="0.8" />
          <text x="96" y="88" fontSize="6" fill={mute} fontFamily="sans-serif">Machine</text>
        </Frame>
      );
    case 'marble_top':
      return (
        <Frame label="Marble top fit on carcase">
          <path d="M20 38 h120 l-6 10 H26 z" fill="#A8B0B8" stroke={ink} strokeWidth="1.2" />
          <path d="M30 48 h100 v30 H30 z" fill="#C4A882" stroke={ink} strokeWidth="1.2" />
          <path d="M38 55 h30 M38 62 h22" stroke={gold} strokeWidth="1" />
          <text x="48" y="88" fontSize="6" fill={mute} fontFamily="sans-serif">Close fit · moulded edge</text>
        </Frame>
      );
    case 'married':
      return (
        <Frame label="Married top and base">
          <path d="M24 30 h50 v20 H24 z" fill="#B8956A" stroke={ink} strokeWidth="1" />
          <path d="M86 30 h50 v20 H86 z" fill="#6B5344" stroke={ink} strokeWidth="1" />
          <path d="M30 58 h40 v28 H30 z" fill="#6B5344" stroke={ink} strokeWidth="1" />
          <path d="M92 58 h40 v28 H92 z" fill="#B8956A" stroke={ink} strokeWidth="1" />
          <text x="55" y="22" fontSize="7" fill={gold} fontFamily="sans-serif">≠</text>
          <text x="40" y="96" fontSize="6" fill={mute} fontFamily="sans-serif">Mismatched parts</text>
        </Frame>
      );
    case 'mercury_glass':
      return (
        <Frame label="Mercury glass edge bloom vs bright silvering">
          <rect x="18" y="22" width="55" height="55" rx="3" fill="#B8C0C4" stroke={ink} strokeWidth="1.2" />
          <ellipse cx="35" cy="40" rx="10" ry="7" fill="#9AA3A8" opacity="0.7" />
          <ellipse cx="55" cy="58" rx="8" ry="6" fill="#A8B0B5" opacity="0.6" />
          <text x="28" y="90" fontSize="6" fill={mute} fontFamily="sans-serif">Mercury</text>
          <rect x="88" y="22" width="55" height="55" rx="3" fill="#E8EEF2" stroke={ink} strokeWidth="1.2" />
          <path d="M100 35 l30 30 M130 35 l-30 30" stroke="#C5CED4" strokeWidth="1" />
          <text x="100" y="90" fontSize="6" fill={mute} fontFamily="sans-serif">Modern</text>
        </Frame>
      );
    case 'mirror_back':
      return (
        <Frame label="Mirror plank back">
          <rect x="30" y="14" width="100" height="72" rx="4" fill={wash} stroke={ink} strokeWidth="1.4" />
          <line x1="80" y1="14" x2="80" y2="86" stroke={ink} strokeWidth="1" />
          <circle cx="50" cy="30" r="2" fill={ink} />
          <circle cx="50" cy="70" r="2" fill={ink} />
          <circle cx="110" cy="30" r="2" fill={ink} />
          <circle cx="110" cy="70" r="2" fill={ink} />
          <text x="48" y="96" fontSize="6" fill={mute} fontFamily="sans-serif">Boards · old fixings</text>
        </Frame>
      );
    case 'gilding':
      return (
        <Frame label="Worn gilding in recesses">
          <path d="M30 70 Q50 20 80 40 Q110 20 130 70 Z" fill="#E8D5A3" stroke={ink} strokeWidth="1.2" />
          <path d="M50 55 Q80 35 110 55" fill="none" stroke={gold} strokeWidth="3" opacity="0.5" />
          <path d="M60 62 Q80 48 100 62" fill="none" stroke="#C4A35A" strokeWidth="2" />
          <text x="42" y="88" fontSize="6" fill={mute} fontFamily="sans-serif">Wear in the hollows</text>
        </Frame>
      );
    case 'seat_rail':
      return (
        <Frame label="Stamp on seat rail">
          <path d="M25 35 h110 v8 H25 z" fill="#8B6914" stroke={ink} strokeWidth="1.2" />
          <path d="M35 43 v35 M125 43 v35" stroke={ink} strokeWidth="2" />
          <path d="M35 78 h90" stroke={ink} strokeWidth="2" />
          <rect x="58" y="48" width="44" height="12" rx="1" fill="none" stroke={gold} strokeWidth="1.5" />
          <text x="64" y="57" fontSize="6" fill={gold} fontFamily="sans-serif">STAMP</text>
          <text x="40" y="96" fontSize="6" fill={mute} fontFamily="sans-serif">Inner seat rail</text>
        </Frame>
      );
    case 'webbing':
      return (
        <Frame label="Chair webbing">
          <rect x="35" y="18" width="90" height="64" fill="none" stroke={ink} strokeWidth="2" />
          {[0, 1, 2, 3].map(i => (
            <line key={`h${i}`} x1="35" y1={30 + i * 14} x2="125" y2={30 + i * 14} stroke={gold} strokeWidth="2" />
          ))}
          {[0, 1, 2, 3].map(i => (
            <line key={`v${i}`} x1={50 + i * 18} y1="18" x2={50 + i * 18} y2="82" stroke={ink} strokeWidth="1.5" opacity="0.7" />
          ))}
        </Frame>
      );
    case 'pegged':
      return (
        <Frame label="Pegged mortise and tenon">
          <rect x="30" y="38" width="100" height="16" fill={wash} stroke={ink} strokeWidth="1.2" />
          <rect x="68" y="20" width="16" height="60" fill="#C4A882" stroke={ink} strokeWidth="1.2" />
          <circle cx="76" cy="46" r="4" fill={gold} stroke={ink} strokeWidth="1" />
          <text x="48" y="92" fontSize="6" fill={mute} fontFamily="sans-serif">Pegged tenon</text>
        </Frame>
      );
    case 'legs':
      return (
        <Frame label="Cabriole vs fluted tapered leg">
          <path d="M40 20 Q28 50 42 78" fill="none" stroke={ink} strokeWidth="2.2" />
          <path d="M40 20 Q52 50 38 78" fill="none" stroke={ink} strokeWidth="2.2" />
          <ellipse cx="40" cy="80" rx="8" ry="3" fill={gold} />
          <text x="24" y="96" fontSize="6" fill={mute} fontFamily="sans-serif">Cabriole</text>
          <line x1="100" y1="20" x2="110" y2="78" stroke={ink} strokeWidth="2.2" />
          <line x1="120" y1="20" x2="110" y2="78" stroke={ink} strokeWidth="2.2" />
          {[0, 1, 2, 3].map(i => (
            <line key={i} x1={102 + i * 2} y1={28 + i * 2} x2={108 + i * 1.2} y2={70} stroke={gold} strokeWidth="0.8" />
          ))}
          <text x="96" y="96" fontSize="6" fill={mute} fontFamily="sans-serif">Fluted</text>
        </Frame>
      );
    case 'nails_screws':
      return (
        <Frame label="Cut nail vs Phillips screw">
          <line x1="45" y1="25" x2="45" y2="70" stroke={ink} strokeWidth="3" />
          <path d="M38 25 h14 l-3 8 h-8 z" fill={ink} />
          <text x="28" y="88" fontSize="6" fill={mute} fontFamily="sans-serif">Cut nail</text>
          <line x1="110" y1="30" x2="110" y2="70" stroke={gold} strokeWidth="2.5" />
          <circle cx="110" cy="28" r="8" fill="none" stroke={gold} strokeWidth="2" />
          <path d="M110 22 v12 M104 28 h12" stroke={gold} strokeWidth="1.5" />
          <text x="92" y="88" fontSize="6" fill={mute} fontFamily="sans-serif">Phillips</text>
        </Frame>
      );
    case 'stamp':
      return (
        <Frame label="Struck estampille in wood">
          <rect x="25" y="25" width="110" height="50" rx="3" fill="#A67C52" stroke={ink} strokeWidth="1.2" />
          <rect x="48" y="38" width="64" height="22" rx="2" fill="none" stroke={ink} strokeWidth="1.5" />
          <text x="56" y="53" fontSize="8" fill={ink} fontFamily="serif" fontWeight="bold">BELLANGÉ</text>
          <text x="40" y="90" fontSize="6" fill={mute} fontFamily="sans-serif">Impressed in the fibre</text>
        </Frame>
      );
    case 'jme':
      return (
        <Frame label="JME guild mark">
          <circle cx="80" cy="48" r="28" fill="none" stroke={ink} strokeWidth="2" />
          <text x="62" y="54" fontSize="16" fill={gold} fontFamily="serif" fontWeight="bold">JME</text>
          <text x="36" y="90" fontSize="6" fill={mute} fontFamily="sans-serif">Paris jurande mark</text>
        </Frame>
      );
    case 'label':
      return (
        <Frame label="Dealer paper label">
          <rect x="40" y="22" width="80" height="50" rx="2" fill="#F5F0E0" stroke={ink} strokeWidth="1" strokeDasharray="3 2" />
          <text x="52" y="42" fontSize="7" fill={mute} fontFamily="sans-serif">Dealer label</text>
          <text x="55" y="55" fontSize="6" fill={gold} fontFamily="sans-serif">≠ stamp</text>
          <text x="38" y="90" fontSize="6" fill={mute} fontFamily="sans-serif">Lead, not proof</text>
        </Frame>
      );
    case 'invoice':
      return (
        <Frame label="Invoice wording">
          <rect x="35" y="16" width="90" height="68" rx="3" fill="#fff" stroke={ink} strokeWidth="1.2" />
          <line x1="45" y1="30" x2="115" y2="30" stroke={wash} strokeWidth="2" />
          <line x1="45" y1="42" x2="100" y2="42" stroke={wash} strokeWidth="2" />
          <line x1="45" y1="54" x2="110" y2="54" stroke={gold} strokeWidth="2" />
          <line x1="45" y1="66" x2="90" y2="66" stroke={wash} strokeWidth="2" />
          <text x="42" y="96" fontSize="6" fill={mute} fontFamily="sans-serif">Write it on the invoice</text>
        </Frame>
      );
    case 'cash':
      return (
        <Frame label="Cash cap">
          <rect x="28" y="30" width="44" height="28" rx="3" fill={gold} opacity="0.25" stroke={gold} strokeWidth="1.2" />
          <text x="36" y="48" fontSize="10" fill={ink} fontFamily="sans-serif">€1k</text>
          <text x="30" y="72" fontSize="6" fill={mute} fontFamily="sans-serif">Resident</text>
          <rect x="88" y="30" width="50" height="28" rx="3" fill={wash} stroke={ink} strokeWidth="1.2" />
          <text x="94" y="48" fontSize="9" fill={ink} fontFamily="sans-serif">€15k</text>
          <text x="90" y="72" fontSize="6" fill={mute} fontFamily="sans-serif">Non-res.</text>
          <text x="34" y="92" fontSize="6" fill={mute} fontFamily="sans-serif">CMF D112-3</text>
        </Frame>
      );
    case 'premium':
      return (
        <Frame label="Hammer plus premium">
          <rect x="30" y="50" width="40" height="30" fill={wash} stroke={ink} strokeWidth="1" />
          <text x="36" y="68" fontSize="7" fill={ink} fontFamily="sans-serif">Hammer</text>
          <rect x="70" y="35" width="60" height="45" fill={gold} opacity="0.2" stroke={gold} strokeWidth="1.2" />
          <text x="78" y="55" fontSize="7" fill={ink} fontFamily="sans-serif">+20–30%</text>
          <text x="82" y="68" fontSize="6" fill={mute} fontFamily="sans-serif">premium</text>
          <text x="48" y="96" fontSize="6" fill={mute} fontFamily="sans-serif">Budget all-in</text>
        </Frame>
      );
    case 'scam':
      return (
        <Frame label="Listing red flags">
          <rect x="40" y="20" width="80" height="55" rx="4" fill="#fff" stroke={ink} strokeWidth="1.2" />
          <text x="58" y="42" fontSize="12" fill={gold} fontFamily="sans-serif">€1</text>
          <text x="52" y="58" fontSize="6" fill={mute} fontFamily="sans-serif">faire offre</text>
          <circle cx="108" cy="30" r="10" fill="none" stroke="#8B2E2E" strokeWidth="2" />
          <path d="M102 24 l12 12 M114 24 l-12 12" stroke="#8B2E2E" strokeWidth="2" />
        </Frame>
      );
    case 'transport':
      return (
        <Frame label="Careful transport">
          <rect x="40" y="35" width="70" height="40" rx="3" fill={wash} stroke={ink} strokeWidth="1.2" />
          <path d="M40 55 h70" stroke={mute} strokeWidth="1" strokeDasharray="4 2" />
          <circle cx="55" cy="80" r="6" fill="none" stroke={ink} strokeWidth="1.5" />
          <circle cx="95" cy="80" r="6" fill="none" stroke={ink} strokeWidth="1.5" />
          <path d="M110 40 l20 -8 v30 l-20 8" fill={gold} opacity="0.3" stroke={gold} strokeWidth="1" />
          <text x="48" y="96" fontSize="6" fill={mute} fontFamily="sans-serif">Pack · insure · quote</text>
        </Frame>
      );
    case 'period':
      return (
        <Frame label="Period ornament cue">
          <path d="M80 20 v60" stroke={ink} strokeWidth="1.5" />
          <path d="M50 50 Q80 25 110 50 Q80 75 50 50" fill="none" stroke={gold} strokeWidth="1.5" />
          <circle cx="80" cy="50" r="6" fill={paper} stroke={ink} strokeWidth="1" />
          <text x="42" y="92" fontSize="6" fill={mute} fontFamily="sans-serif">Form · wood · mounts</text>
        </Frame>
      );
    case 'cabinet':
      return (
        <Frame label="Cabinet two-door elevation">
          <rect x="40" y="14" width="80" height="70" fill={wash} stroke={ink} strokeWidth="1.4" />
          <line x1="80" y1="14" x2="80" y2="84" stroke={ink} strokeWidth="1" />
          <rect x="48" y="28" width="24" height="40" fill="none" stroke={ink} strokeWidth="1" />
          <rect x="88" y="28" width="24" height="40" fill="none" stroke={ink} strokeWidth="1" />
          <circle cx="68" cy="48" r="2" fill={gold} />
          <circle cx="92" cy="48" r="2" fill={gold} />
        </Frame>
      );
    case 'table':
      return (
        <Frame label="Table silhouette">
          <rect x="30" y="28" width="100" height="8" rx="1" fill={wash} stroke={ink} strokeWidth="1.2" />
          <path d="M45 36 v40 M115 36 v40" stroke={ink} strokeWidth="2" />
          <path d="M55 36 v28 M105 36 v28" stroke={ink} strokeWidth="1.5" />
          <path d="M45 64 h70" stroke={gold} strokeWidth="1.2" />
        </Frame>
      );
    case 'frame':
      return (
        <Frame label="Mirror frame mitre">
          <path d="M40 25 h80 v50 H40 z" fill="none" stroke={ink} strokeWidth="6" />
          <path d="M40 25 l12 12 M120 25 l-12 12 M40 75 l12 -12 M120 75 l-12 -12" stroke={gold} strokeWidth="1.5" />
          <text x="52" y="96" fontSize="6" fill={mute} fontFamily="sans-serif">Corner joints</text>
        </Frame>
      );
    case 'negotiate':
      return (
        <Frame label="Negotiation ladder">
          <rect x="40" y="60" width="80" height="12" fill={wash} stroke={ink} strokeWidth="1" />
          <rect x="50" y="42" width="60" height="12" fill={gold} opacity="0.25" stroke={gold} strokeWidth="1" />
          <rect x="60" y="24" width="40" height="12" fill={gold} opacity="0.4" stroke={gold} strokeWidth="1" />
          <text x="44" y="92" fontSize="6" fill={mute} fontFamily="sans-serif">Open · settle · walk away</text>
        </Frame>
      );
    case 'paint':
      return (
        <Frame label="Paint layers on provincial furniture">
          <rect x="35" y="25" width="90" height="50" rx="3" fill="#D8D2C6" stroke={ink} strokeWidth="1.2" />
          <path d="M35 50 h90" stroke="#B8B0A2" strokeWidth="8" opacity="0.5" />
          <path d="M55 30 q10 20 -5 40" fill="none" stroke="#F7F4EF" strokeWidth="4" opacity="0.8" />
          <text x="48" y="92" fontSize="6" fill={mute} fontFamily="sans-serif">Wear at edges</text>
        </Frame>
      );
    case 'fall_front':
      return (
        <Frame label="Secrétaire fall front">
          <path d="M45 20 h70 v35 H45 z" fill={wash} stroke={ink} strokeWidth="1.2" />
          <path d="M45 55 l35 25 h70 l-35 -25 H45" fill="#C4A882" stroke={ink} strokeWidth="1.2" />
          <line x1="45" y1="55" x2="115" y2="55" stroke={gold} strokeWidth="1.5" />
          <text x="50" y="96" fontSize="6" fill={mute} fontFamily="sans-serif">Fall · hinges · surface</text>
        </Frame>
      );
    case 'feet':
      return (
        <Frame label="Feet and plinth">
          <rect x="40" y="20" width="80" height="40" fill={wash} stroke={ink} strokeWidth="1.2" />
          <path d="M50 60 v20 M70 60 v16 M90 60 v16 M110 60 v20" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M48 82 h24 M86 78 h24" stroke={gold} strokeWidth="2" />
          <text x="52" y="96" fontSize="6" fill={mute} fontFamily="sans-serif">Replaced feet?</text>
        </Frame>
      );
    default:
      return (
        <Frame>
          <circle cx="80" cy="50" r="20" fill="none" stroke={gold} strokeWidth="1.5" />
        </Frame>
      );
  }
}

export const FieldNoteIllustration: React.FC<{ id: IllustrationId; className?: string }> = ({ id, className = '' }) => (
  <div className={`aspect-[8/5] rounded-2xl overflow-hidden border border-border-custom bg-paper ${className}`} data-testid="field-note-illustration">
    <Core id={RESOLVE[id] || 'period'} />
  </div>
);

export default FieldNoteIllustration;
