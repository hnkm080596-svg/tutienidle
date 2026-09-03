# Roadmap Chuyển Đổi Combat — Real-time → Turn-Based

> Tài liệu định hướng riêng cho việc chuyển đổi combat từ real-time auto-battler sang turn-based ATB, lập ngày 2026-09-04.
> Mỗi hạng mục có spec/plan riêng (dẫn link bên dưới) — khi làm đến đâu, khảo sát + brainstorm + viết plan riêng cho đúng hạng mục đó, KHÔNG gộp nhiều hệ thống vào một plan (quyết định người dùng, 2026-09-04).
> Khi plan chi tiết và roadmap này lệch nhau, plan chi tiết là nguồn sự thật; cập nhật lại dòng tương ứng ở đây ngay sau đó.
> Tài liệu gốc: [2026-09-03-turn-based-combat-design.md](../../docs/superpowers/specs/2026-09-03-turn-based-combat-design.md) (spec thiết kế đã duyệt) + [2026-09-04-turn-based-combat-survey-and-stat-decisions.md](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) (khảo sát hệ thống thật + sửa sai lệch so với spec gốc + quyết định Stat).

## Nguyên tắc

- Dự án đang ở dev phase — không cần lo save migration (big-bang, không giữ tương thích ngược).
- Sản xuất/tu luyện (idle) **không đổi** — đây là rework thuần combat.
- Combat không bao giờ mô phỏng offline; "Auto" là chính engine turn-based chạy nhanh hơn, không phải công thức riêng.
- Hệ nhân vật phụ (party/companion) **ngoài phạm vi** toàn bộ rework này — có spec riêng sau.
- Mỗi hạng mục dưới đây khi đến lượt làm: khảo sát codebase hiện tại → brainstorm/chốt quyết định với người dùng → viết plan riêng (`docs/superpowers/plans/...`) → cập nhật dòng trạng thái ở đây kèm link plan.

## Milestone 1 — Foundation (primitives độc lập)

Mục tiêu: dựng các primitive thuần (pure function), test riêng, KHÔNG đụng vào `BattleSystem.ts`/`CombatSystem.ts` hiện có.

| Hạng mục | Plan | Trạng thái |
|---|---|---|
| ActionGauge, TurnQueue, ChannelQueue, AoeShape*, BounceChain, TrueShot, BossTurnTriggers, MomentumBreak, ResourceTurnHook — 9 file mới dưới `game/src/core/battle/turn/` | [2026-09-03-turn-based-combat-foundation.md](../../docs/superpowers/plans/2026-09-03-turn-based-combat-foundation.md) | 🟢 Xong, merge master 2026-09-04 (merge commit `aee253b`; 50/50 test turn/ suite, type-check sạch; QA quick report: [2026-09-04-turn-combat-foundation-quick.md](qa/2026-09-04-turn-combat-foundation-quick.md) PASS WITH EVIDENCE) |

## Milestone 2 — BattleSystem Replacement (gộp mọi hệ liên quan, 2026-09-04)

**Quyết định người dùng 2026-09-04**: không tách "Core System Conversion" thành milestone riêng nữa — không đáng phân biệt. Mọi hệ dưới đây làm CHUNG một đợt lớn xoay quanh việc thay `BattleSystem.update(deltaSeconds)`. Trong đợt này vẫn viết plan riêng cho từng hệ khi đến lượt (không gộp 1 plan khổng lồ), nhưng không còn khái niệm "làm sớm trước BattleSystem" nữa — trọng tâm hiện tại là chính bản thân BattleSystem Replacement.

### BattleSystem Replacement — chia slice (2026-09-04)

`update(deltaSeconds)` (18-bước pipeline, ~2400 dòng) quá lớn cho 1 spec/plan — chia thành các slice dọc, mỗi slice lớp thêm 1 phần hành vi thật lên trên slice trước, mỗi slice có spec+plan riêng.

