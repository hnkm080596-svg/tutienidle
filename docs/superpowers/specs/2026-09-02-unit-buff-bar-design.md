# Buff Bar — Icon Buff/Debuff Trên Unit (Player + Enemy)

- Ngày: 2026-09-02 (bản 2 — viết lại sau khảo sát sâu toàn hệ combat)
- Trạng thái: DRAFT — chờ user review
- Spec: thay thế bản `2026-09-02-unit-buff-bar-design.md` v1.
- Nguồn: yêu cầu user (buff bar riêng trên unit) + chốt trực tiếp:
  1. Enemy: icon row **dưới chân** sprite (HP bar giữ trên đầu).
  2. Player: icon row **ngay trên cụm thanh HP** (HUD góc trái-dưới).
  3. Mỗi buff một icon riêng; placeholder **đỏ = debuff, xanh = buff** khi chưa có asset.
  4. **2 hàng trong 1 row:** hàng tạm thời (trong trận) + hàng vĩnh viễn (`onhit_*` duration ∞ — luôn hiện, không timer).
  5. Floating text tên hiệu ứng **chỉ lần đầu attach**.

## 1. Bối cảnh & vấn đề (từ khảo sát)

Sau merge unified buff (`f63bd06`):

- `BattleSystem.snapshotDotStatuses()` (BattleSystem.ts:1468-1498) chỉ thu buff có effect `dot` → **CC (choáng/đóng băng/trói chân) và statModifier debuff (làm chậm/suy nhược/cuồng bạo...) không bao giờ hiển thị** — mặc dù 31 buff ids trong `data/buff/buffs.ts` gồm 6 on-hit permanent (buff), 4 reaction-grant (buff), 21 debuff.
- Icon hiện tại: 1 ô vuông xoay 45° màu heuristic regex (`StatusVfxPresets.ts`), vị trí `headY - 14` — **đè cast bar** (`headY - 10`, cao 5px) khi enemy đang niệm; không phân biệt polarity; không stack layout (nhiều DoT cùng vị trí chồng lên nhau).
- Player không có bất kỳ hiển thị buff nào trong trận (thạch giáp/độc thế/hàn khí... vô hình).
- Không có floating text tên hiệu ứng (deferred từ roadmap 6A-4).

## 2. Mục tiêu

1. Mọi buff/debuff visible trên player + enemy đều có icon, đúng vị trí chốt (§ trên).
2. Phân biệt trực quan **buff (xanh) vs debuff (đỏ)** không phụ thuộc duy nhất màu — buff/debuff dùng 2 **hình khác nhau** (guideline: không convey nghĩa chỉ bằng màu): placeholder buff = hình tròn, debuff = kim cương (diamond 45° — kế thừa hình hiện có).
3. 2 hàng: **hàng dưới = temporary** (có tooltip thời gian còn lại), **hàng trên = vĩnh viễn** (`duration: Infinity` — không timer, chỉ stack count).
4. Stack count góc icon (khi stacks > 1); tooltip hover/tap: tên + polarity + stacks + giây còn lại.
5. Floating text tên buff lần đầu attach, màu theo polarity.
6. Không đổi số liệu combat — chỉ mở rộng event + presentation.

## 3. Non-goals

- Không buff bar DOM/Vue (canvas thuần).
- Không icon theo nguyên tố (placeholder hình học + màu; asset thật thay sau không đụng layout).
- Không đụng vùng worktree Claude P5-P6 (`EquipmentSystem/GameManager/useTribulation/EquipmentHallPanel/theme.css/useEquipmentTooltip/EquipmentNaming/labels/BattleLootSystem/locales`) — đã verify plan那边 không đụng `BattleSystem/BattleEvents/StatusVfxPresets/combat-vfx-spawner/CombatScene/PlayerHudLayer`.
- Không hiển thị buff ngoài trận (menu) — scope chỉ combat scene.

## 4. Thiết kế

### 4.1 Core — snapshot mở rộng (`game/src/core/battle/BattleSystem.ts`)

`snapshotDotStatuses` (1468) → đổi tên `snapshotStatuses`:

```ts
private snapshotStatuses(
  battle: Battle,
): Map<string, {
  targetId: string
  dotType: string          // giữ tên field cho compat consumer cũ
  stacks: number
  remainingTime: number
  polarity: BuffPolarity   // MỚI
  permanent: boolean      // MỚI — duration === Infinity (onhit_*)
}> {
  const collect = (pool: BuffPool, targetId: string) => {
    for (const buff of pool.getAll()) {
      snapshot.set(`${targetId}:${buff.id}:${buff.sourceId}`, {
        targetId,
        dotType: buff.id,
        stacks: buff.stacks,
        remainingTime: buff.remainingTime,
        polarity: buff.polarity,
        permanent: buff.duration === Infinity,
      })
    }
  }
  // ... 2 call sites đổi tên biến dotStatusesBefore → statusesBefore (871, 996)
}
```

- Bỏ filter `effects.some(dot)` — thu **mọi** buff trong pool.
- `hidden` check: hiện 0 buff khai `hidden`, nhưng BuffDefinition có field — vẫn giữ defensive `!buff.hidden` (cost 0, đúng semantic "hidden = không hiển thị").
- `emitStatusVfxDiff` (1501) — payload thêm `polarity`, `permanent`, `buffName` (tra `this.buffRegistry.get(current.dotType).name` — registry sẵn field private 265, emit site cùng class ✓). Giữ `durationSeconds` (giá trị `remainingTime`) cho compat; không đổi key diff.

### 4.2 Event payload (`game/src/core/battle/BattleEvents.ts`)

`StatusVfxAttachedEvent` + optional:

```ts
buffName?: string
polarity?: 'buff' | 'debuff'
permanent?: boolean
```

`StatusVfxUpdatedEvent` giữ nguyên (stacks + durationSeconds đã đủ; permanent không đổi). `StatusVfxRemovedEvent` giữ nguyên. — Optional nên mọi consumer/test cũ không vỡ.

### 4.3 Preset (`game/src/data/vfx/StatusVfxPresets.ts`)

```ts
export type StatusIconShape = 'circle' | 'diamond' | 'square'

export interface StatusVfxPreset {
  color: number
  shape: StatusIconShape
}

const BUFF_PLACEHOLDER_COLOR = 0x58e878    // xanh lá
const DEBUFF_PLACEHOLDER_COLOR = 0xe5484d  // đỏ
const CC_COLOR = 0xffd54f                  // vàng — CC nhận diện nhanh

const STATUS_PRESETS: Record<string, StatusVfxPreset> = {
  // CC — diamond vàng (kế thừa hình quen thuộc của icon cũ)
  choang:    { color: CC_COLOR,        shape: 'diamond' },
  dong_bang: { color: 0x8be9fd,        shape: 'diamond' },
  troi_chan: { color: CC_COLOR,        shape: 'diamond' },
  // DoT — diamond màu nguyên tố
  bong:      { color: 0xff7a45,        shape: 'diamond' },
  trung_doc: { color: 0x58e878,        shape: 'diamond' },
  chay_mau:  { color: 0xe5484d,        shape: 'diamond' },
  te_cong:   { color: 0x58c8ff,        shape: 'diamond' },
  hoai_tu:   { color: 0x58c8ff,        shape: 'diamond' },
  dung_nham: { color: 0xff7a45,        shape: 'diamond' },
  huyet_doc: { color: 0xe5484d,        shape: 'diamond' },
  // statModifier debuff — square
  lam_cham:  { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  han_khi:   { color: 0x8be9fd,        shape: 'square' },
  cuong_bao: { color: 0xff7a45,        shape: 'square' },
  suy_nhuoc: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  uy_ap:     { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  giap_ran:  { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  van_kiem_vu: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  thach_hoa: { color: 0xd4a72c,        shape: 'square' },
  // buff tạm — circle
  thach_giap_buff: { color: BUFF_PLACEHOLDER_COLOR, shape: 'circle' },
  doc_the:   { color: 0x58e878,        shape: 'circle' },
  ngung_lo:  { color: 0x4a90d9,        shape: 'circle' },
  khai_son:  { color: 0xd4a72c,        shape: 'circle' },
  // onhit_* vĩnh viễn — circle viền khác (placeholder cùng tông buff)
  onhit_khiem_phong_haste: { color: BUFF_PLACEHOLDER_COLOR, shape: 'circle' },
  // (các onhit_* còn lại trong data sẽ khớp qua fallback prefix dưới)
}

export function getStatusVfxPreset(buffId: string, polarity?: 'buff' | 'debuff'): StatusVfxPreset {
  // 1. Map trực tiếp
  if (STATUS_PRESETS[buffId]) return STATUS_PRESETS[buffId]
  // 2. onhit_* prefix fallback
  if (buffId.startsWith('onhit_')) return { color: BUFF_PLACEHOLDER_COLOR, shape: 'circle' }
  // 3. Regex heuristic cũ (giữ compat id lạ/data tương lai)
  if (/burn|fire|hot/.test(buffId)) return { color: 0xff7a45, shape: 'diamond' }
  if (/poison|toxic|wood/.test(buffId)) return { color: 0x58e878, shape: 'diamond' }
  if (/bleed|huyet|blood/.test(buffId)) return { color: 0xe5484d, shape: 'diamond' }
  if (/chill|frost|water/.test(buffId)) return { color: 0x58c8ff, shape: 'diamond' }
  // 4. Polarity fallback cuối — placeholder đỏ/xanh
  return { color: polarity === 'buff' ? BUFF_PLACEHOLDER_COLOR : DEBUFF_PLACEHOLDER_COLOR, shape: 'circle' }
}
```

