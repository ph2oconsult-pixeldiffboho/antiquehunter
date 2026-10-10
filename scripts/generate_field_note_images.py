#!/usr/bin/env python3
"""Generate antique-engraving style field-note illustrations (no in-image text).
Renders SVG → PNG (rsvg-convert) → WebP (cwebp)."""
from __future__ import annotations
import subprocess, os, json
from pathlib import Path

OUT_SRC = Path("/tmp/field-notes-src")
OUT_PNG = Path("/tmp/field-notes-png")
OUT_WEBP = Path("/workspace/antiquehunter-repo/public/field-notes")
OUT_SRC.mkdir(parents=True, exist_ok=True)
OUT_PNG.mkdir(parents=True, exist_ok=True)
OUT_WEBP.mkdir(parents=True, exist_ok=True)

W, H = 800, 480
PAPER = "#F4EDE1"
INK = "#2A2218"
GOLD = "#8B7355"
WASH = "#E8DFD0"
MUTE = "#6B5E4E"
BRASS = "#C4A35A"
SHELL = "#4A2F1F"

def svg(body: str, w=W, h=H) -> str:
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <rect width="{w}" height="{h}" fill="{PAPER}"/>
  <rect x="12" y="12" width="{w-24}" height="{h-24}" rx="18" fill="none" stroke="{WASH}" stroke-width="1.5"/>
  {body}
</svg>'''

def write(name: str, body: str):
    (OUT_SRC / f"{name}.svg").write_text(svg(body), encoding="utf-8")

# ── Priority illustrations (no labels/text inside) ──────────────────────────

# 1. Hand-cut vs machine dovetails
write("commode-dovetails", f'''
  <!-- left: irregular hand-cut pins/tails -->
  <g transform="translate(60,80)">
    <path d="M0 40 H280 V300 H0 Z" fill="none" stroke="{INK}" stroke-width="2"/>
    <path d="M0 40 L0 40" stroke="{INK}"/>
    <!-- board edge with irregular dovetails -->
    <path d="M40 40
      L55 40 L70 120 L40 120 L55 40
      M95 40 L115 40 L130 125 L80 125 L95 40
      M155 40 L175 40 L188 115 L142 115 L155 40
      M210 40 L230 40 L242 128 L198 128 L210 40
      M255 40 L275 40 L280 110 L248 110 L255 40"
      fill="none" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <!-- grain lines suggesting oak -->
    <path d="M50 160 H250 M50 190 H230 M50 220 H245 M50 250 H220" stroke="{GOLD}" stroke-width="1" opacity="0.45"/>
  </g>
  <!-- right: uniform machine dovetails -->
  <g transform="translate(420,80)">
    <path d="M0 40 H280 V300 H0 Z" fill="none" stroke="{INK}" stroke-width="2"/>
    <path d="M40 40
      L55 40 L55 120 L40 120 Z
      M70 40 L85 40 L85 120 L70 120 Z
      M100 40 L115 40 L115 120 L100 120 Z
      M130 40 L145 40 L145 120 L130 120 Z
      M160 40 L175 40 L175 120 L160 120 Z
      M190 40 L205 40 L205 120 L190 120 Z
      M220 40 L235 40 L235 120 L220 120 Z
      M250 40 L265 40 L265 120 L250 120 Z"
      fill="none" stroke="{INK}" stroke-width="2"/>
    <path d="M50 160 H250 M50 190 H250 M50 220 H250 M50 250 H250" stroke="{GOLD}" stroke-width="1" opacity="0.35"/>
  </g>
''')

# 2. Pegged mortise and tenon
write("chair-pegged", f'''
  <!-- horizontal rail -->
  <rect x="120" y="200" width="560" height="70" rx="2" fill="{WASH}" stroke="{INK}" stroke-width="2.5"/>
  <!-- vertical stile with tenon through rail -->
  <rect x="355" y="60" width="90" height="360" rx="2" fill="#D4C4A8" stroke="{INK}" stroke-width="2.5"/>
  <!-- mortise outline -->
  <rect x="355" y="200" width="90" height="70" fill="none" stroke="{INK}" stroke-width="1.5" opacity="0.5"/>
  <!-- wooden peg -->
  <circle cx="400" cy="235" r="22" fill="{GOLD}" stroke="{INK}" stroke-width="2.5"/>
  <circle cx="400" cy="235" r="8" fill="{INK}"/>
  <!-- peg end grain hatching -->
  <path d="M388 228 L412 242 M392 220 L408 248 M385 238 L415 232" stroke="{INK}" stroke-width="1" opacity="0.5"/>
''')

# 3. Stamp on chair seat rail
write("chair-seat-rail", f'''
  <!-- seat frame from below -->
  <path d="M140 100 H660 V140 H140 Z" fill="#7A5A2E" stroke="{INK}" stroke-width="2.5"/>
  <path d="M160 140 V340 M640 140 V340" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>
  <path d="M160 340 H640" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>
  <!-- stamp impression (abstract rectangle with hatching, no letters) -->
  <rect x="320" y="180" width="160" height="55" rx="3" fill="none" stroke="{GOLD}" stroke-width="2.5"/>
  <path d="M335 200 H465 M335 212 H450 M335 224 H440" stroke="{INK}" stroke-width="2" opacity="0.55"/>
  <!-- fibre crush marks -->
  <path d="M320 180 Q330 175 340 180" fill="none" stroke="{INK}" stroke-width="1" opacity="0.4"/>
''')

# 4. Stamp on case upright under marble
write("stamp-where-case", f'''
  <!-- marble top -->
  <path d="M100 70 H700 L670 110 H130 Z" fill="#B0B8C0" stroke="{INK}" stroke-width="2"/>
  <path d="M110 70 H690" stroke="#D5DBE0" stroke-width="3" opacity="0.5"/>
  <!-- carcase -->
  <rect x="150" y="110" width="500" height="300" fill="#C4A882" stroke="{INK}" stroke-width="2.5"/>
  <!-- left upright highlight -->
  <rect x="150" y="110" width="55" height="300" fill="#A67C52" stroke="{INK}" stroke-width="1.5"/>
  <!-- stamp zone near top of upright -->
  <rect x="158" y="130" width="38" height="70" rx="2" fill="none" stroke="{GOLD}" stroke-width="2.5"/>
  <path d="M165 150 H185 M165 165 H180 M165 180 H182" stroke="{INK}" stroke-width="1.5" opacity="0.5"/>
  <!-- marble lift suggestion (gap) -->
  <path d="M150 110 H205" stroke="{GOLD}" stroke-width="3" opacity="0.6"/>
