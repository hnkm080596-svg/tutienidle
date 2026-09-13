# Phù & Trận socket trên trang bị

**Trạng thái:** **Data + consumption live, acquisition/socket flow chưa có** — registry, slot state, stat pipeline đều chạy, nhưng không có bag, drop source, lệnh socket/unsocket, hay UI; người chơi chưa thể đưa Phù/Trận vào `socketedTalisman`/`socketedFormation` qua gameplay thường.

Core: `core/talisman/{Talisman,TalismanRegistry}.ts`, `core/formation/{Formation,FormationRegistry}.ts`, `core/equipment/SocketedModifierItem.ts`. Data: `data/talisman/talismans.ts`, `data/formation/formations.ts`.

> Phân biệt: `Formation` ở đây là **item socket** (đồ vật gắn lên trang bị), KHÁC `TranPhapDefinition` trong [companions.md](./companions.md) — đội hình trận pháp combat.

## Model

- `SocketedModifierItem = { itemId, realmId, modifiers: TwoModifiers }` — `TwoModifiers` là tuple **đúng 2** `StatModifier` (type + validator cùng enforce). `itemId` trỏ template trong registry (unsocket trả template này).
- `Talisman` (Phù): `id`, `realmId`, `grade: ProfessionGrade` (phẩm nghề, KHÔNG ItemGrade), `allowedSlots`, `modifiers` — thiên phòng thủ/tiện ích. Socket chỉ khớp equipment **cùng realmId**.
- `Formation` (Trận): cùng schema, thiên tấn công/ngũ hành. MVP bỏ trigger/stack — nếu sau này cần trigger thì là archetype riêng qua modifier runtime authority, không nhét vào schema socket tĩnh.

## Slot state — `EquipmentSlotState`

Mỗi slot tối đa **1 Phù + 1 Trận** (`socketedTalisman`, `socketedFormation`), chỉ active khi slot đang có equipment. Legacy `bonusAffixSlots`/`appliedTalismanIds` đã migration v43 hoàn trả bag rồi xoá (Phù không còn mở affix — Affix thuộc Luyện Khí).

## Stat aggregation

`GameManager.getEquipmentSocketModifiers` (quanh `GameManager.ts:1679`): duyệt `EQUIPMENT_SLOTS`, bỏ slot trống, gom `socketedTalisman.modifiers` + `socketedFormation.modifiers` vào danh sách modifier của player — đây là một nhánh của authority modifier duy nhất (timed effect + socket + equipment).

## Content

- `talismans.ts` — generated matrix 3 realm (`mortal`/`qi_refining`/`foundation_establishment`) × 3 rarity (Hạ/Trung/Thượng Phẩm, scale ×1/×2.5/×6) × realm scale ×1/×4/×12 → 9 Phù: `maxHp` + `hpRegenPerTurn`. `allowedSlots` mặc định mọi slot **trừ weapon** (data có thể mở).
- `formations.ts` — cùng matrix → 9 Trận: `attack` + `criticalRate`, mọi slot.

## Đăng ký & persist

`GameManager.registerTalismans`/`registerFormations` nạp data vào `talismanRegistry`/`formationRegistry` (boot). GameSave giữ field talismans/formations (xem [save-load.md](./save-load.md)); `Tooltip.vue` đã có `kind: 'talisman' | 'formation'`.

## Liên quan

- [equipment.md](./equipment.md) — slot state, enhance cùng bảng.
- [stats.md](./stats.md) — StatModifier/authority.
- [profession-grades.md](./profession-grades.md) — grade của Phù/Trận.
