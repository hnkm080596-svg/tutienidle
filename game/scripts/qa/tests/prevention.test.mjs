// Prevention-upgrade attack suite (pack sec.12): the mechanical PU cases.
// Labels map each assertion to its PU id; cases needing a live second agent or
// human adjudication are documented in qualification.md as SOURCE/PLANNED.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { newLedger, objectHash, fileHashHex } from "../state.mjs";
import {
  routeLessons, draftBrief, preflightBrief, checkpointBrief,
  admitAssignment, observeAssignment, applyLearningAction,
  publishPolicy, loadActivePolicy, migrateLedgerV1toV2,
} from "../prevention.mjs";
import { validateStructure, validateSemantics } from "../validate.mjs";
import { tmpDir, makeRunDir } from "./helpers.mjs";

const mkLesson = (over = {}) => ({
  id: "L-TEST", version: 1, supersedes: null, triggerType: "ESCAPE",
  findingIds: [], incidentEvidenceIds: [], originatingRun: "r0",
  rootClass: "x", missedInvariantIds: [], escapeReason: "x",
  applicability: ["src/save/**"], exclusions: ["src/legacy/**"],
  proposedProtection: [], promotionEvidenceIds: [], qualifiedBy: [],
  capabilityDelta: "x", status: "CAPTURED", policyVersion: null,
  effectiveFromRun: null, recurrenceFindingIds: [], preventionEvidenceIds: [],
  guidance: null,
  ...over,
});

const mkFacet = (root, over = {}) => ({
  guidanceRevision: 1, kind: "RECIPE",
  authorityRefs: [{ id: "a1", path: "docs/x.md", revision: "v1" }],
  sourceDependencies: [{ id: "d1", path: "dep.txt", revision: `sha256:${fileHashHex(path.join(root, "dep.txt"))}` }],
  applicability: ["src/save/**"], exclusions: ["src/legacy/**"],
  ownerRoute: ["SaveOwner"], preconditions: ["p"], steps: ["s"], failureAndInverse: ["f"],
  firstProof: { oracle: "o", stage: "BEFORE_WRITE", admittedSlice: "s", evidenceIds: [] },
  detectorRefs: ["PER-03"],
  originAnalysis: { category: "NOT_RETRIEVED", incidentEvidenceIds: [], uncertainty: "" },
  status: "QUALIFIED", qualificationEvidence: ["ev1"], qualifiedBy: ["rev1"],
  adoptionEvidence: [], causalPrevention: "NOT_ESTABLISHED",
  policyRef: null, supersedes: null, limits: [],
  ...over,
});

test("routing: APPLY on match+fresh, NOT_APPLICABLE on exclusion/miss, STALE on drift, NEEDS_DISCOVERY for candidate (PU-01..05)", () => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, "dep.txt"), "v1");
  const good = mkLesson({ guidance: mkFacet(root) });
  const cand = mkLesson({ id: "L-CAND", guidance: mkFacet(root, { status: "CANDIDATE", qualificationEvidence: [], qualifiedBy: [] }) });
  const r = routeLessons({ applicabilityKeys: ["src/save/**"] }, [good, cand], { productRoot: root });
  assert.equal(r[0].decision, "APPLY");
  assert.equal(r[1].decision, "NEEDS_DISCOVERY"); // candidate informs discovery, never auto-applies
  const excl = routeLessons({ applicabilityKeys: ["src/legacy/**"] }, [good], { productRoot: root });
  assert.equal(excl[0].decision, "NOT_APPLICABLE");
  const miss = routeLessons({ applicabilityKeys: ["src/combat/**"] }, [good], { productRoot: root });
  assert.equal(miss[0].decision, "NOT_APPLICABLE");
  fs.writeFileSync(path.join(root, "dep.txt"), "drifted");
  const stale = routeLessons({ applicabilityKeys: ["src/save/**"] }, [good], { productRoot: root });
  assert.equal(stale[0].decision, "STALE");
});

