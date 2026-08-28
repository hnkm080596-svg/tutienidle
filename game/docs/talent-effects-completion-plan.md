# Kế hoạch Hoàn thiện Effect Thiên Phú

> ⚠️ **ĐÃ THAY THẾ (2026-08-28)** — scope effect-wiring của plan này được hấp thụ vào [talent-direction-choice-plan.md](./talent-direction-choice-plan.md) (đã implement: roll 9 chọn 1, 12 talent effect thật, easter egg Phàm Cốt). Mục tiêu catalog ~43 thiên phú chuyển thành ghi chú dài hạn trong plan mới (§11). Giữ file này chỉ làm tham khảo lịch sử.

> Thuộc Phase 1 của [roadmap.md](./roadmap.md). Plan gốc về hệ thống: [talent-system-plan.md](./talent-system-plan.md). Plan này thực hiện phần còn nợ lớn nhất: **effect thật cho thiên phú** — hiện 11/13 thiên phú có `effects: []` rỗng.
> Phần server roll/xác minh backend KHÔNG thuộc plan này (thuộc [online-login-cloud-save-plan.md](./online-login-cloud-save-plan.md)); roll client-side giữ nguyên.

## 1. Mục tiêu

- Mọi thiên phú trong màn tạo nhân vật có effect thật, đo được, test được.
- Mở rộng `TalentEffect` union đủ phủ các nhóm effect mà 13 thiên phú hiện có hứa hẹn.
- Effect đi qua hệ thống stat/effect hiện có — không logic đặc thù rải rác.
- Bước đầu mở rộng catalog theo mục tiêu ~43 thiên phú của plan gốc (giai đoạn 2 của plan này).

## 2. Hiện trạng

- `TalentEffect` (`src/core/talent/Talent.ts:14-15`) chỉ có 1 kind: `cultivation_speed`.
- 13 thiên phú trong `src/data/talent/Talents.ts`, chỉ 2 có effect (`tam_tinh`, `tien_thien_dao_the`); **11 thiên phú rỗng effect** (lines 20, 29, 38, 47, 56, 65, 74, 83, 92, 101, 110).
- Wiring duy nhất: `getCultivationSpeedMultiplier()` gọi từ `stores/player.ts:66`. Các trục khác (combat, pill, insight, breakthrough) chưa nghe thiên phú.
- `TalentDefinition` chưa có `incompatibleTalentIds` và `enabled` (plan gốc §6 có đề xuất).
- Test hiện có: `Talents.test.ts` (multiplier), `CharacterCreationService.test.ts` (validate chọn 3).

## 3. Thiết kế

### 3.1 Mở rộng `TalentEffect` union

```ts
export type TalentEffect =
  | { kind: 'cultivation_speed'; percent: number }
  | { kind: 'stat_modifier'; stat: TalentStatId; percent: number }
  | { kind: 'insight_gain'; percent: number }
  | { kind: 'pill_effectiveness'; percent: number }
  | { kind: 'element_power'; percent: number }
  | { kind: 'conditional_damage_reduction'; hpBelowPercent: number; reductionPercent: number }
  | { kind: 'breakthrough_attribute_point'; amount: number }
  | { kind: 'tribulation_damage_taken'; percent: number }
```

Trong đó `TalentStatId` là tập con StatId được phép sửa bởi thiên phú (chốt danh sách khi triển khai, tối thiểu: `max_hp`, `physical_damage`/sát thương tổng quát, `armor`, `mana_regen`, `cast_speed`, `skill_damage`). Dùng stat hiện có trong `src/core/stats/`; KHÔNG tạo stat song song.

Ghi chú thiết kế:
- `stat_modifier` dùng được cho cả bonus và penalty (`percent` âm) → phủ được thiên phú risk-reward (`thien_sinh_chien_y`: 2 effect, 1 dương 1 âm).
- Điều kiện chiến đấu (vd `kiem_tam` — khi dùng kiếm) biểu diễn bằng field `condition` optional trong effect, KHÔNG viết logic cứng: `{ kind: 'stat_modifier'; stat: 'skill_damage'; percent: 0.08; condition: { kind: 'weapon_type'; weapon: 'sword' } }`. Nếu hệ condition chưa có chỗ tiêu thụ, task tương ứng phải thêm cả nơi tiêu thụ lẫn test.
- Không dùng `any`; mọi kind mới phải có test riêng.

