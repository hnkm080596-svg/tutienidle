# Mission G — Dead Code & Type Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Delete confirmed dead code and legacy bridges (dev-stage rule: nothing to preserve), close `as never`/`any` contract gaps, deduplicate the small copies.

**Architecture:** M13 dormant cluster and legacy migration shims are deleted outright with their tests adjusted to surviving contracts. Cast sites get real types. Duplicated rules collapse onto their authoritative owner.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/specs/2026-09-16-audit-remediation-spec.md` Mission G. Audit: `docs/qa/2026-09-16-full-project-scout-audit.md` T8-69..75, plus type-audit findings.

## Global Constraints

- Dev-stage rule: delete legacy bridges — `statKeyMigration`, retired-save shims, `pham_nhan` keys, transitional types. No compat layer.
- **Exception:** artifact combat runtime files stay parked (reimagine after pathway framework — locked decision); but UI advertising of artifact combat effects is removed in this mission.
- P8: replacing `as never`/`any` with real types is the point — don't introduce new casts.
- Every deletion must be verified unreachable by import-graph grep BEFORE deleting (audit already did this once — re-verify at execution time since code may have drifted).
- Worktree: `.agent-worktrees/cleanup` (branch `chore/cleanup`).

---

### Task 1: M13 dormant cluster deletion

**Files (verify-then-delete):** `game/src/core/skill/SkillTriggerRunner.ts`, `game/src/core/skill/SkillEffectSystem.ts`, `game/src/core/skill/SkillActionRegistry.ts` (runtime registry portion — keep `SkillAction`/`TriggerBinding` types consumed by `SkillToTurnSkillConverter`), `game/src/core/battle/ActionImpactSystem.ts` (class portion — keep `ActionDamageInfo`/`scaleActionDamage`/`HitResolveOptions` used by turn engine), `game/src/core/battle/ActionTargetingSystem.ts` dead helpers, `game/src/core/battle/Battle.ts` transitional types, `game/src/core/artifact/ArtifactDropBalance.ts`, `game/src/core/combat/CombatSystem.ts` `fireKillTriggers` + `killIfDead` 3rd param.

- [ ] For EACH file/symbol: `grep` all importers; confirm only tests or dormant peers reference it; delete symbol + its dedicated tests; keep shared live types.
- [ ] `npx vitest run src/core` + `npm run type-check` green after each cluster deletion.
- [ ] Commit `chore(core): delete dormant M13 execution cluster`

### Task 2: Legacy bridge deletion

**Files:** `game/src/core/stats/statKeyMigration.ts` (+ call sites in `player.ts` restore, `saveShapeValidation.ts`), `TurnBasicAttacks.ts` dead `the_tu`/`pham_nhan` keys, retired save-resolution shims (retired `hoi_xuan_dan` handling in `GameManagerPillOps` — simplify to rejection), unreachable legacy realm-formula branches (`realmSystem.ts:51-58,77-83`), `Buff.ts` one-line shim.

- [ ] Verify each is only reachable via old-save paths; delete; fix call sites (validator/restore no longer remap — they reject or read current keys only); update tests that exercised the bridges to assert the new behavior.
- [ ] Commit `chore: remove legacy save/stat bridge code`

### Task 3: `as never` / `any` contract fixes

**Files:** `game/src/core/game/GameManagerTickOps.ts:276` (fake Material → typed fallback `Material`), `game/src/components/panels/equipment-hall/DecomposeTab.vue:70,74` (`as never` → `DecomposeSettings['gradeFilter'|'ageFilter']`), `game/src/core/battle/ActionImpactSystem.ts:196,207` (typed event payload — or delete with Task 1 if the whole class goes), `game/src/game/scenes/CombatScene.ts:580,587` (`(event: any)` → `EventHandler<never>`), `game/src/components/game/PhaserCanvas.vue:182,203` (`declare global` in `env.d.ts` for `__tutienPhaserGame`), `game/src/game/scenes/combat/combat-status-tooltip.ts:68` + `presentation/host/useDynamicRegion.ts:228,232` (drop unnecessary double-casts), `CombatScene.ts:1042` redundant `!`, `DropRoll.ts` covered by Mission E (skip if already landed).

- [ ] One commit; `npm run type-check` green.
- [ ] Commit `refactor(types): replace as-never/any casts with real types`

### Task 4: Dead UI/state + artifact advertising removal

**Files:** unreachable `MainMenu` overlay path (`App.vue:192` `setShowMainMenu`), empty `router`/`vue-router` decision (remove dep + file or keep — decide by whether any nav is planned; if removing, update `package.json`), dead store fields (`player.load`, `markRealmEnhancementUnlocked`, write-only `isCultivating`, `pendingEquipTarget`, `combatOrigin`), `beginTribulation` dead op, `resolveSpriteBodyAnchor` (+its test), `spiritStoneIdForRealm`, `filterNguHanhElements`, `Buff.ts` (if not in Task 2), artifact combat presentation chain (`useArtifactCombatPresentation.ts`, `ArtifactCombatSlot.vue`, HUD mount) + any UI text advertising artifact combat effects.

- [ ] Verify unreachable per item → delete → type-check + targeted tests.
- [ ] Commit `chore(ui): remove dead presentation chains and stale store fields`

### Task 5: Dead data + roadmap truth

**Files:** `game/src/data/stage/Stages.ts:145` (floor-8 `foundation_metal_beetle_swarm` → `foundation_ferocious_metal_beetle_swarm` — fix the typo, it's real content), `game/src/data/materials/materials.ts:104,112` (no-producer entries — remove from allowlist or add a producer; pick removal, note in roadmap), `TurnBasicAttacks.ts` dead keys (Task 2 overlap — do once), `realm.ts:56` stale comment path, `realm.ts:10-16` stale legacy-formula comments.

- [ ] Commit `fix(data): floor-8 enemy typo, remove producer-less materials, comment truth`

### Task 6: Dedup batch

**Files:** `game/src/core/game/BattleLootSystem.ts:699-721` (two identical color tables → one), `NodeTreePanel.vue:219` + `NodeInspector.vue:62` (→ `getNodeMaxLevel`), `VendorBalance.ts:61-72` `ESSENCE_REALM_ORDER` (derive from `RealmTierMap` or document intentional divergence with a comment), shared `buildProfessionMaterialId` constructor (ProductionCatalog/AlchemySystem/EquipmentOperationCostCatalog/buildings/AlchemyView), `MaterialBag`/`PillBag` mutable-stack exposure (return immutable copies or read models), `player.ts` insight-settle loop ×2 → shared accrual helper, `useTribulation.ts:24-28` realm map → `getNextRealm`, `useBuildingHeaderState.ts:42-57` → `buildingOps` quote, `useEquipmentTooltip.ts:104-111` fallback formula → require the quote param, `CharacterCreationScreen.vue:37` budget `5` → `CHARACTER_CREATION_ATTRIBUTE_POINTS`, `GameManagerPersistentEffectOps` tu_linh_tran read → store consumes a domain getter, starter `huy_quyen` double-backfill.

- [ ] Each dedup: single owner, both consumers route through it; per-item regression test where behavior is observable.
- [ ] Commit `refactor: collapse duplicated rules onto single owners`

---

## Mission G done-criteria

- M13 dormant cluster and legacy bridges deleted; type surface has no production `any`/`as never` left (except documented test-harness boundary).
- No unreachable UI/state/data ships; artifact combat advertising gone.
- Duplicated rules collapsed onto single owners.
- `npm run type-check` + `npx vitest run` green; P4 quick QA; P5 review.
