# Combat Scene UI Redesign — Design Spec

**Ngày:** 2026-09-01
**Phạm vi:** 6A roadmap — Combat Scene chỉ còn background làm vùng giao diện chính: HP/MP/Kiếm + nút Thoát vào trong Phaser canvas, bỏ 3 bar DOM dưới, floating text đầy đủ.
**Roadmap:** `game/docs/roadmap.md` mục 6A. **UI/UX:** ui-ux-pro-max đã chạy (Minimalism & Swiss, ink-wash tokens, motion giữ easing hiện có) — design system phần "Thiết kế" dưới.
**Ràng buộc:** Inline execution, không subagent; tránh đụng file plan Codex (equipment rework) — phạm vi file dưới đã kiểm không giao nhau.

---

## 1. Mục tiêu

1. HP + MP/Kiếm người chơi vẽ **trong canvas Phaser** (PlayerHudLayer) — bỏ CombatStatusBar.vue
2. Nút Thoát Trận trong canvas (interactive zone góc phải-dưới) — bỏ CombatControlBar.vue; confirm modal DOM giữ nguyên
3. Bỏ CombatEventBar.vue — thông tin Chí Mạng/Hạ Gục chuyển thành floating text
4. Floating combat text đầy đủ: sát thương ✓(có), CRIT ✓, Né ✓, cast ✓, DOT ✓, **+ Hạ Gục (mới)**, **+ Hồi máu (mới — event `heal` mới emit)**. Hiệu ứng đặc biệt (buff/debuff/VFX skill): **kênh đã có sẵn** — `action_impact` + `status_vfx_*` handlers → `vfxSpawner` (tương thích Phase 2A trigger/action engine, giữ nguyên khi dọn bars)
5. CombatSceneOverlay chỉ còn: TopBar (chrome thông tin — giữ), AI Panel, Build HUD, Result Modal, Countdown Overlay
6. Insets: top-only (`bottom: 0`) — canvas chiếm full chiều dưới

Ngoài phạm vi: CombatTopBar (giữ), TribulationScene (chưa làm — pattern sau), AI Panel/Build HUD (giữ nguyên), i18n đổi nhãn khác.

## 2. Thiết kế UI (ui-ux-pro-max)

**Style:** Minimalism/Swiss — HUD lùi sau tranh mực, essential-only, không khung nền.

| Phần tử | Vị trí | Kích thước | Màu | Ghi chú |
|---|---|---|---|---|
| HP player | góc trái-DƯỚI viewport (trên bottomInset=0 → cách mép 16px) | dài 180px×6px + label số 12px phía trên | fill `0xc94b4b` (đồng bộ enemy), bg `0x241b1b`, stroke ink | pattern enemy HP bar (Rectangle 2 lớp) |
| MP player (pháp_tu) | dưới HP, cách 8px | 140px×4px | fill `0x4a90d9`, bg/stroke同 | chỉ hiện khi `cultivationPath === 'phap_tu'` |
| Kiếm Ý/Kiếm Thế (kiếm_tu) | vị trí MP | 140px×4px | fill `0xd4a72c` (gold --rage), bg同 | chỉ hiện khi route kiếm_tu; label "Kiếm Ý T{tier}"/"Kiếm Thế" 10px |
| Nút Thoát | góc phải-DƯỚI, cách mép 16px | hit zone ≥44×44 | text "✕ Thoát" 13px màu `#f4f4f0`, hover tint `0xff6b4a` alpha bg `0x66241b1b` | setInteractive; mở confirm modal DOM hiện có |
| Floating: Hạ Gục | trên đầu enemy chết | 18px bold | `#f4f4f0` stroke `0xc94b4b` | rise 24px/500ms |
| Floating: Hồi máu | trên đầu target | 14px | `#7bd88f`, text `+N` | cùng easing damage text |

**Motion:** giữ easing hiện có (Back.easeOut pop 110ms cho damage; rise-fade 480-620ms); HP bar update tức thời (spatial continuity); **reduced-motion:** bỏ pop scale (check `matchMedia('(prefers-reduced-motion: reduce)')` đọc 1 lần lúc create).

**Accessibility:** label HP luôn kèm số (`{hp} / {max}` text 12px `#f4f4f0` — contrast trên nền tranh); nút Thoát ≥44px; không icon-only không label.