test("preflight: unresolved assumptions + unmet deps block READY; resolved brief declares ready (PU-08, PU-24 basis)", () => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, "dep.txt"), "v1");
  const brief = draftBrief({ taskId: "T", unresolvedAssumptions: ["who owns X?"] }, [], {
    policyHash: objectHash("p"), planningBaseline: { productStateId: "s1", contractId: "c1", attackModelId: "a1", environmentId: "e1" },
  });
  brief.firstProofObligations = [{ oracle: "o", stage: "BEFORE_WRITE", admittedSlice: "s", evidenceIds: [] }];
  let res = preflightBrief(brief, { productRoot: root });
  assert.equal(res.readiness, "BLOCKED");
  brief.unresolvedAssumptions = [];
  brief.sourceDependencyHashes = [{ id: "d1", path: "dep.txt", revision: `sha256:${fileHashHex(path.join(root, "dep.txt"))}` }];
  res = preflightBrief(brief, { productRoot: root });
  assert.equal(res.readiness, "READY_TO_DECLARE");
});

test("checkpoint: state drift invalidates affected items, marks brief STALE (PU-13)", () => {
  const brief = draftBrief({ taskId: "T" }, [], {
    policyHash: "h", planningBaseline: { productStateId: "s1", contractId: "c1", attackModelId: "a1", environmentId: "e1" },
  });
  const res = checkpointBrief(brief, {
    observedState: { productStateId: "s2", contractId: "c1", attackModelId: "a1", environmentId: "e1" },
    reason: "mid-task drift",
  });
  assert.equal(res.brief.revision, 2);
  assert.equal(res.brief.readiness, "STALE");
  assert.ok(res.invalidated[0].includes("productStateId"));
});

test("capacity: admission reserves, overflow queues without holding, release requires lifecycle proof (PU-15,16,17)", () => {
  const ledger = newLedger({ runId: "r1", capacityLimit: 2 });
  const mk = (id) => ({ id, parentId: null, capacityScope: "worker", inputBundleHash: "h".padEnd(64, "0"),
    dependencies: [], requiredCapabilities: [], writeSurface: [], readiness: "READY",
    status: "QUEUED", reservedAt: null, observedRuntimeId: null, releaseEvidence: null,
    resultRef: null, timeoutState: null, history: [] });
  const a1 = admitAssignment(ledger, mk("w1"));
  const a2 = admitAssignment(ledger, mk("w2"));
  assert.ok(a1.admitted && a2.admitted);
  ledger.assignments.push(a1.record, a2.record);
  const a3 = admitAssignment(ledger, mk("w3"), { externalOccupied: 0 });
  assert.equal(a3.record.status, "QUEUED"); // capacity full - queued, no slot
  const a4 = admitAssignment(ledger, mk("w4"), { externalOccupied: 1 });
  assert.equal(a4.record.status, "QUEUED"); // unmanaged session counts too (PU-17)
  // result message is NOT a release
  const w1 = ledger.assignments[0];
  observeAssignment(ledger, "w1", { observedStatus: "result" });
  assert.equal(w1.status, "RESULT_RECEIVED");
  // timeout alone cannot release (PU-16)
  observeAssignment(ledger, "w1", { observedStatus: "timeout" });
  assert.equal(w1.status, "RELEASE_PENDING");
  const active = ledger.assignments.filter((a) => ["RESERVED", "RUNNING", "RESULT_RECEIVED", "RELEASE_PENDING"].includes(a.status));
  assert.equal(active.length, 2); // slot still held pending proof
  observeAssignment(ledger, "w1", { observedStatus: "terminated", evidence: "runtime reports exited" });
  assert.equal(w1.status, "FINISHED");
  assert.ok(w1.releaseEvidence);
});

