# Adversarial QA — TEST-WORKLOAD PHASE 2 (quick)

Scope: worktree `.agent-worktrees/twl-phase2`, branch
`devin/1790533372-twl-phase2`, base `0f1d84d1` (post-PR40 master).
Task-owned paths: 14 files — all test infrastructure (asset test probes,
architecture scan guards, e2e specs) + `docs/audit/…phase2.md` (excluded
from code review). **No production code, config, or dependency changes.**

## Changed-risk map

- `domains`: ui-input-lifecycle (e2e specs).
- `unmappedPaths`: 13 — every task-owned path except
  `create-to-combat.spec.ts`. Manually routed: save-restore coherence
  (`standing-slot-panel` seeded post-mortal save → save-and-cloud pack),
  ritual drive (`combat-and-tribulation`), asset/architecture test
  tooling (no domain pack — bounded, no production reach).
- `deepAuditCandidate`: false. No save/cloud, clock, economy, or
  Vue/Pinia/Phaser production transition changed — quick mode holds.

## Hypotheses attacked

| # | Hypothesis | Evidence | Verdict |
|---|---|---|---|
| H1 | Seeded `foundation_establishment` + companion save incoherent → silent reject | Executed: `standing-slot-panel` passes 43.7s standalone and 41.1s under full-suite contention; restore accepted, panel opened | REFUTED (EXECUTED_RUNTIME) |
| H2 | `it.skipIf` hides assertions on provisioned hosts | Executed: pipeline test runs fully on this Windows host (16.1s), alpha samples execute; skips only when binary absent — fail-safe direction, never false-pass | REFUTED (EXECUTED) |
| H3 | 120s budgets mask a real hang | Executed: `npm run verify` green, 790 files / 253s, all guards terminate | REFUTED (EXECUTED) |
| H4 | Canonical-height poll could mask wrong personHeight | Static: divisor mirrors `resolveEntityDisplaySize` exactly — wrong personHeight ⇒ wrong canonical ⇒ NaN/off-band forever ⇒ still fails. Detection preserved. | REFUTED (SOURCE_PROOF) |
| H5 | Ritual drive masks formation-unlock defect | Spec asserts `realmId==='qi_refining'` post-ritual and slot enabled post-bump — real unlock path exercised, not mocked | REFUTED |
| H6 | Entitlement-modal first-pick nondeterministic | Modal is blocking-by-design; any pick resolves; executed pass | REFUTED |
| H7 | `probeBinary` false-negative under load skips needlessly | 15s budget vs <1s real answer; a miss yields skip, never a false pass | REFUTED (fail-safe polarity) |
| H8 | `pwsh` POSIX path lacks `-ExecutionPolicy` | Gate opens only when pwsh exists; a broken invocation fails visibly | REFUTED |

## Findings

- **Low (fixed in-loop):** `combat-idle-motion-capture` pre-poll
  enemy-definedness check had a wave-gap flake window — replaced by
  NaN-driven `expect.poll` convergence. Re-verified standalone (2.1m).
- **Contention class (documented, not a defect):**
  `combat-vertical-slice` victory loop exceeded its 240s poll ONLY in a
  suite run contaminated by a concurrently-launched standalone spec
  (doubled browser load). Clean standalone rerun: pass (2.5m). The
  budget is sufficient under clean 2-worker load; no change made —
  recorded as a Windows-contention sensitivity, matching the same class
  already handled by `create-to-combat`'s raised budget.

## Verdict label

PASS WITH GAPS — gaps are (a) the full Playwright suite's clean
rerun is in flight for the final evidence line, and (b) Windows host
wall-time variance is a platform property, not bounded by this diff.

No Medium-or-higher defect found. QA write boundary respected: only the
e2e spec files and this report were written during QA.