**Lưu ý breaking change:** signature `getStatusVfxPreset(buffId, polarity?)` — call site duy nhất hiện tại (spawner:117) truyền 1-arg → compat. Shape là hướng hiển thị, không phải thay đổi gameplay.

### 4.4 Presentation — icon row (`game/src/game/scenes/combat/combat-vfx-spawner.ts`)

**StatusEntry** (thay type inline tại CombatScene.ts:392):

```ts
interface StatusEntry {
  targetId: string
  buffId: string
  polarity: 'buff' | 'debuff'
  permanent: boolean
  icon: Phaser.GameObjects.Rectangle   // circle = setSize(w,w).setAngle(0); diamond = setAngle(45); square = setAngle(0)
  stackLabel: Phaser.GameObjects.Text
}
```

**Layout constants (thêm vào `combatConstants.ts`):**

```ts
export const STATUS_ICON_SIZE = 10
export const STATUS_ICON_SPACING = 4
export const STATUS_ROW_GAP = 4
export const STATUS_MAX_PER_ROW = 8
export const STATUS_FOOT_ROW_OFFSET_Y = 8   // enemy: dưới foot (perspective foot = rect.y)
export const STATUS_PLAYER_ROW_OFFSET_Y = 6 // player: trên cụm sub-bar HUD
```

**Cách tính vị trí (mỗi entry, gọi từ `updateStatusIconPositions()` đã chạy mỗi frame tại CombatScene.ts:667):**

- Group theo targetId → tách 2 list: `temporary` (permanent=false) và `permanent` (permanent=true).
- **Enemy** (`targetId !== PLAYER_ID`): neo `sprite.rect.x`, `footY = sprite.rect.y` (perspective, origin 0.5,1) — hàng temporary tại `footY + STATUS_FOOT_ROW_OFFSET_Y`, hàng permanent tại `footY + OFFSET + STATUS_ICON_SIZE + STATUS_ROW_GAP`. Icon xếp trái→phải từ `rect.x - rowWidth/2` (căn giữa sprite).
- **Player** (`targetId === PLAYER_ID`): neo theo HUD — `sub2Y` (Y của sub-bar thấp nhất = Kiếm) tính được từ viewport: `sub2Y = height - HUD_MARGIN - HUD_HP_HEIGHT - HUD_GAP - HUD_SUB_HEIGHT - HUD_GAP - HUD_SUB_HEIGHT` (theo PlayerHudLayer.layout). Hàng temporary tại `sub2Y - STATUS_PLAYER_ROW_OFFSET_Y - STATUS_ICON_SIZE`; permanent ngay trên (`- STATUS_ROW_GAP - STATUS_ICON_SIZE`). leftX = `HUD_MARGIN`. (Import `HUD_*` từ `PlayerHudLayer.ts` đã export.)
- Row slot index = vị trí trong list (0..7); >8: icon thứ 8 gán badge counter "N+" (stackLabel text = `+${n}`), không render icon vượt.
- Icon: `scene.add.rectangle(x, y, size, size, preset.color)` + `setAngle(shape === 'diamond' ? 45 : 0)` — circle không có primitive riêng trong Phaser GameObjects Rectangle; dùng square + góc bo không khả thi → **circle = square kèm viền tròn nhỏ hơn**? Không — đơn giản nhất: circle render bằng `scene.add.circle(x, y, size/2, color)` (Phaser có `Arc`/`Ellipse` — `scene.add.circle` tồn tại). StatusEntry.icon type mở rộng: `Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc`.
- Stack label: text 9px monospace góc phải-dưới icon, chỉ hiện stacks > 1 (hoặc "N+" counter).
- Depth: icon `DEPTH_OVERLAY_UI + 4`, label `+ 5` (kế thừa) — dưới floating text (+6/+7) và dưới cast bar? Cast bar depth — kiểm tra: cast bar dùng depth gì (nếu trùng dải OVERLAY_UI, icon row dưới chân không đè cast bar trên đầu nên không conflict vị trí).

