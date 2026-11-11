#!/usr/bin/env python3
"""Builds src/data/dibsComps.json: current 1stDibs ASKING prices (not sales) for core typologies
(French commodes, semainiers, buffets deux-corps / tall cabinets, Welsh or oak dressers, Gustavian
pieces). Used only as a dealer/antique-shop walk-away ceiling; never mixed into soldComps.json.

The 46 listings in the 11 Nov 2026 1stDibs calibration (antique-hunter-benchmark/firstdibs/cases.json)
are held out so they remain a fair test, as are two listings found sold on the PDP during that
calibration. eval/corpus.json (the sealed set) is never read.

Source: /workspace/antique-hunter-benchmark/firstdibs/parsed_all.json (scraped 2026-11-11).
"""
import json, os, re, sys

SRC = os.environ.get('DIBS_SRC', '/workspace/antique-hunter-benchmark/firstdibs')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'src/data/dibsComps.json')
HOLDOUT_OUT = os.path.join(os.path.dirname(__file__), 'dibs_holdout_ids.json')

FR_ORIG = re.compile(r'\b(french|france|fran[cç]ais)\b', re.I)
NORDIC_ORIG = re.compile(r'\b(swedish|sweden|su[eé]dois|sverige|danish|denmark|danois|danmark|scandinav|norwegian|norway|norge|nordic)\b', re.I)
UK_ORIG = re.compile(r'\b(english|england|welsh|wales|british|britain|great britain|\buk\b|scottish|scotland|irish|ireland)\b', re.I)
GUSTAV = re.compile(r'\b(gustavi\w*|gustaviansk\w*)\b', re.I)
TYPE_WORDS = {
    'commode': 'commode chest of drawers',
    'semainier': 'semainier chiffonnier tallboy chest-on-chest',
    'buffet_deux_corps': 'buffet deux-corps vaisselier',
    'welsh_or_oak_dresser': 'welsh dresser kitchen dresser vaisselier',
    'gustavian': 'gustavian gustaviansk',
}

def origin_of(origin, title, period, style):
    blob = ' '.join(x for x in (origin, title, period, style) if x)
    if NORDIC_ORIG.search(blob) or GUSTAV.search(blob):
        return 'NORDIC'
    if UK_ORIG.search(blob):
        return 'UK'
    if FR_ORIG.search(blob):
        return 'FR'
    return 'OTHER'

def compose(x):
    parts = [x.get('title') or '']
    meta = ' '.join(p for p in (
        x.get('period_prefix'), x.get('period'), x.get('style'), x.get('origin'),
        x.get('period_style'), x.get('materials'),
    ) if p)
    if meta:
        parts.append(meta)
    if x.get('dims_cm'):
        parts.append(x['dims_cm'])
    cat = TYPE_WORDS.get(x.get('category') or '')
    if cat:
        parts.append(cat)
    creators = x.get('creators') or []
    if creators:
        names = ', '.join(str(c) for c in creators if c)
        if names:
            parts.append('stamped ' + names)
    desc = re.sub(r'\s+', ' ', (x.get('description') or '')).strip()
    if desc and desc != (x.get('title') or ''):
        parts.append(desc[:400])
    text = re.sub(r'\s+', ' ', '. '.join(parts)).strip()
    return text[:800]

def stamp_of(x):
    creators = [str(c).strip() for c in (x.get('creators') or []) if str(c).strip()]
    return creators[0] if creators else None

def main():
    parsed = json.load(open(os.path.join(SRC, 'parsed_all.json')))
    cases = json.load(open(os.path.join(SRC, 'cases.json')))
    summary = json.load(open(os.path.join(SRC, 'summary.json')))
    holdout = sorted({c['id'] for c in cases} | set(summary.get('source', {}).get('ids_dropped_sold') or []))
    holdout_set = set(holdout)
    scraped = '2026-11-11'
    skipped = {'holdout': 0, 'no_ask': 0, 'sold_or_unavail': 0}
    lots = []
    for x in parsed['eligible']:
        i = x['id']
        if i in holdout_set:
            skipped['holdout'] += 1
            continue
        if x.get('isSold') or x.get('isUnavailable') or x.get('isOnHold') or x.get('price_upon_request'):
            skipped['sold_or_unavail'] += 1
            continue
        ask = x.get('asking_eur')
        if not (isinstance(ask, (int, float)) and ask > 0):
            skipped['no_ask'] += 1
            continue
        origin = origin_of(x.get('origin'), x.get('title'), x.get('period'), x.get('style'))
        lots.append({
            'id': i,
            'u': x['url'],
            't': compose(x),
            'ask': round(float(ask), 2),
            'd': scraped,
            'src': '1stDibs',
            'rg': 'NORDIC' if origin == 'NORDIC' else 'FR',
            'origin': origin,
            'typology': x.get('category') or '',
            'period': x.get('period_style') or x.get('style') or x.get('period') or None,
            'stamp': stamp_of(x),
            'dims_cm': x.get('dims_cm') or None,
            'location': x.get('location') or None,
            'title': x.get('title') or '',
        })
    lots.sort(key=lambda l: l['id'])
    payload = {
        'built': '2026-11-11',
        'scraped': scraped,
        'note': 'Current 1stDibs ASKING prices (not recorded sales) for core typologies. '
                'The 46 11 Nov 2026 calibration listings and two sold-on-PDP listings are held out. '
                'Never mixed into soldComps.json. Dealer/antique-shop venue only.',
        'holdout_n': len(holdout),
        'holdout_ids': holdout,
        'n': len(lots),
        'lots': lots,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(payload, open(OUT, 'w'), ensure_ascii=False, indent=None, separators=(',', ':'))
    json.dump({
        'note': 'Held out of src/data/dibsComps.json: the 46 1stDibs calibration listings (11 Nov 2026) plus two sold on the PDP. Fair test set; do not train or tune on these asks.',
        'ids': holdout,
        'n': len(holdout),
    }, open(HOLDOUT_OUT, 'w'), indent=2)
    typ = {}
    for l in lots:
        typ[l['typology']] = typ.get(l['typology'], 0) + 1
    print(f'wrote {OUT} n={len(lots)} holdout={len(holdout)} skipped={skipped} typologies={typ}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
