// Firestore security rules tests. Run with `npm run test:rules` (starts the Firestore emulator; needs Java 11+).
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";

const ALICE = "alice", BOB = "bob";
const user = (uid: string, role = "user") => ({ uid, email: `${uid}@example.com`, displayName: uid, role });

let env: RulesTestEnvironment;
let passed = 0;
async function t(name: string, fn: () => Promise<unknown>) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "users", ALICE), user(ALICE));
    await setDoc(doc(c.firestore(), "users", BOB), user(BOB));
  });
  await fn();
  passed++;
  console.log(`ok - ${name}`);
}

async function main() {
  env = await initializeTestEnvironment({
    projectId: "demo-antiquehunter",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 },
  });
  const as = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();

  await t("user cannot update another user's doc", () =>
    assertFails(updateDoc(doc(as(ALICE), "users", BOB), { displayName: "pwned" })));
  await t("user cannot overwrite another user's doc even with own uid field", () =>
    assertFails(setDoc(doc(as(ALICE), "users", BOB), user(ALICE))));
  await t("user cannot create a doc at another user's path", async () => {
    await env.withSecurityRulesDisabled((c) => import("firebase/firestore").then(({ deleteDoc }) => deleteDoc(doc(c.firestore(), "users", BOB))));
    await assertFails(setDoc(doc(as(ALICE), "users", BOB), user(ALICE)));
  });
  await t("signed-out user cannot write a user doc", () =>
    assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), "users", ALICE), user(ALICE))));
  await t("user can update own doc", () =>
    assertSucceeds(updateDoc(doc(as(ALICE), "users", ALICE), { displayName: "Alice B" })));
  await t("user can create own doc", async () => {
    await env.withSecurityRulesDisabled((c) => import("firebase/firestore").then(({ deleteDoc }) => deleteDoc(doc(c.firestore(), "users", ALICE))));
    await assertSucceeds(setDoc(doc(as(ALICE), "users", ALICE), user(ALICE)));
  });
  await t("user cannot elevate own role to admin (update)", () =>
    assertFails(updateDoc(doc(as(ALICE), "users", ALICE), { role: "admin" })));
  await t("user cannot create own doc with admin role", async () => {
    await env.withSecurityRulesDisabled((c) => import("firebase/firestore").then(({ deleteDoc }) => deleteDoc(doc(c.firestore(), "users", ALICE))));
    await assertFails(setDoc(doc(as(ALICE), "users", ALICE), user(ALICE, "admin")));
  });

  await env.cleanup();
  console.log(`\n${passed} rules tests passed`);
}
main().catch(async (e) => { console.error(e); await env?.cleanup(); process.exit(1); });
