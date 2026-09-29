# Local Audit — Slice: combat-progression

**Scope:** `game/src/core/{combat,battle,enemy,buff2,skill,skilldef,proc,stats,math,element,formation,cultivation,breakthrough,realm,tribulation,kiem-tu,phap-tu,the-tu,talent,technique,simulation}` + related data files.

**Auditor:** local subagent (combat/progression). **Audit-only** — no production files modified.

---

### CP-01 — HIGH → **FIXED (round 7)** — `percent` modifiers authored on zero-base stats are silent no-ops (5 sites; 2 talents fully dead)

- **Severity:** High
- **Location:** `game/src/core/stats/StatCalculator.ts:231-279` (`runPipeline`: `value = (base + Σflat) × (1 + Σpercent)`), `:76-77` (codebase's own documentation of the rule), `:250` (percent × stacks)
- **Dead sites:**
  - `game/src/core/talent/TalentBuffs.ts:35` — `trong_kich_burst` `finalDamagePercent percent 0.3`
  - `game/src/core/talent/TalentBuffs.ts:48` — `thach_nham` `finalDamageReductionPercent percent 0.5`
  - `game/src/core/talent/TalentBuffs.ts:79-80` — `tu_sinh_ngo` `0.3`/`0.2`
  - `game/src/core/talent/TalentPassives.ts:73` — `pha_giap` `metalPenetration 0.02` (including its carry-bank machinery at `game/src/core/skill/PassiveSystem.ts:176-249`)
  - `game/src/core/talent/TalentPassives.ts:133,141` — `can_than` +0.1 / `can_than_phi` −0.05 via the `stat()` helper at `:42-55` which only emits `percent`
- **Root cause:** `runPipeline` computes `(base + flat) × (1 + percent)`; on a stat whose base + flat is 0 the percent contributes exactly 0. Player bases are 0 for these stats (`game/src/core/stats/StatBlock.ts:88-90`: `finalDamagePercent`/`finalDamageReductionPercent`/`criticalAvoidance`; `:134` `metalPenetration`). Convention everywhere else grows rate stats via `flat` fractions: `game/src/core/the-tu/TheTuBuffs.ts:127,141`, equipment rolls `game/src/core/equipment/EquipmentSystem.ts:912-924` (always `flat`), node riders `game/src/core/phap-tu/PhapTuRealmRewardNodes.ts:66-67` (`flat`/`perLevelFlat`), realm passives use `percent` only on nonzero-base stats (`game/src/core/realm/RealmPassives.ts:46-101`).
- **Doubly dead:** `can_than_phi` additionally cannot express its designed "+5% damage taken" downside — `finalDamageReductionPercent` clamps `min: 0` (`game/src/core/stats/StatMetadata.ts:26`) at the consumer (`game/src/core/combat/CombatSystem.ts:154`).
- **Consumers confirmed live:** `CombatSystem.ts:154` (final damage multiplier), `:327` (criticalAvoidance subtracts from crit roll); buff statModifiers flow verbatim into `StatModifier` (`game/src/core/buff2/BuffQuery.ts:130-141`) → `recomputeEffectiveStats` (`game/src/core/battle/turn/TurnStatsRecompute.ts:17-24`) → `runPipeline`. Grant wiring confirmed working at `game/src/core/game/GameManagerTurnBattleOps.ts:1816`.
- **Repro:** pick `can_than` (grants both passives, `game/src/core/talent/Talents.ts:94-97`) → any battle → damage taken identical at any stack count/HP. `pha_giap`: N landed hits → penetration stays 0. `trong_kich`/`thach_giap`/`bat_tu_the` bursts apply but the stats stay 0.
- **Impact:** 2 talents fully dead, 5 modifier sites inert; designed talent downsides unexpressible.
- **Same-class suspects (nonzero base or flat-source-conditional — intent ambiguous, NOT filed as findings):** `sat_na` `criticalRate percent 0.3` (`TalentBuffs.ts:62`, base 0.05 → +1.5pp vs likely "+30pp"), `the_man_fire`/`the_man_wood` (`game/src/core/talent/ThuanHeBuffs.ts:185,209`), `hap_linh`/`ho_the`/`thu_phat` (`TalentPassives.ts:103,151,163`).

---

### CP-02 — LOW — Passive stack lifecycle leaks out of battle into persistent state and out-of-combat aggregation

- **Severity:** Low
- **Location:** `game/src/core/game/GameManagerTickOps.ts:257` (`passiveSystem.tick` runs unconditionally on the global game tick); `game/src/core/skill/PassiveSystem.ts:79-87` (`meetsCondition` returns true when `hpReader` is undefined out-of-battle; reader at `game/src/core/game/GameManager.ts:337-345`)
- **Root cause:** Out of battle, `meetsCondition` passes with no HP context → `per_second` passives (`talent_passive_can_than`, `can_than_phi`, `hap_linh` — all without `maxStacks`) accumulate unbounded `stacks` on the Skill objects during menu/idle time. Stacks live on Skill instances and serialize via `save.skills` (`game/src/services/save/SaveSystem.ts:341`; round-trip per `PassiveSystem.ts:52-54`), restored on load; cleared only by `resetStacks()` at battle start (`GameManager.ts:1394`, `GameManagerTurnBattleOps.ts:1666`). Post-battle stacks also keep contributing to out-of-combat aggregation via `getScaledPassiveModifiers` (`game/src/core/skill/SkillSystem.ts:238-256` → `game/src/core/game/GameManagerPersistentEffectOps.ts:82,146`).
- **Corollary:** `runPipeline` treats `stacks ?? 1` (`StatCalculator.ts:239`); all 11 talent passives never initialize `stacks: 0` (contrast `game/src/core/skill/PassiveSkills.ts:43`), so each contributes its per-stack value at ×1 permanently until the first stack event/reset.
- **Repro:** idle in menus with a `per_second` passive equipped → stacks grow on the skill object → save/load round-trips them → out-of-combat aggregated stat display inflated.
- **Impact:** Bounded today (the affected stats are dead under CP-01 and combat resets stacks at battle start) — save-payload growth and wrong out-of-combat aggregated display; latent landmine once those stats gain flat bases.

---

## Notes reviewed and cleared (no findings)

- TribulationOutcomeService (idempotent receipt, terminal-fail marker, Great Dao conversion), TribulationChapters loss tables
- RealmPassives/KIEN_CO channels; NodeSystem gates (realm/techniqueRank/node/path/way) + `aggregateNodeStatModifiers`; realm tier map (`body_integration`→tier 8 intentional)
- CombatSystem damage chain incl. endurance/block/clamps; heal_on_kill + tribulation talent effect consumers
- ActionGauge/ResourceTurnHook/TurnStatsRecompute; SkillExecutor/SkillResolver (typed errors, settle barriers, detonate parity)
- EnemySystem spawn/stat normalization; simulation parity via canonical GameManager seams
- Persistent-effect channels (timed/buff/passive/node partitioning); save shape validation for skills
- **Round-4, battle terminal edges:** every death path funnels through `completeAction` (`TurnBattleSystem.ts:3726-3737`) which checks players-all-dead BEFORE `isStageComplete` — mutual-annihilation resolves 'defeat' correctly. The null-actor victory branch (`:3814-3833`) and the paced `tickPacing` victory check (`:1249-1276`) are only reachable while players are alive, because no out-of-action damage path exists: buff-lifecycle `runBuffLifecycle` calls sit INSIDE `declareActorAction` (`:1455,1463,1596`) and `applyDirectDamage`/`applyHealing` only run inside `resolveDeclaredHit` (`:2500,2517`) — all upstream of `completeAction`'s defeat check. Cleared.
- **Round-4, talent combat passives:** production grant path is `GameManagerProgressionOps.syncTalentCombatPassive` (`:120-150`) which iterates ALL `combat_passive` effects across ALL owned talents via `collectTalentEffects` — dual-passive talents (`can_than` declares 2 effects, `Talents.ts:94-97`) and multi-talent ownership both grant correctly. The exported first-match getter `getTalentCombatPassiveSkillId` (`TalentEffects.ts:46-57`) has ZERO production callers — vestigial superseded API (nit, not filed).
- **Round-4, mana shield:** `manaShieldPercent` hard-capped at 0.8 (`StatMetadata.ts:23`, enforced via `clampStatValue` at `CombatSystem.ts:459`) so `hpDamage` can never be driven negative by an over-100% shield portion — no clamp needed on `manaShieldPortion`. Cleared.
- **Round-4, absorb order:** external ward → native ward → mana shield → post-clamp HP truth (`CombatSystem.ts:432-471`); leech/`taken` triggers scale on actual post-clamp HP (D11); ward-break reads the NATIVE component only — external-ward-only absorb never procs it (`:533`). Cleared.
- **Round-4, technique progression:** all functions pure; realm identity via index never string compare; rank ceiling `min(18, realmLevel)` only while live grade is in-band; sealed-cycle completion vocabulary coherent; grade-up is the only grade mutation (`canAdvanceTechniqueGrade`). Cleared.
- **Round-4, talent entitlement transaction:** validate-before-mutate (`resolveTalentEntitlement` checks offer-membership + legality + ownership + maxLevel before any write); persisted record is exactly-once and re-legalized against pool/policy at resolve; stale different-realm records supersede at origination; `reconcileTalentEntitlement` clears rotten records so the uncancellable modal can't soft-lock with no legal decision. Cleared.
- **Round-4, tribulation settlement chain:** `TribulationDirector.commitOutcome` single terminal transition bound to attemptId; `settleOutcome` idempotent on receipt (repeat ticks re-settle the SAME receipt — never double-apply); settlementError marks terminal-failed and drains home; committed outcome + cooldown serialize through the v82 `tribulation` save slice. Cleared.
- **Round-5, vitals authority:** `EntityVitalsSystem` is the sole HP/ward/MP mutation channel — dead entities reject `applyHealing`/`grantWard`/`applyTurnRegen`; every write clamps to live ceilings and emits one uniform vitals event; leech bypasses `healingEffectivenessPercent` by design (INV-13). Cleared.
- **Round-5, skilldef pipeline:** `SkillResolver` produces pure plans through typed `SkillResolverError` guards (passive rejection, active-only variants/composite picks, empowerment root-cast-only, theBurned captured pre-commit); `ScalarExpression` is a pure AST with guarded divide (0 denominator → 0); reads go through narrow `SkillReadContext` (readonly, synchronous, side-effect free — R-S3). Cleared.
- **Round-5, The economy (Ung The):** `grantThe` is the single clamp authority; reactive cost is success-only flat `theCost`; Ung Tre debt is participant-scoped (not a buff), capped at 3 (Qua The closes windows), gauge penalty per debt documented. Cleared.
- **Round-5, skill membership:** `SkillSystem.learn` is the ONLY membership write (duplicate-reject + structuredClone); `unlearn` preserves `skillCastCounts` practice history; `SkillManager.restore` deep-clones payload (no live-state leak); cast-leveled levels derive from `CAST_LEVELING_THRESHOLDS` single table. Cleared.
- **Round-6, settlement runtime:** `CombatScheduler` — single-flight `runInFlight` guard (reentrant run/settle = structural fault, never silent), `faulted` kill-state on any escape, dual work budgets (per-barrier `maxImmediateWorkPerBarrier` + per-run `maxTotalWorkPerRun` — cross-root ping-pong faults instead of livelocking), nesting depth cap, seq allocated BEFORE execute so `seq(op) < seq(its events)`, frame-local event queues share the root unit's budget. `SkillExecutor` orders consume-resource as the FIRST scheduled op (theBurned frozen pre-commit), composite extras resolve before primary steps, `for_each_instance` iterates canonical sorted order with post-settlement visibility. `ReactionSystem` produces at most ONE resolution per elemental application (INV-R05), bias normalized once per evaluation, trace records board+candidates+winner+opIds. Cleared.
