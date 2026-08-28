# Kế hoạch Thiên Phú — Chọn Hướng Đạo & Phàm Cốt

> Plan đã duyệt 2026-08-28 sau 3 vòng thiết kế cùng tác giả. Thay thế [talent-effects-completion-plan.md](./talent-effects-completion-plan.md) (scope effect-wiring được hấp thụ vào đây; mục tiêu catalog ~43 talent của plan gốc chuyển thành ghi chú dài hạn).
> Bối cảnh: ưu tiên hiện tại là làm thật kỹ giai đoạn early — Thanh Vân địa giới (Phàm Nhân → Trúc Cơ). Kim Đan chưa phải ưu tiên.

## 1. Mục tiêu

- Thiên Phú là **quyết định chọn hướng đi duy nhất** khi tạo nhân vật: roll 9, chọn đúng 1.
- Mỗi thiên phú là **một ngoại lệ của luật chơi** — không có talent cộng chỉ số (nguyên tắc đã chốt: "chỉ số đâu có gì đặc sắc").
- Thêm easter egg **Phàm Cốt**: tu luyện −75% (còn 2.5/s), không effect khác, weight cực thấp — gate của Đại Đạo Trúc Cơ (điều kiện gate do tác giả thiết kế sau, plan này KHÔNG implement gate).
- Chỉ hook vào hệ thống người chơi sống cùng hằng ngày: tu luyện, chiến đấu, Cảm Ngộ, Luyện Thể, kinh tế, luyện đan. KHÔNG thiết kế cho chức năng ít người dùng (Độ Kiếp, avatar dịch chuyển), chức năng ảnh hưởng lớn (offline cap), hoặc hệ thống chưa thiết kế (Kiếm Ý — đường Kiếm Tu chưa hoàn thiện).

## 2. Hiện trạng (đã kiểm chứng 2026-08-28)

- Roll 9 chọn 3: `CHARACTER_CREATION_TALENT_COUNT = 3` (`src/services/character/CharacterCreationService.ts:4`), UI tại `src/components/onboarding/CharacterCreationScreen.vue:30-34, 89-97`.
- 13 talent cũ trong `src/data/talent/Talents.ts`, 11 rỗng effect; chỉ `cultivation_speed` được wire (`src/stores/player.ts:67`, `BASE_CULTIVATION_PER_SECOND = 10` tại `src/core/realm/realmSystem.ts:36`).
- Mọi điểm hook trong §6 đã xác minh vị trí trong code.
- Scaffold Đại Đạo có sẵn nhưng **plan này KHÔNG đụng vào**: `src/core/breakthrough/FoundationResolver.ts` (parked, trả 'human' cứng), `src/data/realm/RealmPassives.ts:47-52` (passive Kiến Cơ 0/5/10/20%), 4 quái kiếp trong `src/data/enemy/Tribulations.ts`, 5 item ẩn trong `src/data/materials/materials.ts:160-206`.

## 3. Cơ chế chọn

- `CHARACTER_CREATION_TALENT_COUNT = 1`; `validateDraft` yêu cầu đúng 1 id hợp lệ.
- `toggleTalent`: click thẻ mới = **thay** lựa chọn (không cộng dồn); click lại thẻ đang chọn = bỏ chọn.
- `selectedTalentIds` giữ kiểu `string[]` (length 1) — **không đổi shape save**.
- **Save cũ 3 talent**: vẫn chạy — mọi helper lặp mảng và bỏ qua id lạ (`getTalentDefinition` trả undefined → skip, pattern có sẵn). Không migration (development phase theo AGENTS.md).
- Reroll giữ nguyên (không giới hạn, client-side); roll 9 từ pool 12 → luôn giấu 3 talent, giữ chất "thiên mệnh".

## 4. Phàm Cốt

```ts
{
  id: 'pham_cot',
  name: 'Phàm Cốt',
  description: 'Ngươi sinh ra chính là người bình thường, lớn lên là kẻ bình thường, sau này khả năng vẫn sẽ luôn như vậy ...',
  rarity: 'di',
  weight: 1,
  tags: ['mechanic', 'risk_reward'],
  effects: [{ kind: 'cultivation_speed', percent: -0.75 }],
}
```

