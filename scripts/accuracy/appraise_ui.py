# Accuracy harness, part A (fix 10): drive the app UI like a user and capture the model's request + answer.
# Upload photos -> "Add more details" -> catalogue text, category, location, seller type Auction, buyer's premium -> Analyze.
# No price is entered: neither the hammer nor the auctioneer's estimate is given to the app (except in --mode url, where the
# app itself reads the lot page; the page's estimate is then legitimately part of the input).
#
#   python3 appraise_ui.py --base https://<preview>.vercel.app --images ../../../antique-hunter-benchmark/accuracy_test_2026-10-09/images \
#       --out runs --tag photos [lot_id ...]
# Modes: photos (default), text (no photos), url (lot link only, no text).
import argparse, asyncio, json, os, time, urllib.request
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--base', required=True)
ap.add_argument('--lots', default=os.path.join(os.path.dirname(__file__), 'lots_split.json'))
ap.add_argument('--images', default='images', help='folder with the lot photos (downloaded from image_urls when missing)')
ap.add_argument('--out', default='runs')
ap.add_argument('--tag', default='photos')
ap.add_argument('--mode', default='photos', choices=['photos', 'text', 'url'])
ap.add_argument('--split', default=None, choices=[None, 'calibration', 'holdout'])
ap.add_argument('ids', nargs='*')
a = ap.parse_args()
LOTS = json.load(open(a.lots))['lots']
L = {l['lot_id']: l for l in LOTS}

def photos(lot):
    os.makedirs(a.images, exist_ok=True)
    out = []
    for i, name in enumerate(lot['image_files']):
        p = os.path.join(a.images, name)
        if not os.path.exists(p) and i < len(lot['image_urls']) and lot['image_urls'][i]:
            urllib.request.urlretrieve(lot['image_urls'][i], p)
        if os.path.exists(p): out.append(p)
    return out

async def run(lot):
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 430, 'height': 900}, locale='en-GB')
        pg = await ctx.new_page(); raw = {}
        async def on_resp(r):
            if 'generativelanguage.googleapis.com' in r.url and 'generateContent' in r.url:
                try:
                    raw['request'] = r.request.post_data_json
                    raw['body'] = await r.json(); raw['status'] = r.status
                except Exception as e: raw['err'] = str(e)
            if r.url.endswith('/api/comps'):
                try: raw['comps'] = await r.json(); raw['comps_status'] = r.status
                except Exception as e: raw['comps'] = {'ok': False, 'error': 'harness:' + str(e)}
            if r.url.endswith('/api/lot'):
                try: raw['lot'] = {k: v for k, v in (await r.json()).items() if k != 'images'}
                except Exception: pass
        pg.on('response', lambda r: asyncio.ensure_future(on_resp(r)))
        pg.on('request', lambda q: raw.__setitem__('comps_requested', True) if q.url.endswith('/api/comps') else None)
        await pg.goto(a.base + '/', wait_until='load'); await pg.wait_for_timeout(2500)
        await pg.click('text=SKIP'); await pg.wait_for_timeout(800)
        await pg.click('text=Appraise an Antique'); await pg.wait_for_timeout(800)
        imgs = photos(lot) if a.mode == 'photos' else []
        if imgs:
            await pg.set_input_files('input[type=file]', imgs); await pg.wait_for_timeout(1500)
            await pg.click('text=Add more details'); await pg.wait_for_timeout(800)
        else:
            await pg.click('text=Add Details (Optional)'); await pg.wait_for_timeout(800)
        if a.mode == 'url':
            await pg.fill('input[placeholder^="https://www.drouot.com"]', lot['url'])
        else:
            await pg.fill('textarea', lot['text'])
        for s in await pg.query_selector_all('select'):
            opts = await s.evaluate('e=>[...e.options].map(o=>o.value)')
            if 'furniture' in opts: await s.select_option(lot['category'])
            elif 'Auction' in opts: await s.select_option('Auction')
        await pg.wait_for_timeout(300)
        inputs = await pg.query_selector_all('input:not([type=file])')
        for i in inputs:
            ph = (await i.get_attribute('placeholder')) or ''
            if ph == '25' and a.mode != 'url': await i.fill(str(lot['premium_pct']))
        if a.mode != 'url':
            locs = [i for i in inputs if ((await i.get_attribute('placeholder')) or '').lower().find('http') < 0 and (await i.get_attribute('placeholder')) not in ('25', 'e.g. 1 500')]
            if locs: await locs[0].fill(lot['location'])
        os.makedirs(a.out, exist_ok=True)
        await pg.screenshot(path=f'{a.out}/{a.tag}_{lot["lot_id"]}_form.png', full_page=True)
        t0 = time.time()
        await pg.click('button[type=submit]')
        for _ in range(150):
            await pg.wait_for_timeout(1000)
            if ('body' in raw or 'err' in raw) and (not raw.get('comps_requested') or 'comps' in raw):
                await pg.wait_for_timeout(3000); break
        el = time.time() - t0
        txt = await pg.inner_text('body')
        await pg.screenshot(path=f'{a.out}/{a.tag}_{lot["lot_id"]}_result.png', full_page=True)
        await b.close()
        return {'lot_id': lot['lot_id'], 'tag': a.tag, 'mode': a.mode, 'base': a.base, 'images': len(imgs), 'elapsed_s': round(el, 1), 'raw': raw, 'page_text': txt}

async def main():
    ids = a.ids or [l['lot_id'] for l in LOTS if not a.split or l['split'] == a.split]
    for i in ids:
        out = f'{a.out}/{a.tag}_{i}.json'
        if os.path.exists(out): continue
        try: r = await run(L[i])
        except Exception as e: r = {'lot_id': i, 'tag': a.tag, 'error': repr(e)[:500]}
        os.makedirs(a.out, exist_ok=True)
        json.dump(r, open(out, 'w'), ensure_ascii=False, indent=1)
        print(i, r.get('elapsed_s'), r.get('error', '')[:200], 'raw' in r and list(r['raw'].keys()), flush=True)
asyncio.run(main())
