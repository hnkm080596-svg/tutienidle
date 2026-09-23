// Runner state mechanics: manifest identity, CAS journal, lease, messaging, invalidation.
// Maps QF-01..05, QF-08, QF-24, QF-26, QF-27.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildManifest, appendEvent, acquireLease, checkLease, recordMessage,
  newLedger, invalidateForNewState, objectHash, sha256hex, utcNow,
} from "../state.mjs";
import { makeRunDir, snapshotState, mkEvidence, mkHappyLedger } from "./helpers.mjs";

const dummyState = () => ({
  productStateId: sha256hex("p"), contractId: sha256hex("c"),
  attackModelId: sha256hex("a"), environmentId: sha256hex("e"),
});

function mkHappyLedger2() {
  const { dir, product } = makeRunDir();
  const { ledger, state } = mkHappyLedger(dir, product);
  return { ledger, state, dir, product };
}

test("manifest is deterministic and detects hidden untracked source (QF-02)", () => {
  const { product } = makeRunDir();
  const m1 = buildManifest(product);
  const m2 = buildManifest(product);
  assert.equal(m1.productStateId, m2.productStateId, "same tree must hash identically");
  fs.writeFileSync(path.join(product, "src", "sneaky.mjs"), "export const x = 1;\n");
  const m3 = buildManifest(product);
  assert.notEqual(m3.productStateId, m1.productStateId, "untracked file must change productStateId");
  assert.ok(m3.entries.some((e) => e.path === "src/sneaky.mjs"));
});

test("manifest includes governing docs/tests and excludes caches + evidence mailboxes", () => {
  const { product } = makeRunDir({ productFiles: { "docs/qa/runs/x/ledger.json": "{}" } });
  const m = buildManifest(product);
  assert.ok(m.entries.some((e) => e.path === "docs/rules.md"), "docs are product identity");
  assert.ok(m.entries.some((e) => e.path === "package.json"));
  assert.ok(!m.entries.some((e) => e.path.startsWith("docs/qa/runs/")), "evidence mailbox excluded");
});

test("wrong-tree evidence cannot populate current coverage (QF-01)", () => {
  const { ledger, state } = mkHappyLedger2();
  const other = dummyState();
  ledger.evidence.push(mkEvidence("EV-WRONG", other));
  const stale = invalidateForNewState(ledger, other === state ? state : { ...state, productStateId: sha256hex("newp") });
  const wrong = ledger.evidence.find((e) => e.id === "EV-WRONG");
  assert.equal(wrong.status, "STALE");
});

test("event chain is contiguous, hashed, CAS-guarded (QF-26 crash/replay)", () => {
  const { dir } = makeRunDir();
  const ledger = newLedger({ runId: "r1" });
  const s = dummyState();
  const e1 = appendEvent(dir, ledger, { kind: "PHASE", actor: "test", state: s, payload: { p: 1 } });
  const e2 = appendEvent(dir, ledger, { kind: "EVIDENCE", actor: "test", state: s, payload: { p: 2 }, expectedSeq: 2 });
  assert.equal(e1.previousEventHash, null);
  assert.equal(e2.previousEventHash, e1.eventHash);
  assert.throws(() => appendEvent(dir, ledger, { kind: "EVIDENCE", actor: "t", state: s, payload: {}, expectedSeq: 2 }), /CAS reject/);
  // crash + replay: reload journal, phase resumes at seq 2, next append is seq 3
  const journal = fs.readFileSync(path.join(dir, "journal.jsonl"), "utf8").trim().split("\n");
  assert.equal(journal.length, 2);
  const e3 = appendEvent(dir, ledger, { kind: "PHASE", actor: "test", state: s, payload: { resumed: true } });
  assert.equal(e3.seq, 3);
  assert.equal(e3.previousEventHash, e2.eventHash);
});

test("lease is exclusive; second coordinator cannot claim (QF-27)", () => {
  const { dir } = makeRunDir();
  const held = acquireLease(dir, "coord-1");
  assert.equal(held.leaseId, "coord-1");
  assert.throws(() => acquireLease(dir, "coord-2"), /lease already held/);
  assert.throws(() => checkLease(dir, "coord-2"), /lease held by coord-1/);
  assert.equal(checkLease(dir, "coord-1").leaseId, "coord-1");
});

