# Accuracy harness, part C (fix 10): POST /api/hunt with the same body the "Find Me an Antique" form sends, for the 10 test searches.
#   python3 hunt_run.py --base https://<preview>.vercel.app --out hunt --tag run1 [case ...]
import argparse, json, os, time, urllib.request, urllib.error
ap = argparse.ArgumentParser(); ap.add_argument('--base', required=True); ap.add_argument('--out', default='hunt'); ap.add_argument('--tag', default='run1')
ap.add_argument('cases', nargs='*'); a = ap.parse_args()
FR = ['Interencheres', 'Drouot', 'LeBonCoin', "Christie's"]; UK = ['The Saleroom', 'easyLive Auction']; SE = ['Auctionet', 'Bukowskis']
def body(q, geo, plat, budget, period=True): return {'query': q, 'geographies': geo, 'platforms': plat, 'priceRange': budget, 'currency': 'EUR', 'language': 'en', 'periodOnly': period}
CASES = {
 's01_commode_louis_xv': body('commode Louis XV', ['France', 'United Kingdom'], FR + UK, '2000 EUR'),
 's02_commode_louis_xvi': body('commode Louis XVI', ['France', 'United Kingdom'], FR + UK, '1500 EUR'),
 's03_vaisselier_welsh_dresser': body('vaisselier / Welsh dresser', ['France', 'United Kingdom'], FR + UK, '2000 EUR'),
 's04_armoire_louis_xv': body('armoire Louis XV', ['France'], FR, '2000 EUR'),
 's05_napoleon_iii_mirror': body('Napoleon III mirror', ['France'], FR, '250 - 500 EUR'),
 's06_gustavian_commode': body('Gustavian commode', ['Sweden', 'Europe'], SE, '2000 EUR'),
 's07_george_iii_chest': body('George III chest of drawers', ['United Kingdom'], UK, '2000 EUR'),
 's08_buffet_deux_corps': body('buffet deux-corps', ['France'], FR, '2000 EUR'),
 's09_secretaire_abattant': body('secrétaire à abattant', ['France', 'United Kingdom'], FR + UK, '2000 EUR'),
 's10_vague_english': body('nice old wooden cupboard for my kitchen', ['France', 'United Kingdom'], FR + UK, '1000 EUR'),
}
if __name__ == '__main__':
    os.makedirs(a.out, exist_ok=True)
    for name in a.cases or CASES:
        b = CASES[name]; t = time.time()
        try:
            req = urllib.request.Request(a.base.rstrip('/') + '/api/hunt', data=json.dumps(b).encode(), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=120) as r: status = r.status; data = json.loads(r.read())
        except urllib.error.HTTPError as e: status = e.code; data = {'error_body': e.read().decode()[:2000]}
        except Exception as e: status = None; data = {'error': repr(e)}
        wall = round(time.time() - t, 1)
        json.dump({'request': b, 'base': a.base, 'httpStatus': status, 'wallSeconds': wall, 'at': time.strftime('%Y-%m-%d %H:%M:%S'), 'response': data},
                  open(f'{a.out}/{a.tag}_{name}.json', 'w'), ensure_ascii=False, indent=1)
        res = (data.get('results') or {}) if isinstance(data, dict) else {}; st = res.get('stats', {})
        print(name, status, wall, 'matches', len(res.get('matches', [])), 'geminiErr', st.get('geminiError'), 'msg', (res.get('message') or '')[:80], data.get('error') if isinstance(data, dict) else '', flush=True)
