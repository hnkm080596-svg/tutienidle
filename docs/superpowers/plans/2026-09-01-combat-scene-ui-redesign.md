# Combat Scene UI Redesign (6A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline execution — user yêu cầu inline, KHÔNG subagent). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HP/MP/Kiếm + nút Thoát vào trong Phaser canvas (PlayerHudLayer), bỏ 3 bar DOM, floating text đầy đủ (kill + heal), insets top-only.

**Architecture:** PlayerHudLayer mới (graphics 2-layer Rectangle theo enemy HP pattern), event `heal` mới emit từ EntityVitalsSystem (filter healing/leech), exit bridge canvas→DOM qua `combat_exit_request`, 3 file bar DOM xóa sau khi extract confirm modal + migrate slider/ult vào KiemTuCombatHud.

**Tech Stack:** TypeScript, Phaser 4, Vue 3, Vitest. Không dependency mới.

**Spec:** `docs/superpowers/specs/2026-09-01-combat-scene-ui-redesign-design.md` (đã lock với Phase 2A — đọc trước khi execute).

## Global Constraints

- **ĐIỀU KIỆN TIÊN QUYẾT: Phase 2A phải đã merge vào master** (spec §3 tương thích). Verify trước Task 1: `git log master --oneline --grep="trigger"` thấy commits Phase 2A; nếu chưa — DỪNG, báo user.
- **Không đụng** `core/skill/**`, `SkillActionRegistry`, `killIfDead`, equipment/materials (plan Codex song song).
- **Inline execution** — user yêu cầu, không dispatch subagent.
- UI Layout Rule (AGENTS.md): vị trí HUD tính từ `viewport.width/height` — không hardcode px ngoài constants; resize → re-layout.
- Reduced-motion: bỏ pop scale, giữ fade (`matchMedia` đọc 1 lần).
- Verify chuẩn: type-check + focused vitest mỗi task; full suite + build cuối phase; e2e boot-fresh + create-to-combat cuối.
- Không xóa file nào trước khi grep hết consumers (checklist Task 8).

---

### Task 1: Event `heal` — emit từ EntityVitalsSystem

**Files:**
- Modify: `game/src/core/combat/EntityVitalsSystem.ts` (applyHealing L61-71)
- Modify: `game/src/core/combat/CombatEvent.ts` (union L1-10)
- Test: `game/src/core/combat/EntityVitalsSystem.test.ts` (thêm mục nếu file có sẵn; không thì tạo)

**Interfaces:**
- Produces: event `'heal'` payload `{ type: 'heal', sourceId?: string, targetId?: string, value: number }` — combat union thêm `'heal'`.
- Emit rule: trong `applyHealing(target, amount, sourceId, reason)` — emit khi `reason === 'healing' || reason === 'leech'` và `amount > 0`. **KHÔNG** emit khi reason `'regen'` (spam mỗi tick) hoặc amount 0.

- [ ] **Step 1: Failing test** — applyHealing với reason 'healing' amount 50 → subscriber nhận event heal value 50; reason 'leech' → nhận; reason 'regen' → KHÔNG nhận; amount 0 → không nhận. (dùng EventBus thật + spy listener)
- [ ] **Step 2: Run** `npx vitest run src/core/combat/EntityVitalsSystem.test.ts` — FAIL
- [ ] **Step 3: Implement** — trong applyHealing sau khi `emit('entity_vitals_changed')` hiện có, thêm emit heal theo rule; thêm `'heal'` vào CombatEvent union. KHÔNG đụng signature có sẵn.
- [ ] **Step 4: Run** — PASS
- [ ] **Step 5: Commit** `feat(combat): emit 'heal' event from vitals (healing/leech, not regen) — 6A`

### Task 2: Floating text — kill + heal trong CombatDamageText