test("message correlation: duplicate idempotent, payload collision rejected (QF-03/04/05)", () => {
  const { ledger } = mkHappyLedger2();
  const base = { id: "M1", runId: ledger.run.id, requestId: "REQ-1", parentRequestId: null, sender: "c", recipient: "r", kind: "ASSIGN", state: ledger.run.state, phase: "CORRECTNESS", bundleHash: sha256hex("b"), payloadPath: "evidence/m1.json", payloadHash: sha256hex("p1"), createdAt: utcNow(), leaseId: "l1" };
  const r1 = recordMessage(ledger, { ...base });
  assert.equal(r1.duplicate, false);
  const r2 = recordMessage(ledger, { ...base });
  assert.equal(r2.duplicate, true, "identical delivery is idempotent");
  assert.equal(ledger.messages.filter((m) => m.id === "M1").length, 1);
  // payload collision
  assert.throws(() => recordMessage(ledger, { ...base, payloadHash: sha256hex("different") }), /integrity error/);
  // valid ACK -> FINDING -> SEALED_RESULT sequence
  const ack = { ...base, id: "M2", kind: "ACK" };
  const find = { ...base, id: "M3", kind: "FINDING", payloadHash: sha256hex("p3") };
  const seal = { ...base, id: "M4", kind: "SEALED_RESULT", payloadHash: sha256hex("p4") };
  for (const m of [ack, find, seal]) assert.equal(recordMessage(ledger, m).duplicate, false);
  // identical terminal replay is idempotent
  assert.equal(recordMessage(ledger, { ...seal }).duplicate, true);
  // conflicting terminal result requires new request
  assert.throws(() => recordMessage(ledger, { ...seal, id: "M5", payloadHash: sha256hex("conflict") }), /conflicting terminal/);
});

test("stale message on old state is flagged, not advanced (QF-03)", () => {
  const { ledger } = mkHappyLedger2();
  const staleMsg = { id: "M9", runId: ledger.run.id, requestId: "REQ-1", parentRequestId: null, sender: "r", recipient: "c", kind: "SEALED_RESULT", state: dummyState(), phase: "CORRECTNESS", bundleHash: sha256hex("b"), payloadPath: "evidence/x.json", payloadHash: sha256hex("x"), createdAt: utcNow(), leaseId: "l1" };
  const res = recordMessage(ledger, staleMsg);
  assert.equal(res.stale, true, "result for earlier state must be flagged stale");
});

test("append-only journal does not change product identity (QF-24)", () => {
  const { product, dir } = makeRunDir({ productFiles: { "docs/qa/learning/history/lessons.jsonl": "" } });
  const before = buildManifest(product).productStateId;
  const histDir = path.join(product, "docs", "qa", "learning", "history");
  fs.mkdirSync(histDir, { recursive: true });
  fs.appendFileSync(path.join(histDir, "lessons.jsonl"), JSON.stringify({ id: "L-1" }) + "\n");
  const after = buildManifest(product).productStateId;
  assert.equal(before, after, "incident journal is excluded from product identity");
});

test("state change invalidates evidence, reviews, cycles transitively (QF-08)", () => {
  const { dir, product } = makeRunDir();
  const { ledger, state } = mkHappyLedger(dir, product);
  ledger.evidence.push(mkEvidence("EV-DEP", state, { inputEvidenceIds: ["EV-FINAL"] }));
  fs.writeFileSync(path.join(product, "src", "inventory.mjs"), "export const changed = true;\n");
  const next = snapshotState(dir, product);
  const stale = invalidateForNewState(ledger, next);
  assert.ok(stale.evidence >= 3, `expected transitively stale evidence, got ${stale.evidence}`);
  assert.equal(ledger.cycles.find((c) => c.id === "CYC-A").status, "STALE");
  assert.equal(ledger.run.cleanRoundA, null);
  assert.equal(ledger.evidence.find((e) => e.id === "EV-DEP").status, "STALE", "dependency on stale is stale");
});
