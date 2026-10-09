# Accuracy harness, part F (fix 10): grade every result of the 10 test searches with the REPORT.md rules, then apply manual
# judgements. Rules per result (Y = yes, N = no, U = could not be verified from outside the app):
#   live      the link opens a real lot page (Drouot lot data / Auctionet item found)          upcoming  sale is in the future
#   budget    all-in at the LOW estimate (published fees, else 25%) within the budget            period    genuinely of the period
#   type      the piece asked for                                                                   loc       in a requested country
# OK = all Y; WRONG = any N; UNVERIFIABLE = otherwise. Precision strict = OK / all; verifiable = OK / (OK + WRONG).
# Automatic rules first (rules below), then manual_grades.json {url fragment: {field: Y/N/U, note}} overrides them; every
# automatic N or U on period/type should be read and confirmed by a person (python3 hunt_grade.py hunt --review lists them).
#   python3 hunt_grade.py hunt [--review]
import json, re, csv, sys, os, unicodedata, time
d = sys.argv[1] if len(sys.argv) > 1 else 'hunt'; REVIEW = '--review' in sys.argv
def n(s): return unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()
SPEC = {  # search: (type regex on title/description start, style regex or None, budget (lo, hi) EUR, countries)
 's01_commode_louis_xv': (r'commode', r'louis xv(?!i)', (0, 2000), ['France', 'United Kingdom']),
 's02_commode_louis_xvi': (r'commode', 'louis xvi', (0, 1500), ['France', 'United Kingdom']),
 's03_vaisselier_welsh_dresser': (r'vaisselier|dresser|buffet[ -]vaisselier|vaissellier', None, (0, 2000), ['France', 'United Kingdom']),
 's04_armoire_louis_xv': (r'armoire', 'louis xv(?!i)', (0, 2000), ['France']),
 's05_napoleon_iii_mirror': (r'miroir|glace|trumeau|mirror', 'napoleon iii|second empire', (250, 500), ['France']),
 's06_gustavian_commode': (r'commode|byra|chest of drawers', 'gustav', (0, 2000), ['Sweden', 'Europe']),
 's07_george_iii_chest': (r'chest of drawers|commode|chest', 'george iii|georgian', (0, 2000), ['United Kingdom']),
 's08_buffet_deux_corps': (r'buffet.{0,40}deux[ -]corps|deux[ -]corps', None, (0, 2000), ['France']),
 's09_secretaire_abattant': (r'secretaire', None, (0, 2000), ['France', 'United Kingdom']),
 's10_vague_english': (r'armoire|buffet|vaisselier|dresser|cupboard|confiturier|bonnetiere|homme debout|placard|enfilade|cabinet|bahut|meuble|vitrine|desserte|semainier|panetiere|crédence|credence', None, (0, 1000), ['France', 'United Kingdom']),
}
FX = {'EUR': 1, 'GBP': 1 / 0.84698, 'SEK': 1 / 11.194, 'DKK': 1 / 7.46, 'NOK': 1 / 11.7, 'CHF': 1 / 0.93, 'USD': 1 / 1.08}
COUNTRY = {'france': 'France', '75': 'France', 'fr': 'France', 'royaume-uni': 'United Kingdom', 'united kingdom': 'United Kingdom', 'uk': 'United Kingdom', 'england': 'United Kingdom',
           'sweden': 'Sweden', 'sverige': 'Sweden', 'suede': 'Sweden'}
