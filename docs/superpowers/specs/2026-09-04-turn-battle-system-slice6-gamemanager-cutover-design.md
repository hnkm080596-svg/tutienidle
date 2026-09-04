# Turn Battle System — Slice 6: GameManager Cutover — Design Spec

Date: 2026-09-04
Status: Approved (design). **BLOCKED — see §2.** Implementation plan not written this session; write it once the blocker clears.

## 1. Motivation

This is the real flip: `GameManager`'s combat entry points
(`startBattle`/`startStage`/`updateBattleFixedStep`/`getBattle`/
`getStageProgress`) route to `TurnBattleSystem` instead of the live
`BattleSystem.ts` (~2400 lines, 18-step real-time pipeline). Per user
decision this session, this is a genuine cutover — not a parallel
"new entry points alongside the old ones" — so `BattleSystem.ts` and
its exclusive dependents (`HazardZoneSystem.ts`, `UltimateSystem.ts`)
are retired, and the ~16 `BattleSystem.*.test.ts` files are rewritten,
matching this whole rework's "big-bang, no back-compat shim" stance.

## 2. Blocker (locked, 2026-09-04) — read before planning implementation

**Stat System conversion (`attackSpeed`→`speed`, full 5-main-stat
deep-think) must be DONE before this slice can be implemented.** The
user explicitly declined the faster alternative (using
`stats.attackSpeed` directly as a temporary `speed` bridge, matching
the "no rebalance" policy already used everywhere else in this rework)
— real turn order needs the real Stat System conversion finished, not
a bridge. This spec is written now per the roadmap's standing "survey
+ design ahead of time" pattern, but **no implementation plan is
written until the Stat System deep-think session (already flagged in
the roadmap, not yet scheduled) completes.**

## 3. Scope Decision: Minimum-Viable Content, Not Full Parity (locked, 2026-09-04)

The user chose **minimum content to make the flipped game playable**,
not full feature parity across every build before flipping:

- Every build (5 Pháp Tu elements' Thuần chains, Kiếm Tu, Thể Tu, Phàm
  Nhân — 8 builds total) needs a real `basicSkillId` mapped before
  flip. `special`/`ultimate` roles can stay unmapped (fall back to
  `basic` via Slice 2's existing priority-selection fallback) and be
  filled in incrementally by separate future content plans, same as
  buff/resource/boss content (§5).
- This means a real player post-flip fights using only their basic
  attack until further content plans add their special/ultimate —
  a real, visible gameplay downgrade versus the current live game,
  accepted explicitly by the user as the cost of flipping sooner.
- **Known gap**: channel-execution skills (Kiếm Tu's Bạt Kiếm Thuật
  ultimate) have no turn-based model at all yet (`chargeSteps`/channel
  policy was never built — flagged as an open gap since the original
  Slice 2 brainstorm, still open). Bạt Kiếm players lose their signature
  mechanic until a future content+engine plan adds channel support.
  Not blocking this slice's flip, but must be called out to the user
  as a real, known regression at flip time, not silently dropped.

## 4. Scope

**Prerequisites (must exist before this slice's plan can execute — not
built by this slice's own plan):**

1. **Stat System conversion** (§2) — hard blocker.
2. **Basic-attack content mapping** for all 8 builds — a `Skill`
   object's `cooldown`/`resourceType`/`cost`/`damage`(derived from
   `effects`)/`targeting` fields copied into a `TurnSkillDefinition`
   per build (straight field copy, per Slice 2's spec §3 note that
   real content mapping is "not a redesign"). Real data work, not
   scoped here.
3. **Enemy basic-attack content mapping** — every `Enemy.specialAttacks[]`
   entry (or lack thereof) converted to a `TurnSkillDefinition` basic
   attack per enemy in `Enemies.ts`. Real data work, not scoped here
   (already flagged as a deferred roadmap item from Slice 2).
4. **Real wave/stage spawn content** — `StageWaveSystem.pickEnemyForSpawn()`'s
   real logic (enemy pool roll, elite chance, hidden-beast, boss-on-floor-10)
   wired as the real `spawnEnemy` factory Slice 5 built the mechanism
   for. Without this, multi-enemy stages cannot progress past their
   first kill. Real data/wiring work, not scoped here (already flagged
   deferred from Slice 5).

**In scope for this slice's own plan (once prerequisites land):**

- `toTurnBattleParticipant(entity: CombatEntity, priority: number, basic: TurnSkillDefinition): TurnBattleParticipant` —
  adapter wrapping the already-existing `playerToCombatEntity()`/
  `enemyToCombatEntity()`, reading real `speed` from the (by-then-real)
  Stat System, constructing a fresh `TurnBuffPool`.
- Replace `GameManager.updateBattleFixedStep(deltaSeconds)`'s body: an
  auto-loop at a fixed step interval (a new constant, e.g. every 0.15s
  of accumulated `deltaSeconds` — a display-pacing choice, not a
  gameplay-affecting one, since turn resolution is already
  instantaneous/event-based) calling `TurnBattleSystem.resolveNextStep()`
  repeatedly, replacing `battleSystem.update(step)`. `grantBattleRewardIfNeeded()`
  keeps firing after each step (ordering requirement preserved from
  the original survey). `stageWaves.update(step)`/`resolveBossSummons()`
  calls are removed — wave spawning now happens inside
  `resolveNextStep()` itself (Slice 5).
- Replace `startBattle`/`startStage`/`getBattle`/`getStageProgress` to
  construct/read a `TurnBattle` instead of a `Battle`.
- Retire `KiemTuCombatHud.vue`'s 3 direct write call sites
  (`setChannelTickSeconds`/`ultAutoEnabled`/`tryPlayerUltimate`) — the
  Ultimate role auto-fires via Slice 2's existing priority selection
  (ultimate → special → basic) with no manual button needed; there is
  no manual/auto distinction to toggle until Slice 7 adds manual
  casting. `setChannelTickSeconds`'s slider has no target (channel
  skills are a known gap, §3).