**Flexible rule (AGENTS.md):** vị trí/kích thước HUD tính từ `viewport.width/height` + scale khi `resize` (resize handler gọi lại layout) — KHÔNG hardcode px ngoài constant ratio.

## 3. Kiến trúc

```
CombatSceneOverlay.vue          → bỏ 3 bar; insets publish chỉ top
  ├─ CombatTopBar.vue           (giữ)
  ├─ CombatAiPanel / BuildHUD   (giữ)
  ├─ CombatResultModal          (giữ — confirm thoát nằm đây… xem §5)
  └─ CombatCountdownOverlay     (giữ)

combatInsets.ts                 → { top, bottom: 0 }; xóa fallback bottom

CombatScene.ts
  ├─ PlayerHudLayer (mới)       → create/destroy theo battle lifecycle; update từ 2 nguồn
  │    ├─ entity_vitals_changed (đã subscribe L1378) → HP values
  │    └─ update() tick đọc battle.player.currentMp/maxMp + Kiếm resource (pattern CombatStatusBar L85-132)
  ├─ subscribeCombatEvents      → + 'kill' → floating "Hạ Gục!"; + 'heal' → "+N"
  └─ exit zone (interactive)    → emit battleBus 'combat_exit_request' → overlay confirm modal mở

EntityVitalsSystem.applyHealing → emit 'heal' {type:'heal', sourceId, targetId, value: amount} (CHỈ reason 'healing'|'leech' — regen KHÔNG emit để tránh spam mỗi tick)
CombatEvent.ts                  → + 'heal' vào union
```

**Tương thích skill system mới (Phase 2A trigger/action — worktree Claude Code):**
- **Heal:** executor `heal` mới (`SkillActionRegistry.ts:88-92`) gọi đúng cổng `CombatSystem.applyHealing(target, value, source.id, 'healing')` → chảy vào `EntityVitalsSystem` → event 'heal' của spec này tự bắt được heal từ skill. KHÔNG cần đường riêng.
- **Hiệu ứng đặc biệt (VFX):** kênh đã tồn tại — executor `spawnVfx` emit `action_impact` với `presetId` (`SkillActionRegistry.ts:266-287`), CombatScene master ĐÃ subscribe `action_impact` + 3 status_vfx handlers (L1373-1376) delegate vào `vfxSpawner` (`onActionImpact` → `vfxSpawner.onActionImpact`). Spec này KHÔNG xây kênh VFX mới — chỉ đảm bảo các handler này giữ nguyên khi dọn bars.
- **Kill:** Phase 2A thêm trigger firing trong `killIfDead` (onKill/onDeath) nhưng event 'kill' payload/emit site KHÔNG đổi → floating "Hạ Gục!" subscribe bus như cũ, tương thích.
- **Ranh giới với Claude Code worktree:** 6A KHÔNG sửa `core/skill/**`, `SkillActionRegistry`, `killIfDead` — chỉ THÊM handler/hàng ở layer scene + vitals emit. Merge Phase 2A trước khi execute 6A để tránh conflict `CombatSystem.ts` (cả 2 đụng file này: Phase 2A thêm trigger firing sites; 6A thêm emit 'heal' trong vitals — vị trí khác nhau, merge được).

**Nút Thoát — cầu nối canvas → DOM modal:** CombatScene không trực tiếp mở DOM modal; emit qua eventBus `'combat_exit_request'` (event mới, payload none); CombatSceneOverlay (hoặc CombatResultModal) nghe và mở confirm modal; confirm flow giữ nguyên logic cũ (abandonBattle → exitCombatScene → `combat_scene_exit`).

## 4. Phạm vi file

**Mới:**
- `game/src/game/scenes/combat/PlayerHudLayer.ts` (~150 dòng — bars + labels + exit zone + resize layout)
- Test: `PlayerHudLayer.test.ts` (thuần logic: vị trí tính từ viewport, values update, pity… không assert pixel)