- Description **verbatim, KHÔNG được sửa** (cùng convention mô tả item ẩn `great_dao_seed`, `materials.ts:162-163`).
- `1 + (−0.75) = 0.25` → đúng **2.5/s** với base 10/s. Guard `Math.max(0.01, multiplier)` tại điểm tính.
- Weight 1 trong pool tổng 307 → **~0.33% mỗi lần roll**. Không visual đặc biệt — card hiển thị như mọi talent Dị khác để giữ bí mật.
- **Hook tương lai (KHÔNG implement trong plan này)**: id `pham_cot` là stable contract; thêm comment vào `FoundationResolver.ts`: gate Đại Đạo Trúc Cơ (thiết kế sau) đọc `PlayerData.selectedTalentIds` chứa `'pham_cot'`.

## 5. Catalog v3 — 12 talent

| id | Tên | Rarity | Weight | Effects | Hook (đã xác minh) |
|---|---|---|---:|---|---|
| `tien_thien_dao_the` | Tiên Thiên Đạo Thể | di | 1 | `cultivation_speed +1.0` | có sẵn (`stores/player.ts:67`) |
| `pham_cot` | Phàm Cốt | di | 1 | `cultivation_speed −0.75` | có sẵn |
| `nghich_thien` | Nghịch Thiên | thien | 4 | `cultivation_speed +0.5`, `insight_gain −0.3` | `player.ts:67` + `BattleLootSystem.ts:175` |
| `bat_tu_the` | Bất Tử Thể | dia | 12 | `survive_lethal { usesPerBattle: 1 }` | `EntityVitalsSystem.ts:105` |
| `dai_tri_nhuoc_ngu` | Đại Trí Nhược Ngu | dia | 12 | `insight_gain +1.0`, `cultivation_speed −0.25` | 2 hook trên |
| `phan_phac` | Phản Phác | linh | 28 | `reaction_keep_chance { percent: 0.25 }` | `ReactionManager.ts:159-169` |
| `ngo_dao` | Ngộ Đạo | linh | 28 | `insight_per_cultivation { cultivationPerInsight: 2000 }` | `cultivate()` trong `stores/player.ts` |
| `huyet_chien` | Huyết Chiến | linh | 28 | `heal_on_kill { maxHpPercent: 0.02 }` | nhánh quái chết trong `BattleLootSystem` |
| `luyen_the_ky_tai` | Luyện Thể Kỳ Tài | linh | 28 | `body_refinement_progress { percent: 1.0 }` | `BodyRefinementSystem.ts:121-128` |
| `tu_bao` | Tụ Bảo | pham | 55 | `spirit_stone_gain { percent: 0.5 }` | `BattleLootSystem.ts:186` |
| `co_duyen` | Cơ Duyên | pham | 55 | `equipment_drop_chance { percent: 0.5 }` | `BattleLootSystem.ts:310, 397` |
| `dan_duyen` | Đan Duyên | pham | 55 | `alchemy_success_bonus { percentPoints: 15 }` | `AlchemySystem.ts:277` |

Hai cặp đối xứng có chủ đích: **Tiên Thiên Đạo Thể ↔ Phàm Cốt** (tốc độ tu luyện), **Nghịch Thiên ↔ Đại Trí Nhược Ngu** (tu luyện ↔ giác ngộ).

Số liệu là baseline playtest — pure data, chỉnh không cần sửa code.

### Xử lý 13 talent cũ

- Giữ id `tien_thien_dao_the` (effect giữ +100%), `nghich_thien` (rework effect theo bảng trên — bản cũ đánh đổi bằng lôi kiếp, vi phạm nguyên tắc §1).
- 4 talent cần kind effect chưa có → chuyển vào khối `PARKED_TALENTS` có chú thích (không vào roll, KHÔNG xóa ý tưởng): `bat_khuat` (cần conditional combat hook), `duoc_duyen` (cần pill hook), `dao_phap_tu_nhien` (cần breakthrough hook), `vo_cau_dao_the` (mechanic lớn, cần thiết kế riêng).
- 7 talent chỉ số còn lại loại khỏi catalog theo thiết kế v3 (nguyên tắc "không talent chỉ số"), ghi chú lý do trong file: `tam_tinh`, `can_cot_vung`, `linh_cam`, `kiem_tam`, `ngu_hanh_than`, `linh_mach_cong_huong`, `thien_sinh_chien_y`.

## 6. Thiết kế effect

