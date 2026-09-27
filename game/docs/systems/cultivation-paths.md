# Con đường tu luyện (Cultivation Path)

> **P1 — Canonical Path Authority (2026-09-20):** phần dưới mô tả meta
> cũ (route Kiếm Tu cũ đã retire). Kiến trúc hiện hành: 3 path
> (`sword`, `spell`, `body`) × ways trong
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
> `spell.elemental_casting`, `spell.the_pool`,
> `spell.empowered_ult` (conditional: node `linh_ngo_<element>`),
> `spell.reaction_aura` (conditional: passive `ngo_dao_hon_don`
> learned), `sword.kiem_pho`, `sword.ngu_kiem_dao`,
> `body.the_economy`.
>
> **Branch reads:** `getActiveElement` / `getActiveRoute` /
> `getKiemTuPreset` — axes `subpaths` do module khai báo, read qua
> authority, fail-closed khi way không sở hữu axis.
>
> **Combat carriers:** aura Ngộ Đạo vẫn chạy qua
> `grantsElementalReactionAura` (runtime semantic flag) — predicate
> `has('ngo_dao_hon_don')` giờ bind vào capability
> `spell.reaction_aura` (1 source, 2 seams: entry grant + dormant
> revive). Domain delta derivers khai báo trên `stats.deltaDerivers`,
> framework đăng ký eager lúc module eval (cycle Kit -> SkillSystem đã
> cắt bằng leaf `core/skill/CastLeveling.ts`).
>
> **Save boundary:** `saveShapeValidation` giữ enum/pair/mortal gate;
> slice rules do module sở hữu qua `validatePersistedState(payload,
> emit)` — `spell` validate `player.phapTu` (required mọi save,
> element/route chỉ dưới ngu_hanh), `sword` validate `player.kiemTu`
> (optional shape, required khi pair là kiem_tu).
>
> Guard: `tests/architecture/cultivationPathIsolation.test.ts` (module
> isolation + identity branching + seam allowlist + slice-inference
> check) và `CultivationPathContract.test.ts`.



**Trạng thái:** Live — 2 lựa chọn: Pháp Tu, Kiếm Tu. Thể Tu có plumbing/test nhưng **chưa** là lựa chọn chơi được.

Union: `core/player/CultivationPathKit.ts` — `CultivationPathId = 'sword' | 'spell' | 'body'` (body = Thể Tu: plumbing + tests tồn tại, chưa mở lựa chọn chơi được trên master — wave path-beta đang chạy trên branch riêng). Chọn qua `GameManager.chooseCultivationPath()` — tự học + trang bị tâm pháp của path (ghi đè tâm pháp đang mang, kể cả Tụ Linh Quyết khởi đầu), cấp `statModifiers` nền của path, và (Kiếm Tu) gán 3 skill cố định vào loadout slot 0/1/2.

## Pháp Tu — Đại Ngũ Hành Chân Quyết

- **Một path thống nhất** — 5 nhánh nguyên tố cũ đã gộp. Mở hành và skill qua **Node Tree** (`data/progression/PhapTuNodes.ts`), không qua skillIds cố định.
- Unlock 1 hành = unlock luôn skill + nội tại của hành đó; phối hợp nhiều hành bằng **Element Loadout** (`core/element/ElementLoadout.ts`) — `player.unlockedElements` / `equippedElements`.
- Resource battle: `core/battle/PhapTuBattleResourceSystem.ts` (linh lực/mana).
- Artifact: **Ngũ Hành Châu** unlock ở Trúc Cơ (`data/artifact/NguHanhChau.ts`) — xem [artifact.md](./artifact.md).

## Kiếm Tu — Ngự Kiếm Tâm Kinh

> ⚠️ **Route model đã retire** (canonical path authority P1, 2026-09-20): split Bạt Kiếm/Kiếm Trận + kit classic (`bat_kiem_thuat`, `kiem_tran_*`, `tru_tien_kiem_tran`, `kiem_khai_thien_mon`, TRAN_SEQUENCE, Kiếm Thế pool) không còn tồn tại trong code. Kiếm Tu giờ là 1 path × ways (`cultivationWay`), node tree `data/progression/KiemTuNodes.ts`.

| Way | Điều kiện | Kit |
|---|---|---|
| `sword_pathway` — **Kiếm Phổ** | mặc định khi chọn Kiếm Tu | preset 5 orbs (`KIEM_PHO_ORB_IDS`, `data/skill/KiemPhoOrbs.ts`) xếp thứ tự tạo combo (`data/skill/KiemPhoCombos.ts`); nhánh `kiem_pho` trong KiemTuNodes (~5 node + capstone mỗi orb) |
| `hidden_sword_pathway` — **Ngự Kiếm Đạo** | entry ritual-only: Huy Kiếm (`tram`) đạt Lv3 — chọn là vĩnh viễn | hành động combat provider-injected `ngu_kiem_thuat`; subtree `ngu_kiem` (cascade + các node cung Khảm/Khôn/Chấn/Tốn/Càn/Đoài); forge qua **Kiếm Ý** (KiemYSystem giữ nguyên: tầng theo `bossKillCount`, trần 100, +Kiếm Ý nền + %dmg/crit) |

Gate `skillCastCount` prerequisite vẫn dùng để đo số cast (vd. tram casts cho entry ritual). Kiếm Ý tạm/vĩnh viễn giữ semantics cũ (`core/player/KiemYSystem.ts` + `core/battle/KiemTuResourceSystem.ts`). Node `kiem_y_bat_tu` cho hồi sinh 1 lần/trận. Nộ (rage) đã gỡ.

## Liên quan

- [node-tree.md](./node-tree.md) — cây node, mua node bằng Cảm ngộ Kỹ năng.
- [skills.md](./skills.md) — loadout, cast count Huy Kiếm.
- [techniques.md](./techniques.md) — tâm pháp của từng path.
