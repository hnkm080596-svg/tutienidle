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
| ActionGauge, TurnQueue, ChannelQueue, AoeShape*, BounceChain, TrueShot, BossTurnTriggers, MomentumBreak, ResourceTurnHook — 9 file mới dưới `game/src/core/battle/turn/` | [2026-09-03-turn-based-combat-foundation.md](../../docs/superpowers/plans/2026-09-03-turn-based-combat-foundation.md) | 🟡 Đang thực thi (agent khác, branch `feat/turn-combat-foundation`, worktree `.agent-worktrees/turn-combat-foundation`) |

*⚠️ Task 4 (`AoeShape.ts`) của plan này cần sửa hướng trước/khi thực thi — xem Milestone 2 hạng mục "AOE Shape extension" bên dưới; logic thuần (`isCellInShape`/`boundingBoxForShape`) vẫn dùng được, chỉ đổi chỗ ở.

## Milestone 2 — Core System Conversion (mỗi hệ 1 plan riêng)

Mục tiêu: chuyển từng hệ thống thật (không phải primitive) sang mô hình turn-based, xây trên Milestone 1. **Chỉ bắt đầu sau khi Milestone 1 merge xong** — các hạng mục dưới đây tái dùng trực tiếp file Foundation làm code đã hoàn thiện, không phải tài liệu tham khảo.

| Hạng mục | Quyết định | Plan | Trạng thái |
|---|---|---|---|
| AOE Shape extension — thêm `'cross'` vào `ActionTargetingSystem.ts`/`CombatAction.ts` hiện có (KHÔNG giữ `AoeShape.ts` làm hệ song song), wire Bounce/TrueShot vào đó | [Đã chốt](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) | _(chưa viết)_ | ⚪ Đã quyết định, chưa có plan |
| Ultimate-as-loadout-slot — `SkillLoadoutSlots.ts` dành slot index 5 cho skill gắn tag `ultimate`, retire `UltimateSystem.ts` | [Đã chốt](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) | _(chưa viết)_ | ⚪ Đã quyết định, chưa có plan |
| BuffSystem turn-duration — chuyển HẲN duration sang theo lượt cho combat buff, không giữ field giây song song | [Đã chốt](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) | _(chưa viết)_ | ⚪ Đã quyết định, chưa có plan (blast radius cao nhất toàn bộ rework) |
| HazardZoneSystem N-turn — Lava Zone/Sword Zone chuyển sang "persists N lượt", tick 1 lần mỗi lượt của chủ zone | [Đã chốt](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) | _(chưa viết)_ | ⚪ Đã quyết định, chưa có plan |
| Resource turn-hooks wiring — `PhapTuBattleResourceSystem`/`KiemTuResourceSystem` chuyển khỏi `deltaSeconds`, dùng `ResourceTurnHook.ts` | [Đã chốt](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) | _(chưa viết)_ | ⚪ Đã quyết định, chưa có plan |
| MomentumBreak real wiring — nối `MomentumBreak.ts` vào call site thật trong `BattleSystem.ts` (~L1452-1475); **decay là cơ chế MỚI** (chưa từng tồn tại), không phải migrate | [Đã chốt](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) | _(chưa viết)_ | ⚪ Đã quyết định, chưa có plan |
| Boss `afterTurns` conversion — `TribulationPhase.ts`'s `BossEnrage.afterSeconds` → `afterTurns`, update data `Enemies.ts` | [Đã chốt](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) | _(chưa viết)_ | ⚪ Đã quyết định, chưa có plan |

## Milestone 3 — BattleSystem Replacement (khối lớn nhất, downstream của mọi thứ trên)

| Hạng mục | Quyết định | Plan | Trạng thái |
|---|---|---|---|
| Thay `BattleSystem.update(deltaSeconds)` (18-bước pipeline, ~2400 dòng) bằng vòng lặp turn-based thật | Chưa bàn chi tiết | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định |
| GameManager external contract — thay `updateBattleFixedStep`/`StageWaveSystem.update(deltaSeconds)` bằng entry point turn-based; sửa `KiemTuCombatHud.vue` (đang gọi thẳng `ultAutoEnabled`/`tryPlayerUltimate`/`setChannelTickSeconds`) | Chưa bàn chi tiết | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định |
| Stat System conversion — `attackSpeed`→`speed`, retire `castSpeedPercent`/`cooldownReduction`, xóa `movementSpeed` | [Trình tự đã chốt: BẮT BUỘC làm chung với Milestone 3, không tách riêng làm sớm](../../docs/superpowers/specs/2026-09-04-turn-based-combat-survey-and-stat-decisions.md) — cách dexterity/intelligence derive ra `speed` **còn mở**, để bàn khi thiết kế tổng thể 5 main stat | _(chưa viết)_ | 🔴 Trình tự đã chốt, thiết kế chi tiết chưa xong |
| Manual tap-to-cast UI (`CombatSkillSlot.vue` và liên quan) — hiện HOÀN TOÀN chưa tồn tại (0 UI thủ công), người chơi chỉ chọn skill, không chọn target (targeting luôn tự động — [spec §4.5](../../docs/superpowers/specs/2026-09-03-turn-based-combat-design.md)) | Đã chốt về hành vi (spec §4.5), UI cụ thể chưa thiết kế | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định |
| StageWaveSystem turn conversion — trigger spawn wave kế theo lượt thay vì `spawnCountdown -= deltaSeconds` | Chưa bàn chi tiết | _(chưa viết)_ | 🔴 Chưa khảo sát/quyết định |
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
