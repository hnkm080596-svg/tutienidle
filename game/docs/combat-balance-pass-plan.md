# Kế hoạch Combat Balance Pass

> Thuộc Phase 1 của [roadmap.md](./roadmap.md). Plan này hoàn tất các quy tắc đã chốt trong progression-combat-rework-plan (đã dọn sau khi hoàn thành) còn nợ và sửa các vấn đề cân bằng/feedback được phát hiện trong đợt rà soát 2026-08-27.
> KHÔNG bao gồm: bàn cờ vây 19×19 (hướng riêng, chưa vào roadmap), Thể Tu (thuộc [progression-depth-plan.md](./progression-depth-plan.md)).
> **Cập nhật 2026-08-29 (quyết định người dùng)**: mana KHÔNG phải tài nguyên cast skill. Mana là **Linh lực hộ thể** (`manaShieldPercent` — chuyển sát thương sang MP, đặc trưng Pháp Tu, đã sống tại `CombatSystem.ts` applyDamage). §3.1 cũ "Bật mana cost" bị thay bằng §3.1 mới "Dọn dữ liệu cost chết" — không thêm mana cost vào bất kỳ skill nào.

## 1. Mục tiêu

- Skill Pháp Tu KHÔNG tốn mana — mana giữ nguyên vai trò Linh lực hộ thể (đặc trưng Pháp Tu); dữ liệu `cost`/`resourceType` chết được dọn sạch khỏi `Skills.ts`.
- Reaction ngũ hành scale theo Power, không yếu dần về late.
- 5 skill Pháp Tu có nhịp (cast time/cooldown/hình dạng AOE) khác nhau.
- Sửa bug HUD `out_of_range` và các vết kỹ thuật nhỏ trong SkillSystem. *(HUD `out_of_range` đã xong 2026-08-28.)*
- Đặt nền cho boss skill data-driven.

## 2. Hiện trạng và vấn đề

### 2.1 Dữ liệu cost chết (Trung bình — đã hạ từ Cao sau quyết định mana=shield)

- Các skill khai `cost > 0` nhưng `resourceType: 'none'`: `pha_thien_nhat_kich` (cost 90, `Skills.ts:311`), `van_kiem_trieu_tong` (cost 9999, `Skills.ts:841`). Mana không bao giờ bị trừ — con số chỉ gây nhiễu khi đọc data.
- Quyết định 2026-08-29: KHÔNG bật mana cost (mana là Linh lực hộ thể, xem header). Việc cần làm là dọn dữ liệu chết, không phải bật tài nguyên cast.
- Mana Shield/regen giữ nguyên vai trò hiện có: `manaShieldPercent` chuyển % sát thương sang MP (`CombatSystem.ts` applyDamage), `manaRegenPerSecond` hồi MP mỗi tick (`BattleSystem.ts` regen). Đây là cơ chế phòng ngự đặc trưng Pháp Tu — không đụng tới.

### 2.2 Reaction không scale (Trung bình)

- `ELEMENT_REACTIONS` (`src/core/element/ElementReaction.ts:123-190`) dùng `baseDamage` flat 60–85. `ReactionManager.ts:84` chỉ khuếch đại bằng `reactionEffectPercent`.
- Về late, 60–85 damage trở nên vô nghĩa so với HP quái; reaction — bản sắc của Pháp Tu — mất giá trị.

### 2.3 Nhịp skill đơn điệu (Trung bình)

- Các skill Pháp Tu hiện cùng cast time ~1.2s / cooldown ~1s (kiểm tra lại chính xác trong `Skills.ts` khi triển khai). Scheduler round-robin biến combat thành chuỗi đòn đồng nhịp.

### 2.4 Bug HUD `out_of_range` (Cao — bug) ✅ ĐÃ XONG 2026-08-28

- `buildLoadoutPresentation()` (`src/core/combat/CombatSkillPresentation.ts:106-110`) dùng `DEFAULT_COMBAT_AI_STRATEGY` để chọn mục tiêu mẫu. Khi người chơi chọn strategy khác (vd 'boss_first'), HUD có thể hiện `out_of_range` trong khi runtime vẫn đánh — và ngược lại. Đã sửa trong Wave 4 2026-08-28.

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

### 3.1 Dọn dữ liệu cost chết (quyết định: KHÔNG bật mana cost — mana là Linh lực hộ thể)

