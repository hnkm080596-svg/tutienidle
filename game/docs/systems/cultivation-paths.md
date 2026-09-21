# Con đường tu luyện (Cultivation Path)

> **P1 — Canonical Path Authority (2026-09-20):** phần dưới mô tả meta
> cũ (route Kiếm Tu cũ đã retire). Kiến trúc hiện hành: 3 path
> (`kiem_tu`, `phap_tu`, `the_tu`) × ways trong
> `CULTIVATION_PATH_MODULES` (`core/player/CultivationPathKit.ts`);
> `CultivationPathSystem` là authority duy nhất cho cặp
> `(cultivationPath, cultivationWay)` — ghi nguyên tử trong Nghi Lễ
> Nhập Môn, fail-closed khi pair hỏng/lệch.
>
> **Capability contract:** downstream systems không suy ra path từ
> skill đã học / slice presence / node / UI. Chúng hỏi capability qua
> `hasPathCapability(player, cap, deps)` (đầy đủ, cần
> `PathCapabilityDeps.hasSkill` cho conditional) hoặc
> `hasStaticPathCapability` (cùng resolver `resolvePathCapabilities`
> ở mode `'static'` — một derivation authority duy nhất). Vocab:
> `phap_tu.elemental_casting`, `phap_tu.the_pool`,
> `phap_tu.empowered_ult` (conditional: node `linh_ngo_<element>`),
> `phap_tu.reaction_aura` (conditional: passive `ngo_dao_hon_don`
> learned), `kiem_tu.kiem_pho`, `kiem_tu.ngu_kiem_dao`,
> `the_tu.the_economy`.
>
> **Branch reads:** `getActiveElement` / `getActiveRoute` /
> `getKiemTuPreset` — axes `subpaths` do module khai báo, read qua
> authority, fail-closed khi way không sở hữu axis.
>
> **Combat carriers:** aura Ngộ Đạo vẫn chạy qua
> `grantsElementalReactionAura` (runtime semantic flag) — predicate
> `has('ngo_dao_hon_don')` giờ bind vào capability
> `phap_tu.reaction_aura` (1 source, 2 seams: entry grant + dormant
> revive). Domain delta derivers khai báo trên `stats.deltaDerivers`,
> framework đăng ký eager lúc module eval (cycle Kit -> SkillSystem đã
> cắt bằng leaf `core/skill/CastLeveling.ts`).
>
> **Save boundary:** `saveShapeValidation` giữ enum/pair/mortal gate;
> slice rules do module sở hữu qua `validatePersistedState(payload,
> emit)` — `phap_tu` validate `player.phapTu` (required mọi save,
> element/route chỉ dưới ngu_hanh), `kiem_tu` validate `player.kiemTu`
> (optional shape, required khi pair là kiem_tu).
>
> Guard: `tests/architecture/cultivationPathIsolation.test.ts` (module
> isolation + identity branching + seam allowlist + slice-inference
> check) và `CultivationPathContract.test.ts`.



**Trạng thái:** Live — 2 lựa chọn: Pháp Tu, Kiếm Tu. Thể Tu có plumbing/test nhưng **chưa** là lựa chọn chơi được.

Union: `core/player/CultivationPathKit.ts` — `CultivationPathId = 'phap_tu' | 'kiem_tu'`. Chọn qua `GameManager.chooseCultivationPath()` — tự học + trang bị tâm pháp của path (ghi đè tâm pháp đang mang, kể cả Tụ Linh Quyết khởi đầu), cấp `statModifiers` nền của path, và (Kiếm Tu) gán 3 skill cố định vào loadout slot 0/1/2.

## Pháp Tu — Đại Ngũ Hành Chân Quyết

- **Một path thống nhất** — 5 nhánh nguyên tố cũ đã gộp. Mở hành và skill qua **Node Tree** (`data/progression/PhapTuNodes.ts`), không qua skillIds cố định.
- Unlock 1 hành = unlock luôn skill + nội tại của hành đó; phối hợp nhiều hành bằng **Element Loadout** (`core/element/ElementLoadout.ts`) — `player.unlockedElements` / `equippedElements`.
- Resource battle: `core/battle/PhapTuBattleResourceSystem.ts` (linh lực/mana).
- Artifact: **Ngũ Hành Châu** unlock ở Trúc Cơ (`data/artifact/NguHanhChau.ts`) — xem [artifact.md](./artifact.md).

## Kiếm Tu — Ngự Kiếm Tâm Kinh

Route **chốt vĩnh viễn lúc chọn path**, xét từ số lần trảm Huy Kiếm (`HUY_KIEM_L3_CASTS = 10000`, `getHuyKiemLevelForCasts` trong `core/skill/SkillSystem.ts`):

| Route | Điều kiện | Active skill slot 0 |
|---|---|---|
| **Bạt Kiếm** (Đơn Kiếm) | Huy Kiếm (tram) ≥ Lv3 (10.000 cast) | `bat_kiem_thuat` — tụ lực channel |
| **Kiếm Trận** (Đa Kiếm) | chưa đạt | `kiem_tran_luong_nghi` → tiến hóa theo keystone |

Node tree: `data/progression/KiemTuNodes.ts`.

### Kiếm Trận (Đa Kiếm)

- 9 keystone `kiem_tran_*` theo chuỗi `TRAN_SEQUENCE` (Lưỡng Nghi 2 kiếm → Tam Tài 3 → … → Cửu Cung/Vô Cực 9 kiếm), mỗi keystone unlock 1 skill trận thay thế skill cũ; realm gate tăng dần (`qi_refining` → `tribulation` — các keystone trên Trúc Cơ là **nội dung tương lai**, chưa tới được).
- Tích **Kiếm Thế** (pool trong trận, +số kiếm mỗi cast, cap 100) → ult `tru_tien_kiem_tran` đốt pool nổ trảm AoE + trận trường tồn; buff +1% sát thương mỗi 2 điểm Kiếm Thế.
- 9 node on-hit mở theo cấp trận (roll 3%/cấp, tối đa 15%).

### Bạt Kiếm (Đơn Kiếm)

- `bat_kiem_thuat` tụ lực channel — "càng treo càng mạnh".
- **Kiếm Ý vĩnh viễn** (`core/player/KiemYSystem.ts`): tầng tích theo `player.bossKillCount` tổng — tầng N cần `10N + 5N(N−1)/2` boss cộng dồn (t1: 10, t2: 25, t3: 45, t4: 70…), trần 100 tầng. Mỗi tầng: +10 Kiếm Ý nền đầu trận + 0.5% skill damage / crit rate / crit damage (áp qua `finalStats` trong store).
- **Kiếm Ý tạm** trong trận: tích theo tick tụ lực + sát thương nhận vào (`core/battle/KiemTuResourceSystem.ts`); tiêu hao ăn tạm trước — vĩnh viễn bất khả xâm phạm.
- Ult `kiem_khai_thien_mon`: đốt toàn bộ kiếm ý tạm, đơn mục tiêu ưu tiên boss, overkill tràn 50%.
- Skill cũ (Ngự Kiếm, Thái Hư, Phiêu Vân, Phá Thiên, Vạn Kiếm…) → passive node trong cây. Node `kiem_y_bat_tu` cho hồi sinh 1 lần/trận. Nộ (rage) đã gỡ.

## Liên quan

- [node-tree.md](./node-tree.md) — cây node, mua node bằng Cảm ngộ Kỹ năng.
- [skills.md](./skills.md) — loadout, cast count Huy Kiếm.
- [techniques.md](./techniques.md) — tâm pháp của từng path.
