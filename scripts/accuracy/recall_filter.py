# Accuracy harness, part H (fix 10): relevant lots in the recall pool (upcoming, period piece of the requested kind, all-in at the
# low estimate within budget), then each candidate's lot page is read for its city/country and full description.
#   python3 recall_filter.py <dir> [YYYY-mm-ddTHH:MM (UTC) = time of the hunt runs]   -> <dir>/recall_candidates.json
import json, re, sys, unicodedata, datetime, subprocess
from concurrent.futures import ThreadPoolExecutor
d = sys.argv[1]; now = datetime.datetime.fromisoformat(sys.argv[2]).replace(tzinfo=datetime.timezone.utc) if len(sys.argv) > 2 else datetime.datetime.now(datetime.timezone.utc)
def n(s): return unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()
pool = json.load(open(f'{d}/drouot_recall_pool.json'))
def up(l):
    try: dt = datetime.datetime.fromisoformat(l['saleDate'].replace('Z', '+00:00'))
    except Exception: return None
    return dt > now and str(l.get('soldOrEnded')) != 'True'
def f(l): return 1 + float(l.get('premiumPct') or 28) / 100
STYLE = re.compile(r'\b(de |dans le |)style\b|gout de|xxe|xxeme|20e|moderne|miniature|maitrise|poupee')
rules = {
 's01_commode_louis_xv': (lambda t: 'commode' in t and not STYLE.search(t) and (re.search(r'(epoque|periode) louis xv\b', t) or (re.search(r'xviii', t) and not re.search(r'louis xvi\b', t) and re.search(r'louis xv\b|tombeau|arbalete|sauteuse|galbe|mouvement|bordelaise|provencale', t))) and not re.search(r'xix', t),
                          lambda l: float(l.get('estimateLow') or l.get('estimateHigh') or 0) * f(l) <= 2000),
 's05_napoleon_iii_mirror': (lambda t: re.search(r'\b(miroir|glace|trumeau)', t) and re.search(r'napoleon (iii|3)|second empire', t) and not re.search(r'\bstyle napoleon|de style napoleon', t),
                          lambda l: float(l.get('estimateLow') or 0) * f(l) <= 500 and float(l.get('estimateHigh') or l.get('estimateLow') or 0) * f(l) >= 250),
 's09_secretaire_abattant': (lambda t: 'secretaire' in t and 'abattant' in t and not STYLE.search(t),
                          lambda l: float(l.get('estimateLow') or l.get('estimateHigh') or 0) * f(l) <= 2000),
}
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
def js_str(s, key):
    m = re.search(key + r':"((?:[^"\\]|\\.)*)"', s)
    if not m: return None
    try: return json.loads('"' + m.group(1) + '"')
    except Exception: return m.group(1)
def enrich(l):
    s = subprocess.run(['curl', '-s', '-L', '--max-time', '25', '-A', UA, l['url']], capture_output=True, text=True).stdout
    j = s.find('{type:"data",data:{lot:'); b = s[j:j + 80000]
    l['city'] = js_str(b, 'city'); m = re.search(r'country:"?([A-Za-z0-9 ]+)"?', b); l['country_raw'] = m.group(1) if m else None
    l['full_description'] = js_str(b, 'description'); return l
out = {}
for k, (tf, bf) in rules.items():
    c = [l for l in pool[k] if up(l) and tf(n(l['description'] or l['title'])) and bf(l)]
    with ThreadPoolExecutor(6) as ex: out[k] = list(ex.map(enrich, c))
    print('##', k, len(pool[k]), 'pool ->', len(c))
    for l in out[k]: print(' ', l['id'], l['estimateLow'], l['estimateHigh'], l['saleDate'][:10], l.get('city'), l.get('country_raw'), '|', (l['description'] or '')[:120].replace('\n', ' '))
json.dump(out, open(f'{d}/recall_candidates.json', 'w'), ensure_ascii=False, indent=1)
