# Kế hoạch Combat Balance Pass

> Thuộc Phase 1 của [roadmap.md](./roadmap.md). Plan này hoàn tất các quy tắc đã chốt trong progression-combat-rework-plan (đã dọn sau khi hoàn thành) còn nợ (đặc biệt §7 — mana cho active skill Pháp Tu) và sửa các vấn đề cân bằng/feedback được phát hiện trong đợt rà soát 2026-08-27.
> KHÔNG bao gồm: bàn cờ vây 19×19 (hướng riêng, chưa vào roadmap), Thể Tu (thuộc [progression-depth-plan.md](./progression-depth-plan.md)).

## 1. Mục tiêu

- Skill Pháp Tu tiêu thụ mana thật — tài nguyên chiến đấu có ý nghĩa.
- Reaction ngũ hành scale theo Power, không yếu dần về late.
- 5 skill Pháp Tu có nhịp (cast time/cooldown/hình dạng AOE) khác nhau.
- Sửa bug HUD `out_of_range` và các vết kỹ thuật nhỏ trong SkillSystem.
- Đặt nền cho boss skill data-driven.

## 2. Hiện trạng và vấn đề

### 2.1 Tài nguyên chết (Cao)

- 5 skill Pháp Tu và Thái Hư Nhất Kiếm khai `cost: 8/15/25` nhưng `resourceType: 'none'` (`src/data/skill/Skills.ts` — các dòng 54, 115, 355, 413, 485…) → mana không bao giờ bị trừ.
- progression-combat-rework-plan §7 đã chốt: "Active skill Pháp Tu tốn mana theo config balance tạm" — quy tắc này chưa được implement.
- Hệ quả: mana regen và Mana Shield (`CombatSystem.manaShield.test.ts`) chỉ còn là stat phòng ngự; trạng thái HUD `blocked_resource` (`CombatSkillPresentation.ts`) không bao giờ kích.

### 2.2 Reaction không scale (Trung bình)

- `ELEMENT_REACTIONS` (`src/core/element/ElementReaction.ts:123-190`) dùng `baseDamage` flat 60–85. `ReactionManager.ts:84` chỉ khuếch đại bằng `reactionEffectPercent`.
- Về late, 60–85 damage trở nên vô nghĩa so với HP quái; reaction — bản sắc của Pháp Tu — mất giá trị.

### 2.3 Nhịp skill đơn điệu (Trung bình)

- Các skill Pháp Tu hiện cùng cast time ~1.2s / cooldown ~1s (kiểm tra lại chính xác trong `Skills.ts` khi triển khai). Scheduler round-robin biến combat thành chuỗi đòn đồng nhịp.

### 2.4 Bug HUD `out_of_range` (Cao — bug)

- `buildLoadoutPresentation()` (`src/core/combat/CombatSkillPresentation.ts:106-110`) dùng `DEFAULT_COMBAT_AI_STRATEGY` để chọn mục tiêu mẫu. Khi người chơi chọn strategy khác (vd 'boss_first'), HUD có thể hiện `out_of_range` trong khi runtime vẫn đánh — và ngược lại.

### 2.5 Fizzle harsh (Trung bình)

- Cast thất bại (chết giữa cast, hết mục tiêu) vẫn tốn đủ tài nguyên + cooldown (transaction 2 nửa trong `SkillSystem.ts`). Với idle game, người chơi không thể phản ứng — penalty nên nhẹ hơn.

### 2.6 Vết kỹ thuật (Thấp)

- `canUseInSlot` mutate tạm `remainingCooldown` để lách global check (`src/core/skill/SkillSystem.ts:301`).
- Song song tồn tại `use()`/`useInSlot()` legacy và field `Skill.castTime` trùng với `execution.castTime` — nguy cơ hai nguồn sự thật.
- `CombatActionDefinition` (`src/core/battle/CombatAction.ts:79`) không nơi tiêu thụ; quái chỉ có basic attack vật lý cứng.
- Policy `attack_speed_cast` đủ code nhưng 0 skill dùng.
- Teleport của avatar chỉ có TODO hook VFX (`BattleSystem.ts:1796`).
- `CombatEventBar.vue` dùng chung icon 🔥 cho mọi reaction.

