# M13 — Retire proven compatibility debt

Worker result for mission M13 of
`docs/architecture/2026-09-14-arch-repair-program.md` (P2; after M3/M8/M12).
Findings: audit `docs/qa/2026-09-14-full-project-engineering-audit.md` §I;
ledgers `docs/qa/2026-09-14-m12-consumers.md`,
`docs/qa/2026-09-14-m9-buff-identity.md`.

## G0 — Task card

```text
TASK CARD
Task / user request: M13 — retire proven compatibility debt.
Assigned worktree / branch:
  E:\tutienidle\.agent-worktrees\arch-m13-retirement / arch/m13-retirement
  (forked off arch/repair-2026-09 @ 93b5c984, post-M12 merge).
Requested observable behavior:
  1. GameManagerTurnBattleOps.getBattle() and its `as unknown as Battle`
     cast eliminated; every live caller reads the real TurnBattle contract.
  2. Audit §I dead-module candidates retired only after importer/content/
     test-value verification (EnemyAttackSystem, KiemTranOnHitSystem,
     PhapTuBattleResourceSystem, SkillEffectResolver, TheResourceSystem,
     AttackTiming).
  3. M12's three fully dead CombatScene handlers retired
     (onCastStart/onCastComplete/onPlayerTeleported) with their exclusive
     delegates.
  4. Parked modules get explicit status labels, not deletion.
  5. ReactionManager (M9 twin) evaluated: retire or document.
  6. Dead UI candidates checked against templates/tooling before removal.
Single responsibility / invariant: one owner per rule/state; delete only
  what is proven dead; preserve test/standalone event seams and authored
  content.
Current owners (path + symbol):
  - Turn battle: TurnBattleSystem.TurnBattle via
    GameManager.getTurnBattle()/GameManagerTurnBattleOps.getTurnBattle().
  - Reactions (turn): TurnReactionManager; (legacy) element/ReactionManager.
  - Legacy Battle contract: core/battle/Battle.ts (transitional).
Expected files: see diff; report lists every touched file.
Explicit non-goals: porting dormant mechanics (artifact combat runtime,
  E-7 the_man sync, on-hit node effects, per-element The pools,
  attack_speed cadence); deleting parked modules; breaking the
  turn_battle_*/combat event seams; committing the worktree.
Tests and gates selected: FULL P3 — npm run type-check + npm run build +
  npx vitest run. P14 live-browser check deferred per isolated-worktree
  exception (no rendering-affecting behavior changed).
Stop condition: all six §I candidates resolved (deleted or justified),
  cast removed, dead handlers/UI resolved, labels applied, gates green
  with only documented pre-existing failures.
Unresolved material assumptions: none.
```

## Retirement ledger