''')

# 5. JME mark (abstract guild circle — letters are the mark itself, essential to the note)
write("stamp-jme", f'''
  <circle cx="400" cy="240" r="140" fill="none" stroke="{INK}" stroke-width="4"/>
  <circle cx="400" cy="240" r="118" fill="none" stroke="{GOLD}" stroke-width="2"/>
  <!-- stylized J M E as impressed mark (the subject of the note) -->
  <path d="M300 200 Q290 240 305 280 Q320 250 318 210" fill="none" stroke="{GOLD}" stroke-width="8" stroke-linecap="round"/>
  <path d="M350 190 L350 290 M350 190 L400 290 M400 190 L400 290" fill="none" stroke="{GOLD}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M430 190 L430 290 M430 190 H500 M430 240 H485 M430 290 H500" fill="none" stroke="{GOLD}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
''')

# 6. Mirror back with boards and forged nails
write("mirror-backboards", f'''
  <rect x="160" y="40" width="480" height="400" rx="6" fill="{WASH}" stroke="{INK}" stroke-width="3"/>
  <!-- vertical planks -->
  <line x1="280" y1="40" x2="280" y2="440" stroke="{INK}" stroke-width="2"/>
  <line x1="400" y1="40" x2="400" y2="440" stroke="{INK}" stroke-width="2"/>
  <line x1="520" y1="40" x2="520" y2="440" stroke="{INK}" stroke-width="2"/>
  <!-- wood grain -->
  <path d="M180 120 Q220 130 260 115 M300 200 Q340 210 380 195 M420 150 Q460 160 500 145 M540 280 Q580 290 620 275"
    fill="none" stroke="{INK}" stroke-width="0.8" opacity="0.35"/>
  <!-- hand-forged nails (irregular heads) -->
  <g fill="{INK}">
    <ellipse cx="200" cy="90" rx="7" ry="6"/>
    <ellipse cx="200" cy="390" rx="8" ry="6"/>
    <ellipse cx="340" cy="100" rx="6" ry="7"/>
    <ellipse cx="340" cy="380" rx="7" ry="6"/>
    <ellipse cx="460" cy="95" rx="7" ry="5"/>
    <ellipse cx="460" cy="385" rx="6" ry="7"/>
    <ellipse cx="600" cy="105" rx="8" ry="6"/>
    <ellipse cx="600" cy="375" rx="7" ry="6"/>
  </g>
  <!-- nail cross marks (rose head) -->
  <g stroke="{GOLD}" stroke-width="1" fill="none">
    <path d="M196 90 h8 M200 86 v8"/>
    <path d="M196 390 h8 M200 386 v8"/>
    <path d="M336 100 h8 M340 96 v8"/>
    <path d="M456 95 h8 M460 91 v8"/>
    <path d="M596 105 h8 M600 101 v8"/>
  </g>
''')

# 7. Mercury glass edge with blooms vs modern plate
write("mirror-mercury", f'''
  <!-- left: mercury glass with blooms / cloudy edge -->
  <rect x="60" y="60" width="320" height="360" rx="4" fill="#8A949A" stroke="{INK}" stroke-width="2.5"/>
  <ellipse cx="140" cy="140" rx="55" ry="40" fill="#6A7478" opacity="0.55"/>
  <ellipse cx="260" cy="280" rx="70" ry="50" fill="#7A8488" opacity="0.45"/>
  <ellipse cx="180" cy="320" rx="40" ry="30" fill="#9AA4A8" opacity="0.4"/>
  <circle cx="300" cy="120" r="12" fill="#C0C8CC" opacity="0.7"/>
  <circle cx="100" cy="360" r="8" fill="#C0C8CC" opacity="0.6"/>
  <!-- cloudy edge bloom -->
  <path d="M70 400 Q160 370 250 395 Q320 410 370 380" fill="none" stroke="#5A6468" stroke-width="8" opacity="0.35"/>
  <path d="M80 80 Q120 100 90 140" fill="none" stroke="#657074" stroke-width="6" opacity="0.3"/>
  <!-- right: modern uniform silvering -->
  <rect x="420" y="60" width="320" height="360" rx="4" fill="#EEF3F6" stroke="{INK}" stroke-width="2.5"/>
  <path d="M440 120 H720" stroke="#D5DDE4" stroke-width="10" opacity="0.7"/>
  <path d="M440 200 H720" stroke="#DFE6EB" stroke-width="8" opacity="0.55"/>
  <path d="M440 280 H720" stroke="#D5DDE4" stroke-width="10" opacity="0.65"/>
  <path d="M440 360 H620" stroke="#E4EAEE" stroke-width="6" opacity="0.5"/>