**Files:**
- Modify: `game/src/game/scenes/combat/combat-damage-text.ts` (thêm 2 method)
- Modify: `game/src/game/scenes/combat/combatConstants.ts` (colors mới)
- Modify: `game/src/game/scenes/CombatScene.ts` (subscribe kill + heal — handlers bound array/subscribes L1351-1378)
- Test: `game/src/game/scenes/combat/combat-damage-text.test.ts` (mở rộng file có sẵn từ T2.3 era — hoặc CombatScene.lifecycle pattern)

**Interfaces:**
- Produces (CombatDamageText):
  - `showKillText(sprite: EntitySprite): void` — text "Hạ Gục!" 18px bold `#f4f4f0` stroke 0xc94b4b, tại entityHeadY − 12, rise 24px/500ms fade, depth OVERLAY_UI+7 (pattern showFloatingText L165-183 nhưng kích thước lớn hơn)
  - `showHealText(sprite: EntitySprite, value: number): void` — text `+${formatNumber(value)}` 14px `#7bd88f`, tại entityHeadY, rise 20px/620ms fade (pattern showFloatingText)
- Constants mới: `KILL_TEXT_COLOR = '#f4f4f0'`, `KILL_TEXT_STROKE = '#c94b4b'`, `HEAL_TEXT_COLOR = '#7bd88f'` trong combatConstants.ts
- CombatScene wiring:
  - `killHandler = (event: CombatEvent) => this.damageText.showKillText(spriteFor(event.targetId))` — guard sprite null; bind vào subscribes (copy pattern damageHandler L1372)
  - `healHandler = (event: CombatEvent) => { if (event.value && event.value > 0) this.damageText.showHealText(spriteFor(event.targetId), event.value) }` — guard null sprite
  - off tương ứng trong unsubscribe (L1396+)

- [ ] **Step 1: Failing test** — combat-damage-text test: event kill → text "Hạ Gục!" tạo tại vị trí sprite (mock scene pattern file test hiện có); heal value 123 → "+123" màu xanh. Guard: sprite null → không crash.
- [ ] **Step 2: Run** — FAIL
- [ ] **Step 3: Implement** — 2 method + 2 handler + constants
- [ ] **Step 4: Run** focused + `CombatScene.lifecycle.test.ts` PASS (subscribes thêm phải cleanup — kiểm test shutdown có assert off không, thêm nếu thiếu)
- [ ] **Step 5: Commit** `feat(combat): kill + heal floating text — 6A`

### Task 3: `combatInsets.ts` top-only

**Files:**
- Modify: `game/src/game/support/combatInsets.ts` (bottom=0, xóa FALLBACK_EVENT_BAR/FALLBACK_CONTROL_BAR + bottom trong fallback formula L54-65)
- Test: `game/src/game/support/combatInsets.test.ts` (tạo nếu chưa có)

**Interfaces:**
- Produces: `setCombatInsets({ top, bottom: 0 })` — bottom param giữ để tránh breaking đổi call site nhưng always 0; `getCombatInsets()` trả `{top, bottom: 0, measured}`; fallback chỉ tính top theo ratio (DESIGN_HEIGHT 1440, FALLBACK_TOP_BAR 64 + FALLBACK_STATUS_BAR 56 giữ — status bar vẫn còn trong inset top lúc transition; Task 8 xóa hẳn CSS var thì cũng chỉ còn topBar).

- [ ] **Step 1: Failing test** — setCombatInsets({top: 100, bottom: 999}) → getCombatInsets().bottom === 0 (ép 0); fallback(1080) → bottom 0; measured=false → fallback dùng.
- [ ] **Step 2-4:** FAIL → implement (gõ bottom=0 trong set + fallback) → PASS
- [ ] **Step 5: Commit** `refactor(combat): insets top-only — 6A`

### Task 4: `PlayerHudLayer.ts` — HP/MP/Kiếm trong canvas

**Files:**
- Create: `game/src/game/scenes/combat/PlayerHudLayer.ts`
- Create: `game/src/game/scenes/combat/PlayerHudLayer.test.ts`
- Modify: `game/src/game/scenes/combat/combatConstants.ts` (sizes/colors)

