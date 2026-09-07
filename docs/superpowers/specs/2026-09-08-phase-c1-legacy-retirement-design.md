# Phase C1 — battle/legacy Retirement Design

**Status:** Approved (delegated inline execution authority, 2026-09-08).

**Roadmap context:** mục 0 Phase C1 — `Xóa battle/legacy/ (engine
real-time cũ) + gỡ shim`, gated on A1+A2 (both shipped, plus A3/A4/A6).

## Survey findings (2026-09-08)

- `GameManager.update()` no longer calls `battleSystem.update()` or
  `stageWaves.update()` — the legacy tick loop is already dead.
  `BattleSystem.start()` is called once per battle to seed a mirror
  Battle object nothing drives.
- `StageWaveSystem.update()`'s legacy spawn loop and
  `resolveBossSummons()` are dead code (never invoked from any prod
  caller). Its live surface: `start`, `stopRepeat`, `getProgress`,
  `pickEnemyForTurnSpawn`.
- `setArtifactRuntime`: artifact combat HUD already returns EMPTY during
  real combat (`TurnBattle` has no `artifactRuntime` field) — artifact
  activation has been inert since Slice 6 (driven only by the dead
  `BattleSystem.update()`). C1 does not add a turn-side artifact
  implementation (separate future feature); HUD behavior unchanged.
- `setChainDefinition` / chain gating: legacy-only (A3 locked the
  divergence — no chain gating in turn combat).
- `resolvePersistentBuffEntity` reads legacy `battle.player` — rewire to
  turnBattle `players[0].entity`.
- `GameManager.kiemTuWiring.test.ts` test 1 pins legacy
  `initChannelState` — retire that assertion. To keep Kiếm bar parity,
  `buildTurnBattle` gains a call to
  `initKiemTuBattleResources(playerEntity, route, kiemYPermanent)` (the
  helper already exists in `KiemTuResourceSystem.ts`; the legacy call
  site dies with the folder).
- `PhapTuNodes.dao.test.ts` imports the `PHAP_TU_ULTIMATE_IDS` re-export
  → re-point to `data/skill/PhapTuUltimates`.
- `Playtest.continuousCombat.test.ts` + 29 `BattleSystem.*.test.ts`
  stubs pin/retire legacy → delete with the folder.
- `StageWaveSystem.spawnTelegraph.test.ts` pins the dead `update()` loop
  → retire.

## Scope

1. `GameManager`: remove legacy field + constructor, `.start()`,
   `setArtifactRuntime`, `setChainDefinition`, legacy fallbacks in
   `getBattle` / `abandonBattle` / `grantBattleRewardIfNeeded`,
   `syncLegacyBattleState` (+ combatAnimationRuntime dep + call sites).
   `resolvePersistentBuffEntity` rewires to the turn battle player
   entity.
2. `StageWaveSystem`: remove `battleSystem` dep + dead `update()` +
   `resolveBossSummons` + `queueEnemySpawn` typing.
3. `buildTurnBattle`: call `initKiemTuBattleResources` for Kiếm bar
   parity.
4. Delete `src/core/battle/legacy/` + `BattleSystem.*.test.ts` +
   `Playtest.continuousCombat.test.ts`; retire the spawnTelegraph test.
5. `PhapTuNodes.dao.test.ts` re-point import.
6. `Battle.ts` keeps its shape (type still referenced by the getBattle
   cast and consumers); removing `lavaZones`/`swordZones` fields is
   type-only cosmetic — deferred to avoid scope creep.

## Non-Goals

- Turn-side artifact implementation (separate feature — artifact
  activation is already inert in real gameplay; HUD unchanged).
- Removing core/battle modules only legacy used (e.g.
  `SkillEffectResolver`) — separate pass; they compile independently.