''')

# 8. Louis XV cabriole leg with scroll foot — PROPER S-curve, not a lens
write("per-louis-xv", f'''
  <!-- bombé commode silhouette (left) -->
  <g transform="translate(80,40)">
    <!-- marble -->
    <path d="M40 20 H300 L285 50 H55 Z" fill="#B0B8C0" stroke="{INK}" stroke-width="2"/>
    <!-- bombé body: curved sides -->
    <path d="M60 50
      Q20 140 55 230
      L55 280
      Q50 300 70 310
      H270
      Q290 300 285 280
      L285 230
      Q320 140 280 50 Z"
      fill="#C4A882" stroke="{INK}" stroke-width="2.5"/>
    <!-- drawer lines following bombé -->
    <path d="M70 110 Q170 95 270 110" fill="none" stroke="{INK}" stroke-width="1.5"/>
    <path d="M65 170 Q170 155 275 170" fill="none" stroke="{INK}" stroke-width="1.5"/>
    <path d="M68 230 Q170 218 272 230" fill="none" stroke="{INK}" stroke-width="1.5"/>
    <!-- rocaille mount suggestion -->
    <path d="M160 130 Q180 115 200 130 Q185 150 160 130" fill="none" stroke="{GOLD}" stroke-width="2"/>
  </g>
  <!-- cabriole leg detail (right): knee out, ankle in, scroll foot -->
  <g transform="translate(480,30)">
    <!-- leg outline as filled silhouette with proper cabriole -->
    <path d="
      M90 20
      C90 20, 95 40, 110 70
      C130 110, 145 140, 140 180
      C135 220, 115 260, 105 300
      C100 320, 95 340, 100 360
      C108 380, 130 390, 145 385
      C155 382, 160 375, 155 368
      C148 360, 130 355, 120 360
      C110 350, 108 330, 112 310
      C120 270, 140 230, 145 190
      C150 150, 135 120, 115 85
      C100 55, 95 35, 95 20 Z"
      fill="{WASH}" stroke="{INK}" stroke-width="2.5"/>
    <!-- inner contour for thickness -->
    <path d="M105 40 C120 80, 135 130, 132 175 C128 220, 112 265, 108 310"
      fill="none" stroke="{INK}" stroke-width="1.2" opacity="0.5"/>
    <!-- scroll foot spiral -->
    <path d="M120 360 Q145 350 155 370 Q145 385 125 375 Q115 365 125 360"
      fill="none" stroke="{GOLD}" stroke-width="2.5"/>
  </g>
''')

# 9. Louis XVI fluted tapered leg
write("per-louis-xvi", f'''
  <!-- straight tapered fluted leg -->
  <g transform="translate(300,30)">
    <!-- outer taper -->
    <path d="M80 20 L110 400 L130 400 L160 20 Z" fill="{WASH}" stroke="{INK}" stroke-width="2.5"/>
    <!-- flutes (concave channels) -->
    <path d="M95 30 L115 390" stroke="{INK}" stroke-width="1.5"/>
    <path d="M105 28 L120 390" stroke="{GOLD}" stroke-width="1.2"/>
    <path d="M115 28 L125 390" stroke="{INK}" stroke-width="1.5"/>
    <path d="M125 28 L130 390" stroke="{GOLD}" stroke-width="1.2"/>
    <path d="M135 30 L135 390" stroke="{INK}" stroke-width="1.5"/>
    <path d="M145 30 L140 390" stroke="{GOLD}" stroke-width="1.2"/>
    <!-- block capital / collar -->
    <rect x="75" y="15" width="90" height="22" fill="#D4C4A8" stroke="{INK}" stroke-width="2"/>
    <!-- toe block -->
    <rect x="105" y="400" width="30" height="18" fill="#D4C4A8" stroke="{INK}" stroke-width="2"/>
  </g>
  <!-- guilloche hint on frieze -->
  <g transform="translate(100,80)">
    <rect x="0" y="0" width="160" height="50" fill="none" stroke="{INK}" stroke-width="2"/>
    <path d="M15 25 Q30 10 45 25 Q60 40 75 25 Q90 10 105 25 Q120 40 135 25"
      fill="none" stroke="{GOLD}" stroke-width="2"/>
  </g>
''')

# 10. Empire sabre leg + armchair silhouette
write("per-empire", f'''
  <!-- sabre rear leg detail -->
  <g transform="translate(80,40)">
    <path d="
      M100 20
      C90 80, 85 140, 100 200
      C120 280, 160 340, 200 400
      L220 395
      C180 335, 145 275, 130 200
      C120 140, 125 80, 130 20 Z"
      fill="{WASH}" stroke="{INK}" stroke-width="2.5"/>
  </g>
  <!-- Empire armchair silhouette -->
  <g transform="translate(380,50)">
    <!-- back -->
    <path d="M80 20 H240 V100 Q240 140 200 160 H120 Q80 140 80 100 Z"
      fill="#5A4030" stroke="{INK}" stroke-width="2.5"/>
    <!-- seat -->
    <path d="M70 160 H250 L260 200 H60 Z" fill="#6B4A2A" stroke="{INK}" stroke-width="2"/>
    <!-- arm -->
    <path d="M70 160 Q40 140 45 100" fill="none" stroke="{INK}" stroke-width="6" stroke-linecap="round"/>
    <path d="M250 160 Q280 140 275 100" fill="none" stroke="{INK}" stroke-width="6" stroke-linecap="round"/>
    <!-- front legs straight tapered -->
    <path d="M80 200 L75 380" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>
    <path d="M240 200 L245 380" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>
    <!-- sabre rear legs -->
    <path d="M90 200 Q70 280 120 380" fill="none" stroke="{INK}" stroke-width="5"/>
    <path d="M230 200 Q250 280 200 380" fill="none" stroke="{INK}" stroke-width="5"/>
    <!-- gilt mount on back -->
    <circle cx="160" cy="70" r="14" fill="none" stroke="{GOLD}" stroke-width="2.5"/>
    <path d="M150 70 H170 M160 60 V80" stroke="{GOLD}" stroke-width="1.5"/>
  </g>
''')

# 11. Restauration gondola chair
write("per-restauration-gondole", f'''
  <!-- gondola chair: continuous curved back wrapping to arms -->
  <g transform="translate(200,30)">
    <!-- outer gondola curve -->
    <path d="
      M80 400
      Q40 280, 60 160
      Q80 60, 200 30
      Q320 60, 340 160
      Q360 280, 320 400"
      fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>
    <!-- inner back -->
    <path d="
      M110 380
      Q90 260, 110 170
      Q130 90, 200 70
      Q270 90, 290 170
      Q310 260, 290 380"
      fill="none" stroke="{INK}" stroke-width="3"/>
    <!-- seat -->
    <ellipse cx="200" cy="280" rx="100" ry="35" fill="{WASH}" stroke="{INK}" stroke-width="2.5"/>
    <!-- crosse (crook) arms -->
    <path d="M90 220 Q50 180, 70 130" fill="none" stroke="{GOLD}" stroke-width="6" stroke-linecap="round"/>
    <path d="M310 220 Q350 180, 330 130" fill="none" stroke="{GOLD}" stroke-width="6" stroke-linecap="round"/>
    <!-- front legs -->
    <path d="M130 300 L120 400" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M270 300 L280 400" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>
  </g>
