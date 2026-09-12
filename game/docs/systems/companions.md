# Đồng đội (Companion) & Trận Pháp

**Trạng thái:** **Live** — vòng chiêu mộ đầy đủ đã ship (2026-09-12, companion-gacha): token pull + pity + đổi Duyên Phận, Cung Mệnh, tiến trình cảnh giới bám theo người chơi, EXP tham chiến + nuôi, UI Chiêu Hiền Quán + panel Đồng Đội, roster thật 10 companion.

Core: `core/companion/CompanionProgression.ts` (exp curve, stats, kit, feed), `CompanionGacha.ts` (rate/pity/pull), `CompanionCombat.ts` (dựng CombatEntity). Orchestration: `core/game/GameManagerCompanionOps.ts` + facade trên `GameManager`. Data: `data/companion/Companions.ts`. Formation: `data/formation/TranPhap.ts`, `core/game/FormationPlacement.ts`, `core/game/PartyFormation.ts`. UI: `TranPhapPanel.vue` (standalone `tran_phap`), `WorkerLodgePanel.vue` (Chiêu Hiền Quán, 3 tab), `CompanionPanel.vue` (standalone `companion`, wheel slot `companion_roster`).

## Model

- `CompanionDefinition` (data): `id`, `name`, `grade` (dùng chung `ItemGrade` 5 bậc — cùng thang Equipment/Pill, KHÔNG phải ProfessionGrade), `growthRate` (hệ số growth theo grade), `unlockThresholds` (mốc realm/tầng mở `special`/`ultimate`), `baseStats { maxHp, attack, speed }`, `basic` + `special?` + `ultimate?` (`TurnSkillDefinition` — skill **cố định** theo definition, không node-tree/loadout riêng, **không** mang trang bị), `constellationPerks?`.
- `CompanionInstance` (sở hữu, persist): `instanceId` (UUID, handle ổn định cho feed/exchange — KHÔNG dùng array index), `definitionId`, `realmId` (bắt đầu `'mortal'`), `realmLevel` (tầng trong realm, `1..realm.maxLevel`), `exp`, `constellationRank` (C0..C6) — trong `player.companions`.
- **Invariant:** đúng 1 instance / `definitionId` — pull/đổi trùng không bao giờ tạo instance thứ 2. `combatantId` trong formation = `definitionId` (unique nhờ invariant này).
- `PlayerData` thêm `companionPullsSinceRare` (pity counter) + `duyenPhan` (điểm đổi). **Save v60** — validator check `instanceId`/`realmId`/`realmLevel`/`exp`/`constellationRank` + 2 counter; không migration (dev-phase convention, save cũ reject).

## Chỉ số & skill kit (`CompanionProgression.ts`)

- `companionStatsAt(definition, instance)` = `base × (1 + growthRate × (globalLevel−1)) × (1 + 0.10 × constellationRank)`, với `globalLevel = getGlobalCultivationLevel(realmId, realmLevel)` (đúng cả realm không đồng đều tầng). Speed không scale theo level nhưng vẫn nhận hệ số Cung Mệnh + perk `stat`. Perk `stat` (flat trước, percent sau) áp khi `atRank <= constellationRank`.
- `isCompanionSkillUnlocked` — `basic` luôn mở; `special`/`ultimate` cần definition khai skill + threshold, so `(realmIndex, realmLevel)` qua `getRealmIndex` (không so string).
- `resolveCompanionSkillKit` — kit thi hành per-instance: slot đã mở + mọi perk `skill_override` đủ bậc áp lên slot tương ứng (`cooldownTurns`, `damageMultiplierPercent`, `healPercentOfDamage` — whitelist, không ghi đè id/targeting). Skill trả về là clone, definition không bị mutate.

## Tiến trình (realm-capped)

- `companionExpRequiredForLevel(realmId, realmLevel)` = `round(40 × realmLevel^1.2 × (realmIndex+1))`.
- `applyCompanionExp(instance, amount, playerRealmId)` — tự lên tầng, **tự phá cảnh** khi quá `maxLevel` mà còn dưới realm người chơi (chain nhiều realm, exp thừa carry). **Trần = `player.realmId` hiện tại** (dynamic cap): đạt realm người chơi + tầng max → exp dư đổ vào `clampedExp`, dừng; trần tự nhích khi người chơi phá cảnh.
- Hai trạng thái "max" khác nhau: `level_maxed` (ngang trần người chơi — chỉ chặn nuôi) vs `constellation_maxed` (C6 — chặn đổi Duyên Phận; pull chuyển thành +5 DP).
- **EXP tham chiến:** `BattleLootSystem.processDefeatedEnemies` — companion có ô trong `formationLoadout` tại thời điểm kill nhận `companionBattleExpPerKill(stageRealmId) = 2 × (realmIndex+1)`/kill (fallback `enemy.realmId` khi không có stage). Snapshot per-kill — đổi đội hình giữa trận ảnh hưởng kill sau; dự bị không tự lên; autofarm đi chung đường này.
- **Nuôi:** `feedCompanion(instanceId, materialId, count)` — `companionFeedExpValue(material)` = `10 × (realmIndex(profession.realmId)+1)` nếu material có `profession` meta, else flat 10. Reject `level_maxed` TRƯỚC khi trừ material.

## Chiêu Mộ (gacha)

