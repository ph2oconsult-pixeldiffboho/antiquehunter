# Accuracy harness, part D (fix 10): re-fetch every result link returned by /api/hunt from outside the app and record the facts
# needed to grade it (live? upcoming? estimate, fees, city/country, full description). Drouot: lot page data; Auctionet: public
# search API by title; other sites: page title + "sold" markers only (usually UNVERIFIABLE).
#   python3 hunt_check.py hunt   -> hunt/spotcheck.json
import json, glob, re, subprocess, html, time, sys, urllib.parse
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
d = sys.argv[1] if len(sys.argv) > 1 else 'hunt'
def js_str(s, key):
    m = re.search(key + r':"((?:[^"\\]|\\.)*)"', s)
    if not m: return None
    try: return json.loads('"' + m.group(1) + '"')
    except Exception: return m.group(1)
def num(s, key):
    m = re.search(r'[,{]' + key + r':(-?[0-9.]+)', s); return float(m.group(1)) if m else None
def fetch(u):
    p = subprocess.run(['curl', '-s', '-L', '--max-time', '25', '-A', UA, '-H', 'Accept-Language: fr-FR,fr;q=0.9,en;q=0.8', '-w', '\n__HTTP__%{http_code} %{url_effective}', u], capture_output=True, text=True)
    body, _, tail = p.stdout.rpartition('\n__HTTP__'); code, _, eff = tail.partition(' ')
    return int(code or 0), eff, body
cache = {}
def check(u, app_title=''):
    if u in cache: return cache[u]
    code, eff, b = fetch(u); r = {'url': u, 'http': code, 'final_url': eff}
    if 'drouot.com' in u:
        j = b.find('{type:"data",data:{lot:'); blk = b[j:j + 60000] if j >= 0 else ''
        if blk:
            r.update({'status': js_str(blk, 'status'), 'epoch': num(blk, 'date'), 'date': time.strftime('%Y-%m-%d %H:%M', time.localtime(num(blk, 'date') or 0)),
                      'low': num(blk, 'lowEstim'), 'high': num(blk, 'highEstim'), 'currency': js_str(blk, 'currencyId'), 'result': num(blk, 'result'),
                      'fees': num(blk, 'fees'), 'city': js_str(blk, 'city'), 'country': js_str(blk, 'country'), 'house': js_str(blk, 'auctioneerName'),
                      'description': (js_str(blk, 'description') or '')[:900]})
    elif 'auctionet.com' in u:
        t = re.search(r'<title>(.*?)</title>', b, re.S); title = html.unescape(t.group(1)).strip() if t else ''
        r['page_title'] = title[:200]; iid = re.search(r'/(\d+)-', u)
        it = None
        # item pages carry the id in the URL; event pages (/en/events/<event>/<lot>-...) only a lot number, so match by exact title
        for q in [re.sub(r'\s*-\s*Auctionet.*$', '', title).split('. ')[0][:80], (app_title or '')[:80]]:
            if it or not q: continue
            try:
                a = json.loads(subprocess.run(['curl', '-s', '--max-time', '20', 'https://auctionet.com/api/v2/items.json?per_page=50&q=' + urllib.parse.quote(q)], capture_output=True, text=True).stdout or '{}')
                items = a.get('items', [])
                it = next((x for x in items if iid and str(x.get('id')) == iid.group(1)), None) if '/events/' not in u else \
                     next((x for x in items if (x.get('title') or '').strip().rstrip('.').lower() == (app_title or '').strip().rstrip('.').lower()), None)
            except Exception: it = None
        if it:
            r.update({'status': it.get('state'), 'epoch': it.get('ends_at'), 'date': time.strftime('%Y-%m-%d %H:%M', time.localtime(it.get('ends_at') or 0)),
                      'low': it.get('estimate'), 'high': it.get('upper_estimate'), 'currency': it.get('currency'), 'house': it.get('house'),
                      'city': it.get('location'), 'item_id': it.get('id'), 'description': re.sub('<[^>]+>', ' ', (it.get('title') or '') + ' ' + (it.get('description') or ''))[:900]})
    else:
        t = re.search(r'<title>(.*?)</title>', b, re.S); r['page_title'] = html.unescape(t.group(1)).strip()[:200] if t else None
        r['looks_sold'] = bool(re.search(r'\b(adjugé|sold for|vendu|lot closed|this auction has ended|vente terminée)\b', b, re.I))
    cache[u] = r; return r
out = {}
for f in sorted(glob.glob(f'{d}/run*_s*.json')):
    j = json.load(open(f)); ms = ((j['response'] or {}).get('results') or {}).get('matches', [])
    out[f] = [{'app': {k: m.get(k) for k in ['title', 'platform', 'price', 'location', 'date', 'verification', 'source', 'house', 'allInLow', 'allInHigh', 'premiumPct', 'allInEstimate', 'premiumAssumed']},
               'check': check(m.get('url'), m.get('title') or '')} for m in ms]
    print(f, len(out[f]), flush=True)
json.dump(out, open(f'{d}/spotcheck.json', 'w'), ensure_ascii=False, indent=1)