''')

# 12. Louis-Philippe mirror with rounded corners
write("per-lp-mirror", f'''
  <path d="
    M180 50
    H620
    A40 40 0 0 1 660 90
    V390
    A40 40 0 0 1 620 430
    H180
    A40 40 0 0 1 140 390
    V90
    A40 40 0 0 1 180 50 Z"
    fill="none" stroke="{INK}" stroke-width="14"/>
  <path d="
    M200 80
    H600
    A20 20 0 0 1 620 100
    V380
    A20 20 0 0 1 600 400
    H200
    A20 20 0 0 1 180 380
    V100
    A20 20 0 0 1 200 80 Z"
    fill="#C8D0D6" stroke="{INK}" stroke-width="1.5"/>
  <!-- highlight on glass -->
  <path d="M220 120 H400" stroke="#E8EEF2" stroke-width="8" opacity="0.6"/>
  <!-- corner radius callouts (arcs only, no text) -->
  <path d="M180 50 A40 40 0 0 1 140 90" fill="none" stroke="{GOLD}" stroke-width="3" opacity="0.8"/>
  <path d="M620 50 A40 40 0 0 0 660 90" fill="none" stroke="{GOLD}" stroke-width="3" opacity="0.8"/>
''')

# 13. Napoleon III gilt stucco mirror
write("per-n3", f'''
  <!-- ornate gilt frame with stucco scrolls -->
  <rect x="180" y="50" width="440" height="380" rx="8" fill="#1A1512" stroke="{INK}" stroke-width="2"/>
  <!-- glass -->
  <rect x="240" y="110" width="320" height="260" fill="#C8D0D6" stroke="{INK}" stroke-width="1.5"/>
  <!-- heavy gilt stucco border -->
  <rect x="180" y="50" width="440" height="380" rx="8" fill="none" stroke="{BRASS}" stroke-width="28" opacity="0.85"/>
  <!-- scroll ornaments at corners -->
  <path d="M200 70 Q230 50 260 75 Q240 100 200 90 Z" fill="{BRASS}" stroke="{INK}" stroke-width="1"/>
  <path d="M600 70 Q570 50 540 75 Q560 100 600 90 Z" fill="{BRASS}" stroke="{INK}" stroke-width="1"/>
  <path d="M200 410 Q230 430 260 405 Q240 380 200 390 Z" fill="{BRASS}" stroke="{INK}" stroke-width="1"/>
  <path d="M600 410 Q570 430 540 405 Q560 380 600 390 Z" fill="{BRASS}" stroke="{INK}" stroke-width="1"/>
  <!-- crest -->
  <path d="M350 40 Q400 10 450 40 Q430 70 400 55 Q370 70 350 40" fill="{BRASS}" stroke="{INK}" stroke-width="1.5"/>
  <!-- stucco texture lines -->
  <path d="M210 100 Q400 80 590 100" fill="none" stroke="{GOLD}" stroke-width="1.5" opacity="0.6"/>
  <path d="M210 380 Q400 400 590 380" fill="none" stroke="{GOLD}" stroke-width="1.5" opacity="0.6"/>
''')

# 14. Boulle brass and tortoiseshell
write("per-regence-trap", f'''
  <rect x="80" y="60" width="640" height="360" fill="#1F1814" stroke="{INK}" stroke-width="3"/>
  <!-- première partie: brass ground, shell inlay -->
  <rect x="100" y="80" width="280" height="150" fill="{BRASS}" opacity="0.7" stroke="{BRASS}" stroke-width="1"/>
  <path d="M130 110 Q180 90 230 120 Q200 160 150 140 Q120 130 130 110" fill="{SHELL}"/>
  <path d="M250 130 Q300 100 350 140 Q320 180 270 160" fill="{SHELL}" opacity="0.9"/>
  <!-- contrepartie: shell ground, brass inlay -->
  <rect x="420" y="80" width="280" height="150" fill="{SHELL}" stroke="{INK}" stroke-width="1"/>
  <path d="M450 110 Q500 90 550 120 Q520 160 470 140" fill="{BRASS}" opacity="0.75"/>
  <path d="M560 130 Q610 100 670 140 Q640 180 590 160" fill="{BRASS}" opacity="0.75"/>
  <!-- lower panels swapped -->
  <rect x="100" y="250" width="280" height="150" fill="{SHELL}" stroke="{INK}" stroke-width="1"/>
  <path d="M140 280 Q200 260 260 300 Q220 340 160 320" fill="{BRASS}" opacity="0.7"/>
  <rect x="420" y="250" width="280" height="150" fill="{BRASS}" opacity="0.7" stroke="{BRASS}" stroke-width="1"/>
  <path d="M460 280 Q520 260 580 300 Q540 340 480 320" fill="{SHELL}"/>
  <!-- not equal mark as geometric X (no text) -->
  <path d="M370 200 L430 280 M430 200 L370 280" stroke="{GOLD}" stroke-width="4" stroke-linecap="round"/>
''')

# 15. Mount backs: hand-finished vs cast/screwed
write("commode-mounts", f'''
  <!-- left: filed reverse with tool marks -->
  <ellipse cx="220" cy="220" rx="140" ry="120" fill="{WASH}" stroke="{INK}" stroke-width="2.5"/>
  <path d="M120 160 Q160 220 120 280
           M150 140 Q200 220 150 300
           M190 130 Q230 220 190 310
           M250 130 Q270 220 250 310
           M290 140 Q300 220 290 300
           M320 160 Q330 220 320 280"
    fill="none" stroke="{INK}" stroke-width="1.8"/>
  <circle cx="220" cy="220" r="16" fill="{GOLD}" stroke="{INK}" stroke-width="1.5"/>
  <!-- old square nut suggestion -->
  <rect x="208" y="208" width="24" height="24" fill="none" stroke="{INK}" stroke-width="1.5" opacity="0.5"/>
  <!-- right: smooth cast with machine screw -->
  <ellipse cx="580" cy="220" rx="140" ry="120" fill="#C9BBA8" stroke="{INK}" stroke-width="2.5"/>
  <circle cx="580" cy="220" r="16" fill="{GOLD}" stroke="{INK}" stroke-width="1.5"/>
  <!-- phillips/machine screw -->
  <path d="M580 200 V240 M560 220 H600" stroke="{INK}" stroke-width="2.5"/>
  <circle cx="580" cy="220" r="28" fill="none" stroke="{MUTE}" stroke-width="1.5"/>
