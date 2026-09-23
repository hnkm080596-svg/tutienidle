// Semantic validation: schema shape + the 13 machine checks from
// game/docs/qa/protocol/ledger-schema.md. Fails closed: every violation
// prints the offending record id and exact reason.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { EXECUTED_KINDS, ACTIONABLE_CLASSES, TERMINAL_FINDING_STATUSES, fileHashHex, objectHash, buildManifest } from "./state.mjs";

export function loadSchema(scriptDir) {
  return JSON.parse(fs.readFileSync(path.join(scriptDir, "ledger.schema.json"), "utf8"));
}

export function validateStructure(ledger, scriptDir = path.dirname(fileURLToPath(import.meta.url))) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(loadSchema(scriptDir));
  validate(ledger);
  return (validate.errors ?? []).map((e) => ({
    check: "SCHEMA",
    recordId: e.instancePath || "/",
    reason: `schema: ${e.instancePath} ${e.message}`,
  }));
}

const MATERIAL_EVIDENCE_KINDS = new Set([...EXECUTED_KINDS, "SOURCE_PROOF", "SPEC_DRIFT", "EXECUTED_MUTATION"]);
const EXECUTED_SURFACE_KIND = {
  DETERMINISTIC: new Set(["EXECUTED_UNIT_STRUCTURAL", "EXECUTED_INTEGRATION", "EXECUTED_RUNTIME", "EXECUTED_PROPERTY"]),
  INTEGRATION: new Set(["EXECUTED_INTEGRATION", "EXECUTED_RUNTIME", "EXECUTED_UNIT_STRUCTURAL"]),
  RUNTIME_E2E: new Set(["EXECUTED_RUNTIME", "EXECUTED_INTEGRATION"]),
  PERSISTENCE: new Set(["EXECUTED_RUNTIME", "EXECUTED_INTEGRATION", "EXECUTED_UNIT_STRUCTURAL", "SOURCE_PROOF"]),
  PROPERTY: new Set(["EXECUTED_PROPERTY", "EXECUTED_MUTATION"]),
  FUZZ: new Set(["EXECUTED_RUNTIME", "EXECUTED_INTEGRATION", "EXECUTED_PROPERTY", "EXECUTED_UNIT_STRUCTURAL"]),
  MUTATION: new Set(["EXECUTED_MUTATION"]),
  SPEC: new Set(["SOURCE_PROOF", "SPEC_DRIFT", "HISTORICAL"]),
  STATIC_SEMANTIC: new Set(["SOURCE_PROOF", "SPEC_DRIFT", "EXECUTED_UNIT_STRUCTURAL"]),
  INDEPENDENT_REVIEW: null, // satisfied by sealed review records, checked separately
};

function idSet(list) {
  return new Set(list.map((r) => r.id));
}

function hasCycle(ids, edgesOf) {
  // DFS over id->ids edges; return a cyclic node id or null.
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map([...ids].map((i) => [i, WHITE]));
  const visit = (id) => {
    color.set(id, GRAY);
    for (const n of edgesOf(id)) {
      if (!color.has(n)) continue;
      if (color.get(n) === GRAY) return n;
      if (color.get(n) === WHITE && visit(n)) return n;
    }
    color.set(id, BLACK);
    return null;
  };
  for (const id of ids) if (color.get(id) === WHITE && visit(id)) return id;
  return null;
}

function pathsContained(runDir, rel) {
  if (path.isAbsolute(rel)) return false;
  const abs = path.resolve(runDir, rel);
  return abs.startsWith(path.resolve(runDir) + path.sep) || abs === path.resolve(runDir, rel.split("/")[0] ?? "");
}

