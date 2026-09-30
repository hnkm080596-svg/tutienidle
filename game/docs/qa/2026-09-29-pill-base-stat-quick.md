# Quick adversarial QA — pill permanent_stat → baseStats

Scope: `pill-base-stat` worktree diff (PillSystem, GameManagerPillOps, StatCap,
realm data, CharacterPanel, PerfectionEconomy, tests). Risk map: economy-and-
progression + ui-input-lifecycle; unmapped paths manually routed:
GameManagerPillOps + StatCap + PerfectionEconomy → economy-and-progression.

## Invariant ledger

| ID | Hypothesis | Invariant | Result |
|---|---|---|---|
| INV-PILL-1 | Pill write bypasses cap | Boundedness | REJECTED — canUseProfessionPill gates `current + value > cap`; apply clamps `Math.min(cap, …)`; guarded by architecture census test |
| INV-PILL-2 | consume before apply → lost pill | Atomicity | REJECTED — useProfessionPill applies, then bag removal happens in usePillDetailed after ok |
| INV-PILL-3 | baseStats write during live battle desyncs entity | Synchronization | REJECTED — entity baseStats minted at battle build (GameManagerProgressionOps:896); mid-battle +1 lands on next battle, same as level-up allocation |
| INV-PILL-4 | legacy save `pill-permanent:*` modifiers rejected by restore | Recoverability | REJECTED — main stats are universal domain; restore whitelist keeps them; effective stat stacks (earned bonus, migration out of scope this phase) |
| INV-PILL-5 | tiered pill `value>1` rejected at cap-1 loses the pill | Conservation | REJECTED — gate rejects, pill stays in bag, `bag.pill.reason.cap` toast (key exists vi+en) |
| INV-PILL-6 | third baseStats writer sneaks in | Authority | PINNED — tests/architecture/baseStatsWriteAuthority.test.ts scans prod writes; only ProgressionOps + PillSystem allowed |
| INV-PILL-7 | random_main_stat + permanent_stat double-count | Exactly-once | REJECTED — random picks stat below cap, permanent adds to baseStats; same pool, same cap |
| INV-PILL-8 | respec/devReset wipes pill-granted baseStats | Monotonicity | REJECTED — respec refunds node-tree points only; baseStats untouched |

## Evidence gate

All hypotheses resolved by source proof + targeted unit tests
(PillSystem.profession.test.ts: cap-edge apply, no-modifier, atomic reject;
PillRework.test.ts: authored permanent_stat ⊆ MAIN_STAT_KEYS;
baseStatsWriteAuthority.test.ts: writer census). No failing-repro defect found.

## Note (not a defect)

Legacy saves retain `pill-permanent:*` modifiers (earned, still applied) — a
pre-change player can exceed cap by legacy modifier amount. Old-save migration
is explicitly out of scope this phase.

## Operation label: PASS WITH EVIDENCE