''')

# 16. Marble edge thickness
write("commode-marble", f'''
  <!-- thick period marble with moulded edge -->
  <g transform="translate(80,100)">
    <path d="M40 40 H300 L280 100 H60 Z" fill="#AEB6BE" stroke="{INK}" stroke-width="2.5"/>
    <!-- thick edge profile -->
    <path d="M60 100 L40 40" stroke="{GOLD}" stroke-width="4"/>
    <path d="M40 40 Q50 70 60 100" fill="none" stroke="{INK}" stroke-width="2"/>
    <!-- moulding -->
    <path d="M60 100 H280" stroke="#8A9298" stroke-width="6"/>
    <rect x="70" y="100" width="200" height="160" fill="#C4A882" stroke="{INK}" stroke-width="2"/>
  </g>
  <!-- thin later slab -->
  <g transform="translate(420,100)">
    <path d="M40 70 H300 L290 90 H50 Z" fill="#C5CDD3" stroke="{INK}" stroke-width="2"/>
    <path d="M50 90 L40 70" stroke="{MUTE}" stroke-width="2"/>
    <rect x="60" y="90" width="220" height="170" fill="#D4C4A8" stroke="{INK}" stroke-width="2"/>
  </g>
''')

# 17. Transplanted stamp patch
write("stamp-fakes", f'''
  <rect x="100" y="60" width="600" height="360" fill="#C4A882" stroke="{INK}" stroke-width="2.5"/>
  <!-- wood grain -->
  <path d="M120 100 H400 M120 140 H500 M120 200 H350 M450 300 H680 M500 360 H680"
    stroke="{INK}" stroke-width="0.8" opacity="0.25"/>
  <!-- inserted patch with different grain direction -->
  <rect x="300" y="160" width="200" height="140" fill="#7A5530" stroke="{GOLD}" stroke-width="3" stroke-dasharray="10 6"/>
  <!-- patch grain perpendicular -->
  <path d="M320 170 V290 M350 170 V290 M380 170 V290 M410 170 V290 M440 170 V290 M470 170 V290"
    stroke="{INK}" stroke-width="1.2" opacity="0.4"/>
  <!-- stamp on patch -->
  <rect x="340" y="200" width="120" height="50" fill="none" stroke="{INK}" stroke-width="2"/>
  <path d="M355 220 H445 M355 235 H430" stroke="{INK}" stroke-width="2" opacity="0.5"/>
  <!-- corner cut marks -->
  <path d="M300 160 L285 145 M500 160 L515 145 M300 300 L285 315 M500 300 L515 315"
    stroke="{GOLD}" stroke-width="2"/>
''')

# 18. Gustavian painted cabinet
write("per-gustavian", f'''
  <rect x="200" y="40" width="400" height="400" fill="#D8D2C6" stroke="{INK}" stroke-width="2.5"/>
  <!-- cornice -->
  <path d="M180 40 H620 L600 70 H200 Z" fill="#E8E2D8" stroke="{INK}" stroke-width="2"/>
  <!-- doors -->
  <line x1="400" y1="70" x2="400" y2="400" stroke="{INK}" stroke-width="2"/>
  <rect x="220" y="100" width="160" height="240" fill="none" stroke="{INK}" stroke-width="2"/>
  <rect x="420" y="100" width="160" height="240" fill="none" stroke="{INK}" stroke-width="2"/>
  <!-- fluted pilasters -->
  <path d="M210 100 V340 M218 100 V340 M226 100 V340" stroke="{GOLD}" stroke-width="1.5"/>
  <path d="M574 100 V340 M582 100 V340 M590 100 V340" stroke="{GOLD}" stroke-width="1.5"/>
  <!-- paint wear at edges -->
  <path d="M200 80 Q210 200 200 350" fill="none" stroke="{PAPER}" stroke-width="8" opacity="0.7"/>
  <path d="M600 90 Q590 220 600 360" fill="none" stroke="{PAPER}" stroke-width="6" opacity="0.6"/>
  <!-- iron handle -->
  <circle cx="380" cy="220" r="6" fill="{INK}"/>
  <circle cx="420" cy="220" r="6" fill="{INK}"/>
''')

# 19. Welsh dresser (mapped to per-georgian as UK piece type illustration companion - actually use cabinet-cornice for buffet / dresser)
write("cabinet-cornice", f'''
  <!-- buffet deux-corps / dresser: upper open shelves + lower cupboard -->
  <g transform="translate(150,20)">
    <!-- cornice -->
    <path d="M20 30 H480 L460 60 H40 Z" fill="{WASH}" stroke="{INK}" stroke-width="2.5"/>
    <!-- upper carcase open -->
    <rect x="50" y="60" width="400" height="160" fill="#D4C4A8" stroke="{INK}" stroke-width="2.5"/>
    <line x1="50" y1="110" x2="450" y2="110" stroke="{INK}" stroke-width="2"/>
    <line x1="50" y1="160" x2="450" y2="160" stroke="{INK}" stroke-width="2"/>
    <!-- plate marks on shelves -->
    <ellipse cx="120" cy="95" rx="25" ry="8" fill="none" stroke="{GOLD}" stroke-width="1.5"/>
    <ellipse cx="200" cy="95" rx="25" ry="8" fill="none" stroke="{GOLD}" stroke-width="1.5"/>
    <ellipse cx="300" cy="145" rx="30" ry="8" fill="none" stroke="{GOLD}" stroke-width="1.5"/>
    <!-- lower cupboard -->
    <rect x="40" y="220" width="420" height="180" fill="#C4A882" stroke="{INK}" stroke-width="2.5"/>
    <line x1="250" y1="220" x2="250" y2="400" stroke="{INK}" stroke-width="2"/>
    <rect x="70" y="250" width="140" height="120" fill="none" stroke="{INK}" stroke-width="1.5"/>
    <rect x="290" y="250" width="140" height="120" fill="none" stroke="{INK}" stroke-width="1.5"/>
    <!-- join line between upper and lower -->
    <path d="M40 220 H460" stroke="{GOLD}" stroke-width="3"/>
  </g>
