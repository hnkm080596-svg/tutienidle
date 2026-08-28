# Kế hoạch Nội dung Trúc Cơ & Pass Kim Đan

> Thuộc Phase 1 của [roadmap.md](./roadmap.md). Đây là plan lớn nhất, giải quyết rủi ro retention số 1: người chơi hết nội dung ở Trúc Cơ tầng 18 (~34 giờ).
> Plan chia 3 milestone độc lập, mỗi milestone để lại bản build chơi được: **M1** nội dung Trúc Cơ thật, **M2** gate Kim Đan, **M3** đời sống Kim Đan.

## 1. Mục tiêu

- Thay 10 stage Trúc Cơ clone bằng nội dung thật (quái mới, boss mới, drop riêng).
- Mở đường đột phá Kim Đan: `canTriggerRealmBreakthrough()` không còn trả `false` cứng.
- Kim Đan có nội dung tối thiểu để sống trong đó: realm passive, tầng node mới, nguyên liệu realm 4 farm được, stage chương 4.
- Không phá vỡ quy tắc progression đã chốt (12 tầng chính + 6 tầng mở rộng, trần tầng 18, đường cong `(baseMinutes + 10) * 2`).

## 2. Hiện trạng

- `GameManager.canTriggerRealmBreakthrough()` (`src/core/game/GameManager.ts:1439`) trả `false` cứng; test `GameManager.progressionScope.test.ts` đang khóa hành vi này.
- `foundationStages` (`src/data/stage/Stages.ts:357-368`) clone nguyên enemy pool Luyện Khí, comment ghi rõ "temporarily reuses".
- `REALMS` (`src/data/realms/realm.ts:80-85`): `golden_core` là placeholder — `maxLevel: 9`, `realmDurationMultiplier: 90` (cơ chế cũ, không theo đường cong baseCultivationMinutes của 3 realm đầu).
- `BREAKTHROUGH_REQUIREMENTS` (`src/core/breakthrough/BreakthroughRequirement.ts:23`) đã author sẵn token Kim Đan: `breakthrough_token_golden_core`, 2.000 Linh Thạch.
- Scaffold vật liệu realm 4+ đã có trong `src/data/materials/materials.ts:349-376` (45 gỗ + 30 quáng) và `extendCosts()` trong `src/data/building/buildings.ts` đòi chúng để nâng công trình — nhưng **không có nguồn sản xuất**.
- Alchemy recipe đã viết đủ 9 realm (`src/data/alchemy/alchemyRecipes.ts`) nhưng thảo realm 4+ không farm được.
- Art quái hiện chỉ có tier mortal (`public/assets/characters/` ~20 file `mortal-*`).

## 3. Thiết kế tổng thể

### 3.1 Quy tắc kế thừa (không đổi)

- Mỗi đại cảnh giới: 12 tầng chính + 6 tầng mở rộng, trần 18 (progression-combat-rework-plan §1).
- Chi phí tầng: `durationMinutes(level) = baseMinutes + level - 1`; `nextRealmBaseMinutes = (baseMinutes + 10) * 2` → **Kim Đan có `baseCultivationMinutes = 148`** (từ Trúc Cơ 64).
- Boss chỉ xuất hiện ở tầng `.10` của mỗi màn.
- Đột phá đại cảnh giới = Đột Phá Lệnh + Độ Kiếp (combat thật); thất bại mất 50% tu vi + Linh Thạch + Kiếp Thương (giữ pattern Trúc Cơ).

### 3.2 Phụ thuộc bắt buộc trước M2/M3

- **economy-fixes Task A1** (mapping Tinh Hoa realm 4+) phải xong trước khi item realm 4 bắt đầu rơi — nếu không dissolve/tinh luyện sẽ sai tier.
- Art quái mới là dependency mềm: cho phép dùng art mortal + tint/đổi tên tạm trong M1, art thật vào sau (theo [ui-discoverability-refactor-plan.md](./ui-discoverability-refactor-plan.md)).

## 4. Milestone 1 — Nội dung Trúc Cơ thật

### 4.1 Quái mới cho chương 3

