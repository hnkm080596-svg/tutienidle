# QA Review: stat-system-reimagined (Tasks 4-12)

- Date: 2026-09-14
- Mode: quick
- Verdict: FAIL
- Task-owned paths: `game/src/core/stats/{StatDomain,StatCalculator,StatBlock,StatTypes,StatMetadata,StatLabels}.ts`, `game/src/core/combat/{CombatSystem,CombatTypes,DotRecovery,EntityVitalsSystem}.ts`, `game/src/core/battle/turn/TurnBattleSystem.ts`, `game/src/core/buff/{BuffSystem,BuffTypes}.ts`, `game/src/core/enemy/{Enemy,EnemyStatInput}.ts`, `game/src/core/equipment/EquipmentStatPolicy.ts`, `game/src/core/player/{Player,CultivationPathSystem}.ts`, `game/src/core/skill/SkillEffectSystem.ts`, `game/src/data/{buff/LegacyBuffs,equipment/equipment,progression/PhapTuNodes.builders}.ts`, `game/src/composables/useTechniqueSections.ts`. Excluded (test-only or docs, reviewed as evidence not surface): the `*.test.ts` companions, `tests/architecture/statDomainWhitelist.test.ts`, spec/plan docs.

## Scope and Risk Map

Changed systems: combat hit/DoT/heal semantics, the stat pipeline + domain gate, enemy authoring boundary, equipment slot/affix pools, Phap Tu player stat assembly, labels. Mapper: `deepAuditCandidate: true` (combat + economy/progression + inventory-equipment). One-hop consumers: player store derived stats, combat entity recompute, save/restore, equipment rolls, loot/progression after combat.