**Event handlers mở rộng:**

- `onStatusAttached(event)`: tạo entry (đã có pattern dedupe theo statusInstanceId); đọc `event.polarity/permanent/buffName`; nếu sprite thiếu → skip (giữ hành vi hiện tại).
- `onStatusUpdated(event)`: chỉ cập nhật stackLabel text.
- `onStatusRemoved(event)`: destroy icon + label; **đóng tooltip nếu tooltip đang neo entry đó**; xóa entry.
- **Tooltip:** module mới nhỏ `game/src/game/scenes/combat/combat-status-tooltip.ts` (một class `StatusTooltip`): 1 active duy nhất; `show(x, y, { name, polarity, stacks, remainingTime, permanent })` → vẽ Container (Graphics bg + Text 2 dòng: tên — đậm, màu polarity; dòng 2: `x{stacks} · {n}s` hoặc `vĩnh viễn`); `hide()`. Spawner gọi qua icon `setInteractive()` + `pointerover`/`pointerout` + `pointerdown` toggle (touch). Clamp trong viewport. **Đây là usage `setInteractive` đầu tiên trong game — cần đảm bảo input enabled trên scene (mặc định Phaser scene có input).**
- Cleanup: 2 chỗ destroy statuses (CombatScene.ts:1242-1247, 1944-1949) — thêm `tooltip.hide()` + mọi entry đóng. (Sửa 2 loop này để cũng destroy theo entry mới — chúng chỉ đụng icon/label fields, giữ nguyên cấu trúc.)

**Floating text (lần đầu attach):** trong `CombatScene.onStatusAttached` (2019) — **trước** khi delegate sang spawner, check "lần đầu": spawn key theo `targetId:buffId` (không gồm sourceId — 2 nguồn cùng buff id chỉ floating 1 lần); scene giữ `Set<string> floatedStatusKeys` (clear ở battle_end). Nếu key mới + `event.buffName` tồn tại → `this.showFloatingText(sprite, buffName, polarityColor)` (2041, sẵn sàng — depth +7, tween lên). Màu: thêm 2 constants `BUFF_ATTACH_COLOR = '#58e878'`, `DEBUFF_ATTACH_COLOR = '#e5484d'` vào combatConstants.

### 4.5 Player HUD không đổi

`PlayerHudLayer` giữ nguyên hoàn toàn (chỉ import constants `HUD_*` đã export sẵn). Icon row player là phần tử spawner, neo theo công thức layout HUD — resize tự đúng vì `updateStatusIconPositions()` chạy mỗi frame tính lại từ viewport.

## 5. Kiến trúc dữ liệu (flow)

```
BuffPool (per entity, unified buff system)
  └─ BattleSystem.update() tick
       ├─ [1] statusesBefore = snapshotStatuses(battle)      // MỌI buff visible
       ├─ [5] ... buffs tick/recompute modifiers ...
       └─ [16] emitStatusVfxDiff(battle, statusesBefore)
            ├─ 'status_vfx_attached'  { +statusInstanceId, targetId, dotType, stacks, durationSeconds, buffName?, polarity?, permanent? }
            ├─ 'status_vfx_updated'   { statusInstanceId, stacks, durationSeconds }
            └─ 'status_vfx_removed'   { statusInstanceId, reason }
                 └─ CombatScene.statusAttachHandler
                      ├─ floating text (lần đầu theo targetId:buffId) → damageText channel
                      └─ vfxSpawner.onStatusAttached → StatusEntry (icon row)
                           ├─ enemy: dưới foot | player: trên cụm HUD HP
                           ├─ hàng temporary / hàng permanent (2 hàng)
                           ├─ stack label + tooltip (hover/tap)
                           └─ updateStatusIconPositions() mỗi frame bám sprite/viewport
```

## 6. Edge cases

