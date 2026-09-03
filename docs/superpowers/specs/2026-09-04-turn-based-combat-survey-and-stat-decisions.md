# Turn-Based Combat — Survey Corrections & Stat System Decisions

Date: 2026-09-04
Status: Decisions locked; each item below gets its own future implementation plan (not bundled into one).

## Context

Following the approved design spec
(`docs/superpowers/specs/2026-09-03-turn-based-combat-design.md`) and the
"Foundation" implementation plan
(`docs/superpowers/plans/2026-09-03-turn-based-combat-foundation.md`, 10
tasks, standalone primitives only under `game/src/core/battle/turn/`,
already committed to `master` and being executed in the worktree
`.agent-worktrees/turn-combat-foundation`, branch `feat/turn-combat-foundation`),
this session ran 3 parallel Explore agents over the real production
systems the Foundation primitives will eventually need to wire into
(`BattleSystem.ts`, `CombatSystem.ts`, resource systems,
`ReactionManager`, `HazardZoneSystem`, `Skill.ts`, the Loadout UI,
`TribulationPhase.ts`, Momentum/Break, `BuffSystem.ts`), plus a follow-up
survey of the Stat system (`game/src/core/stats/`). Several findings
**materially correct or extend** what the spec/Foundation plan assumed.
The resulting open forks were resolved with the user directly. Per the
user's direction, each affected system below gets its **own** future
implementation plan, worked one at a time — this document only records
the findings and the decisions, not a combined task list.

## Survey Findings

1. **`MissileSystem` does not exist.** It was already deleted in a prior
   "Combat Grid Rework" (2026-08-24) commit and replaced by
   `game/src/core/battle/CombatAction.ts` + `ActionTargetingSystem.ts`
   (windup→impact model, already grid/row-column-based, no projectile
   flight time). The design spec's "What Gets Removed" section (§8)
   references a system that's already gone — it needs a correction note,
   not an actual removal task.

2. **`CombatAction.ts` already has a shape system**:
   `ActionTargetingShape = 'single' | 'area' | 'line' | 'all_lanes'`,
   `laneRadius`/`columnRadius` fields on `Skill`, and
   `areaFor()`/`collectAffected()` in `ActionTargetingSystem.ts` — used by
   68 call sites via `SkillEffectSystem`/`SkillEffectResolver`. The
   Foundation plan's Task 4 (`AoeShape.ts`, a brand-new parallel shape
   resolver) risks becoming a second, disconnected shape system.

3. **`CombatSystem.ts`'s `resolveActionHit()`** is already fully
   event/instant-resolution (no `deltaSeconds`, no scheduling) — directly
   reusable as-is by the turn engine, no conversion needed.

4. **`ReactionManager.checkAndTrigger()`** is already purely
   event-triggered (called from `SkillActionRegistry.ts`/`SkillEffectSystem.ts`
   at debuff-application time, never from a tick loop) — also directly
   reusable, confirms design spec §5.

5. **Resource regen/decay**: `PhapTuBattleResourceSystem.updatePhapTuBattleResources(player, deltaSeconds)`
   (`game/src/core/battle/PhapTuBattleResourceSystem.ts:13`) is the one
   real deltaSeconds-driven regen/decay function (Hỏa Thế linear decay,
   Kim Thế stepped decay). `KiemTuResourceSystem.ts`'s functions are all
   already event-triggered by signature, except `gainKiemYTempOnChannelTick`
   which is invoked at a deltaSeconds cadence by `BattleSystem.updateChanneling()`
   — the scheduler around it needs turn-conversion, not the function itself.

6. **`HazardZoneSystem.ts`** (Lava Zone / Sword Zone) is **not mentioned
   anywhere in the design spec** — a real gap. Lava Zone uses
   `remainingTime` (real seconds); Sword Zone already uses
   `remainingCharges` (closer to turn-based already).

7. **Boss Enrage/Summon**: `game/src/core/enemy/TribulationPhase.ts` has
   `BossEnrage.afterSeconds` (L42, exactly the field spec §5 targets) and
   `TribulationPhase.summonEnemyIds` (already %HP-gated only, no time
   field to convert). Confirms the spec's planned conversion target
   precisely — no surprises here.

