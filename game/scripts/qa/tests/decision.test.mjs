// Decision law + end-to-end CLI. Covers outcome mapping + QF-30/32 acceptance shape.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { evaluateTerminal, decide } from "../decision.mjs";
import { acquireLease } from "../state.mjs";
import { makeRunDir, mkHappyLedger, mkFinding, mkEvidence, GAME_ROOT } from "./helpers.mjs";

const CLI = path.join(GAME_ROOT, "scripts", "qa", "cli.mjs");
const run = (args, opts = {}) => execFileSync("node", [CLI, ...args], { encoding: "utf8", ...opts });

function happy() {
  const { dir, product } = makeRunDir();
  const { ledger, state } = mkHappyLedger(dir, product);
  fs.writeFileSync(path.join(dir, "ledger.json"), JSON.stringify(ledger, null, 2));
  fs.writeFileSync(path.join(dir, "request.json"), JSON.stringify({
    runId: ledger.run.id, productRoot: product, contractPaths: ["docs/rules.md", "package.json"],
  }));
  acquireLease(dir, "test-coord");
  return { ledger, state, dir, product };
}

test("happy ledger decides QA_FIXED_POINT_REACHED", () => {
  const { ledger } = happy();
  const r = evaluateTerminal(ledger);
  assert.deepEqual(r.filter((c) => !c.ok), [], JSON.stringify(r.filter((c) => !c.ok)));
  const d = decide(ledger);
  assert.equal(d.outcome, "QA_FIXED_POINT_REACHED");
});

test("QF-06/09: open actionable finding -> QA_FINDINGS_OPEN regardless of green suite", () => {
  const { ledger } = happy();
  ledger.findings.push(mkFinding("F-OPEN", ledger.run.state, { severity: "Low", status: "PROVEN", repair: null, pinEvidenceIds: [], verificationEvidenceIds: [], closureReviewIds: [] }));
  const d = decide(ledger);
  assert.equal(d.outcome, "QA_FINDINGS_OPEN");
});

test("open finding outside authorized scope -> QA_BLOCKED_SCOPE", () => {
  const { ledger } = happy();
  ledger.run.authorizedRepairs = ["src/inventory.mjs"];
  ledger.findings.push(mkFinding("F-OOS", ledger.run.state, { status: "PROVEN", repair: null, pinEvidenceIds: [], verificationEvidenceIds: [], closureReviewIds: [], locations: [{ path: "docs/rules.md", symbolOrSection: null, revision: "x", basis: "SOURCE" }] }));
  const d = decide(ledger);
  assert.equal(d.outcome, "QA_BLOCKED_SCOPE");
  assert.ok(/scope/i.test(d.detail), d.detail);
});

test("human-exceptioned findings -> QA_ACCEPTED_WITH_EXCEPTIONS", () => {
  const { ledger } = happy();
  ledger.findings.push(mkFinding("F-EX", ledger.run.state, {
    status: "HUMAN_EXCEPTION", repair: null, pinEvidenceIds: [], verificationEvidenceIds: [], closureReviewIds: [],
    exception: { scope: "src/", reason: "accepted", decidedBy: "human", instructionRef: "msg:1" },
  }));
  const d = decide(ledger);
  assert.equal(d.outcome, "QA_ACCEPTED_WITH_EXCEPTIONS");
});

test("QF-30: terminal clauses fail on broken final matrix -> no fixed point", () => {
  const { ledger } = happy();
  ledger.evidence.find((e) => e.id === "EV-FINAL").result = "FAIL";
  const r = evaluateTerminal(ledger);
  assert.ok(r.some((c) => c.id === "C4-final-gates" && !c.ok), JSON.stringify(r));
  const d = decide(ledger);
  assert.notEqual(d.outcome, "QA_FIXED_POINT_REACHED");
  assert.equal(d.outcome, "QA_UNVERIFIED");
});

test("QF-08: clean rounds cleared on state change -> UNVERIFIED", () => {
  const { ledger } = happy();
  ledger.run.cleanRoundA = null; ledger.run.cleanRoundB = null;
  const d = decide(ledger);
  assert.equal(d.outcome, "QA_UNVERIFIED");
});

test("CLI end-to-end: init -> snapshot -> record -> validate -> decide -> render", () => {
  const { ledger, dir, product } = happy();

  const v = run(["validate", "--run", dir]);
  assert.match(v, /validate: clean/, v);
  const d = run(["decide", "--run", dir]);
  assert.match(d, /QA_FIXED_POINT_REACHED/, d);
  const rep = run(["render", "--run", dir]);
  assert.ok(fs.existsSync(path.join(dir, "report.md")));
  const body = fs.readFileSync(path.join(dir, "report.md"), "utf8");
  assert.match(body, /QA_FIXED_POINT_REACHED/);
});

test("CLI validate --state detects product drift and refuses", () => {
  const { ledger, dir, product } = happy();
  fs.writeFileSync(path.join(product, "src", "drift.mjs"), "export const drift = 1;\n");
  let threw = false;
  try { run(["validate", "--run", dir, "--state"]); } catch { threw = true; }
  assert.ok(threw, "validate --state must fail when product drifted");
});

test("record dedupes persisted ledger entries by id (QF-04 shape)", () => {
  const { dir, product } = makeRunDir();
  const { ledger } = mkHappyLedger(dir, product);
  fs.writeFileSync(path.join(dir, "ledger.json"), JSON.stringify(ledger, null, 2));
  acquireLease(dir, "test");
  const ev = mkEvidence("EV-DUP", ledger.run.state);
  const evPath = path.join(dir, "ev-dup.json");
  fs.writeFileSync(evPath, JSON.stringify({ kind: "evidence", body: ev }));
  const out1 = run(["record", "--run", dir, "--input", evPath]);
  assert.match(out1, /evidence:EV-DUP/);
  const out2 = run(["record", "--run", dir, "--input", evPath]);
  assert.match(out2, /updated|duplicate/);
});
