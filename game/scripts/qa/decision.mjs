// Terminal predicate and outcome decision. Emits a run outcome only from
// the ledger's declared state — never from exit codes or reviewer labels.
import { TERMINAL_FINDING_STATUSES, EXECUTED_KINDS } from "./state.mjs";

const OPEN = (x) => x.actionable && !TERMINAL_FINDING_STATUSES.has(x.status);
const sameState = (a, b) =>
  a && b && a.productStateId === b.productStateId && a.contractId === b.contractId &&
  a.attackModelId === b.attackModelId && a.environmentId === b.environmentId;

export function openActionable(ledger) {
  return ledger.findings.filter(OPEN);
}

export function withinScope(ledger, finding) {
  const auth = ledger.run.authorizedRepairs;
  if (auth.includes("*")) return true;
  if (auth.length === 0) return false;
  return finding.locations.some((loc) => auth.some((a) => loc.path.startsWith(a.replace(/\*$/, ""))));
}

export function evaluateTerminal(ledger) {
  const cur = ledger.run.state;
  const clauses = [];

  // 1. identities consistent across accepted clean/final evidence
  {
    const accepted = ledger.evidence.filter((e) => e.status === "CURRENT" && ledger.run.finalEvidenceIds.includes(e.id));
    const bad = accepted.filter((e) => !sameState(e.state, cur));
    clauses.push({ id: "C1-identity", ok: bad.length === 0, reason: bad.length ? `final evidence not on current state: ${bad.map((e) => e.id).join(",")}` : "all final evidence binds the declared state" });
  }

  // 2. census + coverage complete
  {
    const badCensus = ledger.census.filter((c) => ["SUSPICIOUS", "LEGACY"].includes(c.classification) && !c.disposition);
    const missingCells = [];
    for (const inv of ledger.invariants.filter((i) => i.status === "ACTIVE")) {
      for (const surf of inv.requiredEvidenceSurfaces) {
        const rows = ledger.coverage.filter((c) => c.invariantId === inv.id && c.surface === surf);
        if (rows.length === 0) { missingCells.push(`${inv.id}:${surf}`); continue; }
        for (const r of rows) {
          if (r.applicability === "REQUIRED" && !["SATISFIED"].includes(r.status)) missingCells.push(`${r.id}=${r.status}`);
        }
      }
    }
    const domainGaps = ledger.run.requiredDomains.filter((d) => !ledger.invariants.some((i) => i.domain === d));
    clauses.push({ id: "C2-census-coverage", ok: badCensus.length === 0 && missingCells.length === 0 && domainGaps.length === 0,
      reason: [...badCensus.map((c) => `unadjudicated census ${c.id}`), ...missingCells.map((m) => `coverage ${m}`), ...domainGaps.map((d) => `domain ${d} uncovered`)].join("; ") || "census + coverage complete" });
  }

  // 3. no actionable defect/dispute/sibling/exception
  {
    const open = openActionable(ledger);
    const disputed = ledger.invariants.filter((i) => i.status === "DISPUTED");
    const exceptions = ledger.findings.filter((x) => x.status === "HUMAN_EXCEPTION");
    clauses.push({ id: "C3-no-open", ok: open.length === 0 && disputed.length === 0 && exceptions.length === 0,
      reason: [...open.map((x) => `open ${x.id}`), ...disputed.map((i) => `disputed ${i.id}`), ...exceptions.map((x) => `exception ${x.id}`)].join("; ") || "none open" });
  }

  // 4. mandatory gates green on final state
  {
    const fin = ledger.run.finalEvidenceIds.map((id) => ledger.evidence.find((e) => e.id === id)).filter(Boolean);
    const bad = fin.filter((e) => e.status !== "CURRENT" || (EXECUTED_KINDS.has(e.kind) && e.exitCode !== 0) || e.result === "FAIL" || e.result === "MISSING" || e.result === "FLAKY");
    clauses.push({ id: "C4-final-gates", ok: fin.length > 0 && bad.length === 0,
      reason: fin.length === 0 ? "no final evidence recorded" : bad.map((e) => `${e.id} status=${e.status} result=${e.result}`).join("; ") || "final gates green" });
  }

  // 5. sequential reviews over resulting states
  {
    const phases = ledger.cycles.flatMap((c) => c.reviewIds.map((id) => ledger.reviews.find((r) => r.id === id))).filter(Boolean);
    const okOrder = phases.some((r) => r.phase === "CORRECTNESS") && phases.some((r) => r.phase === "AUTHORITY") && phases.some((r) => r.phase === "INTEGRATION");
    clauses.push({ id: "C5-sequential", ok: okOrder, reason: okOrder ? "sequential phase reviews present" : "sequential CORRECTNESS→AUTHORITY→INTEGRATION reviews missing" });
  }

  // 6. clean A + B complete, independent, novel attacks between
  {
    const a = ledger.cycles.find((c) => c.id === ledger.run.cleanRoundA);
    const b = ledger.cycles.find((c) => c.id === ledger.run.cleanRoundB);
    let ok = true; const why = [];
    if (!a || a.status !== "CLEAN") { ok = false; why.push("Clean A missing/not CLEAN"); }
    if (!b || b.status !== "CLEAN") { ok = false; why.push("Clean B missing/not CLEAN"); }
    if (a && b) {
      if (!sameState(a.state, cur) || !sameState(b.state, cur)) { ok = false; why.push("clean rounds not on current state"); }
      const ctxA = new Set(a.reviewIds.map((id) => ledger.reviews.find((r) => r.id === id)?.contextId));
      const ctxB = new Set(b.reviewIds.map((id) => ledger.reviews.find((r) => r.id === id)?.contextId));
      if ([...ctxB].some((c) => ctxA.has(c))) { ok = false; why.push("B reused an A context"); }
      const contaminated = [...a.reviewIds, ...b.reviewIds].map((id) => ledger.reviews.find((r) => r.id === id)).filter((r) => r && (r.priorFindingsVisible || r.accessLimitations.length));
      if (contaminated.length) { ok = false; why.push(`contaminated clean reviews: ${contaminated.map((r) => r.id).join(",")}`); }
      if (b.noveltyEvidenceIds.length === 0 && a.noveltyEvidenceIds.length === 0) { ok = false; why.push("no novel-attack evidence between rounds"); }
    }
    clauses.push({ id: "C6-clean-pair", ok, reason: why.join("; ") || "Clean A/B complete and independent" });
  }

  // 7. mutation + corpus satisfied
  {
    const lacking = ledger.invariants.filter((i) => i.status === "ACTIVE" && i.risk !== "STANDARD")
      .filter((i) => !ledger.mutations.some((m) => m.invariantIds.includes(i.id) && m.result === "KILLED_EXPECTED"));
    const corpusOpen = ledger.corpus.filter((c) => c.replayMode !== "PENDING_RECOVERY" && c.status === "PENDING");
    const corpusMissed = ledger.corpus.filter((c) => c.status === "MISSED");
    clauses.push({ id: "C7-mutation-corpus", ok: lacking.length === 0 && corpusOpen.length === 0 && corpusMissed.length === 0,
      reason: [...lacking.map((i) => `no killed mutant for ${i.id}`), ...corpusOpen.map((c) => `corpus ${c.id} pending`), ...corpusMissed.map((c) => `corpus ${c.id} MISSED`)].join("; ") || "mutation + corpus satisfied" });
  }

  // 8. independent terminal verifier on same state
  {
    const ok = ledger.reviews.some((r) => r.phase === "TERMINAL_CHECK" && r.status === "SEALED" && sameState(r.state, cur) && !r.priorFindingsVisible);
    clauses.push({ id: "C8-terminal-check", ok, reason: ok ? "independent terminal verifier sealed" : "no sealed independent TERMINAL_CHECK on the final state" });
  }

  return clauses;
}