```ts
export type TalentEffect =
  | { kind: 'cultivation_speed'; percent: number }
  | { kind: 'insight_gain'; percent: number }
  | { kind: 'insight_per_cultivation'; cultivationPerInsight: number }
  | { kind: 'spirit_stone_gain'; percent: number }
  | { kind: 'equipment_drop_chance'; percent: number }
  | { kind: 'body_refinement_progress'; percent: number }
  | { kind: 'alchemy_success_bonus'; percentPoints: number }
  | { kind: 'survive_lethal'; usesPerBattle: number }
  | { kind: 'reaction_keep_chance'; percent: number }
  | { kind: 'heal_on_kill'; maxHpPercent: number }
```

Helper tập trung trong `src/core/talent/TalentEffects.ts`: `collectTalentEffects(selectedTalentIds)` + getter theo kind (vd `getCultivationSpeedMultiplier`, `getInsightGainMultiplier`, `hasSurviveLethal`…). Mỗi nơi tiêu thụ gọi đúng getter của kind mình — không nơi nào tự lặp vòng lặp đọc effect.

### Quy tắc từng hook

- **cultivation_speed**: giữ điểm tính hiện có (`stores/player.ts:67`), thêm guard `Math.max(0.01, …)`. Percent âm hợp lệ (Phàm Cốt).
- **insight_gain**: nhân `skillInsightGained` tại `BattleLootSystem.ts:175` trước khi cộng (floor kết quả). Nhiều talent cùng kind cộng dồn theo tổng percent (Nghịch Thiên −30% và Đại Trí Nhược Ngu +100%).
- **insight_per_cultivation** (Ngộ Đạo): thêm field `cultivationInsightAccumulator: number` vào PlayerData + default trong `createDefaultPlayer()` (bump `CURRENT_SAVE_VERSION` theo convention, không migration). Trong `cultivate()`: `acc += gained; while (acc >= 2000) { acc -= 2000; skillInsight += 1 }`. **Chỉ áp dụng tu luyện online** — tiến độ offline là thiết kế riêng sau này.
- **survive_lethal**: tại `EntityVitalsSystem.ts:105`, nếu target là player, có talent, còn lượt và đòn đánh lẽ ra chết → clamp HP = 1, trừ lượt. Counter gắn vào battle player, reset khi battle bắt đầu. Emit event để hiển thị khoảnh khắc kích hoạt. **Quyết định khi implement: KHÔNG kích hoạt trong trận Độ Kiếp** (giữ Độ Kiếp là nghi lễ thật) — khóa bằng test.
- **reaction_keep_chance**: tại nhánh consume chuẩn của `ReactionManager` (chỗ remove cả 2 ailment, ~line 165-169), roll 25% → bỏ qua cả hai remove (ailment tồn tại → có thể kích hoạt chain). Chỉ tác động nhánh chuẩn; các nhánh đặc biệt (`appliesAilmentId`, `keepsAilmentId`, `maxHpReductionPercent`, `percentOfTargetCurrentHp`) giữ nguyên hành vi.
- **heal_on_kill**: tại điểm xử lý quái chết trong `BattleLootSystem`, hồi `maxHpPercent × maxHp` cho `battle.player` (clamp maxHp).
- **equipment_drop_chance**: nhân chance của drop kind `'equipment'` (cả nhánh itemDrops ~line 310 lẫn boss drop ~line 397), cap 1.0.
- **alchemy_success_bonus**: cộng điểm % vào `totalPercent` trước khi tách guaranteed/extra (`AlchemySystem.ts:277-287`).
- **body_refinement_progress**: nhân lượng progress cộng vào trước khi so cap (`BodyRefinementSystem.ts:124`).
- **spirit_stone_gain**: nhân `spiritStoneGained` tại `BattleLootSystem.ts:186` (floor).

## 7. UI

- `CharacterCreationScreen.vue`: heading "Chọn ba Thiên Phú" → **"Chọn một Thiên Phú"**; counter "Đã chọn x / 3" → "x / 1"; nút xác nhận enable khi chọn đúng 1; summary bước 3 "3 Thiên Phú" → "1 Thiên Phú"; `toggleTalent` theo §3.
- Panel Nhân Vật (LeftPanel): hiển thị thiên phú đã chọn (tên + description, đọc từ `selectedTalentIds` qua `getTalentDefinition`) — hiện tại talent không hiển thị ở đâu sau khi tạo.