8. **Momentum gain/Break-trigger already exist** in `BattleSystem.ts`
   (~L1452-1475) and are already event-based (hit-landed callback) — spec
   §5 correctly calls these "no change needed." **But Momentum *decay*
   does not exist anywhere in the current codebase at all** — there is no
   `currentMomentum -=` call site. The spec's "decay changes from
   per-second to per-turn" describes a mechanic that must be added new,
   not migrated — lower risk than assumed (nothing to break).

9. **`Skill.ts` already has**: `execution: SkillExecutionPolicy` (a
   discriminated union incl. `cast_time`/`channel` kinds — the real-time
   timing model spec §8 wants replaced by `chargeSteps`), and
   `castTime?: number` which is **already vestigial** ("runtime KHÔNG đọc
   fallback từ đây nữa. Giữ để UI/tooltip hiển thị" — comment at
   `Skill.ts:84-89`). So adding `chargeSteps` is additive to `execution`,
   not a fight against a live field.

10. **Skill Loadout today**: `MAX_SKILL_LOADOUT_SLOTS = 5`
    (`game/src/core/skill/SkillLoadoutSlots.ts:20`). **Ultimate is
    currently a wholly separate pathway** (`UltimateSystem.ts`,
    `buildTag: 'ult'` on `Skill.ts:157`, explicitly excluded from the
    loadout scheduler) — not slot 6 of one array.

11. **No manual "tap to cast" UI exists anywhere today.**
    `CombatSkillSlot.vue`'s own header comment states it is explicitly
    read-only/presentational, no click handler
    ("KHÔNG có nút bấm/hotkey/manual cast"). Building spec §4.5's manual
    mode is greenfield UI work, not a retrofit.

12. **`BuffSystem.ts`** ties ALL duration to real seconds
    (`duration`/`remainingTime`/`continuousSeconds`, `deltaSeconds`-driven
    tick loop at `BuffSystem.ts:233-270`) — every consumer (Reaction
    Engine output buffs, boss enrage buff, Break/`choáng` stagger) goes
    through this one file, making it the single highest-blast-radius
    conversion in the whole rework.