**Interfaces:**
```ts
// PlayerHudLayer — constructor(scene, viewportProvider: () => {width, height})
// Creates: hpBg/hpFill Rectangles + hpLabel Text, mpBg/mpFill + mpLabel (optional),
// kiemBg/kiemFill + kiemLabel (optional) — depth DEPTH_OVERLAY_UI + 2,
// tất cả setScrollFactor(0) để neo camera.
export class PlayerHudLayer {
  constructor(scene: Phaser.Scene, opts: { width: number; height: number })
  layout(width: number, height: number): void          // gọi từ applyBattlefieldLayout resize — vị trí tính: hpY = height − HUD_MARGIN − labelH...
  updateHp(current: number, max: number): void           // fill scaleX = ratio, label text `${ceil(cur)} / ${max}`
  updateMp(current: number, max: number): void            // ẩn khi max <= 0 (displayWidth 0)
  updateKiem(current: number, max: number, label: string): void // ẩn khi max <= 0
  setVisible(v: boolean): void
  destroy(): void
}
```
- Constants: `HUD_MARGIN = 16`, `HUD_HP_WIDTH = 180`, `HUD_HP_HEIGHT = 6`, `HUD_SUB_WIDTH = 140`, `HUD_SUB_HEIGHT = 4`, `HUD_GAP = 8`, colors: HP fill `0xc94b4b`, MP fill `0x4a90d9`, Kiếm fill `0xd4a72c`, bg `0x241b1b` + stroke ink 1 (đồng bộ enemy pattern L1066-1089).
- Labels: 12px `#f4f4f0` HP; 10px sub-labels. Font family theo game (xem enemy text dùng gì — copy).

- [ ] **Step 1: Failing test** — thuần logic test (không cần canvas thật — mock Phaser minimal giống CombatScene.lifecycle.test pattern nếu có; hoặc test qua headless Phaser game config test hiện có trong repo — TRƯỚC KHI VIẾT, đọc `CombatScene.lifecycle.test.ts` + `dongFuBuildingAssets.test.ts` xem pattern test scene dùng gì và follow): layout(800, 600) → hpY đúng công thức; updateHp(50, 100) → fill ratio 0.5 + label "50 / 100"; updateMp(0, 0) → ẩn; updateKiem với label "Kiếm Ý T.2" → label đúng.
- [ ] **Step 2-4:** FAIL → implement → PASS
- [ ] **Step 5: Commit** `feat(combat): PlayerHudLayer — HP/MP/Kiếm in-canvas — 6A`

### Task 5: CombatScene wiring PlayerHudLayer + exit zone

**Files:**
- Modify: `game/src/game/scenes/CombatScene.ts`
- Test: mở rộng `CombatScene.lifecycle.test.ts` + `CombatScene.backgroundLifecycle.test.ts` nếu cần

**Interfaces:**
- Fields mới: `private playerHud?: PlayerHudLayer`, `private exitZone?: Phaser.GameObjects.Zone`, `private exitLabel?: Phaser.GameObjects.Text`
- Create tại battle_start (onBattleStart handler — tìm lifecycle battle_start hiện có): create layer + zone "✕ Thoát" text 13px góc phải-dưới (x = width − HUD_MARGIN − zoneW, hit ≥44×44), `setInteractive()`, `on('pointerdown')` → `eventBus.emit('combat_exit_request')` (event mới payload none — emit qua bus từ registry)
- Visibility: exit zone + HUD ẩn khi `combatOrigin !== 'stage'` (Tribulation không có exit — copy guard từ ControlBar L126 v-if) — đọc origin từ哪 (BattleSystem/battle state — tìm `combatOrigin` tương đương trong core: BattleSystem có battleOrigin? Nếu không — truyền qua scene data khởi tạo; kiểm launchConfig scene.start payload)
- `vitalsHandler` (đã có L1377) — sau khi dùng cho logic hiện có, thêm `if (event.entityId === PLAYER_ID) playerHud?.updateHp(event.hpAfter, event.maxHp)`
- `update()`: mỗi tick khi battle active — đọc `battle.player.currentMp/maxMp` + Kiếm resource (tìm getter tương đương CombatStatusBar.vue L119-132 — `currentKiemYTemp`/`currentKiemThe` là computed từ Vue; trong scene phải đọc qua BattleSystem method — tìm `getKiemY...`/`kiemThe` getter trên battle/player object, hoặc export từ CombatTypes/KiemYSystem) → updateMp/updateKiem. Guard null.
- `applyBattlefieldLayout` resize → `playerHud?.layout(width, height)` + re-position exit zone
- destroy trong shutdown (pattern cleanup L572-575 + 599)