- **Token:** `chieu_hien_lenh` (Chiêu Hiền Lệnh, `category: 'other'`, không bán được ở Ký Bảo Các). **1 token = 1 pull** (không 10-pull). Nguồn: `signatureDrops` boss tầng 10 — `mortal_ferocious_giant_crocodile` (ch1) ×1, `ferocious_flood_serpent` (ch2) ×2, `foundation_ferocious_flood_dragon_whelp` (ch3) ×3, `chance:1 requiresModifier:'boss'` — + quest daily `daily_chieu_hien_lenh` (kill 20 bất kỳ → 1 token).
- **Rate** (`COMPANION_BASE_RATES`): hoang 0.8399 / huyen 0.10 / dia 0.05 / thien 0.01 / tien 0.0001. `effectiveCompanionRates` **lọc grade không có definition trong pool rồi renormalize** (MVP 0 Tiên → tien bị loại, không phải crash slot — `pickDefinitionOfGrade` throw trên pool rỗng).
- **Pity:** `counter += 1 → pityActive = counter >= 30 → roll (pityActive ? trọng số {dia:5, thien:1, tien:0.01} — sàn Địa) → grade >= dia thì reset counter` (kể cả trúng tự nhiên).
- **Trùng → Cung Mệnh:** duplicate pull → `constellationRank +1` (max 6, `+10%` base stats/bậc + perk authored tại C2/C4/C6); đã C6 → `duyenPhanBonus +5` (pull không thể reject sau roll).
- **Duyên Phận:** +1 mỗi pull (kể cả trùng). `exchangeCompanion` mua tự chọn — giá theo Chất `{hoang:20, huyen:30, dia:60, thien:150, tien:300}`; chưa có → instance mới C0, đã có chưa C6 → rank+1, C6 → reject trước khi trừ điểm.
- Ops (`GameManagerCompanionOps`): `pullCompanion()` trừ token trước roll (atomic; roll post-filter không throw — có refund belt-and-suspenders), `exchangeCompanion(definitionId)`, `feedCompanion(instanceId, materialId, count)`. Facade cùng tên trên `GameManager`.

## Roster

`COMPANIONS` = 10 definition thật: **4 Hoàng** (Hồ Ly Tinh, Khai Sơn Lực Sĩ, Linh Hạc, Dược Đồng Tử — growthRate 0.04), **3 Huyền** (Vân Du Kiếm Khách, Thủy Linh Xà, Thiết Y Tăng — 0.05), **2 Địa** (Kim Quang Thánh Nhân, Huyền Vũ — 0.06, có `constellationPerks`), **1 Thiên** (Cửu Thiên Huyền Nữ — 0.08, primordial damage, có perks), **0 Tiên**. Skill là `TurnSkillDefinition` thuần — không `if id` đặc biệt (A8); display name ở `data/skill/TurnSkillDisplayMeta.ts`.

## UI

- **Chiêu Hiền Quán** (`WorkerLodgePanel.vue`): 3 tab — `nhan_cong` (nhân công cũ), `chieu_mo` (`worker-lodge/ChieuMoTab.vue`: nút Pull + số token, pity `x/30`, DP, reveal card theo `PullCompanionResult` — UI chỉ render kết quả, không tự roll), `duyen_phan` (`DuyenPhanTab.vue`: danh sách đổi theo grade + giá + trạng thái owned/Cn/disabled-reason).
- **Panel Đồng Đội** (`CompanionPanel.vue`, standalone `companion`, wheel entry `companion_roster` — không realm gate): grid theo Chất → detail (cảnh giới/tầng, EXP bar, stats `companionStatsAt`, 6 ô Cung Mệnh + perk C2/C4/C6, skill + mốc mở, nút Nuôi disable khi `level_maxed`, hint gán ô qua Trận Pháp).

## Trận Pháp (`TranPhapPanel.vue`)

- `TranPhapDefinition`: `cellPattern` — **lưới cục bộ 3×3** (9 ô standing), map lên `PLAYER_SIDE_REGION` của combat grid qua `localCellToAbsolute`. Mỗi trận mang **1 buff chung** (`buff.definitionId`). Tất cả formation mở sẵn từ đầu.
- `player.formationLoadout: { formationId, assignments: FormationSlotAssignment[] }` — gán player/companion vào ô; `resolvePartyFormation` đọc lúc build battle ([combat-overview.md](./combat-overview.md)).
- `TRAN_PHAP_FORMATIONS` hiện chỉ có `hon_don_tran` (**TEST-ONLY** — mở cả 9 ô để stress wiring; formation thật là content pass sau).

## Vào trận

`GameManagerTurnBattleOps` → `companionToCombatEntity(instance, definition)` dựng `CombatEntity` tươi mỗi trận (stats từ `companionStatsAt`, `realmIndex` từ `instance.realmId`), rồi `resolveCompanionSkillKit` → `toTurnBattleParticipant(entity, index+100, kit.basic, undefined, { special, ultimate })`. Combat state ephemeral như enemy; companion không nằm trong `activePlayer`.

## Liên quan

- [combat-overview.md](./combat-overview.md) — party/turn participant.
- [inventory.md](./inventory.md) — companion không chiếm bag; `chieu_hien_lenh` là material thường trong MaterialBag.
- [quests.md](./quests.md) — daily `daily_chieu_hien_lenh`.
- [drops-loot.md](./drops-loot.md) — `signatureDrops` boss → token.
- [save-load.md](./save-load.md) — save v60 fields.
