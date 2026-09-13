# Presentation — routing, session, scene

**Trạng thái:** Live.

`presentation/` (adapter layer) + `core/presentation/` (contract thuần, không phụ thuộc Phaser) + `game/scenes/` (Phaser). Vue Router **không** điều khiển route gameplay — hash history tồn tại nhưng không có route record ý nghĩa; toàn bộ chuyển cảnh qua `GamePresentationCoordinator`.

## Route & coordinator

`Route = 'boot' | 'auth' | 'character' | 'home' | 'combat' | 'tribulation' | 'error'`.

`GamePresentationCoordinator` — **sole owner** của presentation routing, transition, phase deadline. Chuỗi transition (mỗi bước có deadline, `DEADLINES`: curtain 2s, assets 30s, deactivate/prepare 10s):

```
validate/admit → hold session → close curtain → ensure host/assets →
deactivate prior → set renderRoute → prepare/READY →
commit currentRoute/attach → open curtain → release runtime → idle
```

- `ALLOWED_EDGES` — bảng cạnh hợp lệ (vd `home → combat|tribulation|auth|error`; `combat → home|combat|error`; `error` đi được mọi nơi).
- `RouteRequest` — `combat`/`tribulation` cần `SessionRef` hoặc `behindCurtain` (bắt buộc khi chưa có session — là nguồn duy nhất tạo session cho request đó). `behindCurtain` = domain work chạy sau khi màn che đóng, trước khi reveal; trả `false` → transition fail.
- `Phase`: `idle | closing | loading | activating | awaiting-ready | opening | failed`.
- Port: `RendererPort` (prepare/deactivate), `CurtainPort` (close/open), `AssetPort` (ensureFor), `DeadlineScheduler` — coordinator test được headless qua port giả.

## Session — `core/presentation/PresentationSession`

Session identity cho runtime gameplay đang gắn vào màn hình: session id, mode interactive/headless, hold/release semantics, generation token, attach/detach. Chống stale: transition mang `transitionId` + `sessionId` + `gameGeneration` — ack/ready của session cũ không được resolve waiter mới (A3 generation check).

## Renderer — `PhaserSceneAdapter`

Sole owner vòng đời primary scene: `PRIMARY_SCENE_ROUTES = { home: MainScene, combat: CombatScene, tribulation: TribulationScene }`.

- Chỉ adapter start/stop primary scene; đúng 1 primary scene active ở steady state.
- Đăng ký readiness waiter `{transitionId, sessionId, gameGeneration}` **trước** khi start scene; `reportReady` resolve đúng waiter khớp, một lần.
- Combat → combat cùng route: explicit scene **rebind** thay vì destroy `Phaser.Game`.

`VueRouteAdapter` — bridge phía Vue phản ánh `currentRoute`/`renderRoute` ra DOM.

## Scene (`game/scenes/`)

- `MainScene` — động phủ/home, map tĩnh + building.
- `CombatScene` — renderer trận turn-based: subscribe `BattleEvents` (positions, impact, status VFX, reward particle, teleport, battle end), project `BattleGrid` qua `BattleGridProjection`, HUD qua `PlayerHudLayer`, coalesce position khi timer throttle (`applyPendingPositions`).
- `TribulationScene` — UI độ kiếp (ink-wash style, `InkWashUiPhaser`).
- `TranPhapCombatPreviewScene` — preview đội hình.
- `AssetLoaderScene` — preload tài nguyên.

Scene chỉ render + ack playback (P17): không quyết định kết quả; combat clock freeze `not-revealed`/`turn-in-flight` tới từ gate presentation.

## Cơ chế phụ

- `presentation/gate/PresentationGate` — typed command port: domain push command, presentation đọc qua `readOptionalGate`/`writeGate` — không đụng private state lẫn nhau.
- `presentation/host/useDynamicRegion` — vùng động Vue mount theo region.
- `presentation/geometry/` — `BattleGridProjection`, `combatInsets`, `formationSlot*`, `combatEntityScale`, `combatBodyAnchors`: **một projection đo được** dùng chung Vue+Phaser (A10 — không copy kích thước).
- `presentation/art/` — `CombatPresentationCatalogue`, `PlayerVisualProfiles`, `CombatArtTier`: catalog asset pháp nhân/quái.
- `presentation/background/` — `DongFu*` động phủ, `ThanhVanBackdropArt`, `BackgroundVariant`.
- `presentation/bridges/kiemBarBridge` — đọc Kiếm bar cho HUD.
- `core/presentation/` — `PresentationSession`, `OverlayLayers`, `ActionAvailability`, `labels` (thuần, không Phaser).
- `game/support/` — VFX/art helper phía Phaser: `ActionImpactVfx`, `EnemySpawnVfx`, `RewardGourd`, `InkWashUiPhaser`, `BattleLayers`, `CombatPreload`, `phaserThemeBridge`, backdrop Thanh Vân.

## Liên quan

- [combat-overview.md](./combat-overview.md) — battle event/clock contract.
- [architecture.md](./architecture.md) — layering primitive→presentation.
- [ui-and-i18n.md](./ui-and-i18n.md) — Vue panel/store phía trên.
