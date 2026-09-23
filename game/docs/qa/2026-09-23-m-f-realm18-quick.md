# QA Quick Review — M-F-REALM18 (KD+ realm maxLevel 9 → 18)

Scope: task-owned diff only — `game/src/data/realms/realm.ts` (7 value changes), `game/src/core/cultivation/CultivationSystem.test.ts`, `game/src/core/game/GameManager.progressionScope.test.ts`, `game/src/core/skilldef/LegacySkillCoverage.test.ts`. No unrelated dirty paths existed at review time.

Risk map: `economy-and-progression`; one-hop consumers "UI affordability and unlock state", "save and offline progression"; `deepAuditCandidate: false`. Unmapped paths were the two fixture test files (test-only, manually routed — no domain pack applies; inspected directly).

Deep-escalation assessment: the change touches progression totals and persistence-adjacent reads, but introduces no new transaction and no persisted computed state; every consumer is data-driven off `realm.maxLevel`, the conservation oracle is directly testable, and 1,164 scoped tests are green. Risk is confidently bounded by the invariant ledger below — quick verdict justified.

## Invariant ledger

| ID | State/owner | Action/transition | Invariant | Attack operator | Oracle | Result |
| --- | --- | --- | --- | --- | --- | --- |
| INV-REALM18-1 | KD+ cultivation budgets (`realmSystem.getRequiredCultivation`) | weight sum re-splits over 18 tiers | Conservation: per-realm total ≈ unchanged `realmDurationMultiplier` budget | Value mutation (tier count) | `sum(req) ≤ budget`, drift `< 18` floor loss per realm | PASS — new `it.each` test; computed diffs 7–9 |
| INV-REALM18-2 | `advanceRealmLevel` / `canBreakthrough` | minor breakthroughs at cap | Boundedness: stops exactly at `maxLevel` | Repeat (advance at cap) | advance-to-18-and-stops over every `REALMS` row | PASS — widened `it.each` |
| INV-REALM18-3 | saved player `realmLevel`/`cultivation` (save load) | normalize old cap-9 state | Stale state / monotonicity | Old save at golden_core lvl 9 with cultivation capped at old requirement (≈4.63M) | new lvl-9 required ≈3.14M < stored → one extra breakthrough; cultivation resets; no persisted caps exist | PASS — intended normalization; no migration (E8 dev-phase) |
| INV-REALM18-4 | `getGlobalCultivationLevel` consumers (equipment `MAIN_STAT_REALM_SCALE`, `companionStatsAt` growth, `instance.realmLevel` provenance) | global level for post-golden_core realms rises (e.g. nascent lvl1: 64 → 73) | Synchronization: scaling stays consistent across systems | Cross-system chain | all consumers share the same index-driven sum; `isCompanionSkillUnlocked` compares realm index before tier, unaffected; equipment suite (528 tests) green | PASS |
| INV-REALM18-5 | `saveShapeValidation` companion `realmLevel` bound | bound becomes ≤18 for KD+ | Recoverability: old saves remain valid, out-of-range still rejected | Value mutation | dynamic `realm.maxLevel` read; old saves (≤9) still inside bound | PASS (suite green) |
| INV-REALM18-6 | per-tier requirement sequence | boundary golden_core lvl18 → nascent_soul lvl1 | Monotonicity across realm boundary | Reorder (boundary crossing) | prev-realm last tier (≈11.0M) > next-realm first tier (≈3.08M) — step-down exists at cap 9 too (≈14.2M > ≈13.9M); shape of the budget×3 formula, unchanged | Pre-existing behavior, not a regression — recorded, out of scope |
| INV-REALM18-7 | hard-coded-9 assumptions | repo sweep | no surviving cap assumption | Stale state (literals) | `rg` sweep: only 2 fixture literals + 1 pinned expected value, all updated; `REALM_TIERS` 9-row economic grouping and `SUPPORTED_PROFESSION_REALMS` are orthogonal | PASS |

## Findings

- No confirmed defects. One Low/pre-existing observation: per-tier cultivation steps down at each realm boundary (INV-REALM18-6) — inherent to the 3×-budget formula at any cap; unchanged by this mission and outside its scope.
- Coverage added: realm-table invariant (`every major realm declares 18 minor levels`), per-realm budget-conservation totals for all 7 KD+ rows, widened advance-to-cap coverage across all realms.

## Verdict

PASS WITH EVIDENCE — conservation and boundedness proven by executable tests; no production edits made during QA.
