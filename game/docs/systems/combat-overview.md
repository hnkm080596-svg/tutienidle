# Chiến đấu — Turn Battle Engine

**Trạng thái:** Live — engine ATB turn-based là authority chiến đấu hiện tại. Engine legacy còn ở `core/battle/legacy/` là **Legacy** (chờ dọn, không phải authority).

Entry orchestrator: `core/game/GameManagerTurnBattleOps.ts` (`buildTurnBattle`, tick, settle offline). Engine: `core/battle/turn/*`. Renderer: `game/scenes/CombatScene.ts` + `components/game/combat/*`.

## Phase state machine

`TurnBattleState`: `intro → countdown → fighting → victory | defeat`.

- **intro** — pacing tick `INTRO_TOTAL_TICKS` (curtain/zone reveal), gauge đóng băng.
- **countdown** — `COUNTDOWN_TOTAL_TICKS` (3-2-1), enemies đã spawn đứng yên.
- **fighting** — ATB chạy, wave spawn theo nhịp.
- **victory/defeat** — kết quả; `MAX_TURNS = 10_000` chặn trận vô hạn.

## ATB — ActionGauge + TurnQueue

- `GAUGE_MAX = 1000`; mỗi step mọi actor sống `actionGauge += speed × STEP_RATE(1)` (`ActionGauge.ts`).
- `resolveNextTurn` (`TurnQueue.ts`): lặp step cho tới khi có actor đủ gauge; nhiều actor cùng đủ → speed cao trước, bằng nhau → `priority` nhỏ trước (player > ally theo slot > enemy theo spawn). `MAX_STEPS = 100_000` chống treo khi mọi speed ≤ 0.
- Sau hành động `consumeGauge(fractionConsumed)` — mặc định trừ hết 1000, buff có thể giảm fraction để actor tới lượt sớm hơn; `grantGauge` hồi tức thì.
- Đây là **lượt-pacing logic**, không phải giây thực — CombatClock (bên dưới) mới quyết định nhịp step chạy ra wall-time.

## CombatClock — nhịp riêng của combat

`core/battle/turn/CombatClock.ts`: `COMBAT_STEP_SECONDS = 0.1`. Clock tự đếm qua `ClockSource` inject (browser RAF/interval hoặc `ManualClockSource` cho test headless). Chỉ chạy khi không có `FreezeReason`: `tab-hidden` | `not-revealed` | `turn-in-flight`. **Thời gian off-screen/mid-turn bị bỏ, không gom lại.**

## Turn structure — declare → apply

`TurnPipeline` + `resolveNextStep()`:

1. **Declare** — chọn skill, resolve target set, scale damage, xử lý charge/counter/reaction-path… tất cả ghi vào `TurnDeclaredAction`, **chưa** áp damage.
2. **Apply** — `applyActionImpact()` đọc declared action và áp damage/effect lên participant.

Hai pha tách để presentation có thể diễn đòn (playback) trước khi số thật trừ, và để follow-up/counter biết chính xác đòn đã declare.

## Skill slot & priority

Mỗi `TurnBattleParticipant` có 3 slot (`TurnSkillSlotRole`): `basic` (không cooldown/cost), `special`, `ultimate`. Auto-priority mỗi lượt: **ultimate → special → basic** → fallback `basic_attack` hardcoded nếu không có slot nào. Cooldown `remainingCooldownTurns` giảm 1 mỗi lượt của owner; skill còn cần đủ `resourceCost` (`SkillResourceType`: linh lực/pháp lực/kiếm thế/kiếm ý…).

`TurnSkillDefinition` hỗ trợ: `damage` (physical/element/true…), `targeting` (shape/scope), `targetScope: 'self'`, `resourceType`/`resourceCost`, `compositePicks` (reaction-path pool — chọn 2 pick), `appliesBuff`, `appliesAilment(s)` (chance-gated, apply qua `apply_buff` ops → `elemental_application_committed` feed canonical reaction gate), `consumesAilmentId`+`damagePerStack` (detonate), `consumesWardForDamage` (Thổ Tu tự nổ khiên), `healPercentOfDamage`, `chargeTurns` (Thế→Trảm), `counterable`/`counterSkillId`, `presetId` (VFX).

## Counter & charge

- Counter: đòn `counterable` trúng participant có counter buff → follow-up `counterSkillId`. `MAX_FOLLOW_UP_CHAIN_DEPTH = 4` — 2 bên cùng counter không bounce quá 4 nhịp liên tiếp.
- Charge (`chargeTurns`): lượt đầu `isCharging` (giữ `pendingChargedSkillId`), lượt sau `chargeResolved` — target capture tại declare, damage áp tại apply.

## Wave & spawn