- Adapt the 7 read-only UI call sites (`CombatCountdownOverlay.vue`,
  `CombatResultModal.vue`, `PillBagSection.vue` ×2, `ArtifactPanel.vue`,
  `CombatTopBar.vue`, `MortalCombatHud.vue`/`KiemTuCombatHud.vue`'s
  `isBattleInProgress()` gating) to read `TurnBattle.state`/wave
  progress instead of `Battle.state`/`StageWaveSystem.getProgress()`.
- Rewrite the ~16 `BattleSystem.*.test.ts` files — big-bang, no dual
  pinning of old real-time behavior.
- Retire `BattleSystem.ts`, `HazardZoneSystem.ts` (superseded by the
  zone-as-dot decision, Slice 3), and `UltimateSystem.ts` (superseded
  by the Ultimate-is-just-a-skill-role decision).

**Explicitly out of scope (deferred, tracked in roadmap):**
- Special/ultimate content mapping beyond basic attack (§3).
- Buff/resource/boss real content — not needed for the minimum-viable
  flip since only basic-attack skills (no `appliesBuff`, no
  `resourceType`, no `bossTrigger`) are guaranteed present at flip
  time. Adding real content to these is separate future work,
  independent of the flip itself.
- Channel skill support (§3) — real gap, not fixed here.
- Manual tap-to-cast UI — Slice 7, built after this slice, not
  required for the flip to be playable (auto-only).

## 5. What This Slice Proves

Once its prerequisites land, `GameManager`'s combat surface runs
entirely on `TurnBattleSystem` with no dual-system coexistence — every
build can fight (basic attack only) through real stages with real
multi-wave spawning, and the old real-time engine is fully retired.

## 6. Roadmap Note (to be copied into the roadmap doc)

- **Slice 6 implementation plan**: not written this session — blocked
  on Stat System conversion (§2). Write it once that lands.
- **Channel skill support** (`chargeSteps`/channel execution policy) —
  still an open gap (originally flagged at the Slice 2 brainstorm),
  now confirmed as a real, accepted regression at flip time (§3), not
  merely deferred-and-forgotten.
