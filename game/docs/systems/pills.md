# Đan dược (Pill)

**Trạng thái:** Live.

Core: `core/pill/Pill.ts`, `PillEffect.ts`, `PillSystem.ts`, `PillBag.ts`, `PillRegistry.ts`, `PillTypes.ts`. Data: `data/pill/pills.ts` + `data/pill/PillFamilies.ts`. UI: `PillRoomPanel.vue` + bag tab `pill`. Luyện đan: [alchemy.md](./alchemy.md).

## Model

`Pill`: `id`, `name` (không chứa tiền tố phẩm — ghép động qua `composeItemGradeNameSegments`), `grade` (ItemGrade 5 bậc — driver độ mạnh), `realmId?` (gate cảnh giới khi dùng → `wrong_realm`), `professionGrade?`, `type`, `effects: PillEffect[]`.

## `PillEffectType`

| type | Tác dụng |
|---|---|
| `heal` | hồi HP tức thì `value` |
| `cultivation` | +`cultivationPercent` × required của realm hiện tại (qua `addCultivation` — vẫn cap) |
| `buff` | áp `BuffDefinition` mang sẵn trong effect |
| `permanent_stat` | +`value` vĩnh viễn lên `stat` — ghi THẲNG vào `player.baseStats` (ruling 2026-09-29: chỉ level-up + đan dược được ghi baseStats; bucket modifier `pill-permanent:*` đã retire) |
| `random_main_stat` | +1 lên 1 main stat ngẫu nhiên chưa cap — cũng ghi `baseStats` |
| `regen` | hồi `hpPerSecond`/`mpPerSecond` trong `durationSeconds`; `effectGroup` nhóm stack (cùng nhóm refresh deadline, `stackable` cho uống lại cộng thời lượng) |
| `skill_insight` | +flat Cảm ngộ Kỹ năng |

## Dùng đan — `PillSystem.use`

- `PillTarget` adapter (`addCultivation`/`heal`/`applyBuff`) — PillSystem không giữ PlayerData/CombatEntity; caller cung cấp (ngoài trận: player store; trong trận: CombatEntity).
- Gate: `wrong_realm` (pill có `realmId` ≠ realm player), `all_main_stats_capped`, `requires_phap_tu`, `cap` (stat đích đã chạm trần).
- **Stat cap**: đan stat cộng vào `baseStats` nên chung một trần với điểm level-up — `getEffectiveMainStatCap(player)` (đã gồm bonus trần từ hidden body); uống vượt trần bị từ chối (`cap`), đan ở lại túi.

## Pill families (`PILL_FAMILIES`)

Mỗi family = 1 đan phương ↔ 1 linh thảo riêng (`herbId`), effect kind + scale theo tier (`Math.pow(1.7, tierIndex)`):

| Đan | Thảo | Effect |
|---|---|---|
| Tụ Linh Đan | Tụ Linh Thảo | cultivation (+2% required + 0.5%/tier) |
| Hồi Xuân Đan | Hồi Xuân Thảo | hp regen |
| Hồi Linh Đan | Hồi Linh Thảo | mp regen |
| Phi Vân Đan | Phi Vân Thảo | permanent dexterity |
| Tố Cốt Đan | Tố Cốt Thảo | permanent strength |
| Thối Thể Đan | Thối Thể Thảo | permanent vitality |
| Dưỡng Thần Đan | Dưỡng Thần Thảo | permanent intelligence |
| Khải Linh Đan | Khải Linh Hoa | permanent attunement |

Grade theo tier: `hoang, hoang, huyen, huyen, dia, dia, thien, thien, tien` — đan realm cao grade cao hơn.

## Liên quan

- [alchemy.md](./alchemy.md) — luyện đan (recipe = family × herb).
- [stats.md](./stats.md) — `baseStats` + `getEffectiveMainStatCap`.
- [buffs.md](./buffs.md) — effect `buff`.
- [inventory.md](./inventory.md) — PillBag.
