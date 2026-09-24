// Shared fixtures for QA runner tests. A "happy ledger" factory satisfies
// every terminal clause; tests mutate fields to exercise rejections.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  newLedger, buildManifest, hashFileSet, computeEnvironmentId,
  objectHash, sha256hex,
} from "../state.mjs";

export const T = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_PRODUCT = path.join(T, "fixtures", "product");
export const GAME_ROOT = path.resolve(T, "..", "..", "..");
export const QA_ROOT = path.join(GAME_ROOT, "docs", "qa");

export function tmpDir(prefix = "qa-run-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function makeRunDir({ productFiles = {} } = {}) {
  const root = tmpDir();
  const product = path.join(root, "product");
  fs.cpSync(FIXTURE_PRODUCT, product, { recursive: true });
  for (const [rel, content] of Object.entries(productFiles)) {
    const abs = path.join(product, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  const dir = path.join(root, "run");
  fs.mkdirSync(path.join(dir, "evidence"), { recursive: true });
  fs.mkdirSync(path.join(dir, "reviews"), { recursive: true });
  fs.mkdirSync(path.join(dir, "events"), { recursive: true });
  fs.writeFileSync(path.join(dir, "attack-model.json"), JSON.stringify({
    version: 1, families: ["TRN-atomicity", "ECO-replay", "RUN-lifecycle"],
    invariants: ["I-BAG-CONSERVATION", "I-SETTLE-IDENTITY"],
  }));
  fs.writeFileSync(path.join(dir, "environment.json"), JSON.stringify({
    node: "v22", os: "linux", profile: "test", seeds: { policy: "per-case seeds live in evidence inputs" },
  }));
  return { root, dir, product };
}

export function snapshotState(dir, product) {
  const manifest = buildManifest(product);
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return {
    productStateId: manifest.productStateId,
    contractId: hashFileSet(product, ["docs/rules.md", "package.json"]),
    attackModelId: objectHash(JSON.parse(fs.readFileSync(path.join(dir, "attack-model.json"), "utf8"))),
    environmentId: computeEnvironmentId(path.join(dir, "environment.json")),
  };
}

export function mkEvidence(id, state, over = {}) {
  const artifactPath = `evidence/${id.toLowerCase()}.log`;
  const artifactHash = sha256hex(`log-${id}`);
  return {
    id, state: { ...state }, kind: "EXECUTED_UNIT_STRUCTURAL", producer: "test-harness",
    startedAt: "2026-09-23T10:00:00.000Z", finishedAt: "2026-09-23T10:00:01.000Z",
    commandOrMethod: "node --test fixture", cwd: "game", exitCode: 0, result: "PASS",
    artifactPath, artifactHash, inputPaths: [], inputEvidenceIds: [],
    invariantIds: [], claims: ["fixture claim"], limitations: [], status: "CURRENT",
    ...over,
  };
}

// write artifact files so MC1 path/hash checks pass when runDir is supplied
export function materializeEvidence(dir, ledger) {
  for (const e of ledger.evidence) {
    if (!e.artifactPath) continue;
    const abs = path.join(dir, e.artifactPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const body = `log-${e.id}`;
    fs.writeFileSync(abs, body);
    e.artifactHash = sha256hex(body);
  }
}

export function mkReview(id, state, phase, over = {}) {
  return {
    id, state: { ...state }, round: 1, phase, reviewerId: `rev-${id}`, contextId: `ctx-${id}`,
    model: "swe-2-max", role: phase.toLowerCase(), inputBundleHash: sha256hex(id),
    priorFindingsVisible: false, accessLimitations: [],
    startedAt: "2026-09-23T11:00:00.000Z", sealedAt: "2026-09-23T11:30:00.000Z",
    previousPhaseReviewId: null, reviewedAfterPreviousFixes: true,
    coverageIds: [], evidenceIds: [], findingIds: [], novelAttackIds: [], status: "SEALED",
    ...over,
  };
}

export function mkFinding(id, state, over = {}) {
  return {
    id, title: `finding ${id}`, state: { ...state }, severity: "Medium",
    classification: "REAL_DEFECT", actionable: true, reachability: "PRODUCTION",
    locations: [{ path: "src/inventory.mjs", symbolOrSection: "addItem", revision: "state", basis: "SOURCE" }],
    discoveredBy: "rev-correctness", invariantIds: ["I-BAG-CONSERVATION"], evidenceIds: [],
    counterexample: "cap+1 accepted", expected: "reject without mutation", actual: "mutated",
    rootCause: "missing atomicity", rootClass: "TRN-03", subsystem: "src/inventory.mjs",
    siblingSearch: [{ roots: ["src/"], termsAndMethod: "capacity mutators", evidenceIds: [], hitDispositions: ["1 hit disposed"], coverageLimits: [] }],
    siblingFindingIds: [], repair: "commit:abc1234 context:fixer-1", pinEvidenceIds: [],
    verificationEvidenceIds: [], closureReviewIds: [], status: "CLOSED",
    duplicateOf: null, rejectionReason: null, exception: null, ...over,
  };
}

export function mkHappyLedger(dir, product) {
  const state = snapshotState(dir, product);
  const ledger = newLedger({
    runId: "test-run", checkout: product, branch: "test", base: "main", head: "test",
    authorizedRepairs: ["src/"], nonGoals: [], requiredDomains: ["inventory"],
    environmentPath: "environment.json",
  });
  ledger.run.state = state;
  ledger.run.phase = "DECIDE";

  const inv1 = {
    id: "I-BAG-CONSERVATION", statement: "rejected settle leaves source and bag unchanged",
    domain: "inventory", risk: "HIGH",
    sources: [{ path: "docs/rules.md", symbolOrSection: "capacity", revision: "state", basis: "MAINTAINED_CONTRACT" }],
    owner: { path: "src/inventory.mjs", symbolOrSection: "addItem", revision: "state", basis: "SOURCE" },
    legalWriters: [], legalReaders: [], projections: [], caches: [],
    validStates: [], forbiddenStates: [], preconditions: [], postconditions: [],
    legalTransitions: [], illegalTransitions: ["reject-with-mutation"],
    failureBehavior: "atomic reject", atomicity: "all-or-nothing", inverseBehavior: "n/a",
    persistence: "none", migration: "none", lifecycle: "per-call", runtimeConsequences: [],
    uiConsequences: [], oracles: ["post-state equality"], requiredEvidenceSurfaces: ["DETERMINISTIC", "MUTATION", "INDEPENDENT_REVIEW"],
    taxonomyIds: ["TRN-03"], status: "ACTIVE",
  };
  const inv2 = { ...inv1, id: "I-SETTLE-IDENTITY", risk: "STANDARD", requiredEvidenceSurfaces: ["DETERMINISTIC", "INDEPENDENT_REVIEW"], statement: "settlement identity = runId + item set" };
  ledger.invariants.push(inv1, inv2);

  ledger.census.push({
    id: "CEN-1", invariantIds: ["I-BAG-CONSERVATION"],
    location: { path: "src/inventory.mjs", symbolOrSection: "addItem", revision: "state", basis: "SOURCE" },
    classification: "CANONICAL", reads: [], writes: ["bag.items", "source.stash"],
    eventsIn: [], eventsOut: [], consumerIds: [], searchEvidenceIds: [], disposition: "canonical owner",
  });

  const evFinal = mkEvidence("EV-FINAL", state, { claims: ["final verify"] });
  const evMut = mkEvidence("EV-MUT-1", state, { kind: "EXECUTED_MUTATION", commandOrMethod: "mutate + run" });
  const evRev = mkEvidence("EV-UNIT-1", state, { invariantIds: ["I-BAG-CONSERVATION", "I-SETTLE-IDENTITY"] });
  const evNovel = mkEvidence("EV-NOVEL-1", state, { commandOrMethod: "novel attack exec" });
  ledger.evidence.push(evFinal, evMut, evRev, evNovel);
  ledger.run.finalEvidenceIds = ["EV-FINAL"];

  ledger.coverage.push(
    { id: "COV-1", invariantId: "I-BAG-CONSERVATION", surface: "DETERMINISTIC", attackIds: ["ATK-1"], taxonomyIds: ["TRN-03"], applicability: "REQUIRED", reason: "required surface", evidenceIds: ["EV-UNIT-1"], reviewerIds: ["rev-correctness"], status: "SATISFIED", weakProtection: false },
    { id: "COV-2", invariantId: "I-BAG-CONSERVATION", surface: "MUTATION", attackIds: [], taxonomyIds: ["TRN-03"], applicability: "REQUIRED", reason: "required surface", evidenceIds: ["EV-MUT-1"], reviewerIds: [], status: "SATISFIED", weakProtection: false },
    { id: "COV-3", invariantId: "I-BAG-CONSERVATION", surface: "INDEPENDENT_REVIEW", attackIds: [], taxonomyIds: [], applicability: "REQUIRED", reason: "required surface", evidenceIds: [], reviewerIds: ["rev-a1", "rev-b1"], status: "SATISFIED", weakProtection: false },
    { id: "COV-4", invariantId: "I-SETTLE-IDENTITY", surface: "DETERMINISTIC", attackIds: [], taxonomyIds: [], applicability: "REQUIRED", reason: "required surface", evidenceIds: ["EV-UNIT-1"], reviewerIds: [], status: "SATISFIED", weakProtection: false },
    { id: "COV-5", invariantId: "I-SETTLE-IDENTITY", surface: "INDEPENDENT_REVIEW", attackIds: [], taxonomyIds: [], applicability: "REQUIRED", reason: "required surface", evidenceIds: [], reviewerIds: ["rev-a1"], status: "SATISFIED", weakProtection: false },
  );

  ledger.attacks.push(
    { id: "ATK-1", invariantIds: ["I-BAG-CONSERVATION"], taxonomyIds: ["TRN-03"], challengedAssumption: "reject path commits", sequenceOrInput: "cap+1 then reject", oracle: "state unchanged", noveltyReason: "boundary", evidenceIds: ["EV-UNIT-1"] },
    { id: "ATK-NOVEL", invariantIds: ["I-SETTLE-IDENTITY"], taxonomyIds: [], challengedAssumption: "dedup keys suffice", sequenceOrInput: "same runId different items", oracle: "new settlement delivered", noveltyReason: "identity edge", evidenceIds: ["EV-NOVEL-1"] },
  );

  const rC = mkReview("REV-C", state, "CORRECTNESS", { contextId: "ctx-a-corr" });
  const rA = mkReview("REV-A", state, "AUTHORITY", { contextId: "ctx-a-auth", previousPhaseReviewId: "REV-C" });
  const rI = mkReview("REV-I", state, "INTEGRATION", { contextId: "ctx-a-int", previousPhaseReviewId: "REV-A" });
  const rB1 = mkReview("REV-B1", state, "CORRECTNESS", { contextId: "ctx-b-corr" });
  const rB2 = mkReview("REV-B2", state, "AUTHORITY", { contextId: "ctx-b-auth", previousPhaseReviewId: "REV-B1" });
  const rB3 = mkReview("REV-B3", state, "INTEGRATION", { contextId: "ctx-b-int", previousPhaseReviewId: "REV-B2" });
  const rTerm = mkReview("REV-TERM", state, "TERMINAL_CHECK", { contextId: "ctx-term" });
  const rClosure = mkReview("REV-CLOSURE", state, "CLOSURE", { contextId: "ctx-closure", reviewerId: "rev-closure" });
  ledger.reviews.push(rC, rA, rI, rB1, rB2, rB3, rTerm, rClosure);

  ledger.cycles.push(
    { id: "CYC-A", state: { ...state }, reviewIds: ["REV-C", "REV-A", "REV-I"], coverageIds: ["COV-1"], evidenceIds: ["EV-UNIT-1"], noveltyEvidenceIds: ["EV-NOVEL-1"], startedAt: "2026-09-23T11:00:00.000Z", finishedAt: "2026-09-23T12:00:00.000Z", status: "CLEAN" },
    { id: "CYC-B", state: { ...state }, reviewIds: ["REV-B1", "REV-B2", "REV-B3"], coverageIds: ["COV-1"], evidenceIds: ["EV-UNIT-1"], noveltyEvidenceIds: ["EV-NOVEL-1"], startedAt: "2026-09-23T13:00:00.000Z", finishedAt: "2026-09-23T14:00:00.000Z", status: "CLEAN" },
  );
  ledger.run.cleanRoundA = "CYC-A";
  ledger.run.cleanRoundB = "CYC-B";

  ledger.mutations.push({
    id: "MUT-1", candidateState: { ...state }, invariantIds: ["I-BAG-CONSERVATION"], rootClass: "TRN-03",
    operator: "omit-capacity-check", isolationPath: "evidence/mut-1", mutantHash: sha256hex("mutant"),
    expectedDetector: "EV-MUT-1", result: "KILLED_EXPECTED", evidenceIds: ["EV-MUT-1"],
    equivalenceReason: null, candidateUnchanged: true,
  });

  ledger.corpus.push({
    id: "GB-TEST-1",
    historicalFinding: { path: "docs/qa/learned-defects.md", symbolOrSection: "reject leaked debit", revision: "state", basis: "HISTORICAL" },
    originalRevision: "learned-defects",
    severity: "High", subsystem: "src/inventory.mjs", invariantIds: ["I-BAG-CONSERVATION"],
    rootClass: "TRN-03", counterexample: "cap reject", historicalDetector: "adversarial-qa",
    requiredEvidence: ["rejected no-mutation"], visibility: "TRAINING", replayMode: "ORIGINAL",
    baselineEvidenceIds: [], candidateEvidenceIds: ["EV-UNIT-1"], status: "DETECTED",
  });

  const finding = mkFinding("F-1", state, {
    evidenceIds: ["EV-UNIT-1"], pinEvidenceIds: ["EV-UNIT-1"], verificationEvidenceIds: ["EV-FINAL"],
    closureReviewIds: ["REV-CLOSURE"], repair: "commit:abc1234",
  });
  ledger.findings.push(finding);

  ledger.lessons.push({
    id: "L-TEST", version: 1, supersedes: null, triggerType: "DEFECT",
    findingIds: ["F-1"], incidentEvidenceIds: ["EV-UNIT-1"], originatingRun: "test-run",
    rootClass: "TRN-03", missedInvariantIds: ["I-BAG-CONSERVATION"], escapeReason: "partial-commit",
    applicability: ["reject paths"], exclusions: [],
    proposedProtection: ["atomicity oracle"], promotionEvidenceIds: ["EV-UNIT-1"],
    qualifiedBy: ["REV-TERM"], capabilityDelta: "rejection no-mutation required",
    status: "PROMOTED", policyVersion: objectHash("policy-v1"), effectiveFromRun: "test-run",
    recurrenceFindingIds: [], preventionEvidenceIds: ["EV-UNIT-1"],
    guidance: null,
  });
  ledger.run.consumedLessonIds = ["L-TEST@1"];

  // schema-v2 prevention records: a conforming construction brief makes the
  // happy run satisfy C9-readiness (requiredReadiness defaults true).
  ledger.briefs.push({
    id: "BRIEF-TEST", taskId: "test-task", revision: 1,
    planningBaseline: { ...state }, policyHash: objectHash("policy-v1"),
    requirementRefs: [], invariantIds: ["I-BAG-CONSERVATION"], dependencyRefs: [],
    sourceDependencyHashes: [], expectedChangeSet: ["src/inventory.mjs"],
    lessonRouting: [{ lessonRef: "L-TEST@1", decision: "APPLY", reason: "applicability matched" }],
    slices: ["inventory"],
    firstProofObligations: [{ oracle: "post-state equality", stage: "BEFORE_PROPAGATION", admittedSlice: "inventory", evidenceIds: ["EV-UNIT-1"] }],
    unresolvedAssumptions: [], readiness: "IMPLEMENTATION_READY",
    preflightEvidenceIds: ["EV-UNIT-1"], deviations: [], consumedBy: [], checkpoints: [],
    finalConformanceIds: ["EV-FINAL"],
  });
  ledger.run.briefIds = ["BRIEF-TEST"];

  materializeEvidence(dir, ledger);
  return { ledger, state };
}

export function writeLedger(dir, ledger) {
  fs.writeFileSync(path.join(dir, "ledger.json"), JSON.stringify(ledger, null, 2));
}