EUROPE = {'France', 'United Kingdom', 'Sweden', 'Germany', 'Denmark', 'Norway', 'Finland', 'Belgium', 'Netherlands', 'Spain', 'Italy', 'Switzerland', 'Austria', 'Poland', 'Estonia'}
STYLE_ONLY = re.compile(r"\b(de |dans le |)style\b|\bstil\b|\bstyle\b|in the manner|revival|reproduction|copy\b")
PARTLY = re.compile(r"en partie (d.epoque|ancien|xvii|xix|du xvii|du xix|louis|de la fin)|elements anciens|parties anciennes|compose d'elements|compose d.elements|dans le gout de|made up|later top|\bmarriage\b|travail composite")
MODERN = re.compile(r"\bxx(e|eme)\b|20e siecle|20th|twentieth|\bmodern\b|\b19[2-9]\d\b|\b20[0-2]\d\b|1900-tal|vers 1900|art deco|moderne|contemporain")
PERIOD_WORD = re.compile(r"epoque|periode|period\b|circa 1[78]\d\d|c\. ?1[78]\d\d|\b1[78]\d\d\b|\bxviii|\bxix|\bxvii(e|eme)?\b|1[78]00-tal|1700|1800|18th|19th|late 18|early 19|george iii|gustaviansk|gustavian")
STYLE_CENTURY = {'s01_commode_louis_xv': r'xviii|17[3-7]\d', 's02_commode_louis_xvi': r'xviii|17[7-9]\d', 's04_armoire_louis_xv': r'xviii|17[3-7]\d', 's05_napoleon_iii_mirror': r'18[5-7]\d',
                 's06_gustavian_commode': r'1700|17[7-9]\d|1800-talets (borjan|forsta)|18th|late 18|circa 1[78]\d\d', 's07_george_iii_chest': r'18th|17[6-9]\d|18[01]\d|circa 1[78]\d\d|late 18|george iii'}
FORMS = {'s01_commode_louis_xv': r'tombeau|galbe|arbalete|sauteuse|cambre|chantourn|mouvement|cintre|enroulement', 's04_armoire_louis_xv': r'chantourn|galbe|cambre|chapeau de gendarme|coquille',
         's02_commode_louis_xvi': r'cannel|fusele|gaine|ressaut', 's06_gustavian_commode': r'gustav', 's07_george_iii_chest': r'mahogany|chest'}
def grade_one(s, app, ck, at):
    tre, style, (blo, bhi), geos = SPEC[s]
    g = {}
    desc = n((ck.get('description') or '') + ' ' + (ck.get('page_title') or '') + ' ' + (app.get('title') or ''))
    has = bool(ck.get('description'))
    g['live'] = 'Y' if (ck.get('http') == 200 and has) else ('N' if ck.get('http') == 404 else 'U')
    ep = ck.get('epoch')
    if has and ep:
        g['upcoming'] = 'Y' if (ep > at and not ck.get('result') and str(ck.get('status') or '').lower() not in ('ended', 'sold', 'closed', 'unsold')) else 'N'
    else: g['upcoming'] = 'U'
    if has and (ck.get('low') or ck.get('high')):
        fx = FX.get(ck.get('currency') or 'EUR', 1); fees = ck.get('fees') if ck.get('fees') else 25
        lo = (ck.get('low') or ck.get('high')) * fx * (1 + fees / 100); hi = (ck.get('high') or ck.get('low')) * fx * (1 + fees / 100)
        g['budget'] = 'Y' if (lo <= bhi and hi >= blo) else 'N'
    else: g['budget'] = 'U'
    head = n((ck.get('description') or app.get('title') or '')[:160])
    g['type'] = 'Y' if re.search(tre, head) else ('N' if has else ('Y' if re.search(tre, n(app.get('title') or '')) else 'U'))
    txt = desc
    if PARTLY.search(txt) or MODERN.search(txt[:400]): g['period'] = 'N'
    elif STYLE_ONLY.search(txt) and not PERIOD_WORD.search(txt): g['period'] = 'N'
    elif style:
        cen = STYLE_CENTURY.get(s)
        if re.search(r'(epoque|periode|period)\W+(\w+\W+){0,2}(' + style + ')', txt): g['period'] = 'Y'
        elif STYLE_ONLY.search(txt) and re.search(r'style\W+(\w+\W+){0,1}(' + style + ')', txt): g['period'] = 'N'   # "de style Louis XV" (any later epoch)
        elif re.search(r'(epoque|periode)\W+(\w+\W+){0,1}(regence|louis xiv|louis xvi|louis xv|empire|restauration|directoire|louis[- ]philippe|charles x|napoleon iii|transition)', txt): g['period'] = 'N?'  # another named period - read it
        elif cen and re.search(cen, txt) and (re.search(style, txt) or (FORMS.get(s) and re.search(FORMS[s], txt))): g['period'] = 'Y'
        else: g['period'] = 'U'
    else: g['period'] = 'Y' if PERIOD_WORD.search(txt) else 'U'
    c = (ck.get('country') or '').strip().lower(); country = COUNTRY.get(c)
    if not country and ck.get('currency') in ('GBP', 'SEK'): country = {'GBP': 'United Kingdom', 'SEK': 'Sweden'}[ck['currency']]   # Auctionet / Drouot London
    if not country and ck.get('city'):
        m = re.search(r',\s*([A-Za-z ]+)$', ck['city']); country = COUNTRY.get((m.group(1) if m else '').strip().lower()) or (m.group(1).strip() if m else None)
    if country: g['loc'] = 'Y' if (country in geos or ('Europe' in geos and country in EUROPE)) else 'N'
    else: g['loc'] = 'U' if not has else ('Y' if any(x.lower() in n(app.get('location') or '') for x in geos) else 'U')
    return g
