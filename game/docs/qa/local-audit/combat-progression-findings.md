# Local Audit — Slice: combat-progression

**Scope:** `game/src/core/{combat,battle,enemy,buff2,skill,skilldef,proc,stats,math,element,formation,cultivation,breakthrough,realm,tribulation,kiem-tu,phap-tu,the-tu,talent,technique,simulation}` + related data files.

**Auditor:** local subagent (combat/progression). **Audit-only** — no production files modified.

---

### CP-01 — HIGH — `percent` modifiers authored on zero-base stats are silent no-ops (5 sites; 2 talents fully dead)

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
