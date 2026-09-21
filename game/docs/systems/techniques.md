# Tâm Pháp (Technique)

**Trạng thái:** Live.

Core: `core/technique/Technique.ts`, `TechniqueSystem.ts`, `TechniqueManager.ts`, `TechniqueProgression.ts`. Data: `data/technique/Techniques.ts`. UI: `panels/skill-path/TechniqueBand.vue` trong `SkillPathPanel` (P7-M7 — `TechniquePanel.vue` standalone đã gỡ; `ScripturePavilionPanel` chỉ còn lore).

## Mô hình (P7-M3 — canonical)

- **Đúng 1 công pháp canonical cho mỗi Way đã commit** (6 Way ↔ 6 công pháp), granted tự động lúc Nhập Đạo. Không còn learn-by-drop, không còn danh sách/equip giao hoán — `equipTechnique` là delegate thuần vào authority Way.
- Phàm Nhân **không có** công pháp canonical (không có pathway technique).
- `TechniqueManager` giữ instance sống (holder); `TechniqueSystem` là writer duy nhất (grant/advance/restore) và publish mirror `player.techniqueProgress` {rank, grade} cho NodeSystem prerequisite (P7-M6).
- `combatTypeId` gắn công pháp vào loại combat (crit/def/...); `resourceLabel` đổi nhãn thanh tài nguyên (vd "Pháp Lực").

## Progression: rank / mastery / grade

- **Rank** 0→10 (`TECHNIQUE_RANK_CAP`): mỗi rank cần `mastery` = `300 × grade` (`getTechniqueMasteryForNextRank`). Mastery nuôi từ combat.
- **Rank band** (display): 0 Sơ Nhập / 1-2 Tiểu Thành / 3-5 Đại Thành / 6-10 Viên Mãn (`getTechniqueTierForRank`).
- **Grade** 1→trần = realm index hiện tại (`getTechniqueGradeCeiling`). Nâng grade yêu cầu rank 10 + trả `100 × targetGrade` Linh Thạch theo realm tier (`getTechniqueGradeUpgradeCost`) — action duy nhất phía người chơi là nút **Nâng Cảnh** trong TechniqueBand (`realmAdvanceOps.tryAdvanceTechniqueGrade`).
- **Effect đang chạy** = `gradeEffects[grade cao nhất đã author ≤ technique.grade][rank band]` (`getTechniqueEffects`) — không author = 0.

## Catalog (`TECHNIQUES`, 6 entries — grant template grade 1 / rank 0 / quality 'hoang')

| id | Tên | Way | Ghi chú |
|---|---|---|---|
| `five_elements_art` | Tiểu Ngũ Hành Quyết | `spell_pathway` | grade 2 = bảng Trúc Cơ fold từ `dai_ngu_hanh_quyet_truc_co` đã gỡ |
| `dao_insight_art` | Ngộ Đạo Chân Quyết | `hidden_spell_pathway` | Ngộ Đạo signature |
| `sword_control_art` | Ngự Kiếm Tâm Kinh | `sword_pathway` | combatType `crit`, element metal |
| `myriad_swords_art` | Vạn Kiếm Quyết | `hidden_sword_pathway` | Ngự Kiếm Đạo signature |
| `diamond_body_art` | Kim Cang Bất Hoại Thể | `body_pathway` | combatType `def` |
| `responsive_body_art` | Ứng Thế Thần Quyết | `hidden_body_pathway` | combatType `def` |

`tu_linh_quyet` (Tụ Linh Quyết) đã **REMOVE hoàn toàn** theo quyết định product P7 — không còn generic starter technique.

## Liên quan

- [cultivation-paths.md](./cultivation-paths.md) — Way tự grant công pháp lúc initiation.
- [stats.md](./stats.md) — `sourceType: 'technique'`.
- [drops-loot.md](./drops-loot.md) — nguồn mastery tâm pháp.
