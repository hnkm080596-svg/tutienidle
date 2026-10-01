# QA Review: beta consumer seams (Clean Round B — blind)

- Date: 2026-10-01
- Mode: deep (blind adversarial, integration/consumer seam)
- Base: `devin/qa-fixpoint` @ 5431ae7e
- Verdict: FINDINGS — 4 confirmed defects (2 Medium, 2 Low). Every
  finding is a dormancy-leak on the consumer side: mount seams and one
  banned-import surface that trust Pinia/store state instead of the
  authored scope verdicts.

## Findings

| ID | Severity | Repro (failing test) | Claim |
| --- | --- | --- | --- |
| F-B-CONS-1 | Medium | `tests/architecture/betaConsumerSeams.qa.test.ts` — "a direct ui.leftPanelMode write can never mount the scope-hidden panel" + "the mounted surface can spend live materials…(upgrade chain)" | `FunctionOverlayPanel.mode` reads `ui.leftPanelMode` with no `isBetaLeftPanelMode` check. `openLeftPanel`/`toggleLeft` gate, but a direct store write mounts `<WorkerLodgePanel>`: tab bar + chi_hien_quan header (name, art, level) + actionable upgrade button. `buildingOps.upgradeBuilding` is ungated at the domain layer → foundation-realm player spends `mortal_ore_decade ×4` and `refreshAutoWorkerCapacity` writes the dormant `player.autoWorkerCapacity` field. Root class: mount-seam defense asymmetry — GameRoot defends `ui.standalonePanel` via an `isBetaStandalonePanel` watcher precisely because "a caller bypasses ui.openStandalonePanel and assigns the state field directly"; the sibling mount seams lack the same watcher AND the downstream domain commands lack the fail-closed guard that `consumePill`/`assignWorkers` carry. |
| F-B-CONS-2 | Medium | same file — "a direct ui.activeBuildingPopoverId write can never render the scope-hidden build card" + "the popover Build path constructs the scope-hidden building…" | `GameRoot` line ~111 mounts `BuildingDetailPopover` on `v-if="ui.activeBuildingPopoverId"` with no `isBetaBuildingSurface` check. `openBuildingPopover` gates (ui.ts:292) but a direct write renders the full Chiêu Hiền Quán build card (name, description, cost rows, "Xây dựng" button via `template && !instance`). `buildingOps.buildBuilding('chi_hien_quan')` is ungated → live `BuildingInstance` created + `autoWorkerCapacity` written. Same root class as F-B-CONS-1. |
| F-B-CONS-3 | Low | same file — "WorkerLodgePanel never imports CompanionAvailability and consumes the tab read model" | `WorkerLodgePanel.vue` line 15 imports `isCompanionDomainUnlocked` from `@/core/companion/CompanionAvailability` — the explicit contract §F ban ("Never import CompanionAvailability" on the worker lodge surface). The panel rederives tab visibility from a realm predicate instead of consuming `getWorkerLodgeSurfaceModel()` — the authored read model has zero consumers (dead code), so tab verdicts can drift from the verdict authority. Currently fails closed under the lock (companion tabs don't render), so no live leak today — the defect is the banned dependency + unconsumed authority. |
| F-B-CONS-4 | Low | same file — "a farm whose stage id no longer resolves renders nothing actionable" | `AutoFarmIndicator` falls back to rendering the raw `autoFarmStage.stageId` string as the farm name when the id doesn't resolve: "Đang Tự Động Hoàn Mỹ: ghost_stage_beta [Dừng]". Reachable only via a mid-session corrupt lease (restore-time `reconcileAutoFarmRuntime` drops unresolvable farms) or direct write; the Stop button self-clears it. Display-layer trust of a raw persisted field instead of the resolved stage name. |

## Borderline note (not counted)

`LoreCodex` + material surfaces render carried dormant materials'
descriptions verbatim — `chieu_hien_lenh` ("dùng tại Chiêu Hiền Quán
để chiêu mộ đồng đội"), `doan_bao_thach` ("nâng phẩm bản mệnh pháp
bảo") — dormant-system teasers under §I. Carried-save only, no gameplay
effect; flagged for the coordinator to adjudicate whether authored
description strings count as "UI mentions".

## Novel attacks tried — clean

- `getStageSurfaceModels` over the real catalog (30 stages): every
  `displayEnemy` resolves inside `BETA_ENEMY_ROSTER`; no phantom stages.
- Carried `autoFarmStage` on a real-but-never-perfect-cleared stage and
  on an unregistered ghost stage id with forged `perfectClearStageIds`:
  both dropped by `reconcileAutoFarmRuntime`; `settleAutoFarmOffline`
  grants nothing.
- Precursor parity (contract §J): `tram`/`linh_bao`/`huy_quyen` all in
  `MORTAL_PRECURSOR_SKILL_IDS` + `CAST_LEVELING_THRESHOLDS`;
  `getPrecursorFlatDamageBonus` = floor(casts/10), uncapped, shared.
- `betaCompletionFor` fires only on `foundation_floor_10` (act-3 whelp
  stage) cleared.
- Carried `hiddenPerfection.realms.qi_refining` record →
  `betaHiddenRealmRecordFor` returns undefined (record never surfaces).
- `getWorkerLodgeSurfaceModel()` itself is correct: `nhan_cong`
  available (manualAssignOffered false), all 3 companion tabs
  scope-hidden — the model is right; its consumer is missing (F-B-CONS-3).
- Vendor: `sellMaterialToVendor` rejects `chieu_hien_lenh`,
  `doan_bao_thach`, `duyen_phan` (no profession meta → unsellable) —
  carried dormant mats have no live sink.
- Carried `questManager` active progress on removed `daily_*` quest id:
  `reconcileQuestLifecycle` drops it from `getActiveQuests`.
- Verified clean by inspection (prior pass): usePillDetailed
  scope_hidden reject, CombatBuild way/companion/formation degrade,
  getBattleBaseChannels gating, unsupportedReleaseReason boot notice,
  quest catalog beta-only, isCurrentShapeModifier whitelist,
  BuildingConstructionGate gated funnel, hidden-beast spawn funnel.

## Access limitations

None — full repo, vitest, and catalogs available.

## Evidence

`tests/architecture/betaConsumerSeams.qa.test.ts`: 15 tests —
6 fail (the defect assertions above), 9 pass (clean probes).
`npx vue-tsc --noEmit` clean on the file.
No production edits; tests-only QA pass per P4 write boundary.