''')

# 20. Secrétaire à abattant
write("sec-fall-front", f'''
  <g transform="translate(220,30)">
    <!-- marble -->
    <path d="M40 20 H320 L305 50 H55 Z" fill="#B0B8C0" stroke="{INK}" stroke-width="2"/>
    <!-- upper drawer -->
    <rect x="60" y="50" width="240" height="50" fill="#C4A882" stroke="{INK}" stroke-width="2"/>
    <!-- fall front open (abattant) -->
    <path d="M60 100 L60 100 L20 280 H340 L300 100 Z" fill="#B8956A" stroke="{INK}" stroke-width="2.5"/>
    <!-- leather writing surface -->
    <rect x="50" y="140" width="260" height="100" fill="#5A4030" stroke="{INK}" stroke-width="1.5" opacity="0.85"/>
    <!-- hinge line -->
    <path d="M60 100 H300" stroke="{GOLD}" stroke-width="3"/>
    <!-- lower drawers -->
    <rect x="60" y="100" width="240" height="40" fill="#C4A882" stroke="{INK}" stroke-width="1.5" opacity="0.3"/>
    <rect x="60" y="280" width="240" height="60" fill="#C4A882" stroke="{INK}" stroke-width="2"/>
    <rect x="60" y="340" width="240" height="60" fill="#C4A882" stroke="{INK}" stroke-width="2"/>
    <!-- bracket feet -->
    <path d="M60 400 L40 440 H100 L80 400" fill="{WASH}" stroke="{INK}" stroke-width="2"/>
    <path d="M300 400 L280 440 H340 L320 400" fill="{WASH}" stroke="{INK}" stroke-width="2"/>
  </g>
''')

# 21. Worn gilding on gesso
write("mirror-regilding", f'''
  <!-- ornate frame section -->
  <path d="M100 350 Q200 40 400 120 Q600 40 700 350 Z" fill="#E6D3A0" stroke="{INK}" stroke-width="2.5"/>
  <!-- bole / red showing through wear -->
  <path d="M220 200 Q300 100 400 160 Q480 100 560 200" fill="#8B3A2A" opacity="0.45"/>
  <!-- worn hollows -->
  <ellipse cx="300" cy="180" rx="40" ry="25" fill="#C4A35A" opacity="0.3"/>
  <ellipse cx="500" cy="170" rx="35" ry="20" fill="#6B2E22" opacity="0.35"/>
  <!-- remaining gold leaf patches -->
  <path d="M250 220 Q320 160 380 200" fill="none" stroke="{BRASS}" stroke-width="8" opacity="0.7"/>
  <path d="M420 210 Q500 150 580 220" fill="none" stroke="{BRASS}" stroke-width="6" opacity="0.55"/>
  <!-- gesso crackle -->
  <path d="M280 250 L300 280 M320 240 L340 290 M480 250 L500 285"
    stroke="{INK}" stroke-width="1" opacity="0.35"/>
''')

# 22. Saw marks pit vs circular
write("commode-saw-marks", f'''
  <!-- left: straight pit/frame saw marks -->
  <rect x="60" y="60" width="320" height="360" rx="4" fill="{WASH}" stroke="{INK}" stroke-width="2"/>
  <g stroke="{INK}" stroke-width="1.2" opacity="0.75">
    <path d="M80 90 H360 M80 120 H360 M80 150 H360 M80 180 H360
             M80 210 H360 M80 240 H360 M80 270 H360 M80 300 H360
             M80 330 H360 M80 360 H360 M80 390 H360"/>
  </g>
  <!-- right: arced circular saw marks -->
  <rect x="420" y="60" width="320" height="360" rx="4" fill="{WASH}" stroke="{INK}" stroke-width="2"/>
  <g fill="none" stroke="{GOLD}" stroke-width="1.8">
    <path d="M460 400 A80 80 0 0 1 560 320"/>
    <path d="M460 400 A120 120 0 0 1 600 300"/>
    <path d="M460 400 A160 160 0 0 1 640 280"/>
    <path d="M460 400 A200 200 0 0 1 680 250"/>
    <path d="M460 400 A240 240 0 0 1 720 210"/>
    <path d="M460 400 A280 280 0 0 1 730 160"/>
  </g>
''')

# 23. Hand-forged nails vs modern screws
write("chair-nails-screws", f'''
  <!-- wrought/cut nail -->
  <g transform="translate(180,60)">
    <path d="M60 20 L90 20 L80 60 L40 60 Z" fill="{INK}"/>
    <path d="M60 60 L60 360" stroke="{INK}" stroke-width="10" stroke-linecap="round"/>
    <!-- irregular taper -->
    <path d="M55 100 L65 100 M52 200 L68 200 M56 300 L64 300" stroke="{GOLD}" stroke-width="1.5"/>
  </g>
  <!-- modern phillips screw -->
  <g transform="translate(480,60)">
    <circle cx="70" cy="50" r="40" fill="none" stroke="{GOLD}" stroke-width="5"/>
    <path d="M70 20 V80 M40 50 H100" stroke="{GOLD}" stroke-width="5"/>
    <path d="M70 90 L70 360" stroke="{GOLD}" stroke-width="8" stroke-linecap="round"/>
    <!-- threads -->
    <path d="M55 140 H85 M52 180 H88 M55 220 H85 M52 260 H88 M55 300 H85"
      stroke="{INK}" stroke-width="2" opacity="0.5"/>
  </g>