13. **External contract on `BattleSystem`**: `GameManager.updateBattleFixedStep`
    (`GameManager.ts:2878`) drives `battleSystem.update(step)` in a fixed
    real-time step loop shared with `StageWaveSystem.update(deltaSeconds)`
    (`GameManager.ts:2880`); `KiemTuCombatHud.vue` directly touches
    `battleSystem.ultAutoEnabled`/`.tryPlayerUltimate()`/`.setChannelTickSeconds()`.
    Both are real coupling points a future full `BattleSystem` replacement
    will need to redesign. ~16 existing `BattleSystem.*.test.ts` files pin
    real-time tick behavior and will need rewriting when that happens
    (already anticipated by the spec's big-bang stance, not new).

## Stat System Survey

The user flagged that no `speed`/ATB stat exists today. Survey of
`game/src/core/stats/` found:

- **`attackSpeed`** (attacks/sec) is the closest existing analog — it
  already drives "how often a skill loadout slot becomes usable" via
  `BattleSystem.cadenceInterval()` → `skillCadenceRemainingBySlot`
  (`BattleSystem.ts:1828-1833`, `1805-1817`). It has real content already:
  1 equipment affix (`suffix_attack_speed`,
  `game/src/data/equipment/affixes.ts:59-70`), 2 talent/node passives
  (Tật Phong `TalentPassives.ts:78-86`; Kiếm Tu `passive_phieu_van_bo`,
  `KiemTuNodes.ts:127,405`), several buffs (haste/slow, paired with
  `movementSpeed`), 2 enemy abilities, 1 skill effect.
- **`castSpeedPercent`** (shortens `Skill.castTime`) and
  **`cooldownReduction`** (shortens post-cast cooldown) are separate
  stats today, both real-seconds-based, currently near-empty of content
  (`castSpeedPercent` has 0 base, no grants found).
- **`movementSpeed`** is read in exactly 3 places
  (`BattleSystem.ts:1252,1270,1284`), all inside real-time enemy
  grid-approach logic. `StatBlock.ts:29-31`'s own comment already notes
  it's dead for the player ("tower cố định, không dùng movementSpeed cho
  bản thân nữa"). No equipment/talent content grants it — only 3 buffs
  pair it with `attackSpeed` (haste/slow effects).
- Neither `attackSpeed` nor `movementSpeed` has any cap/metadata entry
  today (`StatCap.ts` only caps the 5 main stats; `StatMetadata.ts` has
  no min/max for either) — a Speed stat needs cap/metadata defined from
  scratch regardless of source stat.

## Decisions Locked With The User

**AOE Shape:** extend the existing `CombatAction.ts`/`ActionTargetingSystem.ts`
shape system (add a `'cross'` shape, wire `BounceChain.ts`/`TrueShot.ts`
primitives from the Foundation plan into it) rather than keep a second,
disconnected shape resolver. Foundation plan's Task 4 (`AoeShape.ts`)
needs to be amended when its wiring work starts — the primitive logic
(`isCellInShape`/`boundingBoxForShape`) is still sound and reusable, just
needs to live as an extension of `ActionTargetingSystem.ts` instead of a
standalone file.

**Ultimate:** not a separate system. Ultimate is conceptually just a
stronger skill, tagged `ultimate`, occupying a 6th, non-swappable loadout
slot (`SkillLoadoutSlots.ts` reserves slot index 5 for whichever skill
carries the tag). `UltimateSystem.ts`'s separate-pathway framing is
retired in favor of the unified 6-slot loadout array.

**BuffSystem:** full conversion to turn-based duration for combat buffs.
No parallel real-time field, no back-compat shim (matches the
already-approved big-bang stance).

**HazardZoneSystem:** both Lava Zone and Sword Zone convert to "persists
N turns," ticking damage once per the zone-owner's turn. Sword Zone's
existing charge model maps ~1:1; Lava Zone's `remainingTime` becomes
`remainingTurns`.

**Stat System:**
- `attackSpeed` is renamed/repurposed directly into the new `speed` stat
  that drives ATB gauge fill rate — not a new parallel stat. All existing
  content (affix, 2 passives, buffs, enemy abilities, skill effect)
  carries over semantically, no new itemization needed.
- `castSpeedPercent` and `cooldownReduction` are **retired as separate
  stats** — merged into the same `speed` concept, which now governs
  every wait-time in combat (gauge fill, `chargeSteps` duration, and
  cooldown-in-turns all scale off one stat).
- `movementSpeed` is **deleted entirely**. Its only real-world dependents
  are the 3 buffs pairing it with `attackSpeed` — those need editing to
  drop the `movementSpeed` component and keep only the `speed` component.

## Sequencing

Any implementation building on the AOE Shape / Ultimate / BuffSystem /
HazardZoneSystem / Stat decisions above **cannot start until the
Foundation plan (Milestone 1) is merged** — they reuse Foundation's
primitive files (`BounceChain.ts`, `TrueShot.ts`, `MomentumBreak.ts`,
`BossTurnTriggers.ts`, `ResourceTurnHook.ts`) as finished, tested code.

One item needs to reach whoever is executing the Foundation plan **before
they reach Task 4** (`AoeShape.ts`): the "extend `CombatAction.ts` instead
of a standalone parallel shape system" decision above changes Task 4's
approach. If Task 4 hasn't started yet, relay this now to avoid throwaway
work; if it's already done, correct it as part of whichever future plan
covers the `ActionTargetingSystem.ts` shape extension instead.

## Scope Boundary

Per the user's direction, each system below gets its **own** future
implementation plan, discussed and decided one at a time — not bundled
into a single combined plan:
- BuffSystem turn-duration conversion
- `ActionTargetingSystem.ts` shape extension (cross shape, Bounce/TrueShot wiring)
- Resource turn-hooks wiring (`PhapTuBattleResourceSystem`, `KiemTuResourceSystem`)
- HazardZoneSystem N-turn conversion
- MomentumBreak real wiring (including the new decay behavior)
- Boss `afterTurns` conversion (`TribulationPhase.ts`, `Enemies.ts` data)
- Ultimate-as-loadout-slot (`SkillLoadoutSlots.ts`, retiring `UltimateSystem.ts`)
- Stat System conversion (`speed` stat, retiring `castSpeedPercent`/`cooldownReduction`/`movementSpeed`)
- Equipment/Affix content beyond the 3 `movementSpeed` buffs
- Enemy data (`Enemies.ts`) needing `speed` values for every enemy
- StageWaveSystem's turn conversion
- GameManager's external fixed-step contract replacement
- The manual tap-to-cast UI (`CombatSkillSlot.vue` and friends)

Full `BattleSystem.update(deltaSeconds)` replacement remains the largest
deferred item, downstream of all of the above.
