# QA Review: phap-tu data-slice balance tune

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/data/skill/PhapTuSkills.ts` (TRANG cost 0.30->0.15, tam_muoi potency 1.5->2.0)
  - `game/src/data/skill/Skills.kit.test.ts` (repin 0.15)
  - `game/src/data/buff/LegacyBuffs.ts` (hoa_an coeff 0.15->0.20)
  - `game/src/data/buff/buffs.test.ts` (repin 0.20 + new invariant)
  - `game/src/core/simulation/benchmark/BalanceMatrix.test.ts` (fingerprint regen)
  - `game/docs/balance/skills-review.md`, `game/docs/balance/2026-10-04-phap-tu-data-slice-baseline.md`

## Scope and Risk Map

Mapper output: domain `combat-and-tribulation`; one-hop consumers "combat
presentation and controls" + "loot, progression, persistence after combat";
`deepAuditCandidate: false`. Unmapped paths = the two docs and
`BalanceMatrix.test.ts` — bounded by inspection: docs are reports; the
fingerprint table is the snapshot this tune intentionally regenerates
(contract: regen must land with the causing data change + a dated delta
doc, both done).

No escalation: the diff is three authored numbers + pin updates. No
mechanic, ownership, persistence, or lifecycle transition changed. The
"transaction across a boundary" here is a pure-combat resource cost,
already exercised by the deterministic benchmark harness.

## Invariant Ledger

| ID | State/owner | Action/transition | Invariant | Attack operator | Oracle | Result |
|---|---|---|---|---|---|---|
| INV-DT-1 | `resourceCostPercentOfMax` stamp (LegacySkillAdapter seam) | special cast pays %maxMP | boundedness: cost in (0,1], spend bounded | value mutation | sim `mpSpent` 86->43 per window at 286MP | no defect |
| INV-DT-2 | `tam_muoi` window -> hoa_an application potency | windowed apply carries x2.0 potency mod | boundedness: positive finite multiplier | value mutation | `buff_periodic` share 35-45% -> 45-65% of fire total in long fights | no defect |
| INV-DT-3 | hoa_an periodic coefficient -> legacy_dot tick | DoT amount = coeff x stacks x power | determinism + isolation | repeat | only the 2 spell recipes' fingerprints drift; other 160 cells byte-identical | no defect |
| INV-DT-4 | ailment sibling ordering | fire dot not weakest | authored ordering | -- | new `buffs.test.ts` invariant (hoaAn >= sibling floor) | no defect |
| INV-DT-5 | balance gates | matrix verdicts | determinism | repeat | `dominance PASS`, per-recipe strengths/weakness identical to pins, no stalemate/deadlock, secondaryDominance PASS | no defect |
| INV-DT-6 | affordability edge | current MP < 15% max | boundedness: hasResourceFor gates cast | timing boundary | auto scheduler falls back to basic when unaffordable (selectAction slotReady) | no defect |
| INV-DT-7 | save persistence | saved games | recoverability | interruption | cost/potency/coeff stamped at battle build per battle; nothing persisted -> no migration surface | no defect |
| INV-DT-8 | expectedEconomy declarations | recipe channels | conservation | -- | recipe kit is basic-only; specials absent -> mpSpent/mpGained not-active declarations unchanged | no defect |

## Verification Evidence

| Command/observation | Result | Evidence/limitation |
|---|---|---|
| `npm run type-check` | exit 0 | vue-tsc --build clean |
| `npx vitest run src/data src/core/phap-tu src/core/buff2 src/core/game src/core/simulation/benchmark` | 212 files / 1695 tests pass, 4 expected-fail | includes repinned kit + buff suites |
| deterministic rerun of matrix (fingerprint dump + suite) | identical table twice | determinism pinned |
| UI/locale grep for 0.3 / potency display | no hits | flavor text only, no numbers shown |
| `balance-check` skill invocation | BLOCKED (tooling) | `Unknown subagent profile 'economy-designer'` — manual ledger used instead |

## Findings

None confirmed. Out-of-scope observations recorded in
`docs/balance/skills-review.md` "ngoai pham vi" (stage-floor difficulty,
Thế threshold reachability, dead authored cooldown fields, solo reaction
reachability) — pre-existing/system-level, not defects of this diff.

Learning note for `game/docs/qa/protocol/learning.md`: the `balance-check`
skill profile (`economy-designer`) is not registered in this environment —
skill invocations fail before work starts. Detector: invocation error.
Proposal: register the profile or mark the skill unavailable in org
tooling config.
