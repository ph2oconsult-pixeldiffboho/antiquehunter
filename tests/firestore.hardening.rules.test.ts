// Firestore security rules tests (item E: admin custom claim + analysis_feedback). Run with `npm run test:rules`.
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";

let env: RulesTestEnvironment;
let passed = 0;
async function t(name: string, fn: () => Promise<unknown>) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "users", "alice"), { uid: "alice", email: "alice@example.com", role: "user" });
    await setDoc(doc(c.firestore(), "analysis_feedback", "f1"), feedback("anonymous"));
  });
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}
const feedback = (userId: string) => ({
  userId, itemCategory: "commode", predictedPriceRange: { low: 100, high: 400 }, confidenceLevel: "medium",
  confidenceScore: 0.5, userAction: "still_deciding", pricePaid: null, notBoughtReason: null, isHelpful: true, timestamp: Timestamp.now(), itemId: "x",
});

async function main() {
  env = await initializeTestEnvironment({
    projectId: "demo-antiquehunter",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 },
  });
  const ctx = (uid: string, token: Record<string, unknown> = {}) => env.authenticatedContext(uid, token).firestore();

  await t("admin custom claim can read feedback", () =>
    assertSucceeds(getDoc(doc(ctx("root", { admin: true }), "analysis_feedback", "f1"))));
  await t("admin custom claim can read another user's profile", () =>
    assertSucceeds(getDoc(doc(ctx("root", { admin: true }), "users", "alice"))));
  await t("legacy admin email fallback still works", () =>
    assertSucceeds(getDoc(doc(ctx("p", { email: "ph2oconsult@gmail.com", email_verified: true }), "analysis_feedback", "f1"))));
  await t("unverified admin email is not admin", () =>
    assertFails(getDoc(doc(ctx("p", { email: "ph2oconsult@gmail.com", email_verified: false }), "analysis_feedback", "f1"))));
  await t("admin claim set to a non-true value is not admin", () =>
    assertFails(getDoc(doc(ctx("x", { admin: "yes" }), "analysis_feedback", "f1"))));
  await t("normal user cannot read feedback", () =>
    assertFails(getDoc(doc(ctx("alice"), "analysis_feedback", "f1"))));
  await t("anonymous feedback create still allowed", () =>
    assertSucceeds(setDoc(doc(env.unauthenticatedContext().firestore(), "analysis_feedback", "f2"), feedback("anonymous"))));
  await t("anonymous cannot spoof a userId", () =>
    assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), "analysis_feedback", "f3"), feedback("alice"))));
  await t("feedback cannot be updated", () =>
    assertFails(updateDoc(doc(env.unauthenticatedContext().firestore(), "analysis_feedback", "f1"), { isHelpful: false })));

  await env.cleanup();
  console.log(`\n${passed} rules tests passed`);
}
main().catch(async (e) => { console.error(e); await env?.cleanup(); process.exit(1); });
