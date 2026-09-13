# Độ Kiếp — đột phá đại cảnh giới

**Trạng thái:** Live cho Quán Khí (Phàm Nhân→Luyện Khí) và Trúc Cơ (Luyện Khí→Trúc Cơ).

Runtime: `core/tribulation/TribulationDirector.ts`. Outcome: `core/tribulation/TribulationOutcomeService.ts`. Chapters data: `data/tribulation/TribulationChapters.ts`. Grade resolve: `data/breakthrough/BreakthroughGrades.ts`. Adapter Vue: `composables/useTribulation.ts`. Scene: `game/scenes/TribulationScene.ts`.

## Luồng

1. Player đạt `realmLevel` đủ (12+) → panel Quán Khí (`quan_khi`) cho bấm Đột Phá.
2. `resolveKienCoGrade(player, hasTrucCoDan)` xét **bậc Kiến Cơ** NGAY LÚC BẤM — từ đầu tư trước kiếp, không công bố trước (điều kiện ẩn). Trận kiếp không cộng/trừ bậc.
3. `TribulationDirector` chạy chuỗi **chương kiếp** theo `getTribulationChapters(targetRealmId)` — KHÔNG phải trận combat quái; đây là nghi lễ riêng với snapshot CombatEntity (maxHp/def/hpRegen thật của player).
4. Kết quả `victory`/`defeat` → `TribulationOutcomeService` áp hậu quả.

## Hai loại chương

- **Tâm Ma Kiếp (`kind: 'mind'`)** — minigame hỏi đáp: `questionCount` câu từ bank `data/tribulation/TribulationMindQuestions.ts`, 4 đáp án, thời gian co dần từ `firstQuestionSeconds` → `lastQuestionSeconds`, nghỉ `restSecondsBetweenQuestions` giữa 2 câu. Trả lời đúng: hồi máu + kháng lôi. Sai/hết giờ: +1 stack debuff `+5% damage taken, −3% defense` còn lại toàn kiếp (`MIND_FAIL_*`).
- **Thân/Lôi Kiếp (`kind: 'body' | 'lightning'`)** — tank: mỗi `strikeIntervalSeconds` một đạo lôi gây `lightningMaxHpDamagePercent` × maxHp (mitigation `100/(100+def)`), kéo dài `durationSeconds`. Chương `lightning` khép bằng đại lôi `finalStrikeMaxHpDamagePercent`.

| Kiếp | Chương |
|---|---|
| Quán Khí (→ qi_refining) | Tâm Ma (3 câu, 12→8s) → Lôi (15s, nhịp 3s, 7% maxHp) |
| Trúc Cơ (→ foundation_establishment) | Tâm Ma (4 câu, 10→6s) → Thân (20s, 2s, 10%) → Lôi (18s, 1.5s, 13% + đại lôi 30%) |

Độ khó nhân thêm `GRADE_DIFFICULTY_MULTIPLIER` theo bậc: Nhân 1.0 … Thiên 1.3, Đại Đạo 1.85 — bậc càng cao kiếp càng khó nhưng nội tại realm càng mạnh.

Catch-up lôi dùng vòng while trên `nextStrikeInSeconds` — **đứng ngoài** fixed-step 0.1s của combat (chống lỗi floating point).

## Bậc Kiến Cơ (ẩn)

`FoundationType = 'human' | 'earth' | 'heaven' | 'great_dao'` (Nhân/Địa/Thiên/Đại Đạo). Điều kiện lũy tiến, chỉ xét khi đủ bậc dưới:

- **Nhân Đạo** — gate công khai duy nhất: tầng 12 + Linh Thạch.
- **Địa Đạo** — + Trúc Cơ Đan trong túi (không tiêu, chỉ là vật chứng) + Luyện Thể ≥ 3 tầng.
- **Thiên Đạo** — + Luyện Thể đủ 6 tầng + ≥ 6/8 mạch thường (không gồm Kỳ Kinh).
- **Đại Đạo** — + đủ 9/9 mạch + talent `pham_cot` + `mortalPerfectionAchieved` + đang ở Luyện Khí tầng 18 + 5 main stat đạt cap (`getMainStatCap`).

`greatDaoOpportunityLost = true` (từng thua kiếp Đại Đạo) → vĩnh viễn cap Thiên Đạo.

## Outcome — `TribulationOutcomeService` (R8.2, authority duy nhất)

**Thắng:** vào realm mới (`realmId` = target, `realmLevel` reset), cultivation reset, ghi `highestFoundationAchieved`, talent `pham_cot` → đổi thành `pham_nhan_chi_cot` (−75% tốc tu → +75% vĩnh viễn) nếu thắng Đại Đạo. Realm passive mới cấp qua `RealmPassiveSystem`.

**Thua:** mất `TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM` × cultivation (LK 50%, TC 40%, sàn 20%, fallback 30%) + mất Linh Thạch (LK 50, TC 200, fallback 2000) + debuff **Kiếp Thương** persistent (`KIEP_THUONG_DEBUFF` trong `data/buff/buffs.ts`) + cooldown `TRIBULATION_COOLDOWN_SECONDS = 300` trước khi thử lại. Nếu đang độ kiếp Đại Đạo → `greatDaoOpportunityLost = true` vĩnh viễn.

Service trả typed result; `useTribulation.ts` chỉ hiển thị + sequence UI/scene (A7 — Vue không quyết định hậu quả).

## Presentation

`TribulationScene` render chương kiếp; session đi qua `PresentationSession` giống combat (hold/attach/release). Vào kiếp mọi vòng tự động (auto farm, auto combat) dừng.

## Liên quan

- [realms.md](./realms.md) — realm passive theo bậc.
- [body-refinement.md](./body-refinement.md), [meridians.md](./meridians.md) — đầu tư nâng bậc.
- [talents.md](./talents.md) — Phàm Cốt / Phàm Nhân Chi Cốt.
- [presentation.md](./presentation.md) — route `tribulation`.
