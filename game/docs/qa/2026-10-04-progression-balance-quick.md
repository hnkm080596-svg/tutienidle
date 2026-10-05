# Adversarial QA (quick) — progression balance pass

Date: 2026-10-04. Scope: task-owned diff on branch `devin/1791147734-progression-balance`:

- `src/data/tribulation/TribulationChapters.ts` (Trúc Cơ tank percents: body 0.10→0.08, lightning 0.13→0.10, final 0.30→0.20)
- `src/core/tribulation/TribulationDirector.terminal.test.ts` (pin re-derivation under the new authored numbers)
- `docs/balance/progression-review.md` (new report, doc-only)

Exclusions: `src/data/progression/PhapTuBasicNodes.ts` was edited then fully reverted (trunk +2%→+2.5% violated the authored +10%/channel cap pinned by `PhapTuBasicNodes.test.ts`); it carries no diff.

Risk-map result: both production paths `unmappedPaths` → manually routed: TribulationChapters is a data leaf consumed by `TribulationDirector` (combat-and-tribulation pack); the terminal test is its own pin layer. No persistence handoff (node/tribulation data rebuilds from authored values on load — `player.nodeLevels` stores levels only).

## Invariant ledger

| ID | State/owner | Transition | Invariant | Oracle | Result |
|---|---|---|---|---|---|
| INV-TRB-1 | Authored chapter percents / `TribulationChapters.ts` | Tank strike applies `pct × gradeMult × talentMult × mitigation × takenMult × (1-correctReduction)` | Boundedness/Determinism — percents stay in (0,1), total raw per grade | Sim table: human 220%, earth 253%, heaven 286% raw — all positive, no NaN | No defect |
| INV-TRB-2 | Terminal outcome / `TribulationDirector` | Lethal strike commits exactly one outcome; no chapter change after defeat | Exactly-once | `TribulationDirector.terminal.test.ts` — 7 boundary cases re-pinned and green | PASS WITH EVIDENCE |
| INV-TRB-3 | In-flight tribulation across save/restore | Persisted `ActiveTribulationState` resumes with NEW authored percents for remaining strikes | Recoverability — resume does not corrupt state; damage just differs mid-run | `persist.test.ts` green; percent change is not persisted state, reload is value-safe | No defect |
| INV-TRB-4 | Penalty path / `TribulationOutcomeService` | Defeat loses cultivation% + stones + Kiếp Thương | Conservation — penalty amounts unchanged by damage tune | Untouched constants; `TribulationOutcomeService.test.ts` green | No defect |
| INV-PROG-1 | Node sibling power / `PhapTuBasicNodes.ts` | Trunk stays at authored +10%/channel cap | Boundedness — design cap invariant | `PhapTuBasicNodes.test.ts` green after revert | No defect (design-cap decision deferred to owner) |

## Findings

- None confirmed against the diff. The two initially failing pin-tests in `TribulationDirector.terminal.test.ts` were re-derived (def 105→70/100→40/130→95, `loi_kiep` ×2 added for body-chapter lethality scenarios now unreachable at human grade since 8%×1.2 wrong-answer max < 100%) — all 166 tribulation/progression-scoped tests green.
- Pre-existing/out-of-scope, recorded for the owner: Insight per-kill income (21-27 LK / 162-216 TC) oversupplies the node tree (~35-76 insight total) by ~1 order of magnitude; knob lives in `src/core/reward/SkillInsightBalance.ts`, out of the authorized data-only domain — documented in `docs/balance/progression-review.md` C2.

## Verdict

PASS WITH EVIDENCE (quick). Escalation to deep audit reviewed and waived: the diff is a data-value tune + its own pin layer, no save/clock/lifecycle or cross-owner boundary change; risk confidently bounded by the two scoped suites (31 files / 286 tests green) and `npm run type-check` clean.