| Case | Hành vi |
|---|---|
| Buff `hidden` (tương lai) | Snapshot loại — không event, không icon |
| 2 nguồn cùng buff id | 2 key `(targetId, buffId, sourceId)` → 2 icon riêng cạnh nhau (đúng semantics multi-source) |
| Stack tăng cùng instance | `updated` → chỉ stackLabel đổi |
| Buff hết hạn/reaction tiêu/target chết | `removed` → destroy + đóng tooltip nếu đang mở trên icon đó |
| Sprite chưa tồn tại (spawn telegraph) | Skip như hiện tại — limitation ghi nhận (buff thực tế chỉ trúng target đã materialize) |
| >8 buff 1 loại/hàng | Icon cuối mang badge "N+" (counter tổng) — không render icon thứ 9+ |
| Icon row đè cast bar | Không — cast bar ở `headY-10` (trên đầu), icon row ở foot (dưới chân) / cụm HUD player: tách vùng hoàn toàn |
| Permanent row khi 0 buff vĩnh viễn | Không render hàng (chỉ hiện khi có ≥1 entry permanent) |
| Viewport nhỏ | Icon row player nằm giữa sub2Y và HP bar cụm — kích thước tối đa 2 hàng × 10px + gap ~28px, không tràn |
| Battle end / scene shutdown | 2 cleanup sites destroy icon+label; tooltip hide; `floatedStatusKeys` clear |

## 7. Testing (TDD)

1. **`BattleSystem.statusVfx.test.ts`** (mới): CC/statModifier/permanent buff vào snapshot + event payload (`polarity`, `permanent`, `buffName`); hidden loại; DoT regression; stacks updated; expire removed. — Dùng pattern fixture `BattleSystem.castTime.test.ts` (createCombatant + registry từ `data/buff/buffs`), apply buff **trực tiếp qua `new BuffSystem(poolOf(entity))`** lấy pool từ battle qua `system.getBattle()` (public, BattleSystem.ts:776) — **không** hack private.
2. **`StatusVfxPresets.test.ts`** (mới): map id đúng color/shape; onhit_ prefix fallback; regex fallback; polarity fallback cuối.
3. **`combat-vfx-spawner.statusRow.test.ts`** (mới, mock scene theo pattern `ActionImpactVfx.test.ts`): attach → entry tạo icon đúng shape/angle; row layout index; enemy foot Y vs player HUD Y; permanent hàng riêng; stack label "N+" khi >8; removed destroy; updated chỉ đổi label.
4. **`combat-status-tooltip.test.ts`** (mới): show/hide; nội dung 2 dòng theo polarity/permanent; clamp viewport.
5. **`CombatScene.hudWiring.test.ts`` mở rộng** hoặc test scene riêng: floating text lần đầu (key `targetId:buffId`) — attach 2 nguồn cùng id chỉ 1 floating; stack update không floating lại.
6. Verify chuẩn: focused 5 file → `npm.cmd run type-check` → full `npx vitest run` → `npm.cmd run build`.

## 8. Rủi ro & mitigations

- **Event volume tăng** (mọi buff diff mỗi tick): volume ≤ ~40 buff/trận, diff theo key chỉ emit khi đổi — negligible.
- **`setInteractive` lần đầu**: risk input conflict thấp (scene input mặc định enabled); test mock cần stub `setInteractive` — pattern test scene hiện có (ActionImpactVfx.test.ts) đã stub `add.rectangle/text` tương tự.
- **Circle = `scene.add.circle`** (Arc) khác type với Rectangle — StatusEntry union type; spawner switch theo preset.shape khi tạo.
- **Miss icon khi attach trước materialize**: limitation chấp nhận (§6).
- **Conflict với worktree Claude**: 0 file chồng (đã verify plan P5-P6) — trừ `combatConstants.ts` KHÔNG thuộc plan Claude ✓.

## 9. Verification chuẩn (definition of done)

- 5 test file mới/sửa PASS (focused).
- `npm.cmd run type-check` PASS.
- `npx vitest run` full PASS (1993+ tests, không regress).
- `npm.cmd run build` PASS.
- Manual smoke (dev server): 1 trận với skill Pháp Tu Hỏa (bong dot + làm chậm) + Kiếm Tu — thấy: icon đỏ diamond bong dưới chân enemy, icon CC vàng khi choáng, floating "Bỏng!" lần đầu, tooltip hover, stack tăng label đổi, buff hết hạn icon biến mất, onhit_* hàng riêng player.
