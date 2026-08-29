# Kế hoạch Chiều sâu Progression

> Thuộc Phase 3 của [roadmap.md](./roadmap.md). Giải quyết các trục progression đang bỏ hoang: **Kiến Cơ (Căn Cơ) 4 bậc**, **node tree Kiếm Tu**, và **chiều sâu idle**. Thể Tu được ghi nhận như lựa chọn mở rộng, không cam kết mốc.
> Phụ thuộc: [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md) M2 xong trước khi nối Kiến Cơ vào gate Kim Đan (Task 2).

## 1. Mục tiêu

- Gate đột phá có "chất lượng": cùng một cửa đột phá nhưng đầu tư khác nhau cho Căn Cơ khác nhau, hưởng passive khác nhau.
- Kiếm Tu có chiều sâu build tương đương Pháp Tu qua node tree.
- Trụ cột idle có đường nâng cấp: tốc độ tu luyện không còn chỉ phụ thuộc thiên phú; offline có việc sinh lợi ngoài tu vi.

## 2. Hiện trạng

### 2.1 Kiến Cơ bị park

- `resolveFoundation()` (`src/core/breakthrough/FoundationResolver.ts:27`) trả `'human'` cứng; comment ghi rõ thiết kế chốt mốc 12 tầng là Nhân Đạo, giữ signature chờ quay lại.
- `FoundationType = 'human' | 'earth' | 'heaven' | 'great_dao'` (`FoundationType.ts`) đã khai báo.
- `RealmPassives.ts` đã author passive Kiến Cơ earth/heaven/great_dao (5–20% main stat) nhưng không ai đạt được → passive Trúc Cơ hiện cho 0% với mọi người chơi.
- Thiết kế gốc là cơ chế **ẨN**: "âm thầm xét Căn Cơ, không bao giờ lộ điều kiện" (comment `FoundationResolver.ts`, đối lập với Đột Phá Lệnh công khai trong `BreakthroughRequirement.ts`).
- `useTribulation.ts:51` hardcode `foundationType = 'human'`.

### 2.2 Kiếm Tu không có node tree

- `CultivationPathKit.ts` cho Kiếm Tu bộ ba skill cố định (comment "chưa đi qua Node Tree").
- Kiếm Ý (`SwordIntentSystem.ts`): mỗi 9.999 tu vi đời = +1 tầng (+0,5% skill dmg/crit) — tài nguyên vĩnh viễn nhưng chỉ một trục số.
- Hạ tầng `ProgressionNode` đã hỗ trợ `unlocksSkillIds` — đủ để dựng node tree không cần kiến trúc mới.

### 2.3 Idle thiếu chiều sâu

- Offline cap 24h (`GameClock.ts`) chỉ cho tu vi (`OfflineProgressSystem.ts`); không có Cảm Ngộ offline — node tree đói currency nếu không grind tay.
- Tốc độ tu luyện = 10/s × thiên phú (`stores/player.ts`); không có pill/building/tâm pháp nào tăng tốc.
- Tâm pháp có tiến độ Sơ Nhập/Tiểu Thành/Đại Thành/Viên Mãn (quy tắc cũ của progression-combat-rework-plan — plan đã dọn; hiện trạng: `src/core/skill`/`SkillSystem`) nhưng chưa gắn phần thưởng tốc độ tu luyện.

## 3. Thiết kế

### 3.1 Kiến Cơ 4 bậc

**Giữ nguyên tắc thiết kế gốc: điều kiện ẨN.** Nhưng thêm lớp khám phá để người chơi có động lực:

- Điều kiện xét tại thời điểm đột phá (trong `resolveFoundation`), không UI nào liệt kê trước.
- Sau khi đạt Căn Cơ bậc nào: công bố trong panel Nhân Vật + thông báo thế giới ("Đạo Cơ vững chắc — Căn Cơ: Địa"), mô tả passive nhận được. Người chơi khám phá ngược từ kết quả và truyền miệng.
- Thêm hint mềm: quest/tooltip flavor text ám chỉ "chuẩn bị kỹ trước đột phá sẽ có cơ duyên" — không nêu số.

