# Bản Mệnh Pháp Bảo (Artifact)

**Trạng thái:** Deferred — domain dời lên **Kim Đan+** theo ruling M-F-ARTIFACT-DEFER (§2/§52): scope Trúc Cơ trước đây bị thay thế, `ARTIFACT_UNLOCK_REALM_ID = 'golden_core'` giờ là gate chung cho grant/awaken/EXP/ops/material (Đoán Bảo Thạch domain-scoped). Wheel slot ẩn (lý do 'Cần đạt Kim Đan' hoặc chính sách release). State persisted (nếu có) được bảo toàn — domain access bị gate, ownership không bị xoá. Chỉ Ngũ Hành Châu (Pháp Tu); Kiếm Tu/Thể Tu chưa có definition.

Core: `core/artifact/Artifact.ts`, `ArtifactProgression.ts`, `ArtifactSystem.ts`, `ArtifactRuntime.ts`, `ArtifactCombatPresentation.ts`. Data: `data/artifact/{Artifacts,NguHanhChau}.ts`. UI: `ArtifactPanel.vue` (standalone `artifact`, command wheel — ẩn cho tới Kim Đan+, xem trạng thái ở trên).

## Mô hình

- Mỗi nhân vật đúng **1 pháp bảo** gắn `cultivationPath` — không slot trong paperdoll, không trong bag, không equip/craft/duplicate.
- `player.artifact?: ArtifactProgress` — `{ artifactId, level, exp, grade, path? }`.
- `ArtifactId = 'ngu_hanh_chau'` — `ARTIFACT_ID_BY_CULTIVATION_PATH` map path → artifact.

## Tiến trình

- **Level**: tích EXP từ kill (`applyArtifactExperience`/`getArtifactExperienceReward` trong loot, [drops-loot.md](./drops-loot.md)); `required(level) = round(20 × level^1.35)`; `ARTIFACT_MAX_DESIGNED_LEVEL = 18` (Trúc Cơ cap); `ArtifactExpStatus`: `training | capped_by_player | content_ceiling` (capped khi EXP vượt nhịp người chơi).
- **Grade** (trục Chất): `pham → linh → dia → thien → tien` (Phàm→Tiên Chất); `ARTIFACT_GRADE_MULTIPLIER` ×1.0/1.12/1.26/1.42/1.6 lên damage/buff/control. Lên phẩm tiêu **Đoán Bảo Thạch** (`doan_bao_thach`): 10/25/60/150 (tien không lên nữa).
- **Path** (`ArtifactPath`): `attack | defense | control` — chỉ 1 hướng active; `setArtifactPath`/`tryUpgradeArtifactGrade` **chặn đổi giữa combat** (runtime snapshot lúc vào trận).

## Milestone theo path (level 1/3/6/12/18)

`NguHanhChau.ts` — data mô tả milestone cho UI; số liệu thi hành (coefficient/ICD/chu kỳ) trong `ArtifactSystem.ts`:

- **Công (Ngũ Hành Liên Châu)**: L1 action nền bắn linh châu theo vòng Ngũ Hành equip; L3 +15% dmg; L6 thêm hit 55% dùng hành kế; L12 hai hành khác nhau trúng cùng mục tiêu giảm 10% chu kỳ kế; L18 lượt kích thứ 5 phóng mọi hành.
- **Thủ**: action nền ×0.70 damage, milestone phòng thủ (ward/buff…).
- **Khống**: ×0.80 damage, milestone khống chế (Ngũ Hành Phược → Trói Chân, per-target ICD chống root-lock).

## Combat runtime

`ArtifactSystem` — "subgun" trong trận: `ArtifactRuntime` (chỉ sống trong 1 Battle, không persist):

- `ARTIFACT_BASE_CYCLE_SECONDS = 3.0` (min 1.5), windup 0.25, base damage ratio 0.45 × power của hành; `NGU_HANH_ROTATION_ORDER` xoay vòng equipped elements.
- `PATH_BASE_DAMAGE_MULTIPLIER`: Công ×1.0, Thủ ×0.70, Khống ×0.80.
- `ArtifactTargetControlState` — ICD per-target cho nhánh Khống (`hitsInWindow`, `reapplyCooldownRemainingSeconds`).
- Damage đi qua `ActionImpactSystem` chuẩn; VFX preset theo element (`vfxPresetForElement`); presentation tách ở `ArtifactCombatPresentation.ts` + `useArtifactCombatPresentation.ts`.

## Liên quan

- [cultivation-paths.md](./cultivation-paths.md) — Pháp Tu.
- [elements-reactions.md](./elements-reactions.md) — vòng Ngũ Hành.
- [combat-overview.md](./combat-overview.md) — trong trận.
