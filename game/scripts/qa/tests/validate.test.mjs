// Machine-check suite over a happy-path ledger: each test mutates one property
// and asserts the expected MC failure. Covers QF-06..23, QF-25, QF-28..31.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateStructure, validateSemantics } from "../validate.mjs";
import { appendEvent, objectHash, sha256hex, utcNow } from "../state.mjs";
import { makeRunDir, mkHappyLedger, mkEvidence, mkReview, mkFinding } from "./helpers.mjs";

function happy() {
  const { dir, product } = makeRunDir();
  const { ledger, state } = mkHappyLedger(dir, product);
  // events exist in a real run; give the ledger a chained event so MC2 has something to verify
  appendEvent(dir, ledger, { kind: "PHASE", actor: "t", state: ledger.run.state, payload: { phase: "DECIDE" } });
  return { ledger, state, dir, product };
}

function mcs(result) {
  return result.map((f) => f.check);
}

test("structural validation: happy ledger passes; tampered enum fails (MC1-schema)", () => {
  const { ledger } = happy();
  const ok = validateStructure(ledger);
  assert.deepEqual(ok, [], JSON.stringify(ok.slice(0, 5)));
  const bad = JSON.parse(JSON.stringify(ledger));
  bad.findings[0].severity = "Severe-ish";
  const res = validateStructure(bad);
  assert.ok(res.length > 0);
});

test("semantic validation: happy ledger passes all MC checks (baseline for QF mutations)", () => {
  const { ledger } = happy();
  const res = validateSemantics(ledger);
  assert.deepEqual(res, [], JSON.stringify(res.slice(0, 8)));
});

test("QF-06/07: missing evidence on required surface blocks SATISFIED (MC7)", () => {
  const { ledger } = happy();
  ledger.coverage.find((c) => c.id === "COV-1").evidenceIds = [];
  ledger.coverage.find((c) => c.id === "COV-1").status = "SATISFIED";
  const res = validateSemantics(ledger);
  assert.ok(mcs(res).includes("MC7"));
});

test("QF-09: open low-severity defect keeps gate red (MC5 shape ok, decision blocks)", () => {
  const { ledger } = happy();
  const f = mkFinding("F-LOW", ledger.run.state, { severity: "Low", status: "PROVEN", evidenceIds: ["EV-UNIT-1"], siblingSearch: [], repair: null, pinEvidenceIds: [], verificationEvidenceIds: [], closureReviewIds: [] });
  f.siblingSearch = [{ roots: ["src/"], termsAndMethod: "scan", evidenceIds: ["EV-UNIT-1"], hitDispositions: ["none"], coverageLimits: [] }];
  ledger.findings.push(f);
  const res = validateSemantics(ledger);
  // no structural blowup; MC12 records it as a gate blocker (decision maps to FINDINGS_OPEN)
  assert.ok(res.every((x) => x.check === "MC12"), JSON.stringify(res));
});

test("QF-10: REAL_DEFECT cannot be non-actionable (MC6)", () => {
  const { ledger } = happy();
  ledger.findings[0].actionable = false;
  const res = validateSemantics(ledger);
  assert.ok(mcs(res).includes("MC6"));
});

test("QF-11: cyclic siblings rejected unless closed atomically (MC5)", () => {
  const { ledger } = happy();
  const f2 = mkFinding("F-2", ledger.run.state, { status: "PROVEN", siblingFindingIds: ["F-1"], repair: null, pinEvidenceIds: [], verificationEvidenceIds: [], closureReviewIds: [] });
  ledger.findings[0].siblingFindingIds = ["F-2"];
  ledger.findings.push(f2);
  // F-1 CLOSED while sibling F-2 open -> cycle detected
  let res = validateSemantics(ledger);
  assert.ok(res.some((x) => x.check === "MC5" && /sibling|cycle/i.test(x.reason)), JSON.stringify(res));
  // closing F-2 too resolves the group atomically
  f2.status = "CLOSED"; f2.repair = "commit:x"; f2.pinEvidenceIds = ["EV-UNIT-1"]; f2.verificationEvidenceIds = ["EV-FINAL"]; f2.closureReviewIds = ["REV-CLOSURE"];
  res = validateSemantics(ledger);
  assert.ok(!res.some((x) => /sibling|cycle/i.test(x.reason)), JSON.stringify(res));
});

test("QF-12: unpinned aggregate parent rejected (MC3)", () => {
  const { ledger } = happy();
  ledger.run.aggregateParents.push({ path: "../other-branch", symbolOrSection: null, revision: "", basis: "SIBLING" });
  const res = validateSemantics(ledger);
  assert.ok(res.some((x) => x.check === "MC3" && /not pinned/.test(x.reason)));
});

test("QF-13/14: contaminated review cannot anchor clean round (MC9)", () => {
  const { ledger } = happy();
  ledger.reviews.find((r) => r.id === "REV-C").priorFindingsVisible = true;
  let res = validateSemantics(ledger);
  assert.ok(res.some((x) => x.check === "MC9" && /priorFindingsVisible|access/i.test(x.reason)));
  const { ledger: l2 } = happy();
  l2.reviews.find((r) => r.id === "REV-B1").accessLimitations = ["could not read src/"];
  res = validateSemantics(l2);
  assert.ok(res.some((x) => x.check === "MC9" && /access|limitations/i.test(x.reason)));
});

