// TEMPORARY diagnostic for the Paris-region (cdg1) test. Fetches a fixed list of
// auction-site URLs (no user-supplied URLs) and reports status codes. Delete before merge.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const POLITE_UA = "AntiqueHunter/1.0 (+https://antiquehunter.vercel.app; personal research tool)";

const TARGETS = [
  { name: "interencheres_search", url: "https://www.interencheres.com/recherche/lots?search=miroir%20napoleon%20III" },
  { name: "interencheres_lot", url: "https://www.interencheres.com/art-decoration/belle-vente-de-lautomne-688096/lot-89014385.html" },
  { name: "asgardgw_item", url: "https://asgardgw.interencheres.com/v2/items/89014385" },
  { name: "drouot_search", url: "https://drouot.com/fr/s?query=miroir%20napoleon%20III" },
  { name: "drouot_lot", url: "https://drouot.com/fr/l/35314556-miroir-de-cheminee-a-encadrement-cintre-en-bois-et-stuc-dore" },
];

async function probe(url: string, ua: string) {
  const t = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": ua, Accept: "text/html,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    const body = await r.text();
    return {
      status: r.status,
      ms: Date.now() - t,
      bytes: body.length,
      server: r.headers.get("server"),
      cfRay: r.headers.get("cf-ray"),
      looksLikeBotWall: /datadome|captcha-delivery|cf-chl|challenge-platform|Just a moment/i.test(body.slice(0, 20000)),
      hasLotMarkup: /lot-\d+\.html|\/(fr|en)\/l\/\d+|"pricing"|application\/ld\+json/.test(body),
    };
  } catch (e: any) {
    return { status: 0, ms: Date.now() - t, error: String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: any, res: any) {
  if (req.query?.k !== "ah-cdg1-probe-7f3k2") {
    return res.status(404).json({ error: "Not found" });
  }
  let egressIp: string | null = null;
  try {
    egressIp = (await (await fetch("https://api.ipify.org?format=json")).json()).ip;
  } catch {}
  const results: Record<string, unknown> = {};
  await Promise.all(
    TARGETS.flatMap((t) => [
      probe(t.url, BROWSER_UA).then((r) => (results[`${t.name}:browser_ua`] = r)),
      probe(t.url, POLITE_UA).then((r) => (results[`${t.name}:polite_ua`] = r)),
    ])
  );
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ region: process.env.VERCEL_REGION || null, egressIp, at: new Date().toISOString(), results });
}