### 3.2 Mapping 11 thiên phú đang rỗng

| Thiên phú | Effect đề xuất |
|---|---|
| `can_cot_vung` | `stat_modifier { stat: 'max_hp'; percent: 0.10 }` |
| `linh_cam` | `insight_gain { percent: 0.08 }` |
| `kiem_tam` | `stat_modifier { stat: 'skill_damage'; percent: 0.08; condition: weapon sword }` |
| `ngu_hanh_than` | `element_power { percent: 0.06 }` (cả 5 hành) |
| `duoc_duyen` | `pill_effectiveness { percent: 0.12 }` |
| `bat_khuat` | `conditional_damage_reduction { hpBelowPercent: 0.35; reductionPercent: 0.12 }` |
| `thien_sinh_chien_y` | `stat_modifier { damage +0.12 }` + `stat_modifier { armor -0.06 }` |
| `linh_mach_cong_huong` | `stat_modifier { mana_regen +0.10 }` + `stat_modifier { cast_speed +0.10 }` |
| `dao_phap_tu_nhien` | `breakthrough_attribute_point { amount: 1 }` |
| `nghich_thien` | `stat_modifier { damage +0.20 }` + `tribulation_damage_taken { percent: 0.10 }` |
| `vo_cau_dao_the` | **Hoãn** — mechanic lớn (bỏ điểm tự do, stat scale theo cảnh giới). Tạm thêm field `enabled: false` vào `TalentDefinition`, thiên phú này `enabled: false` cho tới khi có thiết kế riêng (ghi vào phần Việc phát sinh). |

### 3.3 Điểm tích hợp (integration points)

Mỗi kind effect có đúng một nơi tiêu thụ:

| Kind | Nơi tiêu thụ | Ghi chú |
|---|---|---|
| `cultivation_speed` | `stores/player.ts` (đã có) | Giữ nguyên |
| `stat_modifier` | Hệ thống tính stat (`src/core/stats/`) — thêm talent như một source modifier | Đọc cách source hiện có (equipment/buff/realm passive) được cộng, làm theo đúng pattern |
| `insight_gain` | `src/core/game/BattleLootSystem.ts` — nhân lượng Cảm Ngộ trước khi grant | |
| `pill_effectiveness` | `src/core/pill/PillSystem.ts` — nhân magnitude effect khi dùng đan | |
| `element_power` | `src/core/element/` — cộng vào Power cả 5 hành tại điểm tính stat nguyên tố | |
| `conditional_damage_reduction` | `src/core/combat/CombatSystem.ts` — bước cuối pipeline damage nhận vào, kiểm tra HP hiện tại | |
| `breakthrough_attribute_point` | `src/composables/useBreakthrough.ts` / `GameManager` điểm thuộc tính khi đột phá thành công | |
| `tribulation_damage_taken` | `src/composables/useTribulation.ts` — nhân sát thương lôi kiếp | |

Helper tập trung: thêm `collectTalentEffects(selectedTalentIds)` trong `src/data/talent/Talents.ts` trả về danh sách effect đã gộp (cùng pattern `getCultivationSpeedPercent` hiện có) để các nơi tiêu thụ không tự lặp vòng lặp.

### 3.4 Validation và hiển thị

- Thêm `incompatibleTalentIds: string[]` vào `TalentDefinition` (mặc định `[]`); `validateCharacterCreationDraft` (`src/services/character/CharacterCreationService.ts`) từ chối cặp xung đột. Chưa cần cặp xung đột ngay — hạ tầng có sẵn cho giai đoạn 2.
- Thêm `enabled: boolean` (mặc định `true`); `rollCharacterCreationTalents` loại thiên phú `enabled: false`.
- `CharacterCreationScreen.vue`: giá trị effect phải render từ `effects` (không hardcode text); description giữ vai trò mô tả, không phải nguồn sự thật số.
- Panel xem thiên phú đã chọn trong game (Nhân Vật panel): liệt kê 3 thiên phú + effect thực.

### 3.5 Giai đoạn 2 — mở rộng catalog (sau khi 13 thiên phú hoạt động)

Theo mục tiêu plan gốc §5 (~43 thiên phú), thêm theo nhóm, mỗi đợt 5–8 thiên phú:

1. Đợt 1: nhóm tu luyện/đột phá + tài nguyên (dễ, dùng kind đã có).
2. Đợt 2: nhóm chiến đấu/phòng thủ (cần thêm condition nếu chưa đủ).
3. Đợt 3: nhóm ngũ hành/phản ứng + mechanic (có thể cần kind mới — mỗi kind mới phải có design note trong plan này trước khi code).

Mỗi thiên phú mới phải có: effect test được, description khớp số, weight theo bảng rarity plan gốc §4.

## 4. Nhiệm vụ triển khai

### Task 1: Mở rộng union + helper + validation
- Modify: `src/core/talent/Talent.ts`, `src/data/talent/Talents.ts`, `src/services/character/CharacterCreationService.ts`
- Test trước: `collectTalentEffects` gộp đúng; draft chứa cặp incompatible bị từ chối; thiên phú `enabled: false` không xuất hiện trong roll.

### Task 2: `stat_modifier` qua hệ stat
- Modify: `src/core/stats/` (source mới cho talent) + fill effect `can_cot_vung`, `thien_sinh_chien_y`, `linh_mach_cong_huong`
- Test: stat tính ra có/không có thiên phú; penalty âm hoạt động; condition weapon (nếu điểm tiêu thụ đã tồn tại — nếu chưa, để Task 3).

### Task 3: Condition weapon cho `kiem_tam`
- Modify: nơi tiêu thụ stat trong combat (đọc weapon type từ equipment slot hiện hành)
- Test: skill damage +8% chỉ khi vũ khí là kiếm.

### Task 4: `insight_gain` + `pill_effectiveness` + `element_power`
- Modify: `BattleLootSystem.ts`, `PillSystem.ts`, `src/core/element/`
- Test mỗi trục một file/một describe riêng.

### Task 5: `conditional_damage_reduction` + `tribulation_damage_taken`
- Modify: `CombatSystem.ts`, `useTribulation.ts`
- Test: ngưỡng HP 35% (trên/dưới ngưỡng); kiếp nạn +10% damage.

### Task 6: `breakthrough_attribute_point`
- Modify: luồng đột phá (`useBreakthrough.ts`/`GameManager`)
- Test: đột phá thành công cộng đúng điểm; thất bại không cộng.

### Task 7: Vô hiệu `vo_cau_dao_the` + UI
- Modify: `Talents.ts` (`enabled: false`), `CharacterCreationScreen.vue`, panel Nhân Vật
- Test: roll không ra thiên phú disabled; UI render số từ data.

### Task 8 (giai đoạn 2): mở rộng catalog theo đợt (§3.5)
- Mỗi đợt là task riêng khi vào phase; không code trước thiết kế.

Mỗi task kết thúc: test xanh + `npm.cmd run type-check`.

## 5. Kiểm chứng

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- Unit test phủ đủ 8 kind effect (kể cả edge: effect rỗng, thiên phú unknown id, cộng dồn nhiều thiên phú cùng kind).
- Test hiện có không đổi kết quả: `Talents.test.ts`, `CharacterCreationService.test.ts`.
- Thủ công: tạo nhân vật chọn `can_cot_vung` → HP tăng 10% thật trong combat; chọn `linh_cam` → Cảm Ngộ nhận tăng 8%.

## 6. Rủi ro và lưu ý

- **Effect trùng nguồn stat**: talent cộng thẳng vào stat cuối thay vì qua source sẽ gây cộng trùng khi load lại. Bắt buộc đi qua cơ chế source/modifier hiện có của `core/stats/` (cách realm passive/equipment đang làm).
- **Description lệch số**: sau khi fill effect, soát lại toàn bộ description trong `Talents.ts` khớp giá trị thật.
- **`vo_cau_dao_the` gây thất vọng**: thiên phú Dị duy nhất mang tính mechanic lại bị hoãn. Mitigation: giữ trong code với `enabled: false`, ghi rõ trong plan này; ưu tiên thiết kế riêng ở Phase 3 nếu còn ngân sách.
- Reroll vô hạn + weight hiện tại không đổi trong plan này; vấn đề cân bằng reroll ghi nhận trong [roadmap.md](./roadmap.md) phần ngoài phạm vi / playtest.