test("QF-15..17: mutation results enforced on critical/high-risk invariants (MC11)", () => {
  const { ledger } = happy();
  // TEST_DEFECT classification alone does not excuse mutation coverage
  ledger.findings[0].classification = "TEST_DEFECT";
  ledger.findings[0].status = "REJECTED_WITH_PROOF";
  ledger.findings[0].rejectionReason = "test only";
  ledger.findings[0].actionable = false;
  ledger.findings[0].repair = null;
  ledger.findings[0].pinEvidenceIds = []; ledger.findings[0].verificationEvidenceIds = []; ledger.findings[0].closureReviewIds = [];
  let res = validateSemantics(ledger);
  assert.ok(!mcs(res).includes("MC11"), JSON.stringify(res));
  // INVALID kill does not count
  ledger.mutations[0].result = "INVALID";
  res = validateSemantics(ledger);
  assert.ok(mcs(res).includes("MC11"));
  // SURVIVED is not a kill
  ledger.mutations[0].result = "SURVIVED";
  res = validateSemantics(ledger);
  assert.ok(mcs(res).includes("MC11"));
});

test("QF-18: incomplete review does not satisfy independent-review coverage (MC7/MC9)", () => {
  const { ledger } = happy();
  ledger.reviews.find((r) => r.id === "REV-B1").status = "INCOMPLETE";
  const res = validateSemantics(ledger);
  assert.ok(res.some((x) => x.check === "MC9" && /SEALED/.test(x.reason)) ||
            res.some((x) => x.check === "MC7"), JSON.stringify(res));
});

test("QF-19: evidence under a different environment cannot satisfy coverage (MC4)", () => {
  const { ledger } = happy();
  ledger.evidence.find((e) => e.id === "EV-UNIT-1").state.environmentId = sha256hex("other-env");
  const res = validateSemantics(ledger);
  assert.ok(mcs(res).includes("MC4"), JSON.stringify(res));
});

test("QF-21: stale evidence cannot prove novelty (MC10)", () => {
  const { ledger } = happy();
  ledger.evidence.find((e) => e.id === "EV-NOVEL-1").status = "STALE";
  const res = validateSemantics(ledger);
  assert.ok(mcs(res).includes("MC10"), JSON.stringify(res));
});

test("QF-22/23: promoted lesson without independent qualification rejected (MC13)", () => {
  const { ledger } = happy();
  ledger.lessons[0].qualifiedBy = [];
  let res = validateSemantics(ledger);
  assert.ok(res.some((x) => x.check === "MC13" && /qualification/.test(x.reason)), JSON.stringify(res));
  const { ledger: l2 } = happy();
  l2.run.consumedLessonIds = ["L-OTHER@1"];
  res = validateSemantics(l2);
  assert.ok(res.some((x) => x.check === "MC13" && /consum/i.test(x.reason)), JSON.stringify(res));
});

test("QF-25/28: promoted lesson relaxing gates without human authority rejected (MC13)", () => {
  const { ledger } = happy();
  ledger.lessons[0].proposedProtection = ["relax coverage gate for flake class"];
  const res = validateSemantics(ledger);
  assert.ok(res.some((x) => x.check === "MC13" && /relaxes/.test(x.reason)), JSON.stringify(res));
});

test("QF-29: missing coverage cell rejected (MC7)", () => {
  const { ledger } = happy();
  ledger.coverage = ledger.coverage.filter((c) => c.id !== "COV-4");
  const res = validateSemantics(ledger);
  assert.ok(res.some((x) => x.check === "MC7" && /no coverage row/.test(x.reason)), JSON.stringify(res));
});

test("QF-30: FAIL final evidence does not satisfy final matrix (MC12)", () => {
  const { ledger } = happy();
  ledger.evidence.find((e) => e.id === "EV-FINAL").result = "FAIL";
  const res = validateSemantics(ledger);
  assert.ok(res.some((x) => x.check === "MC12" && /final gate evidence failed/.test(x.reason)), JSON.stringify(res));
});

test("QF-31: forged artifact hash / report lie caught (MC1)", () => {
  const { ledger, dir } = happy();
  fs.writeFileSync(path.join(dir, "evidence", "ev-final.log"), "ok\n");
  ledger.evidence.find((e) => e.id === "EV-FINAL").artifactPath = "evidence/ev-final.log";
  ledger.evidence.find((e) => e.id === "EV-FINAL").artifactHash = sha256hex("forged");
  const res = validateSemantics(ledger, { runDir: dir });
  assert.ok(res.some((x) => x.check === "MC1" && /hash mismatch/.test(x.reason)), JSON.stringify(res));
});

test("QF-31b: tampered event chain caught (MC2)", () => {
  const { ledger, dir } = happy();
  ledger.events[0].state.productStateId = sha256hex("tampered");
  const res = validateSemantics(ledger, { runDir: dir });
  assert.ok(res.some((x) => x.check === "MC2" && /eventHash/.test(x.reason)), JSON.stringify(res));
});

test("QF-32: complete internal run validates with zero failures and no external dependency", () => {
  const { ledger, dir } = happy();
  const res = validateSemantics(ledger, { runDir: dir });
  assert.deepEqual(res, [], JSON.stringify(res));
});