M = json.load(open(f'{d}/manual_grades.json')) if os.path.exists(f'{d}/manual_grades.json') else {}
sc = json.load(open(f'{d}/spotcheck.json'))
rows, per, review = [], {}, {}
for f, rs in sorted(sc.items()):
    m = re.search(r'(run\d)_(s\d\d_[a-z_0-9]+)\.json', f); run, s = m.group(1), m.group(2)
    req = json.load(open(f)); resp = req['response'] or {}; res = resp.get('results') or {}; st = res.get('stats') or {}
    at = time.mktime(time.strptime(req['at'], '%Y-%m-%d %H:%M:%S'))
    p = per.setdefault((s, run), {'n': 0, 'ok': 0, 'bad': 0, 'unv': 0, 'wall': req['wallSeconds'], 'http': req['httpStatus'], 'geminiErr': st.get('geminiError'), 'msg': res.get('message') or (resp.get('error') if isinstance(resp, dict) else None)})
    for r in rs:
        u = r['check']['url']; g = grade_one(s, r['app'], r['check'], at); note = ''
        for k, v in M.items():
            if k in u:
                note = v.get('note', ''); g.update({x: v[x] for x in ['live', 'upcoming', 'budget', 'period', 'type', 'loc'] if x in v})
        if g['period'] == 'N?': g['period'] = 'N'
        if any(g[x] != 'Y' for x in ['period', 'type']) and not any(k in u for k in M): review[u] = {'search': s, **g, 'title': (r['app']['title'] or '')[:100], 'desc': (r['check'].get('description') or r['check'].get('page_title') or '')[:400]}
        vals = [g[x] for x in ['live', 'upcoming', 'budget', 'period', 'type', 'loc']]
        verdict = 'OK' if all(v == 'Y' for v in vals) else ('WRONG' if 'N' in vals else 'UNVERIFIABLE')
        p['n'] += 1; p['ok'] += verdict == 'OK'; p['bad'] += verdict == 'WRONG'; p['unv'] += verdict == 'UNVERIFIABLE'
        rows.append({'search': s, 'run': run, 'verdict': verdict, **g, 'platform': r['app']['platform'], 'app_verification': r['app']['verification'], 'title': (r['app']['title'] or '')[:120],
                     'app_price': r['app']['price'], 'app_allin': f"{r['app']['allInLow']}-{r['app']['allInHigh']}", 'app_location': r['app']['location'], 'url': u, 'note': note})
if REVIEW:
    for u, v in review.items(): print(json.dumps({'url': u, **v}, ensure_ascii=False))
    sys.exit()
with open(f'{d}/graded_results.csv', 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
tot = {'n': 0, 'ok': 0, 'bad': 0, 'unv': 0}
print(f"{'search':32} run  n  ok wrong unverif  prec(strict) prec(verifiable)  wall  note")
for (s, run), p in sorted(per.items()):
    for k in tot: tot[k] += p[k]
    ps = p['ok'] / p['n'] if p['n'] else None; pv = p['ok'] / (p['ok'] + p['bad']) if (p['ok'] + p['bad']) else None
    print(f"{s:32} {run} {p['n']:2} {p['ok']:3} {p['bad']:5} {p['unv']:7}  {('-' if ps is None else f'{ps:.0%}'):>10} {('-' if pv is None else f'{pv:.0%}'):>12}  {p['wall']:5}  {p['http']} {p['geminiErr'] or ''} {(p['msg'] or '')[:70]}")
print('TOTAL', tot, 'strict', round(tot['ok'] / tot['n'], 2), 'verifiable-only', round(tot['ok'] / max(1, tot['ok'] + tot['bad']), 2))
json.dump({'per_run': {f'{s}|{r}': p for (s, r), p in per.items()}, 'total': tot}, open(f'{d}/precision_summary.json', 'w'), indent=1)