- Thêm 5–6 loài quái Trúc Cơ trong `src/data/enemy/Enemies.ts`, id prefix `foundation_*` (vd yêu thú núi Thanh Vân, mộc linh, thạch khôi…). Stat scale theo pattern hiện có của quái Luyện Khí (đọc 2–3 enemy Luyện Khí làm chuẩn rồi nhân hệ số cảnh giới).
- 1 boss mới cho `foundation_floor_10`: có phase HP threshold + enrage (hạ tầng boss phase đã có trong `BattleSystem`) — boss Trúc Cơ đầu tiên dùng cơ chế này làm hình mẫu.
- Mỗi quái mang drop: Linh Thạch, `xich_dong`/`huyen_thiet` giữ nguyên nếu economy plan chưa xong; khi economy plan xong thì theo bảng drop mới.

### 4.2 Stage chương 3 thật

- Viết lại `foundationStages` trong `Stages.ts`: enemy pool từ quái `foundation_*`, giữ id `foundation_floor_1..10` (không đổi id để không vỡ tham chiếu), tăng `totalEnemyCount`/`spawnIntervalSeconds` theo pattern chuẩn hóa hiện có.
- Xóa comment "temporarily reuses".

### 4.3 Quest Trúc Cơ

- Thêm 3–5 quest chuỗi Trúc Cơ vào `src/data/quest/quests.ts` (diệt boss foundation_floor_10, thu thập vật liệu Trúc Cơ, luyện đan phẩm Linh) — phần thưởng gồm equipment lần đầu (quest hiện tại chưa thưởng equipment).

### 4.4 Kiểm chứng M1

- Test: stage chương 3 không tham chiếu enemy pool chương 2; mọi `enemyId`/`bossEnemyId` tồn tại; quest điều kiện tham chiếu material/enemy tồn tại.
- Chơi thử: Trúc Cơ tầng 1→10 stage có độ khó tăng dần, boss phase hoạt động.

## 5. Milestone 2 — Gate Kim Đan

### 5.1 Mở khóa đột phá

- `canTriggerRealmBreakthrough()`: cho phép đột phá từ `foundation_establishment` tầng 12+ sang `golden_core` khi đủ `BREAKTHROUGH_REQUIREMENTS['golden_core']` (token + 2.000 Linh Thạch — cân nhắc nâng chi phí Linh Thạch thành sink hàm mũ đầu tiên: baseline đề xuất 20.000, phối hợp [economy-fixes-sinks-plan.md](./economy-fixes-sinks-plan.md) §B1).
- Cập nhật `GameManager.progressionScope.test.ts` theo hành vi mới.
- Nếu [progression-depth-plan.md](./progression-depth-plan.md) (Kiến Cơ) đã xong: gate Kim Đan nhận thêm điều kiện Căn Cơ; nếu chưa xong: giữ gate token thuần, Kiến Cơ nối sau (không chặn M2).

### 5.2 Độ Kiếp Kim Đan

- Thêm tribulation profile mới trong `src/core/breakthrough/TribulationProfile.ts`: khó hơn profile Trúc Cơ (baseline: thời gian dài hơn, %maxHP sát thương cao hơn, thêm phase sét thứ hai) — số cụ thể playtest chỉnh.
- Thêm enemy kiếp trong `src/data/enemy/Tribulations.ts` theo pattern hiện có.
- Thất bại: giữ pattern 50% tu vi + Linh Thạch + Kiếp Thương.

### 5.3 Realm data Kim Đan

- `realm.ts`: đổi `golden_core` từ placeholder sang thiết kế thật — `maxLevel: 18`, `baseCultivationMinutes: 148`, bỏ `realmDurationMultiplier: 90`, thêm `attributeCap` (baseline 200, theo pattern tăng dần 10/20/100).
- Cập nhật comment PRODUCT SCOPE: scope giờ phủ tới Kim Đan.

### 5.4 Kiểm chứng M2

- Test: đường cong tu luyện Kim Đan đúng công thức; gate mở khi đủ token + Linh Thạch và đóng khi thiếu; tribulation profile mới kích hoạt đúng realm.
- Chơi thử full luồng: Trúc Cơ 18 → mua token → Độ Kiếp → vào Kim Đan.

