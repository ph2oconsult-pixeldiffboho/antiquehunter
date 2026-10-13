// Unit tests for src/services/apiGuard.ts (no network, fake verifier). Run: npm run test:api-guard
import assert from "node:assert/strict";
import { withApiGuard, memoryStore, type Verifier } from "../src/services/apiGuard.ts";

const verifier: Verifier = {
  async verifyIdToken(t) { if (t === "good") return { uid: "u1" }; throw new Error("bad"); },
  async verifyAppCheck(t) { if (t === "ac-good") return { appId: "a" }; throw new Error("bad"); },
};
function mockRes() {
  const r: any = { statusCode: 200, headers: {} as Record<string, string>, body: null };
  r.setHeader = (k: string, v: string) => { r.headers[k] = v; };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  return r;
}
const req = (headers: Record<string, string> = {}, ip = "1.2.3.4") => ({ method: "POST", body: {}, headers: { "x-forwarded-for": ip, ...headers } });
const ok = (_q: any, res: any) => res.status(200).json({ ok: true, uid: _q.authUid });
let n = 0;
async function t(name: string, env: Record<string, string>, fn: () => Promise<void>) {
  const saved = { ...process.env };
  delete process.env.REQUIRE_API_AUTH; delete process.env.REQUIRE_APP_CHECK;
  Object.assign(process.env, env);
  try { await fn(); } finally { process.env = saved; }
  n++; console.log(`ok - ${name}`);
}
const g = (opts: any = {}, v: Verifier | null = verifier) => withApiGuard(ok, { route: "t", limit: 3, ...opts }, { verifier: async () => v, store: memoryStore() });

await t("flags off: signed-out request allowed", {}, async () => { const r = mockRes(); await g()(req(), r); assert.equal(r.statusCode, 200); assert.equal(r.body.uid, null); });
await t("flags off: valid token identifies user", {}, async () => { const r = mockRes(); await g()(req({ authorization: "Bearer good" }), r); assert.equal(r.body.uid, "u1"); });
await t("flags off: invalid token treated as anonymous", {}, async () => { const r = mockRes(); await g()(req({ authorization: "Bearer bad" }), r); assert.equal(r.statusCode, 200); });
await t("flags off, admin not configured: still works", {}, async () => { const r = mockRes(); await g({}, null)(req(), r); assert.equal(r.statusCode, 200); });
await t("REQUIRE_API_AUTH: missing token -> 401", { REQUIRE_API_AUTH: "true" }, async () => { const r = mockRes(); await g()(req(), r); assert.equal(r.statusCode, 401); });
await t("REQUIRE_API_AUTH: invalid token -> 401", { REQUIRE_API_AUTH: "true" }, async () => { const r = mockRes(); await g()(req({ authorization: "Bearer bad" }), r); assert.equal(r.statusCode, 401); });
await t("REQUIRE_API_AUTH: valid token -> 200", { REQUIRE_API_AUTH: "true" }, async () => { const r = mockRes(); await g()(req({ authorization: "Bearer good" }), r); assert.equal(r.statusCode, 200); });
await t("REQUIRE_API_AUTH without Admin SDK -> 503 (fail closed)", { REQUIRE_API_AUTH: "true" }, async () => { const r = mockRes(); await g({}, null)(req({ authorization: "Bearer good" }), r); assert.equal(r.statusCode, 503); });
await t("REQUIRE_APP_CHECK: missing -> 401, invalid -> 401, valid -> 200", { REQUIRE_APP_CHECK: "1" }, async () => {
  const h = g();
  let r = mockRes(); await h(req(), r); assert.equal(r.statusCode, 401);
  r = mockRes(); await h(req({ "x-firebase-appcheck": "nope" }), r); assert.equal(r.statusCode, 401);
  r = mockRes(); await h(req({ "x-firebase-appcheck": "ac-good" }), r); assert.equal(r.statusCode, 200);
});
await t("rate limit per IP: 4th request in window -> 429 with Retry-After", {}, async () => {
  const h = g();
  for (let i = 0; i < 3; i++) { const r = mockRes(); await h(req(), r); assert.equal(r.statusCode, 200); }
  const r = mockRes(); await h(req(), r); assert.equal(r.statusCode, 429); assert.equal(r.headers["Retry-After"], "60");
  const other = mockRes(); await h(req({}, "5.6.7.8"), other); assert.equal(other.statusCode, 200, "other IP unaffected");
});
await t("rate limit keyed by uid when signed in (not shared IP)", {}, async () => {
  const h = g();
  for (let i = 0; i < 3; i++) await h(req(), mockRes());
  const r = mockRes(); await h(req({ authorization: "Bearer good" }), r); assert.equal(r.statusCode, 200);
});
await t("rate store failure fails open", {}, async () => {
  const h = withApiGuard(ok, { route: "t", limit: 1 }, { verifier: async () => verifier, store: { hit: async () => { throw new Error("down"); } } });
  const r = mockRes(); await h(req(), r); assert.equal(r.statusCode, 200);
});
console.log(`\n${n} api guard tests passed`);