''')

# 24. Veneer thickness at edge
write("sec-veneer", f'''
  <!-- thick early veneer cross-section -->
  <g transform="translate(80,100)">
    <rect x="0" y="80" width="280" height="200" fill="#8B5A2B" stroke="{INK}" stroke-width="2"/>
    <!-- thick veneer layer -->
    <rect x="0" y="60" width="280" height="28" fill="#D4A574" stroke="{INK}" stroke-width="2"/>
    <path d="M20 74 H260" stroke="{GOLD}" stroke-width="2" opacity="0.5"/>
  </g>
  <!-- thin modern veneer -->
  <g transform="translate(440,100)">
    <rect x="0" y="80" width="280" height="200" fill="#C4A06A" stroke="{INK}" stroke-width="2"/>
    <rect x="0" y="74" width="280" height="8" fill="#E8C8A0" stroke="{INK}" stroke-width="1.5"/>
  </g>
''')

# 25. Replaced hardware with extra holes
write("cabinet-hardware", f'''
  <rect x="150" y="60" width="500" height="360" rx="4" fill="{WASH}" stroke="{INK}" stroke-width="2.5"/>
  <!-- current lock plate -->
  <rect x="340" y="180" width="120" height="150" rx="4" fill="#4A453E" stroke="{INK}" stroke-width="2"/>
  <circle cx="400" cy="230" r="12" fill="{GOLD}"/>
  <path d="M380 280 H420" stroke="{GOLD}" stroke-width="3"/>
  <!-- ghost holes from previous hardware -->
  <circle cx="300" cy="200" r="8" fill="none" stroke="{GOLD}" stroke-width="2" stroke-dasharray="4 3"/>
  <circle cx="300" cy="280" r="8" fill="none" stroke="{GOLD}" stroke-width="2" stroke-dasharray="4 3"/>
  <circle cx="500" cy="200" r="8" fill="none" stroke="{GOLD}" stroke-width="2" stroke-dasharray="4 3"/>
  <circle cx="500" cy="280" r="8" fill="none" stroke="{GOLD}" stroke-width="2" stroke-dasharray="4 3"/>
  <circle cx="400" cy="140" r="6" fill="none" stroke="{MUTE}" stroke-width="2" stroke-dasharray="3 2"/>
  <!-- filled old hole -->
  <circle cx="280" cy="240" r="5" fill="{INK}" opacity="0.35"/>
''')

# 26. Stamp on seat rail (stamps category twin) - more detailed impression
write("stamp-where-chairs", f'''
  <path d="M120 80 H680 V130 H120 Z" fill="#7A5A2E" stroke="{INK}" stroke-width="2.5"/>
  <path d="M150 130 V360 M650 130 V360" stroke="{INK}" stroke-width="10" stroke-linecap="round"/>
  <path d="M150 360 H650" stroke="{INK}" stroke-width="10"/>
  <!-- look-here bracket on inner rail face -->
  <rect x="310" y="170" width="180" height="60" rx="3" fill="none" stroke="{GOLD}" stroke-width="3"/>
  <path d="M330 190 H470 M330 205 H455 M330 220 H440" stroke="{INK}" stroke-width="2.5" opacity="0.45"/>
  <path d="M400 130 V170" stroke="{GOLD}" stroke-width="2" stroke-dasharray="6 4"/>
''')

# 27. Commode stamp location (under marble upright) for sec-stamp-location
write("sec-stamp-location", f'''
  <path d="M120 60 H680 L650 105 H150 Z" fill="#B0B8C0" stroke="{INK}" stroke-width="2"/>
  <rect x="170" y="105" width="460" height="320" fill="#C4A882" stroke="{INK}" stroke-width="2.5"/>
  <rect x="170" y="105" width="50" height="320" fill="#A67C52" stroke="{INK}" stroke-width="1.5"/>
  <rect x="178" y="125" width="34" height="80" rx="2" fill="none" stroke="{GOLD}" stroke-width="2.5"/>
  <path d="M185 150 H205 M185 170 H200 M185 190 H203" stroke="{INK}" stroke-width="1.5" opacity="0.5"/>
  <!-- fall front hint -->
  <rect x="240" y="160" width="320" height="120" fill="#B8956A" stroke="{INK}" stroke-width="2"/>
''')

# 28. Louis XV bombé only (style note uses catalogue words — skip text-heavy; use curved vs straight comparison without text)
write("per-louis-xv-style", f'''
  <!-- left: period bombé with cabriole -->
  <g transform="translate(60,50)">
    <path d="M50 40 H270 L255 70 H65 Z" fill="#B0B8C0" stroke="{INK}" stroke-width="1.5"/>
    <path d="M70 70 Q30 160 65 240 L70 280 Q60 300 85 310 H235 Q260 300 250 280 L255 240 Q290 160 250 70 Z"
      fill="#C4A882" stroke="{INK}" stroke-width="2"/>
    <!-- cabriole feet -->
    <path d="M85 310 C70 350, 60 380, 90 400" fill="none" stroke="{INK}" stroke-width="4"/>
    <path d="M235 310 C250 350, 260 380, 230 400" fill="none" stroke="{INK}" stroke-width="4"/>
  </g>
  <!-- right: straight neoclassical revival claiming XV -->
  <g transform="translate(420,50)">
    <path d="M50 40 H270 L255 70 H65 Z" fill="#B0B8C0" stroke="{INK}" stroke-width="1.5"/>
    <rect x="70" y="70" width="180" height="240" fill="#D4C4A8" stroke="{INK}" stroke-width="2"/>
    <!-- fluted straight legs (anachronistic for XV) -->
    <path d="M90 310 L90 400 M100 310 L100 400 M110 310 L110 400" stroke="{GOLD}" stroke-width="2"/>
    <path d="M210 310 L210 400 M220 310 L220 400 M230 310 L230 400" stroke="{GOLD}" stroke-width="2"/>
  </g>
  <path d="M380 200 L420 260 M420 200 L380 260" stroke="{GOLD}" stroke-width="4" stroke-linecap="round"/>
