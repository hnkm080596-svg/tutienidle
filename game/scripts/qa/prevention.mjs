// Prevention machinery (prevention-upgrade 2026-09-24): deterministic lesson
// routing, construction-brief validation, capacity admission, learning-facet
// transitions, atomic policy publication, v1->v2 ledger migration.
// Sole write authority remains the coordinator (lease holder).
import fs from "node:fs";
import path from "node:path";
import { objectHash, fileHashHex, utcNow } from "./state.mjs";

export const ASSIGNMENT_ACTIVE = new Set(["RESERVED", "RUNNING", "RESULT_RECEIVED", "RELEASE_PENDING"]);
export const ASSIGNMENT_STATES = new Set(["QUEUED", "READY", "RESERVED", "RUNNING", "RESULT_RECEIVED", "RELEASE_PENDING", "FINISHED", "BLOCKED", "CANCELLED"]);
export const TERMINAL_OBSERVED = new Set(["terminated", "finished", "exited", "cancelled", "closed"]);

// ---------- lesson index + routing ----------

export function loadLessonsJsonl(historyPath) {
  if (!fs.existsSync(historyPath)) return [];
  return fs.readFileSync(historyPath, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

function refFreshness(ref, productRoot) {
  // A sourceDependency ref is fresh only when its recorded content hash still
  // matches the current file. revision format: "sha256:<hex>" or any text;
  // absence of the file or hash drift => STALE.
  const abs = path.resolve(productRoot, ref.path);
  if (!abs.startsWith(path.resolve(productRoot) + path.sep)) return { fresh: false, reason: `path escapes productRoot: ${ref.path}` };
  if (!fs.existsSync(abs)) return { fresh: false, reason: `dependency missing: ${ref.path}` };
  const m = /^sha256:([0-9a-f]{64})$/.exec(ref.revision ?? "");
  if (!m) return { fresh: false, reason: `no pinned content hash on ${ref.path}` };
  const cur = fileHashHex(abs);
  return cur === m[1] ? { fresh: true } : { fresh: false, reason: `content drift on ${ref.path}` };
}

export function routeLessons({ applicabilityKeys = [] }, lessons, { productRoot } = {}) {
  // Deterministic routing record over lessons' guidance facets.
  // Matches on semantic keys (domain paths, operation/invariant ids); an
  // exclusion match wins over applicability. QUALIFIED facets apply; stale
  // dependencies reject; CANDIDATE facets route as NEEDS_DISCOVERY (untrusted
  // hypothesis only - never auto-applied).
  const keys = new Set(applicabilityKeys);
  const out = [];
  for (const lesson of lessons) {
    const g = lesson.guidance;
    if (!g) continue;
    const ref = `${lesson.id}@${lesson.version}`;
    const excluded = g.exclusions.some((x) => keys.has(x));
    if (excluded) { out.push({ lessonRef: ref, decision: "NOT_APPLICABLE", reason: "exclusion matched" }); continue; }
    const matched = g.applicability.some((x) => keys.has(x));
    if (!matched) { out.push({ lessonRef: ref, decision: "NOT_APPLICABLE", reason: "no semantic trigger matched" }); continue; }
    if (g.status === "QUALIFIED" && productRoot) {
      const stale = g.sourceDependencies.map((r) => refFreshness(r, productRoot)).filter((r) => !r.fresh);
      if (stale.length) { out.push({ lessonRef: ref, decision: "STALE", reason: stale.map((s) => s.reason).join("; ") }); continue; }
    }
    if (g.status === "QUALIFIED") { out.push({ lessonRef: ref, decision: "APPLY", reason: "applicability matched, sources fresh" }); continue; }
    if (g.status === "CANDIDATE") { out.push({ lessonRef: ref, decision: "NEEDS_DISCOVERY", reason: "unqualified candidate - untrusted hypothesis, not a binding recipe" }); continue; }
    out.push({ lessonRef: ref, decision: "NOT_APPLICABLE", reason: `facet status ${g.status} is not consumable` });
  }
  return out;
}

export function draftBrief(task, routing, { policyHash, planningBaseline }) {
  return {
    id: `BRIEF-${task.taskId}`, taskId: task.taskId, revision: 1,
    planningBaseline, policyHash,
    requirementRefs: task.requirementRefs ?? [],
    invariantIds: task.invariantIds ?? [],
    dependencyRefs: task.dependencyRefs ?? [],
    sourceDependencyHashes: task.sourceDependencyHashes ?? [],
    expectedChangeSet: task.expectedChangeSet ?? [],
    lessonRouting: routing,
    slices: task.slices ?? [],
    firstProofObligations: task.firstProofObligations ?? [],
    unresolvedAssumptions: task.unresolvedAssumptions ?? [],
    readiness: "DRAFT",
    preflightEvidenceIds: [], deviations: [], consumedBy: [], checkpoints: [], finalConformanceIds: [],
  };
}

// ---------- brief preflight / checkpoint ----------

export function preflightBrief(brief, { productRoot, activePolicyHash }) {
  // Mechanical checks only: structure + required evidence presence + identity
  // freshness. Semantic owner/contract truth is agent/reviewer-established -
  // field presence alone cannot prove architectural correctness (pack sec.11).
  const unmet = [];
  if (!brief.planningBaseline?.productStateId) unmet.push("planningBaseline missing");
  if (activePolicyHash && brief.policyHash !== activePolicyHash) unmet.push(`policyHash does not match active policy ${activePolicyHash.slice(0, 12)}`);
  if (brief.unresolvedAssumptions.length) unmet.push(`unresolvedAssumptions non-empty: ${brief.unresolvedAssumptions.join("; ")}`);
  const pending = brief.lessonRouting.filter((r) => r.decision === "NEEDS_DISCOVERY");
  if (pending.length) unmet.push(`unresolved routing: ${pending.map((r) => r.lessonRef).join(", ")}`);
  const stale = brief.lessonRouting.filter((r) => r.decision === "STALE");
  if (stale.length) unmet.push(`stale guidance not resolved: ${stale.map((r) => r.lessonRef).join(", ")}`);
  if (!brief.firstProofObligations.length) unmet.push("no firstProofObligations - highest-cost uncertainty not named");
  for (const fp of brief.firstProofObligations) {
    if (!fp.oracle) unmet.push(`firstProof on slice '${fp.admittedSlice}' has no oracle`);
  }
  if (productRoot) {
    for (const dep of brief.sourceDependencyHashes) {
      const chk = refFreshness(dep, productRoot);
      if (!chk.fresh) unmet.push(`sourceDependency ${chk.reason}`);
    }
  }
  return { readiness: unmet.length ? "BLOCKED" : "READY_TO_DECLARE", unmet };
}

export function checkpointBrief(brief, { observedState, reason }) {
  // Compare planning baseline against observed current state; invalidate the
  // affected items. Returns the new brief revision (immutable-history style:
  // checkpoint appended, revision bumped).
  const b = brief.planningBaseline;
  const invalidated = [];
  const eq = (a, c) => a === c;
  if (!eq(b.productStateId, observedState.productStateId)) invalidated.push("productStateId drift -> affected slices + firstProof identities");
  if (!eq(b.contractId, observedState.contractId)) invalidated.push("contractId drift -> requirementRefs + routing applicability");
  if (!eq(b.attackModelId, observedState.attackModelId)) invalidated.push("attackModelId drift -> attack coverage claims");
  if (!eq(b.environmentId, observedState.environmentId)) invalidated.push("environmentId drift -> environment-bound evidence");
  const next = JSON.parse(JSON.stringify(brief));
  next.revision = brief.revision + 1;
  next.checkpoints = brief.checkpoints.concat([{
    at: utcNow(), baselineState: b, observedState, invalidatedItems: invalidated,
    nextSlice: invalidated.length ? "affected slices pending revalidation" : "continue current slice",
    reason,
  }]);
  if (invalidated.length) next.readiness = "STALE";
  return { brief: next, invalidated };
}

// ---------- capacity admission (5-slot, no watchers) ----------

export function admitAssignment(ledger, asg, { externalOccupied = 0 } = {}) {
  const cap = ledger.run.capacityLimit ?? 5;
  const active = ledger.assignments.filter((a) => ASSIGNMENT_ACTIVE.has(a.status)).length;
  const total = active + externalOccupied;
  const record = { ...asg, history: [...(asg.history ?? [])] };
  const push = (to, reason) => record.history.push({ at: utcNow(), from: record.status, to, reason });
  if (!ASSIGNMENT_STATES.has(record.status)) throw new Error(`unknown assignment status: ${record.status}`);
  if (asg.readiness !== "READY") {
    const to = asg.readiness === "BLOCKED" ? "BLOCKED" : "QUEUED";
    push(to, `readiness=${asg.readiness} - waiting work holds no slot`);
    record.status = to;
    return { record, admitted: false };
  }
  if (total + 1 > cap) {
    push("QUEUED", `capacity ${total}/${cap} occupied - queued, no slot consumed by queue record`);
    record.status = "QUEUED";
    return { record, admitted: false };
  }
  push("RESERVED", `admitted at ${total + 1}/${cap} (incl. external ${externalOccupied})`);
  record.status = "RESERVED";
  record.reservedAt = utcNow();
  return { record, admitted: true };
}

export function observeAssignment(ledger, asgId, { observedStatus, evidence }) {
  // Lifecycle-verified release: a result message alone never frees a slot.
  // Timeout/lease expiry alone cannot release (PU-15/PU-16).
  const a = ledger.assignments.find((x) => x.id === asgId);
  if (!a) throw new Error(`unknown assignment ${asgId}`);
  const push = (to, reason) => a.history.push({ at: utcNow(), from: a.status, to, reason });
  if (observedStatus === "result") { push("RESULT_RECEIVED", "terminal result observed - slot still occupied"); a.status = "RESULT_RECEIVED"; return a; }
  if (observedStatus === "timeout" || observedStatus === "expired") {
    push("RELEASE_PENDING", "lease/timeout elapsed WITHOUT lifecycle proof - authority revoked, slot retained");
    a.status = "RELEASE_PENDING";
    a.timeoutState = observedStatus;
    return a;
  }
  if (TERMINAL_OBSERVED.has(observedStatus)) {
    push("FINISHED", `lifecycle verified released via '${observedStatus}'`);
    a.status = "FINISHED";
    a.releaseEvidence = evidence ?? null;
    return a;
  }
  throw new Error(`unhandled observedStatus: ${observedStatus}`);
}

// ---------- learning facet transitions + policy publication ----------

export function applyLearningAction(lesson, action, { actor } = {}) {
  const g = lesson.guidance;
  const fail = (why) => ({ ok: false, reason: why });
  if (!g) return fail("lesson has no guidance facet");
  switch (action.type) {
    case "candidate":
      if (g.status !== "CANDIDATE") return fail(`only unqualified new facets start CANDIDATE, got ${g.status}`);
      return { ok: true };
    case "qualify": {
      if (g.status !== "CANDIDATE") return fail(`qualify requires CANDIDATE, got ${g.status}`);
      if (!g.authorityRefs.length) return fail("authorityRefs empty - an invariant/recipe needs current authority");
      if (!g.qualificationEvidence.length) return fail("qualificationEvidence empty - original-bug/controls/trial required");
      if (!g.qualifiedBy.length) return fail("qualifiedBy empty - independent verifier required");
      if (actor && g.qualifiedBy.includes(actor)) return fail(`self-approval rejected: ${actor} is in qualifiedBy`);
      if (g.originAnalysis.category === "UNKNOWN" && g.kind === "RECIPE") return fail("origin UNKNOWN cannot qualify a recipe - do not fabricate causality");
      g.status = "QUALIFIED";
      return { ok: true };
    }
    case "publish": {
      if (g.status !== "QUALIFIED") return fail(`publish requires QUALIFIED, got ${g.status}`);
      return { ok: true };
    }
    case "reject":
      g.status = "REJECTED";
      return { ok: true };
    case "markStale":
      g.status = "STALE";
      return { ok: true };
    case "rollback":
      g.status = "ROLLED_BACK";
      return { ok: true };
    default:
      return fail(`unknown learning action: ${action.type}`);
  }
}

export function publishPolicy(policyDir, activePath, payload) {
  // Atomic publication: payload hash -> policies/<hash>.json via tmp+rename,
  // then active-policy.json. A torn write leaves the previous active index
  // intact (PU-28). Self-hash cycles are rejected (PU-27): the payload may not
  // contain a 'policyHash' key or references to generated run/brief artifacts.
  const raw = JSON.stringify(payload);
  if (/"policyHash"\s*:/.test(raw)) return { ok: false, reason: "payload contains self-hash field 'policyHash' (PU-27)" };
  if (/docs\/qa\/runs\/|journal\.jsonl|briefs\//.test(raw)) return { ok: false, reason: "payload references generated run evidence - cyclic identity (PU-27)" };
  const hash = objectHash(payload);
  fs.mkdirSync(policyDir, { recursive: true });
  const target = path.join(policyDir, `${hash}.json`);
  const tmp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, raw);
  fs.renameSync(tmp, target);
  const idxTmp = `${activePath}.tmp-${process.pid}`;
  fs.writeFileSync(idxTmp, JSON.stringify({ policyHash: hash, publishedAt: utcNow() }, null, 2) + "\n");
  fs.renameSync(idxTmp, activePath);
  return { ok: true, policyHash: hash, path: target };
}

export function loadActivePolicy(activePath, policyDir) {
  if (!fs.existsSync(activePath)) return null;
  const idx = JSON.parse(fs.readFileSync(activePath, "utf8"));
  const file = path.join(policyDir, `${idx.policyHash}.json`);
  if (!fs.existsSync(file)) throw new Error(`active policy index points to missing ${idx.policyHash.slice(0, 12)} - torn publication; recover by repointing to last intact policy or republishing`);
  return { policyHash: idx.policyHash, payload: JSON.parse(fs.readFileSync(file, "utf8")) };
}

// ---------- v1 -> v2 migration ----------

export function migrateLedgerV1toV2(old) {
  // Explicit resume-only migration. Historical v1 ledgers replay unchanged
  // under the v1 schema; this produces a v2 ledger for a run that RESUMES.
  const led = JSON.parse(JSON.stringify(old));
  const notes = [];
  led.schemaVersion = 2;
  for (const k of ["briefs", "assignments", "consumptions"]) {
    if (!Array.isArray(led[k])) { led[k] = []; notes.push(`initialized empty ${k}`); }
  }
  led.run.briefIds = led.run.briefIds ?? [];
  led.run.capacityLimit = led.run.capacityLimit ?? 5;
  led.run.requiredReadiness = false; // never retro-claim readiness on old runs
  notes.push("requiredReadiness=false: v1 run never met v2 readiness obligations");
  for (const l of led.lessons) {
    if (l.guidance === undefined) { l.guidance = null; notes.push(`lesson ${l.id}: guidance absent (causalPrevention NOT_ESTABLISHED)`); }
  }
  return { ledger: led, notes };
}