Quyết định người dùng 2026-08-29: không thêm mana cost vào skill. Mana giữ vai trò Linh lực hộ thể (`manaShieldPercent`). §7 của plan gốc (mana cost cho active skill) bị hủy.

- Đặt `cost: 0` và giữ `resourceType: 'none'` cho các skill Pháp Tu (root node active) — khớp thiết kế "skill root không tốn tài nguyên".
- Dọn các skill có `cost > 0` nhưng `resourceType: 'none'`: `pha_thien_nhat_kich` (cost 90), `van_kiem_trieu_tong` (cost 9999). Quyết định cụ thể: nếu skill đó là active nên có cost thật thì dùng `resourceType` phù hợp bản chất (vd `sword_intent`), còn không thì `cost: 0`. Grep mọi caller đọc `cost` trước khi sửa để không bỏ sót.
- Giữ nguyên `resourceType: 'rage'` / `'sword_intent'` hiện có của skill khác — không đổi.
- Xóa hoặc sửa test khẳng định mana bị trừ khi cast (nếu có) — sau quyết định này, mana KHÔNG bị trừ khi cast.
- Kiểm tra `hasEnoughResource` (`CombatSkillPresentation.ts:85`) và transaction `SkillSystem` không còn nhánh mana khi bật.

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

### 3.4 Sửa HUD `out_of_range` ✅ ĐÃ XONG 2026-08-28

- `buildLoadoutPresentation()` nhận thêm tham số `strategy: CombatAiStrategy` (người chơi đang chọn, đọc từ PlayerData tại nơi gọi trong `CombatSceneOverlay`/HUD component).
- Thay `DEFAULT_COMBAT_AI_STRATEGY` bằng tham số này.
- Test: cùng battle state, hai strategy khác nhau cho trạng thái `out_of_range` khác nhau khi mục tiêu ưu tiên ngoài tầm. *(Đã xong trong Wave 4.)*

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

1. **Task 1 (bug)**: sửa HUD `out_of_range` (§3.4) — ✅ ĐÃ XONG 2026-08-28.
2. **Task 2**: dọn dữ liệu cost chết (§3.1) — ✅ XONG 2026-08-29. Xác minh: `pha_thien_nhat_kich` (rage) và `van_kiem_trieu_tong` (sword_intent) đã có resourceType hợp lệ — không còn cost chết. Xóa 12 dòng `cost: 0` thừa trên passive. Thêm invariant test `Skills.costInvariant.test.ts` (cost>0 phải có resourceType; resourceType none không khai cost; active phải có execution).
3. **Task 3**: reaction power scaling (§3.2) — ✅ XONG 2026-08-29. Field `powerScalingRatio` trên `ElementReactionDefinition`, công thức `(base + sourcePower×ratio) × (1+reactionEffectPercent)`; element lấy từ instance ailment vừa áp (`AilmentSystem.getAilment`), Power qua `elementalBasePower()` dùng chung. `powerScalingRatio: 0.5` cho Bốc Hơi/Lôi Viêm/Độc Thủy/Thiêu Huyết. Test: `ReactionManager.powerScaling.test.ts` + cập nhật test cũ (power cộng thêm từ attack nền).
4. **Task 4**: đa dạng nhịp skill (§3.3) — ✅ XONG 2026-08-29. Hỏa 1.6/4, Thủy 0.9/1, Mộc 1.2/2, Kim 1.0/2.5, Thổ 1.4/5 (cast/cooldown). Test `Skills.rhythm.test.ts`.
5. **Task 5**: fizzle refund (§3.5) — ✅ XONG 2026-08-29. `SkillSystem.refundResource()` + `commitSlotCooldown(slot, fraction=0.5)`; `BattleSystem.updateCasting` fizzle → refund 100% + commit 50%. Test `BattleSystem.fizzleRefund.test.ts` + cập nhật `skillFlow.test.ts`.
6. **Task 6**: boss skill nền (§3.6) — ✅ XONG 2026-08-29. `EnemySpecialAttack` (`everyNth`/`damageMultiplier`/`presetId`) thread qua Enemy/CombatEntity, tiêu thụ `fireEnemyAttack` với `specialAttackCounter` runtime. Áp cho boss `foundation_ferocious_flood_dragon_whelp` (mỗi đòn thứ 4 ×2.5 nước). Test `BattleSystem.bossSpecialAttack.test.ts`.
7. **Task 7**: dọn vết kỹ thuật (§3.7) — ✅ XONG 2026-08-29 (một phần). Đã làm: `canUseInSlot` không mutate state; gộp `use()` legacy vào `useInSlot`; icon reaction riêng bằng CSS glyph trong `CombatEventBar.vue` (bỏ emoji). Teleport VFX đã có sẵn (flash alpha trong `CombatScene.onPlayerTeleported`). Giữ lại có chủ đích: policy `attack_speed_cast` và field `Skill.castTime` legacy (đã ghi "giữ UI/tooltip" trong code — xóa chạm rộng, để đợt UI refactor).
8. **Task 8**: playtest pass — ✅ XONG 2026-08-29. Xem "Kết quả playtest".