- [ ] **Step 1: Failing test** — battle_start → hud tồn tại + nhận vitals update; exit click → event combat_exit_request emit (spy bus); shutdown → hud destroy (không leak — test pattern lifecycle hiện có assert destroy).
- [ ] **Step 2-4:** FAIL → implement (trước khi viết, đọc BattleSystem để tìm origin + Kiếm getters chính xác — không đoán tên hàm) → PASS
- [ ] **Step 5: Commit** `feat(combat): wire PlayerHudLayer + exit zone in scene — 6A`

### Task 6: `CombatExitConfirmModal.vue` — extract từ ControlBar

**Files:**
- Create: `game/src/components/game/combat/CombatExitConfirmModal.vue`
- Test: `game/src/components/game/combat/CombatExitConfirmModal.test.ts`

**Interfaces:**
- Copy ControlBar L45-55 logic + L173-182 markup: props none; state `visible` mở qua listen `combat_exit_request` bus event; buttons "Ở Lại" (đóng) / "Thoát Trận" (confirm) — confirm flow giữ nguyên: `gameManager.abandonBattle()` → `ui.battleRunMode = 'manual'` → `ui.exitCombatScene()` → `gameManager.eventBus.emit('combat_scene_exit', undefined)` → đóng.
- Gate render: `v-if="ui.combatOrigin === 'stage' && visible"`.

- [ ] **Step 1: Failing test** — mount + emit combat_exit_request → modal hiện; click Thoát → abandonBattle + exitCombatScene + combat_scene_exit (spy theo pattern test action cũ nếu có trong ControlBar test — không có thì tự mount pattern EquipmentHallPanel.test).
- [ ] **Step 2-4:** FAIL → implement → PASS
- [ ] **Step 5: Commit** `feat(combat): extract CombatExitConfirmModal, listen combat_exit_request — 6A`

### Task 7: Slider + Ult → KiemTuCombatHud

**Files:**
- Modify: `game/src/components/game/combat/hud/KiemTuCombatHud.vue`
- Test: `game/src/components/game/combat/hud/KiemTuCombatHud.test.ts` (tạo nếu chưa có)

**Interfaces:**
- Di chuyển từ ControlBar L135-171: slider "Nhịp Tụ Lực" (v-if bat_kiem — `player.kiemTuRoute === 'bat_kiem'`; write `batKiemTickSeconds.value` + `setChannelTickSeconds('bat_kiem_thuat', s)`; reset 3 on mount) + Ult button (v-if ultInfo — `canFireUlt`/`fireUltimate` — logic L70-109 copy nguyên, imports tương ứng).
- Consumer `batKiemTickSeconds` (ref export useCombatSkillPresentation L20) — giữ, thêm consume trong KiemTuCombatHud.

- [ ] **Step 1: Failing test** — bat_kiem → slider render + change gọi setChannelTickSeconds; kiem_tran có ult learned → button render + click tryPlayerUltimate.
- [ ] **Step 2-4:** FAIL → implement → PASS
- [ ] **Step 5: Commit** `feat(combat-hud): migrate tu-luc slider + ult into KiemTuCombatHud — 6A`