export function validateSemantics(ledger, { runDir = null, checkState = null } = {}) {
  const fails = [];
  const f = (check, recordId, reason) => fails.push({ check, recordId, reason });

  // ---- MC1 unique ids, references resolve, no cycles, path containment+hashes
  const ns = {
    run: [ledger.run.id], invariant: idSet(ledger.invariants), census: idSet(ledger.census),
    finding: idSet(ledger.findings), evidence: idSet(ledger.evidence), coverage: idSet(ledger.coverage),
    attack: idSet(ledger.attacks), review: idSet(ledger.reviews), cycle: idSet(ledger.cycles),
    mutation: idSet(ledger.mutations), corpus: idSet(ledger.corpus), lesson: idSet(ledger.lessons),
    message: idSet(ledger.messages), request: new Set(ledger.messages.map((m) => m.requestId)),
  };
  const allIds = new Map();
  for (const [kind, set] of Object.entries(ns)) {
    for (const id of set) {
      if (allIds.has(id)) f("MC1", id, `duplicate id across/within namespaces (also in ${allIds.get(id)})`);
      else allIds.set(id, kind);
    }
  }
  const req = (kind, id, owner) => {
    if (!ns[kind]?.has(id)) f("MC1", owner, `unresolved ${kind} reference: ${id}`);
  };
  const reqMaybe = (kind, id, owner) => { if (id != null) req(kind, id, owner); };
  for (const c of ledger.census) c.invariantIds.forEach((i) => req("invariant", i, c.id));
  for (const x of ledger.findings) {
    x.invariantIds.forEach((i) => req("invariant", i, x.id));
    x.evidenceIds.forEach((i) => req("evidence", i, x.id));
    x.pinEvidenceIds.forEach((i) => req("evidence", i, x.id));
    x.verificationEvidenceIds.forEach((i) => req("evidence", i, x.id));
    x.closureReviewIds.forEach((i) => req("review", i, x.id));
    x.siblingFindingIds.forEach((i) => req("finding", i, x.id));
    x.siblingSearch.forEach((s) => s.evidenceIds.forEach((i) => req("evidence", i, x.id)));
    reqMaybe("finding", x.duplicateOf, x.id);
  }
  for (const e of ledger.evidence) {
    e.invariantIds.forEach((i) => req("invariant", i, e.id));
    e.inputEvidenceIds.forEach((i) => req("evidence", i, e.id));
  }
  for (const c of ledger.coverage) {
    req("invariant", c.invariantId, c.id);
    c.attackIds.forEach((i) => req("attack", i, c.id));
    c.evidenceIds.forEach((i) => req("evidence", i, c.id));
  }
  for (const a of ledger.attacks) {
    a.invariantIds.forEach((i) => req("invariant", i, a.id));
    a.evidenceIds.forEach((i) => req("evidence", i, a.id));
  }
  for (const r of ledger.reviews) {
    reqMaybe("review", r.previousPhaseReviewId, r.id);
    r.coverageIds.forEach((i) => req("coverage", i, r.id));
    r.evidenceIds.forEach((i) => req("evidence", i, r.id));
    r.findingIds.forEach((i) => req("finding", i, r.id));
    r.novelAttackIds.forEach((i) => req("attack", i, r.id));
  }
  for (const c of ledger.cycles) {
    c.reviewIds.forEach((i) => req("review", i, c.id));
    c.coverageIds.forEach((i) => req("coverage", i, c.id));
    c.evidenceIds.forEach((i) => req("evidence", i, c.id));
    c.noveltyEvidenceIds.forEach((i) => req("evidence", i, c.id));
  }
  for (const m of ledger.mutations) {
    m.invariantIds.forEach((i) => req("invariant", i, m.id));
    m.evidenceIds.forEach((i) => req("evidence", i, m.id));
    if (m.candidateState) {
      // candidateState is a state object, not an id
    }
  }
  for (const c of ledger.corpus) {
    c.invariantIds.forEach((i) => req("invariant", i, c.id));
    c.baselineEvidenceIds.forEach((i) => req("evidence", i, c.id));
    c.candidateEvidenceIds.forEach((i) => req("evidence", i, c.id));
  }
  for (const l of ledger.lessons) {
    l.findingIds.forEach((i) => req("finding", i, l.id));
    l.incidentEvidenceIds.forEach((i) => req("evidence", i, l.id));
    l.missedInvariantIds.forEach((i) => req("invariant", i, l.id));
    l.promotionEvidenceIds.forEach((i) => req("evidence", i, l.id));
    l.qualifiedBy.forEach((i) => req("review", i, l.id));
    l.recurrenceFindingIds.forEach((i) => req("finding", i, l.id));
    l.preventionEvidenceIds.forEach((i) => req("evidence", i, l.id));
    if (l.supersedes) req("lesson", l.supersedes.split("@")[0], l.id);
  }
  for (const m of ledger.messages) {
    if (m.runId !== ledger.run.id) f("MC1", m.id, `message runId ${m.runId} != run ${ledger.run.id}`);
    if (m.parentRequestId) req("request", m.parentRequestId, m.id);
  }
  ledger.run.finalEvidenceIds.forEach((i) => req("evidence", i, "run.finalEvidenceIds"));
  for (const cyc of [ledger.run.cleanRoundA, ledger.run.cleanRoundB]) {
    if (cyc != null) req("cycle", cyc, "run");
  }
  // cycles: evidence prerequisites, duplicate chains
  {
    const cyc = hasCycle(ns.evidence, (id) => ledger.evidence.find((e) => e.id === id).inputEvidenceIds);
    if (cyc) f("MC1", cyc, "cycle in evidence prerequisite graph");
    const dupEdges = (id) => {
      const x = ledger.findings.find((v) => v.id === id);
      return x?.duplicateOf ? [x.duplicateOf] : [];
    };
    const dcyc = hasCycle(ns.finding, dupEdges);
    if (dcyc) f("MC1", dcyc, "cycle in duplicate-findings chain");
  }
  // path containment + recorded hash matches
  if (runDir) {
    const checkPath = (rel, expectHash, owner) => {
      if (!rel) return;
      if (!pathsContained(runDir, rel)) { f("MC1", owner, `path escapes run dir: ${rel}`); return; }
      const abs = path.join(runDir, rel);
      if (!fs.existsSync(abs)) { f("MC1", owner, `referenced path missing: ${rel}`); return; }
      if (expectHash && fileHashHex(abs) !== expectHash) f("MC1", owner, `hash mismatch for ${rel}`);
    };
    for (const e of ledger.events) checkPath(e.payloadPath, e.payloadHash, `event:${e.seq}`);
    for (const e of ledger.evidence) checkPath(e.artifactPath, e.artifactHash, e.id);
    for (const m of ledger.messages) checkPath(m.payloadPath, m.payloadHash, m.id);
  }

  // ---- MC2 times, chronology, event chain
  const t = (v, owner) => { if (!v || Number.isNaN(Date.parse(v))) f("MC2", owner, `invalid UTC instant: ${v}`); };
  for (const e of ledger.evidence) {
    t(e.startedAt, e.id); t(e.finishedAt, e.id);
    if (Date.parse(e.startedAt) > Date.parse(e.finishedAt)) f("MC2", e.id, "startedAt > finishedAt");
  }
  for (const r of ledger.reviews) {
    t(r.startedAt, r.id); t(r.sealedAt, r.id);
    if (Date.parse(r.startedAt) > Date.parse(r.sealedAt)) f("MC2", r.id, "startedAt > sealedAt");
  }
  for (const m of ledger.messages) t(m.createdAt, m.id);
  for (const c of ledger.cycles) { t(c.startedAt, c.id); t(c.finishedAt, c.id); }
  for (const e of ledger.events) t(e.at, `event:${e.seq}`);
  for (let i = 0; i < ledger.events.length; i++) {
    const e = ledger.events[i];
    if (e.seq !== i + 1) f("MC2", `event:${e.seq}`, `non-contiguous seq at index ${i}`);
    const prev = i === 0 ? null : ledger.events[i - 1].eventHash;
    if (e.previousEventHash !== prev) f("MC2", `event:${e.seq}`, "previousEventHash chain broken");
    const forHash = { ...e }; delete forHash.eventHash;
    if (objectHash(forHash) !== e.eventHash) f("MC2", `event:${e.seq}`, "eventHash does not recompute");
  }

  // ---- MC3 state manifests recompute; stale/not-current marking consistent
  const cur = ledger.run.state;
  const sameState = (a, b) => a && b && a.productStateId === b.productStateId && a.contractId === b.contractId && a.attackModelId === b.attackModelId && a.environmentId === b.environmentId;
  if (checkState?.manifestRoot) {
    const now = buildManifest(checkState.manifestRoot, checkState);
    if (now.productStateId !== cur.productStateId) {
      f("MC3", "run.state", `recomputed productStateId ${now.productStateId.slice(0, 12)}… != recorded ${cur.productStateId.slice(0, 12)}… — tree changed or stale`);
    }
  }
  if (cur.productStateId === "" || !/^[0-9a-f]{64}$/.test(cur.productStateId)) f("MC3", "run.state", "productStateId unset — run snapshot first");
  for (const par of ledger.run.aggregateParents) {
    if (!par.revision || par.revision.length < 7) f("MC3", par.path ?? "?", `aggregate parent ${par.path} not pinned to a concrete revision`);
  }

  // ---- MC4 evidence currency + kind requirements
  for (const e of ledger.evidence) {
    if (e.status === "CURRENT" && !sameState(e.state, cur)) f("MC4", e.id, "CURRENT evidence does not match run state identity");
    if (EXECUTED_KINDS.has(e.kind)) {
      if (e.exitCode == null) f("MC4", e.id, `${e.kind} evidence lacks exitCode`);
      if (!e.commandOrMethod) f("MC4", e.id, `${e.kind} evidence lacks commandOrMethod`);
    }
    if (e.kind === "SOURCE_PROOF" && e.inputPaths.length === 0) f("MC4", e.id, "SOURCE_PROOF without source artifact paths");
  }
  // stale propagation consistency: evidence depending on STALE evidence must be STALE/REJECTED
  const evById = new Map(ledger.evidence.map((e) => [e.id, e]));
  for (const e of ledger.evidence) {
    for (const dep of e.inputEvidenceIds) {
      if (evById.get(dep)?.status === "STALE" && e.status === "CURRENT") {
        f("MC4", e.id, `depends on STALE evidence ${dep} but still CURRENT (invalidation must be transitive)`);
      }
    }
  }

  // ---- MC5 CLOSED finding requirements
  const reviewById = new Map(ledger.reviews.map((r) => [r.id, r]));
  for (const x of ledger.findings) {
    if (x.status !== "CLOSED") continue;
    if (!x.rootCause || !x.rootClass) f("MC5", x.id, "CLOSED without rootCause/rootClass");
    if (!x.repair) f("MC5", x.id, "CLOSED without implemented repair reference");
    if (x.siblingSearch.length === 0) f("MC5", x.id, "CLOSED without sibling-search evidence");
    if (x.pinEvidenceIds.length === 0 && !x.rejectionReason) f("MC5", x.id, "CLOSED without regression pin or explicit alternative rationale");
    if (x.verificationEvidenceIds.length === 0) f("MC5", x.id, "CLOSED without current affected verification");
    if (x.closureReviewIds.length === 0) f("MC5", x.id, "CLOSED without closure review");
    for (const rid of x.closureReviewIds) {
      const r = reviewById.get(rid);
      if (r && r.reviewerId === x.discoveredBy && r.role !== "CLOSURE") f("MC5", x.id, `closure reviewer ${r.reviewerId} is the discovering fixer context`);
    }
    // open siblings outside atomic group
    for (const sid of x.siblingFindingIds) {
      const sib = ledger.findings.find((v) => v.id === sid);
      if (sib && !TERMINAL_FINDING_STATUSES.has(sib.status)) {
        f("MC5", x.id, `CLOSED while sibling ${sid} is ${sib.status} — cyclic/linked siblings must close in one atomic group`);
      }
    }
  }

  // ---- MC6 actionability derived, not flagged
  for (const x of ledger.findings) {
    const actionableClass = ACTIONABLE_CLASSES.has(x.classification);
    if (x.actionable && !actionableClass) {
      f("MC6", x.id, `actionable=true but classification ${x.classification} is not actionable`);
    }
    if (!x.actionable) {
      if (!["FALSE_POSITIVE", "NON_ACTIONABLE"].includes(x.classification)) {
        f("MC6", x.id, `actionable=false requires FALSE_POSITIVE/NON_ACTIONABLE, got ${x.classification}`);
      }
      if (x.status !== "REJECTED_WITH_PROOF" && x.status !== "HUMAN_EXCEPTION") {
        f("MC6", x.id, `actionable=false requires REJECTED_WITH_PROOF (or human exception), status=${x.status}`);
      }
      if (x.status === "REJECTED_WITH_PROOF" && !x.rejectionReason) {
        f("MC6", x.id, "REJECTED_WITH_PROOF without rejectionReason");
      }
    }
    if (x.status === "HUMAN_EXCEPTION" && !x.exception) {
      f("MC6", x.id, "HUMAN_EXCEPTION without explicit human instruction scope/reason/expiry");
    }
    if (x.exception && (!x.exception.humanInstructionRef || !x.exception.scope || !x.exception.reason)) {
      f("MC6", x.id, "exception lacks instruction ref/scope/reason");
    }
  }

  // ---- MC7 coverage completeness per active invariant
  for (const inv of ledger.invariants) {
    if (inv.status !== "ACTIVE") continue;
    for (const surface of inv.requiredEvidenceSurfaces) {
      const rows = ledger.coverage.filter((c) => c.invariantId === inv.id && c.surface === surface);
      if (rows.length === 0) { f("MC7", inv.id, `required surface ${surface} has no coverage row (MISSING, never silently reduced)`); continue; }
      for (const c of rows) {
        if (c.applicability === "REQUIRED" && c.status === "NOT_APPLICABLE") {
          f("MC7", c.id, "REQUIRED applicability marked NOT_APPLICABLE — invalid");
        }
        if (c.applicability === "REQUIRED" && ["PENDING", "MISSING"].includes(c.status)) {
          f("MC7", c.id, `required surface ${surface} is ${c.status}`);
        }
        if (c.status === "SATISFIED") {
          if (c.evidenceIds.length === 0 && c.surface !== "INDEPENDENT_REVIEW") {
            f("MC7", c.id, "SATISFIED with no evidence");
          }
          if (c.surface === "INDEPENDENT_REVIEW" && c.reviewerIds.length === 0 && c.evidenceIds.length === 0) {
            f("MC7", c.id, "INDEPENDENT_REVIEW SATISFIED with no reviewers or evidence");
          }
          const allowed = EXECUTED_SURFACE_KIND[c.surface];
          if (allowed) {
            for (const eid of c.evidenceIds) {
              const e = evById.get(eid);
              if (e && !allowed.has(e.kind)) f("MC7", c.id, `evidence ${eid} kind ${e.kind} cannot satisfy surface ${c.surface} (HISTORICAL/INFERRED never satisfy EXECUTED)`);
              if (e && e.status !== "CURRENT") f("MC7", c.id, `evidence ${eid} is ${e.status}, not CURRENT`);
            }
          }
        }
      }
    }
  }

  // ---- MC8 census + required domains
  for (const c of ledger.census) {
    if (["SUSPICIOUS", "LEGACY"].includes(c.classification) && !c.disposition) {
      f("MC8", c.id, `${c.classification} census entry lacks adjudicated disposition`);
    }
  }
  for (const d of ledger.run.requiredDomains) {
    if (!ledger.invariants.some((i) => i.domain === d) && !ledger.census.some((c) => c.location?.path?.startsWith(d))) {
      f("MC8", "run.requiredDomains", `required domain ${d} has no invariant or census presence`);
    }
  }

  // ---- MC9 review independence/integrity
  const cleanReviewIds = new Set();
  for (const key of [ledger.run.cleanRoundA, ledger.run.cleanRoundB]) {
    const c = key && ledger.cycles.find((v) => v.id === key);
    if (c) c.reviewIds.forEach((id) => cleanReviewIds.add(id));
  }
  const reviewIsClean = (r) => r.priorFindingsVisible === false && r.accessLimitations.length === 0;
  for (const r of ledger.reviews) {
    if (r.status === "SEALED" && !r.sealedAt) f("MC9", r.id, "SEALED without sealedAt");
    if (cleanReviewIds.has(r.id) && r.status !== "SEALED") {
      f("MC9", r.id, `clean-round review ${r.status} — must be SEALED to count`);
    }
    if (cleanReviewIds.has(r.id) && r.status === "SEALED" && !reviewIsClean(r)) {
      f("MC9", r.id, `clean-round review has priorFindingsVisible=${r.priorFindingsVisible} or access limits — contaminated, cannot count as independent`);
    }
    if (r.phase === "CLOSURE") {
      // closure reviewer must differ from the finding's repair author context
      const closed = ledger.findings.filter((x) => x.closureReviewIds.includes(r.id));
      for (const x of closed) {
        if (x.repair && r.contextId && x.repair.includes(`context:${r.contextId}`)) {
          f("MC9", r.id, "closure reviewer is own fixer");
        }
      }
    }
  }
  for (const c of ledger.cycles) {
    const revs = c.reviewIds.map((id) => reviewById.get(id)).filter(Boolean);
    const phases = revs.map((r) => r.phase);
    for (const need of ["CORRECTNESS", "AUTHORITY", "INTEGRATION"]) {
      if (!phases.includes(need)) f("MC9", c.id, `cycle missing sequential phase ${need}`);
    }
    // sequential ordering: each phase's previousPhaseReviewId links to the prior phase
    const idxCorr = phases.indexOf("CORRECTNESS");
    const idxAuth = phases.indexOf("AUTHORITY");
    const idxInt = phases.indexOf("INTEGRATION");
    if (idxAuth >= 0 && revs[idxAuth].previousPhaseReviewId !== revs[idxCorr]?.id) {
      f("MC9", c.id, "AUTHORITY phase does not reference CORRECTNESS review as predecessor");
    }
    if (idxInt >= 0 && revs[idxInt].previousPhaseReviewId !== revs[idxAuth]?.id) {
      f("MC9", c.id, "INTEGRATION phase does not reference AUTHORITY review as predecessor");
    }
  }

  // ---- MC10 clean rounds
  for (const [key, label] of [[ledger.run.cleanRoundA, "CleanA"], [ledger.run.cleanRoundB, "CleanB"]]) {
    if (!key) continue;
    const c = ledger.cycles.find((v) => v.id === key);
    if (!c) { f("MC10", String(key), `${label} references missing cycle`); continue; }
    if (!sameState(c.state, cur)) f("MC10", c.id, `${label} state does not match current run identity`);
    if (c.status === "STALE") f("MC10", c.id, `${label} is STALE`);
    if (c.status === "FINDINGS") f("MC10", c.id, `${label} recorded findings — not clean`);
    if (c.status === "INCOMPLETE") f("MC10", c.id, `${label} incomplete`);
    for (const eid of c.noveltyEvidenceIds) {
      const e = evById.get(eid);
      if (e && e.status !== "CURRENT") {
        f("MC10", c.id, `novel attack ${eid} is ${e.status} — novelty must be proven on current state`);
      } else if (e && !MATERIAL_EVIDENCE_KINDS.has(e.kind)) {
        f("MC10", c.id, `novel attack ${eid} has kind ${e.kind} — needs executed/source-proof result`);
      }
    }
  }
  if (ledger.run.cleanRoundA && ledger.run.cleanRoundB && ledger.run.cleanRoundA === ledger.run.cleanRoundB) {
    f("MC10", "run", "CleanA and CleanB reference the same cycle — impossible");
  }
  // B contexts must differ from A contexts
  if (ledger.run.cleanRoundA && ledger.run.cleanRoundB) {
    const a = ledger.cycles.find((c) => c.id === ledger.run.cleanRoundA);
    const b = ledger.cycles.find((c) => c.id === ledger.run.cleanRoundB);
    if (a && b) {
      const ctxA = new Set(a.reviewIds.map((id) => reviewById.get(id)?.contextId));
      const ctxB = new Set(b.reviewIds.map((id) => reviewById.get(id)?.contextId));
      for (const ctx of ctxB) if (ctxA.has(ctx)) f("MC10", b.id, `Clean B reused Clean A context ${ctx} — independence violated`);
    }
  }

  // ---- MC11 mutation + golden corpus
  for (const inv of ledger.invariants) {
    if (inv.status !== "ACTIVE" || inv.risk === "STANDARD") continue;
    const muts = ledger.mutations.filter((m) => m.invariantIds.includes(inv.id));
    const killed = muts.some((m) => m.result === "KILLED_EXPECTED");
    if (!killed) f("MC11", inv.id, `${inv.risk} invariant lacks a KILLED_EXPECTED representative mutation`);
    for (const m of muts) if (!m.candidateUnchanged) f("MC11", m.id, "candidate hash changed after mutation job");
  }
  for (const c of ledger.corpus) {
    if (c.replayMode !== "PENDING_RECOVERY" && c.status === "PENDING") {
      f("MC11", c.id, "executable golden case still PENDING — no detected result and no benchmark-gap record");
    }
  }

  // ---- MC12 final matrix
  for (const eid of ledger.run.finalEvidenceIds) {
    const e = evById.get(eid);
    if (!e) continue;
    if (e.status !== "CURRENT") f("MC12", eid, "final gate evidence is not CURRENT");
    if (e.exitCode !== 0 && EXECUTED_KINDS.has(e.kind)) f("MC12", eid, `final gate evidence exitCode=${e.exitCode}`);
    if (e.result === "FAIL") f("MC12", eid, "final gate evidence failed");
  }
  const openActionable = ledger.findings.filter((x) => x.actionable && !TERMINAL_FINDING_STATUSES.has(x.status));
  for (const x of openActionable) f("MC12", x.id, `actionable finding still ${x.status}`);
  const terminalOk = ledger.reviews.some((r) => r.phase === "TERMINAL_CHECK" && r.status === "SEALED" && sameState(r.state, cur));
  if (ledger.run.outcome === "QA_FIXED_POINT_REACHED" && !terminalOk) {
    f("MC12", "run", "QA_FIXED_POINT_REACHED claimed without independent terminal review on same state");
  }

  // ---- MC13 lessons
  for (const x of ledger.findings) {
    if (!TERMINAL_FINDING_STATUSES.has(x.status)) continue;
    const linked = ledger.lessons.some((l) => l.findingIds.includes(x.id));
    if (!linked && x.classification !== "FALSE_POSITIVE") {
      f("MC13", x.id, "terminal finding has no linked lesson record (meaningful incidents must enter learning history)");
    }
  }
  for (const l of ledger.lessons) {
    if (l.status === "PROMOTED") {
      if (l.qualifiedBy.length === 0) f("MC13", l.id, "PROMOTED without independent qualification reviews");
      if (l.promotionEvidenceIds.length === 0) f("MC13", l.id, "PROMOTED without promotion evidence (original-bug kill + legal controls)");
      if (!l.policyVersion) f("MC13", l.id, "PROMOTED without policyVersion hash");
      if (!l.effectiveFromRun) f("MC13", l.id, "PROMOTED without effectiveFromRun");
      for (const rid of l.qualifiedBy) {
        const r = reviewById.get(rid);
        if (r && !reviewIsClean(r)) f("MC13", l.id, `qualifier ${rid} was contaminated`);
      }
      const relaxes = [...(l.proposedProtection ?? []), l.capabilityDelta ?? ""].some((t) => /relax|weaken|skip|remove gate|drop|loosen/i.test(t));
      if (relaxes) {
        const humanAuth = ledger.findings.some((x) => x.status === "HUMAN_EXCEPTION" && x.exception?.scope);
        if (!humanAuth) f("MC13", l.id, "promoted lesson relaxes required detection without explicit human authority — rejected");
      }
    }
  }
  // consumed lessons must be promoted in the active policy
  const promotedIds = new Set(ledger.lessons.filter((l) => l.status === "PROMOTED").map((l) => `${l.id}@${l.version}`));
  for (const cid of ledger.run.consumedLessonIds) {
    if (!promotedIds.has(cid)) f("MC13", cid, "run consumes lesson not PROMOTED in policy");
  }

  return fails;
}

export function validateLedger(ledger, opts) {
  const structural = opts?.scriptDir ? validateStructure(ledger, opts.scriptDir) : [];
  const semantic = validateSemantics(ledger, opts);
  return [...structural, ...semantic];
}