## 8. Nhiệm vụ triển khai

1. **Task 1 — Cơ chế chọn 1**: `CHARACTER_CREATION_TALENT_COUNT = 1`, `validateDraft`, `CharacterCreationScreen.vue`, cập nhật `CharacterCreationService.test.ts`.
2. **Task 2 — Data + helper**: viết lại `Talents.ts` theo catalog §5 (+ khối `PARKED_TALENTS` + ghi chú talent retired), mở rộng `TalentEffect` union, tạo `TalentEffects.ts` — test từng getter viết trước code.
3. **Task 3 — Hook rẻ**: cultivation_speed guard, insight_gain, spirit_stone_gain, equipment_drop_chance, body_refinement_progress, alchemy_success_bonus + test mỗi hook.
4. **Task 4 — Ngộ Đạo**: field accumulator + logic trong `cultivate()` + test (kể cả case chưa đủ 2000 tu vi thì không trigger).
5. **Task 5 — Hook trung bình**: survive_lethal (kể cả test KHÔNG kích hoạt trong Độ Kiếp), reaction_keep_chance (kể cả edge chain + nhánh đặc biệt không đổi), heal_on_kill (clamp HP) + test.
6. **Task 6 — UI**: panel Nhân Vật hiển thị talent.
7. **Task 7 — Ghi chú tương lai**: comment hook Đại Đạo trong `FoundationResolver.ts` (§4); cập nhật `docs/roadmap.md` (link talent plan trỏ về file này); đánh dấu `talent-effects-completion-plan.md` là đã thay thế.

Mỗi task kết thúc: test xanh + `npm.cmd run type-check`.

## 9. Kiểm chứng

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- Test khóa hành vi: Phàm Cốt → `cultivationPerSecond === 2.5`; Tiên Thiên Đạo Thể → 20/s; Đại Trí Nhược Ngu → Cảm Ngộ ×2 và tu luyện 7.5/s; Nghịch Thiên → tu luyện 15/s và Cảm Ngộ −30%; Bất Tử Thể sống sót đúng 1 lần/trận; Phản Phác giữ ailment khi roll thành công; Ngộ Đạo +1 Cảm Ngộ mỗi 2000 tu vi.
- Invariant catalog: đúng 12 talent enabled, weight > 0, id duy nhất, mọi effect kind có nơi tiêu thụ.
- Thủ công: tạo nhân vật thấy 9 thẻ, chọn 1, reroll giữ nguyên lựa chọn hợp lệ; save cũ 3 talent load không crash.

## 10. Rủi ro & lưu ý

- **Phàm Cốt chọn nhầm là chủ đích** — description cố ý "vô dụng", không thêm cảnh báo; người chọn chấp nhận ~4× thời gian early game (Phàm Nhân ~11h, Luyện Khí ~37h ở tốc độ nền).
- **Phản Phác + reaction damage**: chain reaction có thể tăng DPS Pháp Tu đáng kể — 25% là baseline, theo dõi playtest.
- **Ngộ Đạo phá luật "Cảm Ngộ chỉ từ chiến đấu"** — cố ý, đó là bản sắc talent; cập nhật `docs/game-guide.md` khi implement.
- **Huyết Chiến + Bất Tử Thể** cùng nhân vật: combo sinh tồn mạnh, chấp nhận được vì cùng rarity hiếm khi roll.
- Plan này không đụng: logic `FoundationResolver`, `RealmPassives`, tribulation, item ẩn, Kiếm Ý.

## 11. Quyết định đã ghi nhận (cho plan sau, KHÔNG implement ở đây)

- **Gate Đại Đạo Trúc Cơ**: tác giả sẽ thiết kế điều kiện sau; Phàm Cốt là một gate; đọc qua `PlayerData.selectedTalentIds`.
- **Trận kiếp Đại Đạo**: sẽ là **lôi kiếp khắc nghiệt hơn** (profile riêng theo foundationType — duration dài hơn, `lightningMaxHpDamagePercent` cao hơn), KHÔNG spawn quái kiếp.
- **Catalog dài hạn**: mục tiêu ~43 thiên phú của `talent-system-plan.md` giữ làm định hướng; `PARKED_TALENTS` là hạt giống đầu tiên.