**Sửa:**
- `CombatScene.ts` — tạo/destroy PlayerHudLayer theo battle_start/battle_end/shutdown; subscribe 'kill'/'heal'; exit zone wiring; bỏ gourdBottomInset phần bottom (L428)
- `combat-damage-text.ts` — `showKillText(sprite)` + `showHealText(sprite, value)` (pattern showFloatingText, constants màu mới trong combatConstants.ts)
- `combatConstants.ts` — + `PLAYER_HP_*`, `PLAYER_MP_*`, `KIEEM_*` colors/sizes, `HUD_MARGIN = 16`
- `combatInsets.ts` — bottom always 0; xóa FALLBACK_EVENT_BAR/FALLBACK_CONTROL_BAR
- `EntityVitalsSystem.ts` — emit 'heal' (applyHealing L61-71: emit khi reason ∈ {healing, leech})
- `CombatEvent.ts` — union + 'heal'
- `CombatSceneOverlay.vue` — xóa 3 import + template refs; insets publish chỉ topBar; confirm modal move vào ResultModal hoặc giữ file riêng (chốt trong plan: giữ file ControlBar CHỈ phần modal? — KHÔNG: extract `CombatExitConfirmModal.vue` ~60 dòng từ ControlBar)
- `game/src/core/combat/CombatTypes.ts` — không đổi (MAX_KIEM_THE/MAX_KIEM_Y_CAP giữ)

**Xóa hẳn:** `CombatStatusBar.vue` (232), `CombatEventBar.vue` (222), `CombatControlBar.vue` (297) — extract trước phần confirm modal
**Theme.css:** xóa `--combat-status-h/--combat-event-h/--combat-control-h` (giữ `--combat-topbar-h`)

**Không đụng:** equipment/*, materials, StatCalculator, `core/skill/**` + `SkillActionRegistry` + `killIfDead` (Phase 2A của Claude Code — merge Phase 2A vào master TRƯỚC khi execute 6A), TribulationScene

## 5. Quyết định đã chốt

- Confirm modal thoát: extract `CombatExitConfirmModal.vue` (~60 dòng từ ControlBar L173-182 + confirm logic L45-55) — ControlBar xóa sạch
- Slider "Nhịp Tụ Lực" (bat_kiem, ControlBar L135-150) + Ult button (L153-171): **chuyển vào Build HUD** — `hud/CombatBuildHud.vue` (36 dòng) là switch theo route giữa `KiemTuCombatHud`/`PhapTuCombatHud`/`MortalCombatHud`; slider + ult thêm vào KiemTuCombatHud (bat_kiem: slider; kiem_tran: ult) — cùng surface bottom-center, ít chuyển nhất
- `batKiemTickSeconds` ref (useCombatSkillPresentation L20) giữ nguyên — consumer đổi từ ControlBar sang KiemTuCombatHud
- TribulationScene đã kiểm: KHÔNG dùng combatInsets (grep 0) — an toàn

## 6. Testing (contract)

1. PlayerHudLayer: layout tính từ viewport — resize thay đổi vị trí (mock resize event); HP/MP/Kiếm update đúng giá trị event/battle; MP ẩn khi không phải pháp_tu; Kiếm ẩn khi không phải kiếm_tu
2. Kill floating: emit 'kill' → text "Hạ Gục!" tại đúng sprite; sprite chết fade không crash
3. Heal: `applyHealing(reason 'healing'|'leech')` → event 'heal' emit đúng value; reason 'regen' KHÔNG emit; floating "+N" xanh
4. Insets: top-only — CombatScene applyBattlefieldLayout nhận bottom 0; fallback không còn bottom
5. Exit flow: click zone → 'combat_exit_request' → confirm modal hiện; confirm → abandonBattle + exitCombatScene + 'combat_scene_exit' (giữ contract cũ)
6. Overlay: 3 bar không còn render; TopBar/AI/BuildHUD còn; reduced-motion bỏ pop scale
7. Ult + slider: chuyển Build HUD vẫn hoạt động (fireUltimate + setChannelTickSeconds)
8. Full verify: type-check, vitest full, build, e2e 6/6

## 7. Rủi ro

- Pointer events: canvas transparent dưới overlay — zone interactive trong Phaser vẫn nhận pointer vì canvas nhận event trước overlay (overlay pointer-events:none trừ bars) → kiểm bằng test + tay
- MP/Kiếm đọc battle mỗi tick: chỉ khi `hasBattle`, guard null
- 3 file xóa có thể vỡ test import — grep trước khi xóa (CombatSceneOverlay tests + theme vars)
- TribulationScene dùng chung inset? — kiểm: TribulationScene có overlay riêng, không dùng combatInsets (kiểm trong plan)