`Stage.waves: number[]` — số quái spawn **đồng thời** mỗi wave; `sum(waves) === totalEnemyCount` (test invariant). `effectiveWaves()`/`effectiveTotalEnemyCount()` áp override: stage floor 10 boss ép `[1]`. Spawn placement: `EnemySpawnPlacement.ts` trên grid 10×16, player gate mép trái.

## Sudden death & enrage

Trận kéo dài có `suddenDeathMultiplier` scale damage theo thời gian (capture tại declare). Boss có `BossEnrage` + phase theo ngưỡng HP (`TribulationPhase` type trên Enemy — xem [enemies-stages.md](./enemies-stages.md)).

## CombatEntity & vitals

`core/combat/CombatEntity.ts` + `EntityVitalsSystem.ts` — entity trong trận có stats snapshot (`playerToCombatEntity`, `enemyToCombatEntity`, `companionToCombatEntity`), vitals (hp, ward, mp…), `BuffPool` riêng. Vitals mutation chỉ qua owner path (R1/R14 guard: không write HP ngoài permitted vitals paths).

## Party & companion

`toTurnBattleParticipant` chuyển player/companion thành participant; party formation `DEFAULT_PARTY_FORMATION`/`resolvePartyFormation` xếp vị trí; companion từ `COMPANIONS` registry ([companions.md](./companions.md)).

## Presentation session

Battle chạy dưới `PresentationSession` (`core/presentation/PresentationSession.ts`): session id tăng đơn điệu, interactive session bắt đầu `held` cho tới khi renderer `attach` rồi `release` — chống engine chạy trước khi màn hình sẵn sàng. Headless (test/settle) detach chuyển mode headless.

`CombatAnimationRuntime` + `ResumePlayback` quản lý animation ack — ack **pace** action, không quyết định outcome (P17). `TurnActionPresentationEvents` emit snapshot/impact event cho renderer.

## Chế độ battle (UI store)

`BattleRunMode`: `manual` | `repeat` (đánh lại stage) | `progress` (auto tiến stage kế) | `perfect_farm` (farm stage đã hoàn mỹ). `combatInputMode`: `auto` (engine không pause) | `manual` (pause tới lượt player chờ chọn skill qua 3 nút) — trục riêng với run mode.

## Combat contract layer — built-but-dormant

Contract layer cho combat (spec `.superpowers/sdd/2026-09-17-combat-systems-contract-spec.md`, megaplan `2026-09-17-megaplan-combat-contract`, branch `feat/combat-contract`) đã build xong nhưng **chưa route gameplay** — gameplay authority hiện tại vẫn là pipeline declare → apply phía trên.

- `core/battle/contracts/` — contract types: `CombatOperation` union (16 member generic, không primitive theo-path), `CombatOperationResult`, `CombatEvent` (producer emit envelope-free payload → scoped sink mint `eventId` + causation id), `CombatOperationOrigin`, `CombatRng`, settlement/batch types.
- `core/battle/runtime/scheduler/` — `CombatOperationExecutor` (pure router `op.type` → authority port), `CombatScheduler` (settlement barrier sau mỗi op, per-execution event frames depth-first, exactly-once `eventId` dedup, dual guard `settlement_depth_exceeded` / `settlement_work_budget_exceeded`, fault lane out-of-band qua `diagnosticSink`), `CombatOperationBatchRunner` (atomic preflight + deferred `heal_from_damage_result`), `CombatTrace` (journal + causation tree §85), `CombatTraceExporter` (dev-only serializable snapshot — không phải dependency của gameplay path).
- Composition root `GameManagerTurnBattleOps.mintCycleScheduler()` mint executor + scheduler mỗi battle cycle, inject vào `TurnBattleSystem` — **dormant**: chưa có authored op nào route qua; port `buffs` để `undefined` chờ buff megaplan. Adapter damage/heal/gauge/resource/shield đã nối vào engine hiện tại (`runtime/scheduler/adapters/`).
- RNG: `mintCycleRng()` mint một `CombatRng` mỗi cycle — mọi roll của engine đi qua `roll()`/`rollChance()` của nó; `SeededCombatRng` qua `setBattleRngFactory` phục vụ determinism test.
- DoD sweep theo spec §104 (row → test hoặc sibling plan): [../architecture/2026-09-17-combat-contract-dod.md](../architecture/2026-09-17-combat-contract-dod.md).

Các sibling plan (skill / reaction / buff megaplan, seal batch) sẽ produce + consume trên layer này.

## Liên quan

- [damage-pipeline.md](./damage-pipeline.md) — damage resolve chi tiết.
- [buffs.md](./buffs.md), [skills.md](./skills.md), [elements-reactions.md](./elements-reactions.md).
- [enemies-stages.md](./enemies-stages.md) — stage/wave/boss data.
- [drops-loot.md](./drops-loot.md) — loot khi enemy chết.
- [presentation.md](./presentation.md) — scene + coordinator.