| Candidate | Evidence | Decision |
|---|---|---|
| `GameManagerTurnBattleOps.getBattle()` / `GameManager.getBattle()` + `as unknown as Battle` | `TurnBattle` is not a structural `Battle` (no `player`, `BattleEnemy[]`, `playerTeleport`, `artifactRuntime`, `mode`, `idle` state). 15 production callers audited: state/countdown readers migrate cleanly; `battle.player` readers map to `players[0]?.entity` (Kiem Tu pools live on `CombatEntity`); `useCombatSceneActive`'s `state !== 'idle'` collapsed to non-null (no `idle` in `TurnBattleState`); `useArtifactCombatPresentation` passed `null` forever at runtime (`artifactRuntime` never exists on `TurnBattle`). | **RETIRED.** Both methods + cast deleted; dep-slot renames `getBattle`→`getTurnBattle` in `GameManagerTurnBattlePresentationOps`/`CombatAnimationRuntime`; `ArtifactCombatPresentation` narrowed to `ArtifactRuntime \| null`. |
| `SkillEffectResolver.ts` | Zero production importers (only `ZoneDotBuffs` comment). Sole consumers of its deps (`gainPhapTuCastResources`, `KiemTranOnHitSystem`) are itself. Its role is covered by `TurnSkillAction`/`SkillToTurnSkillConverter` in the live engine. | **DELETED.** |
| `EnemyAttackSystem.ts` | Zero production importers; `TurnBattleSystem` references are comments documenting the ported `everyNth` semantics (`specialAttackCounter`, TurnBattleSystem.ts:111/927). | **DELETED.** (comments annotated "retired M13"). |
| `KiemTranOnHitSystem.ts` + test | Sole importer was `SkillEffectResolver`; `ProgressionNode.ts` ref is a comment. Authored on-hit nodes (`KiemTuNodes.ts` 9× `onHitNode`, `ProgressionNode.onHitEffect`) are live content — **kept**. | **DELETED** (system + its test). On-hit engine consumer is a documented dormant gap (below). |
| `PhapTuBattleResourceSystem.ts` | Sole importer was `SkillEffectResolver`. `currentHoaThe`/`currentKimThe`/`currentThoThe` pools have no turn-engine writer — dormant mechanic, pre-existing gap. | **DELETED.** Entity fields + `Skill.grantsHoaThePerCast` content kept. |
| `TheResourceSystem.ts` + test | Zero production importers; data refs are comments (`ThuanHeBuffs`, `PhapTuNodes.builders`, `buffs.test.ts`). `currentThe` gains are owned by `TurnBattleSystem` (THE_GAIN_PER_LINK/FINISHER, :1090-1272). The E-7 `the_man_*` buff sync had no caller — dormant pre-M13. | **DELETED.** `the_man_*` buffs + `the_man_<el>` nodes kept; comments retargeted. |
| `AttackTiming.ts` + test | Sole importer was `EnemyAttackSystem`. `attack_speed`/`attack_speed_cast` execution-policy kinds are authored in `Skill.ts`/`CoreSkills`/`KiemTranSkills` but no live code reads `skill.execution` (only `GameManagerSaveRestore` backfills it) — dormant cadence mechanism, pre-existing gap. | **DELETED.** |
| `GameManager.actionImpact` / `GameManager.skillEffectSystem` fields | Zero callers outside the deleted modules and self-mocked tests. `ActionImpactSystem`/`SkillEffectSystem` classes stay (live exports `scaleActionDamage`/`ActionDamageInfo`/`SkillEffectContext`). | **REMOVED** fields + imports. |
| `CombatScene.onCastStart` / `onCastComplete` / `onPlayerTeleported` | M12 retired the EventBus bindings; zero tests/standalone callers since. | **RETIRED** with exclusive delegates: `CombatCastBar.onCastStart`+`CastStartEvent` (CastBarHost narrowed to cleanup API), `actionFeedback.onCastComplete`, `CombatScene.playTeleportVfx`, `vfxSpawner.playTeleportVfx`, `PlayerTeleportedEvent` (BattleEvents). Cast-bar destroy/position/clear machinery kept — called by live entity-removal + encapsulation QA test. |
| `'cast'` event chain (review fix) | `SkillEffectResolver.resolveSkillEffects` was the sole `emit('cast', …)` producer — verified `grep emit('cast'` → only a generic EventBus unit test. Orphaned: binding `CombatScene.getCombatEventBindings`, `CombatScene.onCast` → `CombatActionFeedback.onCast` (flash + floating skill name), `skillName`/`castTimeSeconds` on `CombatScenePayload` (no remaining consumer), constants `CAST_GLOW_COLOR`/`CAST_NAME_COLOR`/`CAST_BAR_BG_COLOR`/`FILL_COLOR`/`HEIGHT` (only `CAST_BAR_OFFSET_Y` still used). | **RETIRED** — binding, handler, delegate, payload fields, and unused constants removed. Distinct from the live `'onCast'` *skill trigger* (SkillTrigger/SkillTriggerRunner) and `turn_cast_start`, both untouched. |
| `GamePanel.vue` | Zero template/tooling importers; `OfflineSummaryModal`/`InkNineSlice` refs are comments; sole consumer was `InkWashLargeSurfaces.test.ts` (variant→asset pairing case). | **DELETED**; that one test case dropped — XL pairing contract still pinned by the live `OverlayPanel` case + raw-source assertions in the same file. |
| `SceneHeader.vue` / `ThemedIcon.vue` / `iconRegistry.ts` / `OnboardingChapter.vue` | Zero importers anywhere (App.vue uses `AuthEntryScreen`/`CharacterCreationScreen` directly; `useTheme` remains live via other consumers; no global CSS references). | **DELETED.** |
| `ReactionManager.ts` (M9 twin) | M9: "production-unreachable, test-covered, legacy identity defect". Current source confirms: never instantiated in production — `CombatSystem` takes it as an OPTIONAL dep `GameManager` never passes, so `fireKillTriggers`→`SkillTriggerRunner`→`SkillActionRegistry`→`SkillEffectSystem.applyAll`→`checkAndTrigger` is gated off at runtime. But it is still the declared type of `SkillEffectContext.reactionManager` consumed by `SkillEffectSystem`/`SkillActionRegistry`, and 3 dedicated test files cover real reaction math. Deleting it would require unwinding the `SkillEffectContext` contract and lose that coverage. | **RETAINED — labelled TRANSITIONAL (production-unreachable)** in module header; defect + rationale documented for a future unwind. |
| `WorldMap.ts` / `HexCoordinate.ts` / `HexLayout.ts` / `WorldMapValidator.ts` | Parked feature family; only the validator test imports them. | **PARKED — labelled**, not deleted. |
| `MeridianSystem.ts` | `openedMeridianIds` is live persisted state (read by `BreakthroughGrades`, save validation) but `investThongMachDan`/`applyMeridianModifiers` have no production caller. | **PARKED — labelled** (state slice live, engine unwired). |
| `ZoneDotBuffs.ts` | NOT registered in `buffs.ts`; header documents the blocked zone-as-dot cutover; only its test consumes it. | **PARKED — labelled** (content anchor). |
| `Battle.ts` | Still the declared contract of dormant `ArtifactSystem`, legacy `ActionImpactSystem` methods, `ActionTargetingSystem` helpers. | **TRANSITIONAL — labelled.** |
| `ArtifactSystem.ts` | `updateArtifactActivation` never called in the turn path; `artifactRuntime` never initialized. | **TRANSITIONAL-DORMANT — labelled.** |
| `SkillEffectSystem` / `SkillTriggerRunner` / `SkillActionRegistry` | Reachable only through the gated `fireKillTriggers` path; `SkillEffectContext` remains a live type contract. | **TRANSITIONAL — labelled.** |
| `ActionTargetingSystem` / `ActionImpactSystem` | `areaFor` / `ActionDamageInfo` / `scaleActionDamage` are live turn-engine imports; their `Battle`-typed APIs are dormant. | **PARTIAL — labelled.** |
| `progressionOps.getOnHitNodeLevelsSnapshot()` | Only consumer is `GameManager.kiemTuWiring.test.ts`; it is the sole read seam for the live-authored `onHitEffect` node content (9 Kiem Tu nodes) whose engine consumer is not yet ported. | **RETAINED** — removing it would lose the only coverage that on-hit node effects are readable; documented dormant-consumer gap. |
| Event seams `turn_battle_entity_snapshot`, `turn_cast_start`, `battle_end`, `positions`/`onPositions`, `combat` | Retained per M12; verified still bound/tested. | **KEPT.** |