## 6. Milestone 3 — Đời sống Kim Đan

### 6.1 Realm passive

- Thêm nội tại Kim Đan vào `src/data/progression/RealmPassives.ts` (hoặc đường dẫn hiện hành của RealmPassives) theo pattern `RealmPassiveSystem` — mỗi đại cảnh giới đúng 1 nội tại cấp một lần. Ý tưởng baseline: nội tại Kim Đan phải khác chất Trúc Cơ (vd liên quan đến đan điền/mana hoặc % sát thương tổng), không chỉ là số to hơn.

### 6.2 Tầng node mới cho Pháp Tu

- Thêm tier node Kim Đan vào `src/data/progression/PhapTuNodes.ts`: mỗi hành mở 1 keystone bậc hai hoặc node ultimate (tham chiếu ý tưởng "ultimate Trúc Cơ/Kim Đan" trong `docs/Plans .md` trước khi file bị xóa — xem [docs-sync-audit-plan.md](./docs-sync-audit-plan.md) Task 4).
- Kiếm Tu: nếu node tree Kiếm Tu chưa có (progression-depth-plan), thêm ít nhất 1 tầng Kiếm Ý milestone để Kiếm Tu không trống ở Kim Đan.

### 6.3 Nguyên liệu realm 4 — mở nguồn farm

- Thêm nguồn sản xuất cho vật liệu realm 4 đã scaffold (`materials.ts:349-376`): lựa chọn thiết kế khi triển khai — (a) mở rộng Động Thiên/Huyền Thiết Quảng/Thanh Vân Lâm lên cấp realm 4, hoặc (b) thêm địa giới khai thác mới. Ưu tiên (a) vì hạ tầng `ProductionSystem` đã có level/realm gating; (b) chỉ làm nếu (a) vỡ cấu trúc.
- Thảo realm 4 vào bảng roll Động Thiên để alchemy recipe realm 4+ dùng được.
- Kiểm tra `extendCosts()` building giờ đã có nguồn cung — mở lại đường nâng công trình đang tắc.

### 6.4 Stage chương 4

- Thêm 10 stage Kim Đan (`golden_core_floor_1..10`) với quái mới prefix `golden_core_*` + boss tầng 10; drop equipment realm 4 (chỉ sau khi economy-fixes A1 xong).

### 6.5 Kiểm chứng M3

- Test: realm passive cấp đúng một lần; node mới mua được bằng Cảm Ngộ và effect hoạt động; production realm 4 ra đúng vật liệu; stage chương 4 tham chiếu hợp lệ.
- Chơi thử: 1 ngày idle ở Kim Đan có việc làm (tu luyện + farm realm 4 + luyện đan realm 4 + đẩy stage).

## 7. Kiểm chứng chung

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- Toàn bộ test progression hiện có (`GameManager.progressionScope.test.ts`, realm system tests) phải được cập nhật có chủ đích, không xóa để xanh.
- Sau mỗi milestone: cập nhật `docs/game-guide.md` (mục Tu luyện/Cảnh giới) theo thay đổi.

## 8. Rủi ro và lưu ý

- **Art là nút cổ chai**: M1/M3 cần art quái mới. Mitigation: tint/placeholder được phép ở M1, không được phép phát hành chính thức ở M3 — ghi rõ trong checklist asset.
- **Lạm phát Linh Thạch**: gate Kim Đan là sink hàm mũ đầu tiên; nếu giữ 2.000 như author cũ thì quá rẻ so với nguồn tích lũy ~34 giờ. Chốt số cùng economy plan.
- **Vỡ quy tắc progression**: mọi thay đổi `realm.ts` phải đối chiếu §3.1; không tự chế đường cong mới.
- **Scope creep**: plan này KHÔNG thiết kế Nguyên Anh trở đi. Các realm sau Kim Đan giữ placeholder cho tới roadmap sau.
- Nếu `docs/Plans .md` chứa ý tưởng Kim Đan chưa được đưa vào đây, Task 4 của docs-sync-plan phải chuyển chúng vào mục này trước khi xóa file — không làm mất ý tưởng gốc.