| Slice | Nội dung | Spec | Plan | Trạng thái |
|---|---|---|---|---|
| Slice 1 — Core Turn Loop | Class mới `TurnBattleSystem` độc lập, headless: 1 player vs N enemy cố định, ATB turn order + targeting §4 (gần nhất-trước-mặt) + basic attack qua `CombatSystem.resolveActionHit` có sẵn. KHÔNG skill/buff/reaction/hazard/wave/UI/Stat speed thật (speed truyền tay qua constructor, tách khỏi quyết định Stat còn treo) | [2026-09-04-turn-battle-system-slice1-core-loop-design.md](../../docs/superpowers/specs/2026-09-04-turn-battle-system-slice1-core-loop-design.md) | [2026-09-04-turn-battle-system-slice1-core-loop.md](../../docs/superpowers/plans/2026-09-04-turn-battle-system-slice1-core-loop.md) | 🟢 Xong, merge master 2026-09-04 (merge commit `72eec64`; 8/8 plan tests + 4 adversarial probes, turn/ suite 63/63, type-check sạch; QA quick report: [2026-09-04-turn-battle-system-slice1-quick.md](qa/2026-09-04-turn-battle-system-slice1-quick.md) PASS WITH EVIDENCE) |
| Slice 2+ | StageWaveSystem (wave theo lượt), HazardZone, Boss afterTurns, Resource hooks, MomentumBreak, BuffSystem, AOE Shape/skill loadout thật, GameManager contract, manual UI | — | _(chưa viết)_ | 🔴 Chưa khảo sát — quyết định sau khi Slice 1 xong |