**Bảng điều kiện baseline** (số playtest chỉnh; dùng hệ thống hiện có, không currency mới):

| Căn Cơ | Điều kiện (baseline) | Passive |
|---|---|---|
| Nhân Đạo | Mặc định | 0% (hiện trạng) |
| Địa | Luyện Thể đủ 6 tầng + tu vi tầng 12 trở lên không đột phá sớm trước tầng 14 | Theo `RealmPassives.ts` đã author (5%+) |
| Thiên | Địa + dùng đan phẩm chất cao trước đột phá + thắng Độ Kiếp không lần chết | Đã author (10%+) |
| Đại Đạo | Thiên + Cảm Ngộ tích lũy đạt ngưỡng + điều kiện đặc biệt theo path | Đã author (20%+) |

- Implement trong `resolveFoundation()` theo đúng signature hiện có (player, materialBag, pillBag, tham số thứ 4) — đọc dữ liệu thật, không đổi API.
- `useTribulation.ts`: bỏ hardcode `'human'`, gọi `resolveFoundation()` thật; enemy Kiếp có thể scale nhẹ theo Căn Cơ (tùy chọn, baseline giữ nguyên).
- Passive Kiến Cơ áp dụng cho cảnh giới vừa đột phá vào, qua `RealmPassiveSystem` (idempotent pattern `grantedRealmPassiveIds` hiện có).

### 3.2 Node tree Kiếm Tu

- Dựng cây trong `src/data/progression/KiemTuNodes.ts` (file mới, cùng pattern `PhapTuNodes.ts`): root mở rộng → nhánh Kiếm Ý (tăng tầng/sức mạnh Kiếm Ý) → nhánh Ngự Kiếm (cải thiện 3 skill cố định) → 2 keystone loại trừ nhau ở Trúc Cơ (vd "Kiếm Khí Phân Thân" vs "Nhất Kiếm Phá Pháp").
- Currency: **Cảm Ngộ** (nhất quán với Pháp Tu — cùng nguồn từ chiến đấu). Kiếm Ý giữ vai trò tài nguyên bị động vĩnh viễn, không đổi cơ chế.
- Quy mô khởi điểm: ~15–20 node (so với 49 node Pháp Tu — chấp nhận nhỏ hơn ở bản đầu, mở rộng sau).
- Mua qua `GameManager.purchaseNode()`/`NodeSystem` hiện có; panel `NodeTreePanel.vue` render cây Kiếm Tu khi path là Kiếm Tu.
- Test: prerequisite, cost, effect từng node; Kiếm Tu và Pháp Tu không chia node.

### 3.3 Chiều sâu idle

**a) Nguồn tăng tốc tu luyện (3 nguồn, mỗi nguồn một trục):**

| Nguồn | Cơ chế | Nơi implement |
|---|---|---|
| Tâm pháp | Mỗi bậc tâm pháp (Sơ Nhập → Viên Mãn) cộng % tốc độ tu luyện (baseline 5/10/15/20%) | `core/technique/` + nơi tính tốc độ trong `stores/player.ts` |
| Đan | Họ đan mới "Tụ Linh Đan" — buff timed +% tốc độ tu luyện (dùng như pill buff hiện có) | `data/pill/` + `PillSystem` |
| Công trình | Building mới hoặc nâng cấp Linh Tuyền: "Tụ Linh Trận" +% tốc độ khi nhân vật ở Động Phủ | `data/building/` + `BuildingSystem` |

Ba nguồn nhân với nhau và nhân với thiên phú — cùng một điểm tính duy nhất trong `stores/player.ts` (không rải mỗi nơi một multiplier).

**b) Cảm Ngộ offline:**