## 3. Thiết kế

### 3.1 Bật mana cost (quyết định: BẬT, không xóa cost)

Lý do: §7 plan gốc đã chốt; Mana Shield/regen cần lý do tồn tại; idle combat cần quyết định tài nguyên.

- Đổi `resourceType: 'none'` → `'mana'` cho các skill Pháp Tu có `cost > 0` trong `Skills.ts`. Giữ `resourceType: 'rage'`/`'sword_intent'` hiện có của skill khác.
- Balance mana baseline (file balance tập trung, playtest chỉnh):
  - Max mana và mana regen phải đủ cho vòng cast ổn định ở trạng thái idle: mục tiêu thiết kế = không bao giờ cạn mana khi đánh quái ngang cảnh giới, có thể cạn khi spam skill mạnh hơn cảnh giới.
  - Cost hiện tại (8/15/25) giữ làm baseline; regen baseline đề xuất: hồi ~30–40% max mana mỗi 10 giây ở trạng thái chiến đấu (số cụ thể chỉnh theo max mana thực của `stats`).
- Kiểm tra `hasEnoughResource` (`CombatSkillPresentation.ts:85`) và transaction trong `SkillSystem` đã xử lý đúng khi mana bật — phần lớn code đã tồn tại, chủ yếu là bật data.

### 3.2 Reaction scale theo Power

- Thêm field optional trong reaction data: `powerScalingRatio?: number` — tỷ lệ Power nguyên tố của NGUỒN kích hoạt (ailment áp sau cùng) cộng vào damage.
- Công thức: `damage = (baseDamage + sourcePower * powerScalingRatio) * (1 + reactionEffectPercent)`.
- Baseline `powerScalingRatio: 0.5` cho reaction có baseDamage > 0; giữ nguyên behavior khi field vắng mặt (tương thích test hiện có).
- Reaction `percentOfTargetCurrentHp` và loại sinh ailment/buff không đổi.

### 3.3 Đa dạng nhịp skill Pháp Tu

Nguyên tắc: mỗi hành một cá tính nhịp, tổng DPS ngang nhau trước keystone.

| Vai trò | Cast time | Cooldown | Ghi chú |
|---|---:|---:|---|
| Hỏa (bùng nổ) | 1.6s | 4s | Damage lớn, AOE nhỏ |
| Thủy (duy trì) | 0.9s | 1s | Đòn nhịp nhanh, áp ailment |
| Mộc (DoT) | 1.2s | 2s | Áp độc mạnh, damage trực tiếp thấp |
| Kim (xuyên) | 1.0s | 2.5s | Single-target nặng |
| Thổ (phòng thủ/khống chế) | 1.4s | 5s | AOE rộng hoặc hiệu ứng khống chế nhẹ |

Bảng trên là baseline thiết kế; số cụ thể chỉnh trong `Skills.ts` + playtest. Không đổi effect cốt lõi của skill nếu không cần — chỉ đổi nhịp và phân bố damage.

### 3.4 Sửa HUD `out_of_range`

- `buildLoadoutPresentation()` nhận thêm tham số `strategy: CombatAiStrategy` (người chơi đang chọn, đọc từ PlayerData tại nơi gọi trong `CombatSceneOverlay`/HUD component).
- Thay `DEFAULT_COMBAT_AI_STRATEGY` bằng tham số này.
- Test: cùng battle state, hai strategy khác nhau cho trạng thái `out_of_range` khác nhau khi mục tiêu ưu tiên ngoài tầm.

### 3.5 Giảm penalty fizzle

- Fizzle (cast bị hủy không phải do người chơi) hoàn lại 100% tài nguyên, chỉ commit 50% cooldown. Giữ nguyên penalty đầy đủ khi cast hoàn tất.
- Sửa transaction trong `SkillSystem` (`beginCastInSlot`/`commitSlotCooldown`); thêm test fizzle.

### 3.6 Nền boss skill (phạm vi giới hạn)