export function decide(ledger) {
  const clauses = evaluateTerminal(ledger);
  const allOk = clauses.every((c) => c.ok);
  const open = openActionable(ledger);
  const exceptions = ledger.findings.filter((x) => x.status === "HUMAN_EXCEPTION");

  if (allOk && ledger.findings.length >= 0) {
    return { outcome: "QA_FIXED_POINT_REACHED", clauses, detail: "terminal predicate satisfied" };
  }
  if (open.length) {
    const outOfScope = open.filter((x) => !withinScope(ledger, x));
    if (outOfScope.length && open.every((x) => outOfScope.includes(x) || exceptions.includes(x))) {
      return { outcome: "QA_BLOCKED_SCOPE", clauses, detail: `repairs outside authorized scope: ${outOfScope.map((x) => x.id).join(",")}` };
    }
    const uncovered = open.filter((x) => !x.exception && withinScope(ledger, x));
    if (uncovered.length === 0 && exceptions.length) {
      return { outcome: "QA_ACCEPTED_WITH_EXCEPTIONS", clauses, detail: `human-accepted: ${exceptions.map((x) => x.id).join(",")}` };
    }
    return { outcome: "QA_FINDINGS_OPEN", clauses, detail: `open actionable: ${open.map((x) => x.id).join(",")}` };
  }
  if (exceptions.length && !allOk) {
    const blocked = clauses.filter((c) => !c.ok && !["C3-no-open"].includes(c.id));
    if (blocked.length === 0) {
      return { outcome: "QA_ACCEPTED_WITH_EXCEPTIONS", clauses, detail: `human-accepted: ${exceptions.map((x) => x.id).join(",")}` };
    }
  }
  return { outcome: "QA_UNVERIFIED", clauses, detail: "required evidence/coverage/independence missing" };
}

export function renderReport(ledger, failures = []) {
  const r = ledger.run;
  const lines = [];
  lines.push(`# QA run ${r.id}`, "");
  lines.push(`- phase: ${r.phase}`);
  lines.push(`- outcome: ${r.outcome ?? "(undecided)"}`);
  lines.push(`- state: product=${r.state.productStateId.slice(0, 12) || "—"} contract=${r.state.contractId.slice(0, 12) || "—"} attack=${r.state.attackModelId.slice(0, 12) || "—"} env=${r.state.environmentId.slice(0, 12) || "—"}`);
  lines.push(`- base/head: ${r.base} -> ${r.head}`);
  lines.push("");
  lines.push("## Findings", "");
  if (!ledger.findings.length) lines.push("(none)");
  for (const x of ledger.findings) {
    lines.push(`- **${x.id}** ${x.severity}/${x.classification} — ${x.status} — ${x.title}`);
  }
  lines.push("");
  lines.push("## Coverage", "");
  const byStatus = {};
  for (const c of ledger.coverage) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
  lines.push(`- cells: ${ledger.coverage.length} total; ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  lines.push("");
  lines.push("## Chronology", "");
  for (const c of ledger.cycles) {
    lines.push(`- cycle ${c.id}: ${c.status}; reviews ${c.reviewIds.join(",")}`);
  }
  lines.push("");
  lines.push("## Convergence", "");
  for (const c of evaluateTerminal(ledger)) {
    lines.push(`- ${c.ok ? "OK" : "UNMET"} ${c.id}: ${c.reason}`);
  }
  if (failures.length) {
    lines.push("", "## Validation failures", "");
    for (const f of failures) lines.push(`- ${f.check} ${f.recordId}: ${f.reason}`);
  }
  return lines.join("\n") + "\n";
}
