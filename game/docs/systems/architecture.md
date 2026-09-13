# Kiến trúc tổng thể

**Trạng thái:** Live — đây là khung authority hiện hành, định nghĩa tại `AGENTS.md` (Part 2) và `docs/roadmap.md` mục 0.

## Stack

Vue 3 + TypeScript + Pinia (UI/state phía người chơi), Phaser (scene nền + chiến đấu), Vite/Vitest, Vue I18n (vi mặc định, en fallback). Entry: `src/App.vue` → `components/layout/GameRoot.vue` + `components/game/PhaserCanvas.vue`.

## Phân lớp

```text
Primitive        (StatBlock, BuffPool, MaterialBag, EquipmentInstance, CombatClock…)
→ Mechanism      (BuffSystem, ActionImpactSystem, WorkerAllocator, ModifierSystem…)
→ Domain System  (CultivationSystem, EquipmentSystem, ProductionSystem, TribulationDirector…)
→ Orchestrator   (GameManager, BattleLootSystem, StageWaveSystem, player store)
→ Presentation   (GamePresentationCoordinator, Phaser scenes, Vue panels, use* composables)
```

- `src/core/` — toàn bộ domain logic. Plain TypeScript, **không** import Vue/Phaser/Pinia, test được headless (Vitest).
- `src/data/` — định nghĩa nội dung tĩnh (enemy, stage, skill, pill, material, building, node tree…).
- `src/stores/` — Pinia: `player.ts` (PlayerData — nguồn sự thật state người chơi phía UI), `ui.ts`, `notification.ts`, `offlineSummary.ts`, `error.ts`, `themeStore.ts`, `saveIssue.ts`, `worldAnnouncement.ts`, `actionFeedback.ts`, `breakthroughRequirement.ts`.
- `src/composables/` — adapter Vue: chỉ đọc state, phát command, điều phối presentation. Không chứa rule.
- `src/game/scenes/` + `src/game/` — Phaser renderer + adapter. Không quyết định outcome.
- `src/services/` — save (`services/save/`), auth (`services/auth/`), cloud save (`services/cloudSave/`), character creation (`services/character/`).
- `src/presentation/` — coordinator + contract (route, session, panel ids) nằm giữa domain và renderer.

## Luật authority đang enforce

- **One rule, one owner** — mỗi rule (công thức damage, vòng đời buff, stack túi…) có đúng một owner; caller dùng kết quả, không tự suy lại.
- **One mutable state, one authority** — mỗi state quan trọng trả lời được: ai write/ai read/ai reset/ai persist.
- **Presentation is not gameplay authority** — Vue/Phaser render, animate, nhận input, ack hoàn thành; không quyết định damage/reward/progression. Visual arrival không được cấp tài nguyên.
- **Queries are observational** — `getActiveQuests()`, getter… không được activate/claim/reset state.
- **Shared rule, single implementation** — cùng một công thức không copy giữa runtime/preview, online/offline, UI/engine.

Các quy tắc này đang được ghi thành test guard (R14, xem `roadmap.md` mục R14 và `tests/architecture/*.test.ts` — vd `coreImportDirection`, `vitalsWriteAuthority`, `statProvenanceAndQueryPurity`, `presentationGate`, `progressionOutcomeOwnership`).

## Orchestrator trung tâm: `GameManager`

`src/core/game/GameManager.ts` + các file `GameManager*.ts` cùng thư mục. Plain class, không biết Vue. Nó giữ registry/manager của từng domain và expose method mà App/store/composable gọi: tick battle, đột phá, mua node, save/load, production, vendor…

- Tick chính: `GameManager.update()` chạy theo fixed-step từ `App.vue` (xem [game-loop.md](./game-loop.md)).
- Battle ops turn-based: `GameManagerTurnBattleOps.ts`.
- Loot: `BattleLootSystem.ts` (được gọi khi enemy chết trong turn engine).
- Session/presentation: `core/presentation/PresentationSession.ts` cấp session id + hold/release token; coordinator ở `src/presentation/` consume.

## Save boundary

`services/save/SaveSystem.ts` — snapshot `GameSave` (version 59 hiện tại), validate shape + registry reference trước khi đụng Pinia. Chi tiết: [save-load.md](./save-load.md).

## Hệ thống phụ trợ xuyên suốt

- `core/events/EventBus.ts` — bus sự kiện nội bộ domain → presentation.
- `core/notification/` + `core/game/NotificationQueue.ts` — toast event (loot, craft, error…) rút ra mỗi tick bởi `App.vue` → `stores/notification.ts`.
- `core/item/` — ItemGrade (5 bậc độ hiếm), ItemQuality (9 bậc phẩm cấp), NameSegment.
- `core/profession/ProfessionGrade.ts` — thang phẩm nghề 10 bậc (xem [profession-grades.md](./profession-grades.md)).
- `core/reward/` — `Reward`/`RewardSystem`/`RewardReceiver` (techniqueInsight, cultivation, spiritStone).
- `core/idle/GameClock.ts` — đo thời gian online/offline (`DEFAULT_MAX_OFFLINE_SECONDS`).

## Xem thêm

- `docs/roadmap.md` — trạng thái từng phase R0–R14 (mục nào shipped/parked).
- `docs/game-guide.md` — tổng hợp gameplay cấp cao (ngắn gọn hơn bộ này).