| Hạng mục | Quyết định | Plan | Trạng thái |
|---|---|---|---|
| AOE Shape extension — thêm `'cross'`/`'row'`/`'column'` vào `ActionTargetingSystem.ts`/`CombatAction.ts`, đổi tên `'area'`→`'square'` (23 literal, 9 file), wire `AoeShape.isCellInShape` cho cross. Bounce/TrueShot wiring KHÔNG nằm trong plan này | [2026-09-04-aoe-shape-extension-design.md](../../docs/superpowers/specs/2026-09-04-aoe-shape-extension-design.md) | [2026-09-04-aoe-shape-extension.md](../../docs/superpowers/plans/2026-09-04-aoe-shape-extension.md) | 🟡 Plan viết xong 2026-09-04, sẵn sàng giao agent thực thi |
| Ultimate-as-loadout-slot — `SkillLoadoutSlots.ts` dành slot index 5 cho skill gắn tag `ultimate`, retire `UltimateSystem.ts`. **Sửa quy mô (2026-09-04, phiên khảo sát 3)**: khảo sát thật cho thấy KHÔNG nhỏ như tưởng — `UltimateSystem.ts` đan xen sâu với `BattleSystem.tryPlayerUltimate()` (2 route Kiếm Tu/Pháp Tu Thuần khác nhau), UI thật `KiemTuCombatHud.vue` (nút Ult + auto-toggle, `ultAutoEnabled`/`fireUltimate()`). Quy mô ngang GameManager external contract, KHÔNG bundle chung với việc nhỏ khác | [Đã chốt hướng](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) — quy mô thật chưa khảo sát sâu | _(chưa viết)_ | 🔴 Hướng đã chốt nhưng quy mô lớn hơn tưởng, cần khảo sát riêng kỹ hơn trước khi viết plan |
| BuffSystem turn-duration — `TurnBuffSystem.ts` MỚI hoàn toàn (không sửa `BuffSystem.ts` sống — file đó đang chạy real-time combat thật, sửa tại chỗ sẽ phá game). Port `apply`/`update`/stack-mode/convert/CC-check verbatim, đổi field `remainingTime`→`remainingTurns`, `continuousSeconds`→`continuousTurns`, `damagePerSecond`→`damagePerTurn` | [2026-09-04-turn-buff-system-design.md](../../docs/superpowers/specs/2026-09-04-turn-buff-system-design.md) | [2026-09-04-turn-buff-system.md](../../docs/superpowers/plans/2026-09-04-turn-buff-system.md) | 🟡 Plan viết xong 2026-09-04, sẵn sàng giao agent thực thi (blast radius cao nhất toàn bộ rework — nhưng plan này tự giới hạn blast radius = 0 vì không đụng file sống) |
| BuffSystem — port nốt `getActiveModifiers()`/`isRooted()`/`rollOnHitEffects()`/`getStacks()` vào `TurnBuffSystem.ts` (bị loại khỏi plan 2026-09-04 để giữ phạm vi nhỏ — spec chỉ chốt `apply`/`update`/`isStunned`/`isFrozen`) | Đã biết cách làm (port verbatim như 4 method kia), chỉ chưa viết | _(chưa viết)_ | ⚪ Đã biết hướng, chưa có plan |
| BuffSystem — migrate content thật (`game/src/data/buff/buffs.ts`, boss enrage buff trong `TribulationPhase.ts` data, equipment/talent passive buff) từ `BuffDefinition` sang `TurnBuffDefinition` | Chưa bàn — phụ thuộc `TurnBuffSystem` đã có (plan trên) | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định |
| BuffSystem — cân bằng lại số lượt (turn-count) cho từng buff definition đã migrate — plan 2026-09-04 CHỦ ĐỘNG giữ nguyên số (X giây → X lượt), không tự cân bằng | Chưa bàn — chỉ làm sau khi content đã migrate | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định (việc nội dung/balance, không phải cơ chế) |
| BuffSystem — presentation/VFX/tooltip hiển thị duration (`combat-vfx-spawner.ts`'s `durationSeconds`, `combat-status-tooltip.ts`'s `"${remainingTime}s"` format) đổi sang hiển thị theo lượt | Chưa bàn — chỉ cần khi `TurnBuffSystem` thật sự lên hình | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định |
| ReactionManager.ts turn-based conversion — đã event-triggered sẵn (không có deltaSeconds trong logic), nhưng call site cần dời từ vòng lặp real-time BattleSystem sang turn-based; hiện vẫn gọi `BuffSystem`/`BuffPool` SỐNG, cần quyết định đổi sang `TurnBuffSystem`/`TurnBuffPool` khi nào. **Cần thêm**: reaction nào hiện `spawnLavaZone` (vd "Dung Nham" thạch_hóa+bỏng) phải đổi sang áp `TurnBuffSystem` dot buff thay vì spawn zone (xem quyết định "ĐẢO NGƯỢC HazardZoneSystem" ở trên) | [Khảo sát ban đầu](../../docs/superpowers/specs/2026-09-03-turn-based-combat-design.md) ghi nhận logic không cần đổi, nhưng chưa quyết định thời điểm/cách dời call site | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định |
| SkillEffectResolver.ts's `grantsSwordZone` conversion — skill hiện spawn SwordZone trực tiếp (không qua Reaction), cần đổi sang áp `TurnBuffSystem` dot buff cùng lý do trên | Theo cùng quyết định "ĐẢO NGƯỢC HazardZoneSystem" | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định |
| ~~HazardZoneSystem N-turn~~ — **ĐẢO NGƯỢC quyết định cũ (2026-09-04, phiên khảo sát 2)**: khái niệm "zone" định vị liên tục (ai đi vào sau vẫn bị trúng) không còn giá trị trong turn-based (không có di chuyển liên tục giữa lượt). KHÔNG xây `TurnHazardZoneSystem` — thay Lava Zone/Sword Zone bằng áp DoT trực tiếp lên tập target đã chọn tại thời điểm cast, qua AOE shape (đã có plan) + `TurnBuffSystem`'s effect `dot` (đã có plan). `HazardZoneSystem.ts`/`LavaZone.ts`/`SwordZone.ts` sống tiếp tục KHÔNG đổi cho tới khi Reaction Engine/SkillEffectResolver thật sự cutover — lúc đó chỉ đổi CALL SITE (spawn zone → apply dot buff), không có primitive mới nào cần build riêng | Quyết định trực tiếp trong phiên brainstorm 2026-09-04 (khảo sát 2), không cần spec/plan riêng — ghi nhận tại đây | _(không cần — không có gì để build)_ | 🟢 Đã quyết định: KHÔNG làm, gộp vào ReactionManager/SkillEffectResolver conversion sau này |
| **Gộp 3 mục (2026-09-04, phiên khảo sát 3)** — Resource turn-hooks wiring (`PhapTuBattleResourceSystem`/`KiemTuResourceSystem`), MomentumBreak real wiring, Boss `afterTurns` conversion: cả 3 primitive (`ResourceTurnHook.ts`, `MomentumBreak.ts`, `BossTurnTriggers.ts`) đã build+test xong ở Milestone 1 Foundation. Phần CÒN LẠI của cả 3 là NỐI vào call site thật trong `BattleSystem.ts` (real-time, sống) — đó chính là việc cutover Slice 2+, không phải việc làm riêng lẻ trước cutover được (không có "standalone Turn* twin" nào để xây thêm — logic thuần đã đủ, chỉ thiếu chỗ gọi) | [Đã chốt](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) | _(không cần plan riêng — không còn logic thuần nào để viết trước cutover)_ | 🟢 Primitive đã xong (Milestone 1); wiring thật BLOCKED cho tới Slice 2+ cutover |
| GameManager external contract — thay `updateBattleFixedStep`/`StageWaveSystem.update(deltaSeconds)` bằng entry point turn-based; sửa `KiemTuCombatHud.vue` (đang gọi thẳng `ultAutoEnabled`/`tryPlayerUltimate`/`setChannelTickSeconds`) | Chưa bàn chi tiết | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định |
| Stat System conversion — `attackSpeed`→`speed`, retire `castSpeedPercent`/`cooldownReduction`, xóa `movementSpeed` | [Trình tự đã chốt: bắt buộc làm chung đợt BattleSystem Replacement](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) — cách dexterity/intelligence derive ra `speed` **còn mở**, để bàn khi thiết kế tổng thể 5 main stat | _(chưa viết)_ | 🔴 Trình tự đã chốt, thiết kế chi tiết chưa xong |
| Manual tap-to-cast UI (`CombatSkillSlot.vue` và liên quan) — hiện HOÀN TOÀN chưa tồn tại (0 UI thủ công), người chơi chỉ chọn skill, không chọn target (targeting luôn tự động — [spec §4.5](../../docs/superpowers/specs/2026-09-03-turn-based-combat-design.md)) | Đã chốt về hành vi (spec §4.5), UI cụ thể chưa thiết kế | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định |
| StageWaveSystem turn conversion — `WaveSpawnTrigger.ts` MỚI (2 pure function, không đụng `StageWaveSystem.ts` sống). Quyết định: BỎ HẲN `spawnCountdown`/`spawnIntervalSeconds` (không convert sang lượt) — spawn quái kế tiếp NGAY khi sân trống, không cần throttle thời gian thật nữa trong turn-based | [2026-09-04-wave-spawn-trigger-design.md](../../docs/superpowers/specs/2026-09-04-wave-spawn-trigger-design.md) | [2026-09-04-wave-spawn-trigger.md](../../docs/superpowers/plans/2026-09-04-wave-spawn-trigger.md) | 🟡 Plan viết xong 2026-09-04, sẵn sàng giao agent thực thi |
| Rewrite ~16 file `BattleSystem.*.test.ts` đang pin hành vi real-time | Kỳ vọng: viết lại, không giữ (big-bang) | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định |