Mỗi task: test trước (trừ Task 8), kết thúc bằng test xanh + type-check.

## 5. Kiểm chứng

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- Test bắt buộc mới: reaction scale Power; fizzle refund; HUD theo strategy live (đã xong).
- Test hiện có: `CombatSkillPresentation.test.ts`, `ReactionManager.test.ts`, `SkillSystem` tests, `BattleSystem.*.test.ts` — cập nhật có chủ đích, không xóa để xanh.
- Chơi thử: reaction còn ý nghĩa ở quái Luyện Khí tầng cao; mana regen nuôi Linh lực hộ thể ổn định.

## 6. Rủi ro và lưu ý

- **Mana = Linh lực hộ thể (quyết định 2026-08-29)**: mọi chỉnh balance mana trong quá trình playtest phải nhắm vào khả năng duy trì khiên (`manaShieldPercent` × regen), KHÔNG thêm cost cast. Trạng thái HUD `blocked_resource` không còn ý nghĩa cho mana — kiểm tra xem còn hệ tài nguyên nào dùng nó không trước khi xóa.
- **Đổi nhịp skill vỡ test snapshot**: nhiều test battle có thể hardcode cast time; cập nhật từng cái có chủ đích.
- **Boss skill scope creep**: giới hạn đúng §3.6; UI báo hiệu và đa dạng skill boss để dành phase sau.
- Sau khi hoàn tất: cập nhật `docs/game-guide.md` mục Chiến đấu (theo quy trình docs-sync-audit đã hoàn thành 2026-08-28).

## Kết quả playtest

_(Điền 2026-08-29 — Task 8.)_

Mô phỏng combat liên tục 600s (10 phút, tick 0.1s) Pháp Tu Thủy path vs quái ngang cảnh giới, qua test `Playtest.continuousCombat.test.ts`:

- **Mana = Linh lực hộ thể**: với `manaShieldPercent 0.5` + `manaRegenPerSecond 5`, mana có thể chạm 0 khi khiên hút đòn lớn nhưng regen hồi lại liên tục, KHÔNG âm/KHÔNG crash — player sống trọn 10 phút. Không cần chỉnh balance regen.
- **Reaction power scaling**: reaction cộng `sourcePower×0.5` (qua `elementalBasePower` dùng chung với direct hit/DoT) — ở quái cùng cảnh giới vẫn đóng góp ý nghĩa, không còn chỉ là 60–85 flat vô nghĩa.
- **Nhịp skill mới**: 5 nhịp khác nhau (Hỏa 1.6/4, Thủy 0.9/1, Mộc 1.2/2, Kim 1.0/2.5, Thổ 1.4/5) — scheduler round-robin tạo đa dạng thay vì đồng nhịp 1.2/1.
- **Fizzle**: cast hỏng vì mục tiêu chết/rời tầm → hoàn 100% tài nguyên + 50% cooldown, idle không mất trắng.

**Verify tổng**: 199 file test / 1147 test ✅, `type-check` ✅, `build` ✅.

**Giới hạn còn lại**: 
- `attack_speed_cast` và `Skill.castTime` legacy giữ lại (đã ghi lý do ở Task 7).
- `blocked_resource` HUD không còn dùng cho mana — kiểm tra trước khi xóa (để đợt UI refactor).
- Boss special attack chưa có UI telegraph báo hiệu riêng (scope §3.6 giới hạn data + resolve) — để dành phase sau.
- Chưa cập nhật `docs/game-guide.md` mục Chiến đấu cho nhịp/reaction/fizzle mới — nên làm cùng docs-sync (plan ghi rõ).
