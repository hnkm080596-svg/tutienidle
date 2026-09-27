// CLI-level regression for the counted-oracle contract (F-PU30-04 / QAI-08 /
// L-022): a verdict must be emitted only on a positive, parsed denominator.
// The real qualify command cannot be spawned inside a test worker — a nested
// node --test exits silently with no output — so the parser/verdict helpers
// live in ../qualify.mjs and are unit-tested here on real captured output.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseOrchestratorCounts, qualifyGaps } from "../qualify.mjs";
import fs from "node:fs";
import os from "node:os";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.resolve(TESTS_DIR, "..", "..", "..");
const CLI = path.join(GAME_ROOT, "scripts", "qa", "cli.mjs");

const TAP_GREEN = `ok 1 - a test
# tests 54
# pass 54
# fail 0
# duration_ms 2000`;

const SPEC_24 = `✔ a test (5ms)
ℹ tests 54
ℹ pass 54
ℹ fail 0
ℹ duration_ms 2000`;

test("parser reads TAP counters; spec-reporter output yields no counters (the original defect)", () => {
  assert.deepEqual(parseOrchestratorCounts(TAP_GREEN), { passed: 54, failed: 0 });
  assert.deepEqual(parseOrchestratorCounts(SPEC_24), { passed: 0, failed: null },
    "spec reporter must NOT be mistaken for a passing suite");
});

test("verdict refuses vacuous and failing outcomes, accepts a positive green denominator", () => {
  // the F-PU30-04 shape: reporter drift -> 0 parsed, exit 0 -> must refuse
  assert.ok(qualifyGaps({ passed: 0, failed: 0, exitCode: 0, sentinelOk: true }).gaps.some((g) => /0 tests observed/.test(g)));
  // reporter mismatch/crash at nonzero exit -> treated as failing
  assert.ok(qualifyGaps({ passed: 0, failed: null, exitCode: 1, sentinelOk: true }).gaps.some((g) => /failing/.test(g)));
  assert.ok(qualifyGaps({ passed: 54, failed: 2, exitCode: 1, sentinelOk: true }).gaps.some((g) => /2 failing/.test(g)));
  assert.ok(qualifyGaps({ passed: 54, failed: 0, exitCode: 0, sentinelOk: false }).gaps.some((g) => /sentinel/.test(g)));
  assert.equal(qualifyGaps({ passed: 54, failed: 0, exitCode: 0, sentinelOk: true }).gaps.length, 0);
});

test("the real suite under the TAP reporter produces a positive denominator", { timeout: 120000 }, (t) => {
  if (process.env.QA_QUALIFY_RUN === "1") { t.skip("inside qualify-spawned suite"); return; }
  // Exercises the same invocation cmdQualify uses; proves the reporter emits
  // # pass/# fail counters on THIS node version (guards reporter drift).
  // NODE_TEST_* markers make a nested node --test exit silently — strip them.
  const env = { ...process.env, QA_QUALIFY_RUN: "1" };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_TEST_WORKER_ID;
  const out = execFileSync(process.execPath, ["--test", "--test-reporter", "tap", path.join(TESTS_DIR, "*.test.mjs")], { encoding: "utf8", env });
  const { passed, failed } = parseOrchestratorCounts(out);
  assert.ok(passed > 0, `TAP run produced no positive denominator — reporter drifted again:\n${out.slice(-800)}`);
  assert.equal(failed, 0);
});

test("record write path rejects schema-invalid records before commit (F-PU31-01)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-pu31-"));
  const runId = dir.split(path.sep).join("/");
  fs.writeFileSync(path.join(dir, "request.json"), JSON.stringify({
    runId, productRoot: GAME_ROOT.split(path.sep).join("/"), capacityLimit: 5,
    attackModelPath: "attack-model.json", environmentPath: "environment.json",
    contractPaths: ["package.json"], requiredReadiness: false,
  }));
  fs.writeFileSync(path.join(dir, "attack-model.json"), '{"surfaces":[]}');
  const run = (args) => {
    try { return { code: 0, out: execFileSync(process.execPath, [CLI, ...args], { cwd: GAME_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
    catch (e) { return { code: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") }; }
  };
  assert.equal(run(["init", "--request", path.join(dir, "request.json"), "--lease", "t"]).code, 0);
  // schema-invalid: attack record missing oracle/evidenceIds
  fs.writeFileSync(path.join(dir, "bad.json"), JSON.stringify({ records: [{ kind: "attack", body: { id: "ATK-BAD", invariantIds: [], taxonomyIds: [], challengedAssumption: "x", sequenceOrInput: "x", noveltyReason: "x" } }] }));
  const bad = run(["record", "--run", runId, "--input", path.join(dir, "bad.json"), "--lease", "t"]);
  assert.notEqual(bad.code, 0, `schema-invalid record must be refused:\n${bad.out}`);
  assert.ok(/schema-invalid/.test(bad.out), bad.out);
  // id-keyed attribution bypass: a record WITHOUT an id must also be refused
  // (it would otherwise land permanently uncorrectable and brick decide)
  fs.writeFileSync(path.join(dir, "bad-noid.json"), JSON.stringify({ records: [{ kind: "attack", body: { invariantIds: [], taxonomyIds: [], challengedAssumption: "x", sequenceOrInput: "x", oracle: "o", noveltyReason: "x", evidenceIds: [] } }] }));
  const badNoId = run(["record", "--run", runId, "--input", path.join(dir, "bad-noid.json"), "--lease", "t"]);
  assert.notEqual(badNoId.code, 0, `id-less schema-invalid record must be refused:\n${badNoId.out}`);
  assert.ok(/schema-invalid/.test(badNoId.out), badNoId.out);
  // cross-namespace id collision (F-PU31-02): schema-valid record whose id
  // exists in another namespace (here: the run id itself) bricks MC1
  fs.writeFileSync(path.join(dir, "dupid.json"), JSON.stringify({ records: [{ kind: "attack", body: { id: runId, invariantIds: [], taxonomyIds: [], challengedAssumption: "x", sequenceOrInput: "x", oracle: "o", noveltyReason: "x", evidenceIds: [] } }] }));
  const dupId = run(["record", "--run", runId, "--input", path.join(dir, "dupid.json"), "--lease", "t"]);
  assert.notEqual(dupId.code, 0, `cross-namespace duplicate id must be refused:\n${dupId.out}`);
  assert.ok(/already exists in another namespace/.test(dupId.out), dupId.out);
  // a well-formed record still lands
  fs.writeFileSync(path.join(dir, "good.json"), JSON.stringify({ records: [{ kind: "attack", body: { id: "ATK-OK", invariantIds: [], taxonomyIds: [], challengedAssumption: "x", sequenceOrInput: "x", oracle: "o", noveltyReason: "x", evidenceIds: [] } }] }));
  const good = run(["record", "--run", runId, "--input", path.join(dir, "good.json"), "--lease", "t"]);
  assert.equal(good.code, 0, good.out);
});