## Ngoài phạm vi (có spec riêng sau, KHÔNG thuộc rework này)

| Hạng mục | Ghi chú |
|---|---|
| Hệ nhân vật phụ (party/companion: main + tối đa 4, recruit, skill riêng, nâng cấp theo bậc/phẩm) | [spec §2/§7](../../docs/superpowers/specs/2026-09-03-turn-based-combat-design.md) — kiến trúc turn engine đã tổng quát cho N combatant/phe, nhưng recruitment/UI/nội dung để spec riêng |
| Equipment/Affix content ngoài 3 buff ghép `movementSpeed`+`attackSpeed` | [Ghi nhận](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) — chưa quyết định phạm vi |
| Enemy data (`Enemies.ts`) cần giá trị `speed` cho từng enemy | [Ghi nhận](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) — công việc nội dung, làm sau khi Stat System chốt xong |

## Cách cập nhật roadmap này

Sau mỗi lần khảo sát/brainstorm/viết plan cho một hạng mục:
1. Đổi cột **Trạng thái** (🔴 chưa quyết định → ⚪ đã quyết định chưa có plan → 🟡 đang thực thi → 🟢 xong, kèm ngày).
2. Điền/đổi link **Plan** sang file plan thật vừa viết (`docs/superpowers/plans/...`).
3. Nếu quyết định mới làm lệch mô tả ở cột "Quyết định", cập nhật luôn dòng đó — không để roadmap nói khác plan chi tiết.