test("learning facet: qualify guards, no self-approval, publish atomic (PU-21,23,27,28)", () => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, "dep.txt"), "v1");
  const lesson = mkLesson({ guidance: mkFacet(root, { status: "CANDIDATE" }) });
  // self-approval rejected (PU-23)
  assert.equal(applyLearningAction(lesson, { type: "qualify" }, { actor: "rev1" }).ok, false);
  assert.ok(applyLearningAction(lesson, { type: "qualify" }, { actor: "other" }).ok);
  assert.equal(lesson.guidance.status, "QUALIFIED");
  // publish writes policies/<hash>.json + active index, no self-hash (PU-27)
  const pdir = path.join(root, "policies"); const act = path.join(root, "active-policy.json");
  const bad = publishPolicy(pdir, act, { policyHash: "x", lessons: {} });
  assert.equal(bad.ok, false);
  const ok = publishPolicy(pdir, act, { lessons: { "L-TEST@1": lesson.guidance } });
  assert.ok(ok.ok);
  assert.ok(fs.existsSync(path.join(pdir, `${ok.policyHash}.json`)));
  const loaded = loadActivePolicy(act, pdir);
  assert.equal(loaded.policyHash, ok.policyHash);
  // torn publication detected, not silently accepted (PU-28)
  fs.unlinkSync(path.join(pdir, `${ok.policyHash}.json`));
  assert.throws(() => loadActivePolicy(act, pdir), /torn publication/);
});

const h64 = (c) => c.repeat(64);
function mkV1Ledger(over = {}) {
  const l = newLedger({
    runId: "old", checkout: "/x", branch: "b", base: "a".repeat(7), head: "b".repeat(7),
  });
  l.run.state = { productStateId: h64("1"), contractId: h64("2"), attackModelId: h64("3"), environmentId: h64("4") };
  l.schemaVersion = 1; delete l.briefs; delete l.assignments; delete l.consumptions;
  delete l.run.briefIds; delete l.run.capacityLimit; delete l.run.requiredReadiness;
  return Object.assign(l, over);
}

test("migration: v1 ledger -> v2 explicit, lessons keep CAPTURED + no fabricated evidence", () => {
  const v1 = mkV1Ledger();
  v1.lessons.push(mkLesson({ id: "L-001" }));
  const { ledger, notes } = migrateLedgerV1toV2(v1);
  assert.equal(ledger.schemaVersion, 2);
  assert.equal(ledger.run.requiredReadiness, false);
  assert.equal(ledger.lessons[0].guidance, null);
  assert.ok(notes.length >= 4);
  assert.equal(validateStructure(ledger).length, 0);
});

test("v1 schema still validates a v1 ledger (replay guarantee)", () => {
  assert.equal(validateStructure(mkV1Ledger()).length, 0);
});

test("v2 ledger validates; MC14 catches bad refs (PU-24 linkage)", () => {
  makeRunDir("prevention");
  const ledger = newLedger({ runId: "prevention", checkout: "/x", branch: "b", base: "a".repeat(7), head: "b".repeat(7) });
  ledger.run.state = { productStateId: h64("1"), contractId: h64("2"), attackModelId: h64("3"), environmentId: h64("4") };
  ledger.run.briefIds = ["BRIEF-T"];
  ledger.briefs.push(draftBrief({ taskId: "T" }, [], { policyHash: h64("9"), planningBaseline: { productStateId: h64("5"), contractId: h64("6"), attackModelId: h64("7"), environmentId: h64("8") } }));
  ledger.briefs[0].id = "BRIEF-T";
  ledger.briefs[0].readiness = "IMPLEMENTATION_READY";
  ledger.briefs[0].unresolvedAssumptions = ["oops"];
  const structural = validateStructure(ledger);
  assert.equal(structural.length, 0, JSON.stringify(structural));
  const sem = validateSemantics(ledger);
  assert.ok(sem.some((x) => x.check === "MC14" && /unresolvedAssumptions/.test(x.reason)));
});