## Dormant content gaps surfaced (pre-existing — NOT caused by M13)

These authored mechanics have content but no live engine consumer after the
legacy engine's removal; they were already dormant before this change:

- `onHitEffect` nodes (9 Kiem Tran on-hit nodes) — resolver retired with the
  legacy engine; `getOnHitNodeLevelsSnapshot` kept as the content seam.
- `the_man_<element>` E-7 buff sync — definitions + nodes authored; no
  turn-side applier.
- `currentHoaThe`/`currentKimThe`/`currentThoThe` pools +
  `grantsHoaThePerCast` — no turn-engine writer.
- `attack_speed`/`attack_speed_cast` execution policies — authored on skills,
  no interpreter in the turn engine.
- Artifact combat runtime (`artifactRuntime`) — HUD renders EMPTY_STATE.
- Passive `'cast'` trigger (verified at review): `EVENT_TO_TRIGGER['cast']`
  (`PassiveSystem.ts:37`) subscribes the shared eventBus to an event nothing
  emits now that `SkillEffectResolver` is gone → the authored passive
  `passive_luyen_hu_bo` (`PassiveSkills.ts:277`, wired via `Techniques.ts:209`)
  is orphaned/dormant. Pre-existing dormancy — the passive content and the
  subscription stay for a future producer.
- Orphaned locale keys `onboarding.chapter.*` remain in the i18n data after
  `OnboardingChapter.vue` was deleted — harmless data, flagged here as a
  known orphan rather than swept (key-parity test only guards missing keys).

## Save compatibility (M1)

No retired module owned a persisted slice: the deleted systems operated on
runtime `CombatEntity`/`Battle` fields only. `openedMeridianIds` (persisted)
keeps its owner. `getBattle()` was an API surface, not serialized state.
No save keys dropped; `saveShapeValidation` untouched.

## Files changed

