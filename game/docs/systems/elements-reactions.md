# Ngũ Hành & Phản ứng nguyên tố

**Trạng thái:** Live.

Types: `core/element/ElementType.ts` (5 hành). Reaction data: `core/element/ElementReaction.ts` (`ELEMENT_REACTIONS`). Manager: `core/element/ReactionManager.ts` (legacy path) + `core/battle/turn/TurnReactionManager.ts` (port cho turn engine — authority trong combat hiện tại). Loadout: `core/element/ElementLoadout.ts`, `ElementSlot.ts`.

## ElementType — chỉ 5 hành

`wood | fire | earth | metal | water`. **Phong/Lôi đã bỏ toàn hệ** (spec Đạo Sắc §5) — không mở lại. `primordialPower` (Hỗn Nguyên) là damage type true riêng, không phải element trong vòng này.

## Element Loadout (Pháp Tu)

- `player.unlockedElements` — hành đã mở qua node tree ([node-tree.md](./node-tree.md)); unlock mãi mãi, unequip không mất.
- `player.equippedElements` — hành mang vào combat, giới hạn `getElementSlotCount(realmId)`:
  - Phàm Nhân: 0 slot (chưa chọn path).
  - Luyện Khí: 2 slot; mỗi 2 đại cảnh giới kế +1; trần `MAX_ELEMENT_SLOTS = 5`.
- `canEquipElement`/`equipElement`/`unequipElement` — domain gate; UI ở loadout section của panel.

## Phản ứng (`ELEMENT_REACTIONS`)

Khi 1 ailment/debuff mới áp thành công lên target, `TurnReactionManager` quét buff **đang có** trên target, tìm cặp khớp `ELEMENT_REACTIONS[existing][new]` (và ngược lại) → kích **tối đa 1 lần mỗi call**.

`ElementReactionDefinition` hỗ trợ: `baseDamage` + `powerScalingRatio` (true damage bỏ qua Armor/Res), `percentOfTargetCurrentHp`, `keepsAilmentId` (giữ 1 vế thay vì tiêu cả 2), `appliesAilmentId` (tạo ailment mới), `appliesBuffId` (cấp buff lên **source**), `maxHpReductionPercent` (trừ vĩnh viễn % maxHp, trần cộng dồn `MAX_HP_REDUCTION_CAP_PERCENT = 0.3`/trận), `spawnsLavaZone` (legacy — turn engine bỏ, zone = DoT qua AOE/buff), `relation: 'sinh' | 'khac'` (nhãn).

## Bảng phản ứng hiện có

| Cặp | Tên | Hệ quả |
|---|---|---|
| Bỏng (Hỏa) + Tê Cóng (Thủy) | Bốc Hơi | 60 true dmg, giữ Tê Cóng, khắc |
| Bỏng + Trúng Độc (Mộc) | Độc Viêm | 10% currentHp target, sinh |
| Tê Cóng + Trúng Độc | Độc Thủy | 65 true dmg, giữ Tê Cóng, sinh |
| Thạch Hóa (Thổ) + Bỏng | Dung Nham | áp ailment `dung_nham` (DoT), sinh |
| Thạch Hóa + Tê Cóng | Trói Chân | áp `troi_chan` (root), khắc |
| Thạch Hóa + Trúng Độc | Độc Thế | buff nguồn `doc_the` (self-stack), khắc |
| Thạch Hóa + Chảy Máu (Kim) | Khai Sơn | 50 dmg + buff nguồn `khai_son` (+8% def/tầng), sinh |
| Chảy Máu + Bỏng | Thiêu Huyết | 85 dmg + trừ 3% maxHp vĩnh viễn, khắc |
| Chảy Máu + Trúng Độc | Huyết Độc | gộp thành ailment `huyet_doc` mạnh hơn, khắc |
| Chảy Máu + Tê Cóng | Ngưng Lộ | 40 dmg + buff nguồn `ngung_lo` (+5 manaRegen), sinh |

(Thủy+Kim chủ ý không phản ứng — "Kim không cần tương tác với mọi hệ".)

`reactionEffectPercent` trên stat khuếch đại `baseDamage` lúc kích.

## Element damage

`core/combat/ElementDamageCalculator.ts` — `elementalBasePower` gom power theo hành; mỗi hành là 1 damage type độc lập đấu resistance cùng tên (không còn chu kỳ sinh/khắc trong damage). Linh Căn (attunement) cộng đều 6 hành ([stats.md](./stats.md)).

## Liên quan

- [buffs.md](./buffs.md) — ailment id (bong, trung_doc, chay_mau, te_cong, thach_hoa…).
- [skills.md](./skills.md) — `appliesAilment`, reaction path picks.
- [cultivation-paths.md](./cultivation-paths.md) — Pháp Tu multi-hành.