''')

# 29. Chair legs comparison: cabriole / sabre / fluted
write("chair-legs", f'''
  <!-- cabriole -->
  <g transform="translate(80,40)">
    <path d="
      M70 20
      C50 80, 40 140, 70 200
      C100 260, 90 320, 75 380
      C70 400, 90 420, 110 410
      C95 400, 85 385, 90 360
      C100 300, 115 250, 95 190
      C75 130, 85 70, 90 20 Z"
      fill="{WASH}" stroke="{INK}" stroke-width="2.5"/>
    <path d="M85 390 Q105 380 115 400" fill="none" stroke="{GOLD}" stroke-width="2"/>
  </g>
  <!-- sabre -->
  <g transform="translate(300,40)">
    <path d="
      M80 20
      C70 100, 65 180, 90 260
      C120 340, 160 400, 190 420
      L200 410
      C170 390, 135 330, 110 260
      C90 180, 95 100, 100 20 Z"
      fill="{WASH}" stroke="{INK}" stroke-width="2.5"/>
  </g>
  <!-- fluted taper -->
  <g transform="translate(560,40)">
    <path d="M60 20 L80 420 L100 420 L120 20 Z" fill="{WASH}" stroke="{INK}" stroke-width="2.5"/>
    <path d="M75 40 L88 400 M85 35 L92 400 M95 35 L96 400 M105 40 L104 400"
      stroke="{GOLD}" stroke-width="1.3"/>
    <rect x="55" y="15" width="70" height="18" fill="#D4C4A8" stroke="{INK}" stroke-width="1.5"/>
  </g>
''')

# 30. Commode backboards (old boards)
write("commode-backboards", f'''
  <!-- left: nailed boards -->
  <g transform="translate(60,50)">
    <rect x="0" y="0" width="70" height="380" fill="{WASH}" stroke="{INK}" stroke-width="2"/>
    <rect x="70" y="0" width="70" height="380" fill="#E0D6C4" stroke="{INK}" stroke-width="2"/>
    <rect x="140" y="0" width="70" height="380" fill="{WASH}" stroke="{INK}" stroke-width="2"/>
    <rect x="210" y="0" width="70" height="380" fill="#E0D6C4" stroke="{INK}" stroke-width="2"/>
    <g fill="{INK}">
      <ellipse cx="35" cy="60" rx="5" ry="4"/><ellipse cx="35" cy="320" rx="5" ry="4"/>
      <ellipse cx="105" cy="80" rx="5" ry="4"/><ellipse cx="105" cy="300" rx="5" ry="4"/>
      <ellipse cx="175" cy="50" rx="5" ry="4"/><ellipse cx="175" cy="340" rx="5" ry="4"/>
      <ellipse cx="245" cy="90" rx="5" ry="4"/><ellipse cx="245" cy="310" rx="5" ry="4"/>
    </g>
  </g>
  <!-- right: plywood -->
  <g transform="translate(450,50)">
    <rect x="0" y="0" width="290" height="380" fill="#D5CBBD" stroke="{INK}" stroke-width="2"/>
    <path d="M0 120 H290 M0 240 H290" stroke="{MUTE}" stroke-width="1.5" stroke-dasharray="8 6"/>
    <!-- ply layers at edge -->
    <path d="M0 0 V380" stroke="{GOLD}" stroke-width="6" opacity="0.4"/>
    <path d="M3 0 V380 M8 0 V380 M13 0 V380" stroke="{INK}" stroke-width="0.8" opacity="0.5"/>
  </g>
''')

# Extra useful ones
write("per-lp", f'''
  <!-- bulky LP armoire/comfort silhouette -->
  <path d="M200 50 H600 A30 30 0 0 1 630 80 V400 H170 V80 A30 30 0 0 1 200 50 Z"
    fill="none" stroke="{INK}" stroke-width="8"/>
  <rect x="220" y="100" width="360" height="280" fill="#5A4030" stroke="{INK}" stroke-width="2"/>
  <line x1="400" y1="100" x2="400" y2="380" stroke="{INK}" stroke-width="2"/>
  <path d="M200 50 Q400 20 600 50" fill="none" stroke="{GOLD}" stroke-width="2"/>
''')

write("stamp-genuine-look", f'''
  <rect x="120" y="80" width="560" height="320" rx="4" fill="#A67C52" stroke="{INK}" stroke-width="2.5"/>
  <!-- deep impressed rectangle -->
  <rect x="240" y="160" width="320" height="120" rx="4" fill="#8B5A2B" stroke="{INK}" stroke-width="3"/>
  <!-- abstract impressed strokes (not readable brand) -->
  <path d="M280 200 H400 M280 230 H520 M280 255 H450"
    stroke="{INK}" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
  <!-- fibre crush at edges -->
  <path d="M240 160 Q255 150 270 160" fill="none" stroke="{INK}" stroke-width="1.5" opacity="0.5"/>
''')

print(f"Wrote {len(list(OUT_SRC.glob('*.svg')))} SVGs")

# Render + optimise
accepted = []
for svg_path in sorted(OUT_SRC.glob("*.svg")):
    name = svg_path.stem
    png = OUT_PNG / f"{name}.png"
    webp = OUT_WEBP / f"{name}.webp"
    subprocess.run(["rsvg-convert", "-w", "800", str(svg_path), "-o", str(png)], check=True)
    # quality loop for 40-80KB
    for q in (80, 70, 60, 50, 40):
        subprocess.run(["cwebp", "-q", str(q), "-resize", "800", "0", str(png), "-o", str(webp)],
                       check=True, capture_output=True)
        sz = webp.stat().st_size
        if 40_000 <= sz <= 80_000 or (sz < 40_000 and q >= 70):
            break
    # if still tiny, that's ok for line art; if huge, force lower
    sz = webp.stat().st_size
    if sz > 80_000:
        subprocess.run(["cwebp", "-q", "35", "-resize", "800", "0", str(png), "-o", str(webp)],
                       check=True, capture_output=True)
        sz = webp.stat().st_size
    accepted.append({"id": name, "bytes": sz})
    print(f"{name}: {sz} bytes")

total = sum(a["bytes"] for a in accepted)
print(f"TOTAL: {total} bytes ({total/1024:.1f} KB), count={len(accepted)}")
(Path("/tmp/field-notes-manifest.json")).write_text(json.dumps(accepted, indent=2))