Production:
- `src/core/game/GameManager.ts` — `getBattle()` removed; `actionImpact`/`skillEffectSystem` fields removed; comment updated.
- `src/core/game/GameManagerTurnBattleOps.ts` — `getBattle()` + cast removed; dep rename.
- `src/core/game/GameManagerTurnBattlePresentationOps.ts` — dep rename.
- `src/core/game/GameManagerRealmAdvanceOps.ts` — `getTurnBattle` dep.
- `src/core/battle/turn/CombatAnimationRuntime.ts` — dep rename.
- `src/core/battle/Battle.ts`, `src/core/battle/BattleEvents.ts` — label; `PlayerTeleportedEvent` removed.
- `src/core/artifact/ArtifactCombatPresentation.ts` — narrowed to `ArtifactRuntime | null`.
- `src/composables/useArtifactCombatPresentation.ts` — honest EMPTY contract.
- `src/composables/useCombatSceneActive.ts`, `useStageActive.ts`, `useTribulation.ts`, `src/presentation/bridges/kiemBarBridge.ts`, `src/core/dev/enemySpawnDebug.ts`, `src/App.vue`, `CombatIntroOverlay.vue`, `CombatResultModal.vue`, `CombatCountdownOverlay.vue`, `ArtifactPanel.vue`, `PillBagSection.vue` — migrated to `getTurnBattle()` / `players[0].entity`.
- `src/game/scenes/CombatScene.ts` + `combat/combat-cast-bar.ts` + `combat/combat-action-feedback.ts` + `combat/combat-vfx-spawner.ts` — dead handlers/delegates removed.
- Labels: `core/world-map/*` (4), `core/realm/MeridianSystem.ts`, `data/buff/ZoneDotBuffs.ts`, `core/element/ReactionManager.ts`, `core/artifact/ArtifactSystem.ts`, `core/skill/SkillEffectSystem.ts`, `SkillTriggerRunner.ts`, `SkillActionRegistry.ts`, `core/battle/ActionTargetingSystem.ts`, `ActionImpactSystem.ts`.
- Comment retargets: `TurnBattleSystem.ts`, `TurnBattleSystem.specialAttacks.test.ts`, `ZoneDotBuffs.ts`, `ProgressionNode.ts`, `CombatEntity.ts`, `ThuanHeBuffs.ts`, `PhapTuNodes.builders.ts`, `buffs.test.ts`.

Deleted (11 prod + 3 tests): `SkillEffectResolver.ts`, `EnemyAttackSystem.ts`,
`KiemTranOnHitSystem.ts`, `PhapTuBattleResourceSystem.ts`,
`TheResourceSystem.ts`, `AttackTiming.ts`, `GamePanel.vue`,
`SceneHeader.vue`, `ThemedIcon.vue`, `iconRegistry.ts`, `OnboardingChapter.vue`
+ tests `KiemTranOnHitSystem.test.ts`, `TheResourceSystem.test.ts`,
`AttackTiming.test.ts`.

Tests updated: `kiemBarBridge.test.ts`, `CombatCountdownOverlay.test.ts`,
`tribulationRouting.test.ts`, `useStageActive.resultLifecycle.test.ts`,
`CombatAnimationRuntime.test.ts` + `.r5.reaudit.test.ts`,
`InkWashLargeSurfaces.test.ts`, and 12 `getBattle()`→`getTurnBattle()` call
sites across `GameManager.*`/presentation tests.

## Verification (FULL P3)

- `npm run type-check` (vue-tsc --build): **clean**.
- `npm run build` (run-p type-check + build-only): **built in 6.46s**.
- `npx vitest run`: **554 files / 3916 tests — 3909 pass, 7 fail**.
  - 4× `GameManager.perfectClear.feasibility` multi-hit floors 1/5/9/10 —
    the documented pre-existing/flaky set (see arch-repair-program.md
    "perfectClear quarantine" row; unchanged by M13).
  - 3 flaky-under-load failures, all green when rerun in isolation
    (14/14): `eslintCoreSeverity` (60 s probe timeout under full-suite
    load), `ChiHienQuan.integration` gacha counter,
    `TurnBattleSystem.dotSource.qa` healing threshold. None touch any
    M13-modified path.

## Remaining concerns / Notes

- `ReactionManager` and the legacy trigger chain stay as labelled
  TRANSITIONAL: deleting them requires first unwinding
  `SkillEffectContext.reactionManager` through `SkillEffectSystem` +
  `SkillActionRegistry` + the `fireKillTriggers` optional-dep gate —
  out of M13 scope.
- `CombatCastBar`'s map is now permanently empty (creation path retired);
  its destroy/position/clear API remains as defensive cleanup wired to
  live entity-removal and an encapsulation QA test. A future cleanup may
  retire the whole class if the cast-bar feature is formally dropped.
- Dormant-mechanics list above should be tracked by whichever mission
  ports turn-side on-hit/Thế/artifact/cadence behavior — content and
  tests are preserved.
- roadmap.md M13 row still reads PENDING — coordinator updates on merge.
- Worktree intentionally left uncommitted per instructions.