- `OfflineProgressSystem` mô phỏng chiến đấu offline tại stage hiện tại: tỷ lệ thắng ước lượng từ stat vs quái (không mô phỏng từng trận — dùng công thức xác suất), sinh Cảm Ngộ + Linh Thạch ở **50% tốc độ online** (baseline, giữ idle thật là lựa chọn tốt hơn).
- Cap chung 24h hiện có giữ nguyên; tổng kết hiện trong `OfflineSummaryModal.vue` thêm dòng Cảm Ngộ.
- Test: offline 8h sinh đúng lượng theo công thức; không sinh Cảm Ngộ khi stage hiện tại chưa thắng lần nào.

### 3.4 Thể Tu — ghi nhận, không cam kết

- Plumbing combat đã có (Momentum/Break gauge, `BattleSystem.theTu.test.ts`); `CultivationPathId` chưa có Thể Tu.
- Nếu làm: path thứ ba với node tree riêng, resource Thể Phách, stage yêu cầu art võ thể. Ước lượng ngang Kiếm Tu node tree + combat kit.
- Quyết định "làm hay không" để sau khi Kiếm Tu node tree xong và có số liệu playtest về nhu cầu path thứ ba.

## 4. Nhiệm vụ triển khai

1. **Task 1**: Implement `resolveFoundation()` thật + bỏ hardcode trong `useTribulation.ts` + test 4 bậc (chưa nối gate Kim Đan — xét ở đột phá Trúc Cơ trước).
2. **Task 2**: Nối Kiến Cơ vào gate Kim Đan (sau truc-co-kim-dan M2) + passive qua `RealmPassiveSystem` + công bố sau đạt (panel + announcement).
3. **Task 3**: Data node tree Kiếm Tu (`KiemTuNodes.ts`) + test prerequisite/cost/effect.
4. **Task 4**: Wiring node tree Kiếm Tu vào `NodeTreePanel.vue`/`SkillPathPanel.vue`.
5. **Task 5**: Tốc độ tu luyện theo tâm pháp + test.
6. **Task 6**: Tụ Linh Đan (pill buff tốc độ) + test.
7. **Task 7**: Tụ Linh Trận (building tốc độ) + test.
8. **Task 8**: Cảm Ngộ offline trong `OfflineProgressSystem` + cập nhật `OfflineSummaryModal.vue` + test.
9. **Task 9**: Playtest pass — hằng số Kiếm Ý (9.999 tu vi/tầng), điều kiện Kiến Cơ, % tốc độ các nguồn; ghi vào mục "Kết quả playtest".

## 5. Kiểm chứng

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- Test hiện có: `FoundationResolver.test.ts` (baseline 'human') phải được cập nhật có chủ đích theo hành vi mới — không xóa.
- Test mới phủ: 4 bậc Kiến Cơ (đủ/thiếu từng điều kiện), node tree Kiếm Tu, 3 nguồn tốc độ cộng đúng thứ tự nhân, offline Cảm Ngộ.
- Chơi thử: nhân vật đầu tư Luyện Thể + đan trước đột phá nhận Căn Cơ Địa; Kiếm Tu có quyết định chi tiêu Cảm Ngộ thật.

## 6. Rủi ro và lưu ý

- **Kiến Cơ ẨN gây frustrate**: nếu không ai tìm ra, tính năng chết. Mitigation: lớp công bố sau đạt + hint flavor (§3.1); theo dõi tỷ lệ đạt qua telemetry nếu có.
- **Ba nguồn tốc độ làm vỡ pacing**: tổng nhân có thể vượt xa thiết kế thời gian realm. Mitigation: trần mềm tổng multiplier (vd ×3) trong điểm tính duy nhất; đối chiếu bảng thời gian realm trong `src/data/realms/realm.ts` khi tune.
- **Cảm Ngộ offline làm grind tay mất giá**: giữ 50% tỷ lệ online và không cho Cảm Ngộ từ boss offline.
- Không đổi cơ chế Kiếm Ý hiện có trong plan này; nếu playtest (Task 9) cho thấy cần sửa, tách task riêng.

## Kết quả playtest

_(Để trống — điền khi thực hiện Task 9.)_