Escalation decision (quick, not deep): the change is broad but every new invariant is fail-fast guarded (domain gate throws in dev/test, whitelist lint has 257 cases, enemy gate throws at `defineEnemy`, pool scarcity has a data-validation test) and the full suite (4,238 tests) is green. The one material cross-system seam found by the ledger (persisted modifiers x domain gate) is recorded below as the single Confirmed finding; no other high-risk hypothesis resisted a bounded oracle. Residual breadth risk is documented under Gaps.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority / outcome |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-1 | `EntityVitalsSystem.applyHealing` | authored heal vs leech vs MP/ward regen | Conservation: heal amp only on authored HP restoration | value mutation (leech on full absorb, dotRecovery heal) | leech bitwise unchanged; authored heal scaled | unit (`CombatSystem.healing.test.ts`) | resolved - green |
| QA-2 | `CombatSystem.resolveAttack` | miss/absorbed/taken outcome | Exactly-once/correctness: `onImpactLanded` and damage-proportional triggers only on `taken` | boundary (full ward absorb, forced miss) | `outcome` field + trigger gating | unit (`CombatSystem.hitOutcomes.test.ts`) | resolved - green |
| QA-3 | `CombatSystem.applyDotDamage` | DoT tick | Conservation: `dotResistancePercent` (minus authored penetration) is the only mitigation; no final-damage amp, ward, leech, thorns | value mutation | DoT ignores `finalDamageMultiplier` | unit | resolved - green |
| QA-4 | `applyDomainGate` in `calculateStats`/`calculateEffectiveStats` | modifier delivery to gated stats | Boundedness/isolation: wrong/absent domain rejected loudly | cross-system chain (all emitters) | throw in dev/test, filter+report in prod; whitelist lint | unit + `statDomainWhitelist.test.ts` (257) | resolved - green |
| QA-5 | Phap Tu attunement->MP emission in `resolvePlayerFinalStats` | MP derivation ordering | Exactly-once: emitted once pre-pipeline, delta-deriver only inside effective-stats | repeat (per-tick recompute) | no double MP | unit (`CultivationPathSystem.test.ts`) | resolved - green |
| QA-6 | `normalizeEnemyStats` / `defineEnemy` | gated stats and reaction ids on enemy input/definitions | Boundary: declared base slots allowed; modifier channels and reaction-tagged ids rejected | value mutation (cast payloads, embedded buffs) | throws with named stat/id | unit (`EnemyStatInput.test.ts`, 16 tests) | resolved - green |
| QA-7 | `EQUIPMENT_SLOT_STAT_POLICY` + `MAIN_STATS` + affix pools | speed pool scarcity (D1/INV-15) | speed never the sole desirable roll | data sweep | >=2 competitive stats per speed pool | unit (`EquipmentStatPolicy.test.ts`) | resolved - green; necklace mains gained `defense`/`evasionRate` rivals |
| QA-8 | `player.restoreFromSave` baseStats | legacy key restore | Recoverability: `createBaseStats` backfill + rename/drop | stale state | migration assertions | unit (`player.restoreFromSave.test.ts`) | resolved - green |
| QA-9 | `player.restoreFromSave` persisted modifiers x `applyDomainGate` | legacy timed/persisted modifier on a now-gated stat | Recoverability: a legit pre-domain save must recompute without a gate throw | stale state + cross-system chain | `player.finalStats` after restore | integration repro | **FAIL - Confirmed** (QA-2026-09-14-001) |
| QA-10 | `StatLabels` | `might` label + stale `attack`-era strings | presentation correctness | inspection | `Sức mạnh`; no `Công kích` remnant on might | unit + inspection | resolved |
| QA-11 | thorns / ward-break on `absorbed` hits | defender retaliation when hpDamage = 0 | semantics preserved: both were `hpDamage > 0`-gated before the outcome enum | boundary | unchanged guards in `CombatSystem` | inspection | resolved - identical pre-change behavior |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | PASS | vue-tsc clean |
| `npm run build` | PASS | 7.6s, pre-existing chunk-size warnings only |
| `npx vitest run` (full) | PASS | 560 files / 4,238 tests, 4 expected-fail (pre-existing) |
| `npx vitest run src/core/enemy` | PASS | 26 tests incl. 10 new gate tests |
| `npx vitest run src/core/equipment src/data/equipment tests/architecture` | PASS | 689 tests |
| `npx vitest run src/stores/player.legacyGatedModifier.qa.test.ts` | **FAIL (intended)** | both repros throw `[StatDomain] gate violation` |
| Inspection: `CombatSystem` thorns/leech/ward-break guards | unchanged | all still `hpDamage > 0`-gated, matching pre-enum behavior (D21's "unaffected" clause) |

## Findings

### QA-2026-09-14-001: pre-domain persisted modifiers on gated stats trip the domain gate on restore

- Severity: Medium
- Status: Confirmed
- Invariant: Recoverability — a legitimate save written before the `StatModifier.domain` field existed must restore and recompute without a gate violation.
- Preconditions: save persisted while a timed effect carrying a now-gated stat was active — e.g. an MP-regen pill (`stat: 'manaRegenPerSecond'`, or `'manaRegenPerTurn'` written in the rename-era window) or a `speedMultiplier` timed effect (migrates to `productionSpeedMultiplier`, gated `'production'`).
- Reproduction: `src/stores/player.legacyGatedModifier.qa.test.ts` — two cases; `restoreFromSave` then the per-tick `externalModifiers` feed + `player.finalStats`.
- Expected: restore + recompute succeeds (the legacy modifier is either safely dropped or accepted under its owning domain — `migrateStatModifier` owns legacy-shape knowledge).
- Actual: `migrateStatModifier` renames the stat key but never tags `domain`; the gate sees `modifierDomain='universal'` on a gated stat and **throws in dev/test** (first post-restore recompute), **drops + `console.error`s the modifier in production**.
- Evidence: both tests fail with `Error: [StatDomain] gate violation: modifier "..." targets stat "..." gated to domain "..." but declares domain "universal"`.
- Test file: `game/src/stores/player.legacyGatedModifier.qa.test.ts`
- Owner subsystem: `src/core/stats/statKeyMigration.ts` / `src/core/stats/StatDomain.ts` boundary.
- Blast radius: production — any real save with an in-flight gated-stat timed effect loses that modifier's contribution for its remaining duration (bounded, self-heals at expiry, no corruption); dev/test — the recompute throws, so a legacy save can crash a dev session's first stat pass. Same defect class also covers `applyTimedEffect` group-refresh merging a new tagged modifier into a persisted untagged one (the old untagged modifier is kept).
- Resolution (post-review repair, dev workflow): `migrateStatModifier` now backfills `domain` = the persisted stat's owning domain when the saved modifier is untagged — legacy payloads restore their intended grant; saved wrong-domain tags are still rejected. Repro tests flip green and remain as regression coverage.

## New or Changed QA Tests

- `game/src/stores/player.legacyGatedModifier.qa.test.ts` — two intended-failing repros for QA-2026-09-14-001 (MP-regen pill legacy modifier; production-speed legacy modifier). Proves the restore->recompute path, not just the gate unit behavior. Must remain as the regression test after the production repair.

## Gaps and Residual Risk

- The gate's production path (`filter + console.error`) is not covered by a `MODE==='production'` test — current evidence is code inspection; recommend a scoped `throwOnViolation=false` test in the fix-up.
- `applyTimedEffect` group-merge keeps a persisted untagged modifier (same finding class; not separately repro'd — the repair point is identical).
- No e2e save-reload run in this pass (isolated worktree — P14 browser deferral applies); store-level repro stands in.
- Residual breadth: 4 expected-fail tests are pre-existing and unrelated (recorded under Pre-existing Failures).

## Pre-existing Failures

- 4 `expected fail` tests across the full suite — present before this feature, unrelated.

## Learned-defect ledger row (to append)

| QA-2026-09-14-001 | Persisted StatModifier x domain gate on restore | Restore a save whose persisted modifier targets a stat that became domain-gated after the save was written | A legit legacy payload must recompute without a gate violation; migration owns the legacy-shape knowledge | The rename pass covered stat KEYS but the new `domain` field was not backfilled for persisted modifiers; existing migration tests asserted remapped keys, never recomputed stats | `game/src/stores/player.legacyGatedModifier.qa.test.ts` | For a new gated/restricted field on persisted payloads, weight the restore->recompute chain end-to-end, not just field-level migration assertions |