### Task 8: Xóa 3 bars + Overlay cleanup + theme vars

**Files:**
- Delete: `CombatStatusBar.vue`, `CombatEventBar.vue`, `CombatControlBar.vue`
- Modify: `CombatSceneOverlay.vue` — xóa 3 import/template refs/publishInsets phần bottom (chỉ còn topBar); insert `<CombatExitConfirmModal />`
- Modify: `game/src/assets/theme.css` — xóa `--combat-status-h/--combat-event-h/--combat-control-h` (giữ topbar-h)
- Modify: `game/src/game/support/combatInsets.ts` — BAR_CLASSES giảm 1 (topBar only), publishInsets chỉ top
- Grep TRƯỚC khi xóa: `CombatStatusBar|CombatEventBar|CombatControlBar` + `--combat-status-h|--combat-event-h|--combat-control-h` + `combat-status-bar|combat-event-bar|combat-control-bar` (class names) — liệt kê consumers, sửa hết rồi mới xóa file

**Interfaces:** Không đổi public API gì — pure removal.

- [ ] **Step 1: Grep sweep** — thu thập danh sách mọi consumer (tests, components, css)
- [ ] **Step 2: Update Overlay** — template chỉ còn TopBar + battlefield (AI/BuildHUD) + ResultModal + Countdown + ExitConfirmModal; publishInsets = topBar height
- [ ] **Step 3: Update tests** — tests cũ tham chiếu 3 bars chuyển sang assert THROUGH scene (hud trong canvas) hoặc xóa nếu trùng hợp đồng mới; `npx vitest run` focused đến khi không còn fail vì bars
- [ ] **Step 4: Xóa 3 file + theme vars** — type-check PASS
- [ ] **Step 5: Commit** `refactor(combat-ui): remove 3 DOM bars, overlay top-only — 6A`

### Task 9: FINAL verify + e2e

- [ ] `npm.cmd run type-check` PASS
- [ ] `npx vitest run` full PASS (không regress)
- [ ] `npm.cmd run build` PASS
- [ ] `npx playwright test tests/e2e/boot-fresh.spec.ts tests/e2e/create-to-combat.spec.ts` PASS (create-to-combat là acid test: full boot→fight→result flow qua UI mới)
- [ ] `npx playwright test` full 6/6+
- [ ] Manual check 1 lần trong dev server: HUD hiển thị đúng góc, resize window không lệch, click Thoát mở modal, heal hiện "+N" (dùng skill heal nếu có — nếu chưa skill nào heal, ghi chú "chờ data skill migrate" trong report — engine đã hỗ trợ)
- [ ] Commit nếu có fix: `fix: 6A final verify fixes`
- [ ] Update ROADMAP 6A → hoàn thành (trừ floating-text hiệu ứng đặc biệt — đã có sẵn action_impact/VFX)

---

## Self-Review (2026-09-01)

- **Spec coverage:** 6 mục tiêu §1 → Task 1-9 (mục 1: T4-5; 2: T5-6; 3: T8; 4: T1-2; 5: T8; 6: T3+8). §5 quyết định → T6/T7. §6 contracts 1-8 → các test steps. Không gap.
- **Placeholder scan:** Các "tìm X" trong Task 5 (origin, Kiếm getters, exit event naming) là instructions điều tra bắt buộc trước khi code — plan cố ý không đoán tên hàm, yêu cầu implementer đọc trước. Không TBD nào thiếu đường giải.
- **Type consistency:** `PlayerHudLayer` API (layout/updateHp/updateMp/updateKiem) khớp giữa Task 4-5; `combat_exit_request` thống nhất Task 5-6; constants đặt combatConstants.ts tập trung — một nơi import.
- **Ordering cứng:** Task 1→2 (heal event trước floating); Task 3 trước 8 (insets trước cleanup); Task 6-7 trước 8 (extract trước xóa); Task 9 cuối.