- Chỉ làm phần data + resolve: cho phép boss khai báo 1–2 action trong `CombatActionDefinition` thay vì basic attack cứng trong `fireEnemyAttack`. Chưa làm UI báo hiệu skill boss.
- Áp dụng cho đúng 1 boss hiện có (boss `foundation_floor_10` nếu M1 của [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md) xong, nếu không chọn boss Luyện Khí tầng 10) làm hình mẫu.
- Nếu khi triển khai thấy `CombatActionDefinition` không khớp nhu cầu thực, được phép thiết kế lại shape — nhưng phải cập nhật test và ghi chú trong plan.

### 3.7 Dọn vết kỹ thuật

- Gộp `use()`/`useInSlot()`: giữ `useInSlot` làm API duy nhất, `use()` gọi qua hoặc xóa nếu không còn caller.
- Xóa field `Skill.castTime` nếu mọi nơi đã đọc từ `execution.castTime` (grep xác nhận trước).
- Viết lại `canUseInSlot` không mutate state (check cooldown bằng phép so sánh thuần).
- Xóa hoặc gán skill cho policy `attack_speed_cast`: nếu không skill nào cần trong 2 milestone tới, xóa policy + test liên quan để giảm bề mặt bảo trì.
- Thêm VFX tối thiểu cho teleport (dùng preset có sẵn trong `CombatVfxPresets.ts`, không cần asset mới).
- Icon riêng cho từng reaction trong `CombatEventBar.vue` (SVG/CSS glyph theo theme, không emoji — phối hợp [ui-discoverability-refactor-plan.md](./ui-discoverability-refactor-plan.md)).

## 4. Nhiệm vụ triển khai

1. **Task 1 (bug)**: sửa HUD `out_of_range` (§3.4) — nhỏ, làm trước.
2. **Task 2**: bật mana cost + balance regen (§3.1); cập nhật test mana hiện có.
3. **Task 3**: reaction power scaling (§3.2); test mới + test cũ không đổi khi vắng field.
4. **Task 4**: đa dạng nhịp skill (§3.3); cập nhật test cast time/cooldown bị ảnh hưởng.
5. **Task 5**: fizzle refund (§3.5).
6. **Task 6**: boss skill nền (§3.6).
7. **Task 7**: dọn vết kỹ thuật (§3.7) — có thể tách nhiều commit nhỏ.
8. **Task 8**: playtest pass — Realm Pressure tuyến tính, mana regen, nhịp skill mới; ghi kết quả và số chỉnh vào cuối plan này (mục "Kết quả playtest").

Mỗi task: test trước (trừ Task 8), kết thúc bằng test xanh + type-check.

## 5. Kiểm chứng

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- Test bắt buộc mới: mana trừ khi cast + chặn khi thiếu mana (`blocked_resource` kích trên HUD); reaction scale Power; fizzle refund; HUD theo strategy live.
- Test hiện có: `CombatSkillPresentation.test.ts`, `ReactionManager.test.ts`, `SkillSystem` tests, `BattleSystem.*.test.ts` — cập nhật có chủ đích, không xóa để xanh.
- Chơi thử: Pháp Tu hết mana trong tình huống hợp lý rồi hồi lại; reaction còn ý nghĩa ở quái Luyện Khí tầng cao.

## 6. Rủi ro và lưu ý

- **Bật mana phá vỡ idle**: nếu regen quá thấp, auto-battle chết đứng khi hết mana. Mitigation: mục tiêu thiết kế §3.1 + test mô phỏng 10 phút combat liên tục.
- **Đổi nhịp skill vỡ test snapshot**: nhiều test battle có thể hardcode cast time; cập nhật từng cái có chủ đích.
- **Boss skill scope creep**: giới hạn đúng §3.6; UI báo hiệu và đa dạng skill boss để dành phase sau.
- Sau khi hoàn tất: cập nhật `docs/game-guide.md` mục Chiến đấu (theo quy trình docs-sync-audit đã hoàn thành 2026-08-28).

## Kết quả playtest

_(Để trống — điền khi thực hiện Task 8.)_
