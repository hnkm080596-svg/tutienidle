# Động Phủ Command Wheel, Inventory Sort, và Linh Thạch Material Plan

## Trạng thái

- Loại tài liệu: implementation plan.
- Phạm vi: UI Động Phủ, điều hướng chức năng, trình bày nhân vật, sắp xếp kho và mô hình dữ liệu Linh Thạch.
- Chưa thực hiện thay đổi runtime trong tài liệu này.
- Project đang ở development phase: chấp nhận phá tương thích save cũ; không dành công sức cho save migration.
- Tài liệu này thay thế các quyết định runtime/navigation cũ liên quan Tàng Kinh Các và building world object trong `thanh-van-dong-fu-art-production-plan.md`; tài liệu art cũ vẫn giữ giá trị tham khảo cho quy trình sản xuất asset.

## Mục tiêu

1. Bỏ hoàn toàn top action bar và bottom action bar ở Động Phủ.
2. Động Phủ sử dụng toàn bộ viewport khi không ở combat/Độ Kiếp.
3. Dùng nhân vật đang tu luyện ở giữa màn hình làm trigger mở command wheel nhiều tầng.
4. Giữ hai đường truy cập cho các building thật: hotspot trên background và shortcut trong wheel.
5. Chuyển Tàng Kinh Các thành shortcut hệ thống ở vòng ngoài, ngang hàng với Cài Đặt; không còn hotspot và không mang semantics Building.
6. Dùng artwork mortal mới cho Động Phủ và tab Nhân Vật.
7. Thêm chức năng sort theo từng tab kho, đặt bên phải pagination.
8. Chuyển Linh Thạch khỏi `PlayerData` thành một material thật trong `MaterialBag`.

## Kiến trúc UI đích

```text
                 Vòng 4 — hệ thống
          [Tàng Kinh Các]     [Cài Đặt]

                 Vòng 3 — building
       Khí Đường · Đan Phòng · Truyền Tống Trận
              Linh Tuyền · Sản Xuất

              Vòng 2 — hệ thống phát triển
       Luyện Thể · Quan Khí · Realm Passive
          slot Pháp Bảo · Phù · Trận · tương lai

                   Vòng 1 — cốt lõi
          Nhân Vật · Kho · Kỹ Năng · Tâm Pháp

             [player-mortal-cultivate-v1]
                    trigger trung tâm
```

### Quy tắc vòng ngoài

- Tàng Kinh Các và Cài Đặt nằm trên cùng một bán kính, cùng kích thước và cùng visual priority.
- Hai shortcut được bố trí đối xứng theo trục ngang: Tàng Kinh Các bên trái, Cài Đặt bên phải.
- Tàng Kinh Các mở thẳng `leftPanelMode = 'scripture_pavilion'`.
- Cài Đặt mở thẳng `leftPanelMode = 'settings'`.
- Cả hai luôn khả dụng, không có trạng thái locked/unbuilt/upgradeable.

## Workstream A — Artwork và chuyển động nhân vật

### Artwork

- Trung tâm Động Phủ dùng:
  - `/assets/characters/player/mortal/player-mortal-cultivate-v1.png`
- Chân dung trong tab Nhân Vật dùng:
  - `/assets/characters/player/mortal/player-mortal-v1.png`
- Hai file này là PNG tĩnh, không phải atlas nhiều frame. Không tiếp tục truyền chúng qua `AtlasSprite`.
- Tạo component trình bày dùng chung, ví dụ `PlayerPortrait.vue`, nhận variant, kích thước và cờ animation.

### Chuyển động CSS của ảnh tu luyện

- Float dọc nhẹ: biên độ 3–5 px, chu kỳ chậm.
- Nhịp thở: scale khoảng `1` đến `1.015`.
- Aura pulse độc lập, không scale trực tiếp toàn bộ hit target.
- Vòng linh khí dưới chân mở rộng/nhạt dần theo chu kỳ.
- Khi wheel mở, aura tăng nhẹ và các vòng shortcut fan-out từ tâm.
- Không dùng sway ngang, rotate hoặc tilt.
- `prefers-reduced-motion: reduce` vô hiệu hóa float/scale và rút ngắn transition.
- Ảnh `player-mortal-v1.png` trong tab Nhân Vật là ảnh tĩnh; không áp animation tu luyện.

## Workstream B — Command wheel nhiều tầng

### Component và dữ liệu

Tạo `DongFuCommandWheel.vue` và catalog thuần data:

```ts
interface CommandWheelSlot {
  id: string
  ring: 1 | 2 | 3 | 4
  label: string
  icon?: string
  target?: PanelTarget
  buildingId?: string
  available: () => boolean
}
```

- `ring` giữ vai trò semantic/color grouping, không còn ép slot thành các cụm chỉa theo từng hướng.
- Các slot khả dụng phân bố đều đủ 360° trên hai quỹ đạo tròn; bán kính clamp theo viewport và khoảng trống thật phía dưới tâm wheel.
- Khi mở, slot xuất phát từ tâm rồi vừa tăng bán kính vừa chạy theo cung: vòng trong ngược kim đồng hồ, vòng ngoài thuận kim đồng hồ; nếu bổ sung vòng thứ ba thì tiếp tục ngược kim đồng hồ. Nội dung nút được counter-rotate để luôn thẳng và alpha tăng liên tục từ 0 lên 1.
- Button dùng khoảng 75% kích thước ban đầu; bán kính hai vòng được nới rộng và vòng trong giữ khoảng trống trung tâm đủ lớn để không che sprite nhân vật ở trạng thái mở.
- Khi đóng, wheel chạy ngược animation mở: các slot giảm alpha, thu bán kính và uốn theo cung trở lại tâm trước khi DOM được gỡ; lớp wheel ngừng nhận pointer-event ngay khi bắt đầu đóng.
- Phím `Tab` toggle wheel khi đang ở Động Phủ (không chiếm Tab trong input/select/contenteditable hoặc khi đang combat). Motion dùng nhịp ngắn khoảng 320ms để phản hồi gần với tốc độ các UI khác.
- Tối ưu compositor: wheel luôn mounted và chỉ đổi `visibility`; mỗi button tự chạy một chuỗi transform quỹ đạo/counter-rotate thay cho cặp anchor + button; toàn bộ slot chạy đồng thời, không stagger; bỏ shadow trang trí và backdrop đổi tức thời, không animate opacity trên canvas Phaser.
- Vị trí mỗi slot được suy từ index/tổng số slot; không hard-code từng `left/top` trong template.
- Slot tương lai tồn tại trong catalog dưới dạng `null`/unavailable nhưng không render nút.
- Không render shortcut giả cho chức năng chưa implement.

### Interaction

- Click ảnh tu luyện: toggle wheel.
- Click lần nữa, click vùng trống hoặc nhấn `Escape`: đóng wheel.
- Chọn shortcut: đóng wheel rồi mở panel/overlay tương ứng.
- Wheel dùng button thật, có `aria-label`, focus order hợp lý và `focus-visible`.
- Touch không phụ thuộc hover; tap trực tiếp mở chức năng.
- Khi một panel được mở bằng nguồn khác, trạng thái active trên wheel vẫn suy ra từ `uiStore`.

### Fan-out

- Các vòng mở từ trong ra ngoài với stagger ngắn.
- Shortcut scale/fade từ tâm tới vị trí cuối.
- Không animate layout bằng `left/top`; dùng `transform` và opacity để tránh giật layout.
- Đóng theo thứ tự ngược lại nhưng tổng thời gian ngắn, không cản thao tác.

## Workstream C — Building dùng đồng thời hotspot và wheel

### Building thật tiếp tục có hai entry point

- Hotspot trên background vẫn hoạt động.
- Shortcut ring 3 vẫn hoạt động.
- Hai entry point không tự giữ logic điều hướng riêng.

Tách controller/composable dùng chung, ví dụ:

```ts
openBuilding(buildingId: string): void
openBuildingUpgrade(buildingId: string): void
getBuildingPresentation(buildingId: string): BuildingPresentation
```

Quy tắc duy nhất:

- Chưa xây: mở popover xây dựng.
- Đã xây và có `functionType`: mở panel chức năng.
- Đã xây nhưng là resource building: mở popover thu hoạch/nâng cấp.
- Có thể nâng cấp: cả hotspot và wheel hiển thị cùng indicator.
- Chỉ có một `BuildingDetailPopover` ở tầng `GameRoot`, được điều khiển bằng `activeBuildingPopoverId` dùng chung.
- Khi wheel đang mở, wheel có z-index cao hơn hotspot. Hotspot tạm ngừng hit-test dưới vùng wheel để tránh click xuyên, nhưng vẫn là entry point độc lập khi wheel đóng.

### Tàng Kinh Các không phải Building

Tàng Kinh Các bị loại hoàn toàn khỏi hệ hotspot/building:

- Xóa `SCRIPTURE_HOTSPOT` khỏi `HomeBuildingIcons.vue`.
- Xóa button hotspot Tàng Kinh Các khỏi background.
- Xóa tooltip world-object riêng của Tàng Kinh Các.
- Xóa handler `openScripturePavilion()` đặc biệt khỏi component hotspot.
- Không thêm `scripture_pavilion` vào `buildings.ts`.
- Không tạo `BuildingInstance`, level, cost, build, upgrade hoặc trạng thái unlock cho Tàng Kinh Các.
- Không đi qua building controller/composable.
- Entry duy nhất của Tàng Kinh Các là shortcut vòng ngoài của command wheel.

Các building thật còn lại ở ring 3:

- `equipment_hall`
- `pill_room`
- `teleport_array`
- `spirit_spring`
- `gathering_outpost`

## Workstream D — Bỏ action bars và mở full viewport

### Loại khỏi `GameRoot`

- `DongFuTopBar`
- `BottomBar`
- `DongFuQuickNav`
- `RealmActionNav`
- `NavMenuOverlay` sau khi command wheel đã bao phủ toàn bộ entry cần thiết

Sau khi không còn consumer, xóa component và CSS/comment/reference đã lỗi thời.

### Layout

- `MainScene` không còn `bottomInset` theo `--bottom-bar-h`; home dùng `bottom: 0`.
- `LeftPanel` không còn chừa `--top-bar-h` và `--bottom-bar-h`; trở thành overlay full-height ở cạnh trái.
- Xóa `game-root__top-bar` và `game-root__bottom-bar` styles.
- Xóa hoặc retire `--top-bar-h`/`--bottom-bar-h` nếu không còn consumer.
- Background Động Phủ, hotspot và command wheel dùng toàn bộ viewport.
- Combat Scene và Tribulation Scene tiếp tục là full-screen overlay độc lập.
- Text cảnh giới và ResourceDisplay Linh Thạch biến mất cùng top bar.

## Workstream E — Inventory sort bên phải pagination

### Shared pagination footer

Ba bag section hiện lặp cùng pagination. Tách thành `BagPaginationControls.vue`:

```text
| khoảng cân bằng | ‹ 1 2 3 › | [Sắp xếp ↕] |
```

Layout:

```css
grid-template-columns: 1fr auto 1fr;
```

- Pagination luôn ở giữa.
- Sort control nằm sát phải.
- Nút sort vẫn hiển thị khi chỉ có một trang.
- Mobile/khung hẹp cho phép nút chỉ hiện icon, tooltip vẫn có nhãn đầy đủ.

### Sort model

```ts
type SortDirection = 'asc' | 'desc'

interface BagSortState<TMode extends string> {
  mode: TMode
  direction: SortDirection
}
```

- Mỗi tab có state sort riêng trong `uiStore`.
- State tồn tại trong phiên chơi, không cần ghi vào game save.
- Sort trên một bản copy của toàn bộ list trước pagination.
- Không mutate thứ tự thật trong `EquipmentBag`, `MaterialBag` hoặc `PillBag`.
- Dùng stable sort; comparator cuối cùng quay về original index.
- Đổi sort mode/direction gọi `resetPage()` và quay về trang đầu.
- Mở rộng `useBagPagination()` để expose `resetPage()`.

### Tiêu chí Trang Bị

- Mặc định.
- Phẩm chất.
- Rarity/phẩm cấp.
- Cảnh giới.
- Slot.
- Tên.
- Điểm Rèn/tiềm năng rèn.

### Tiêu chí Nguyên Liệu

- Mặc định.
- Phân loại.
- Niên đại/cấp nguyên liệu.
- Số lượng.
- Tên.
- Nguồn chính.

### Tiêu chí Đan Dược

- Mặc định.
- Phẩm đan.
- Loại hiệu ứng.
- Số lượng.
- Tên.

### Sort menu

- Click nút mở popover nhỏ chứa mode và direction.
- Label nút phản ánh trạng thái hiện hành, ví dụ `Phẩm chất ↓` hoặc `Tên A–Z`.
- Có action `Mặc định` để trả lại original order.
- Đóng bằng outside click hoặc `Escape`.

## Workstream F — Linh Thạch trở thành Material

### Material definition

Tạo constant dùng chung:

```ts
export const SPIRIT_STONE_MATERIAL_ID = 'spirit_stone'
```

và đăng ký material:

```ts
{
  id: SPIRIT_STONE_MATERIAL_ID,
  name: 'Linh Thạch',
  category: 'spirit_stone',
  sourceType: 'building',
  description: 'Tinh thể linh khí dùng làm vật liệu và đơn vị trao đổi.',
}
```

- Bổ sung icon material phù hợp.
- Linh Thạch xuất hiện trong tab Nguyên Liệu và tham gia mọi sort như material bình thường.

### Xóa currency state riêng

- Xóa `spiritStone` khỏi `PlayerData` và default player.
- Xóa `addSpiritStone()` khỏi `RewardReceiver`/player store.
- Xóa mọi read/write trực tiếp `player.spiritStone`.
- Số dư duy nhất là `materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)`.
- Cộng bằng `materialBag.add()`; tiêu bằng `materialBag.remove()` sau khi kiểm tra `has()`.
- Với penalty có thể trừ quá số dư, dùng amount thực tế `Math.min(owned, requested)`.

### Nguồn nhận

- Enemy/tribulation reward cấp Linh Thạch như material reward.
- Linh Tuyền chuyển từ `producesSpiritStone` sang `producesMaterialId: SPIRIT_STONE_MATERIAL_ID`.
- Reward summary không giữ một currency authority riêng; nếu cần dòng trình bày chuyên biệt thì chỉ derive từ material reward của trận.
- Toast/particle có thể giữ presentation màu vàng nhưng storage vẫn là MaterialBag.

### Nơi tiêu

Chuyển toàn bộ check/trừ sang material cost:

- Đột phá.
- Luyện Đan.
- Cường Hóa, Tẩy Luyện, Tinh Luyện.
- Nâng Production Site.
- Chi phí nghề và các operation catalog.
- Penalty thua Độ Kiếp.

Các cấu trúc cost nên quy về danh sách material cost chung thay vì giữ nhánh `spiritStoneCost` đặc biệt, trừ khi field đó chỉ còn là authoring sugar và được normalize ngay tại boundary.

### Save

- Save mới chỉ persist Linh Thạch trong `materials`.
- Không thêm migration từ `player.spiritStone` vì project đang ở development phase.
- Save cũ có thể bị reset/không tương thích sau thay đổi này.

### Chính sách migration và an toàn ghi đè

Audit trước triển khai phát hiện `loadGame()` vẫn tự migrate v42/v43 rồi ghi đè save gốc, trong khi kết quả được gắn thẳng `CURRENT_SAVE_VERSION` nhưng không được normalize qua các schema v45–v47. Điều này mâu thuẫn với chính sách development build ở trên và có thể tạo một save mang version hiện hành nhưng thiếu field bắt buộc.

- Phương án mặc định của plan này: retire đường auto-migrate v42/v43; mọi version cũ hơn `CURRENT_SAVE_VERSION`, gồm v42–v46, trả về `incompatible` để người chơi có thể Export/Xóa qua màn recovery. Không xây thêm migration v44–v46.
- Nếu có yêu cầu sản phẩm riêng buộc phải giữ migration v42/v43, migration phải:
  - gọi `backupCurrentSave()` trước lần `writeGameSave()` đầu tiên;
  - chạy đủ chuỗi normalize tới schema hiện hành, không chỉ đổi số version;
  - reset toàn bộ state Phù/Trận trên slot (`socketedTalisman`, `socketedFormation`, `appliedTalismanIds`, `bonusAffixSlots`);
  - bảo toàn cờ `locked`/`favorite` của equipment thay vì âm thầm đặt cả hai về `false`;
  - chuyển Linh Thạch vào `materials`, không tái tạo authority `player.spiritStone`.
- Test phải chứng minh migration không bao giờ ghi đè save gốc khi chưa có backup. Nếu chọn retire migration, test phải chứng minh v42–v46 không phát sinh bất kỳ write nào.

## Audit findings cần xử lý cùng đợt

Các mục dưới đây không mở rộng feature scope của command wheel/inventory, nhưng là regression hoặc lỗi dữ liệu đã được xác nhận trong cùng working tree. Xử lý chúng như preflight hardening trước visual QA; không trộn thành một rewrite kiến trúc.

### P0 — đúng đắn runtime và dữ liệu

1. **Timed-effect percent stacking** — `GameManager.applyTimedEffect()` hiện tìm modifier cũ bằng cả `stat` và giá trị `percent`. Vì vậy hai percent khác nhau của cùng stat không match và bị cộng dồn, trái policy “cùng effectGroup giữ giá trị mạnh hơn per-stat”. Đổi merge key theo identity thực (`stat` và `tag` khi tag phân biệt pool), rồi chọn giá trị mạnh hơn riêng cho `flat`/`percent`/`multiplier`; không để modifier yếu và mạnh cùng tồn tại ngoài ý muốn. Thêm test cho weaker→stronger, stronger→weaker, refresh deadline và hai tag hợp lệ độc lập.
2. **Dead player completes a cast** — `BattleSystem.updateCasting()` chạy sau tick Ailment/DoT nhưng thiếu `player.alive` guard. Nếu DoT giết Player trong cùng tick, cast đang niệm vẫn có thể hoàn tất trước `checkBattleEnd()`. Khi Player chết, hủy/clear cast transaction và phát tín hiệu completion/cancel cần thiết để cast bar không kẹt; tuyệt đối không resolve skill effect. Thêm regression test “DoT lethal đúng tick cast hoàn tất”.
3. **Reward VFX dùng sai body anchor** — `CombatScene.resolveRewardSourcePoint()` áp `getBodyAnchors(this.playerProfile, 'combat').chest` cho mọi source sprite, kể cả enemy. Dùng anchor/presentation dành cho loại source; với enemy chưa có catalog anchor thì dùng điểm thân trung tính suy ra từ sprite bounds, sau đó mới fallback last-known screen/grid. Thêm test enemy source không phụ thuộc Player profile.

### P1 — chất lượng HUD

4. **Mất lớp smoothing của cadence HUD** — HUD hiện truyền thẳng `cadenceRemaining` từ snapshot `stateVersion`, trong khi `useBasicAttackCadence()` có rAF nội suy chỉ-presentation đã bị loại. Khôi phục một lớp smoothing dùng chung cho mọi slot có execution policy cadence, resync ở mỗi snapshot, đóng băng khi gameplay không advancing và cancel rAF khi unmount. Không mutate battle timer. Test fake-rAF cho resync, pause và cleanup; visual QA xác nhận mask/số đếm không nhảy theo nhịp tick.

### P2 — cleanup có giới hạn

5. Chỉ thực hiện các cleanup sau khi P0/P1 đã có test:
   - tách predicate chọn affix hợp lệ đang lặp trong `EquipmentSystem` để roll thường và wash dùng chung cùng rule slot/pool/excluded stat;
   - nếu migration v42/v43 được giữ, tách helper cộng dồn stack theo id cho các vòng material/pill/talisman/formation; nếu retire migration thì xóa code chết thay vì refactor;
   - catalog command wheel/building navigation là nguồn duy nhất cho building id dùng chung trong UI mới; không tạo một lớp constant toàn cục chỉ để thay literal xuất hiện một lần;
   - chống queue trùng texture trong `queueCombatAssets()`: `textures.exists()` không nhận biết key mới chỉ được queue, và các Player profile đang dùng trùng key. Dedupe theo texture key trong chính một lần queue, đồng thời giữ khả năng gọi helper từ cả MainScene và CombatScene.

## Trình tự triển khai

1. Chốt chính sách save: retire auto-migration v42/v43 theo development policy; chỉ giữ khi có yêu cầu sản phẩm rõ ràng và khi đó phải backup + normalize đủ schema.
2. Sửa các regression P0 đã xác nhận: timed-effect stacking, dead-cast guard và enemy reward anchor.
3. Khôi phục cadence HUD smoothing và khóa bằng test presentation.
4. Tạo command-wheel catalog, building navigation controller và shared popover authority.
5. Chuyển player center sang PNG mới + CSS motion.
6. Mount command wheel, thêm đủ ring và xác minh keyboard/touch.
7. Chuyển Tàng Kinh Các sang vòng ngoài; xóa toàn bộ pseudo-building hotspot logic của nó.
8. Giữ các building thật ở cả hotspot và ring 3, nối cả hai vào controller chung.
9. Gỡ top/bottom/nav chrome và mở layout Động Phủ full viewport.
10. Tạo shared pagination footer và sort state/comparator theo từng bag.
11. Chuyển Linh Thạch sang MaterialBag theo một lượt atomic để tránh tồn tại hai authority.
12. Thực hiện cleanup P2 còn phù hợp sau khi shape cuối đã ổn định.
13. Cập nhật tests, comments và tài liệu asset/navigation liên quan.
14. Chạy full test, type-check, build và visual E2E ở các viewport mục tiêu.

## Test plan

### Command wheel

- Toggle bằng player center.
- Outside click, center click và `Escape` đóng đúng.
- Fan-out từ tâm theo cung xoắn ra hai vòng tròn đủ 360°, hai vòng quay ngược chiều nhau và stagger liên tục theo thứ tự slot.
- Shortcut mở đúng `leftPanelMode`/`standalonePanel`.
- Slot chưa implement không render.
- Focus order và touch hoạt động không cần hover.
- Reduced-motion không chạy animation lặp.

### Tàng Kinh Các

- Không còn `[data-building-id="scripture_pavilion"]` trong hotspot layer.
- Không có BuildingInstance/cost/level cho Tàng Kinh Các.
- Shortcut vòng ngoài luôn hiện và mở đúng panel.
- Tàng Kinh Các và Cài Đặt giữ cùng semantic/style priority trong circular-orbit layout.

### Building dual-entry

- Hotspot và wheel cùng mở đúng một popover cho building chưa xây.
- Cả hai mở đúng function panel sau khi xây.
- Upgrade state/cost/level đồng bộ ngay sau mutation.
- Wheel mở không gây click xuyên xuống hotspot.

### Inventory sort

- Sort chạy trước pagination.
- Đổi mode/direction reset về page 0.
- Asc/desc đúng cho từng tiêu chí.
- Stable sort giữ thứ tự item bằng nhau.
- Mỗi tab nhớ state riêng.
- Linh Thạch sort đúng trong tab Nguyên Liệu.

### Linh Thạch

- Mọi source cộng vào MaterialBag.
- Mọi cost trừ đúng stack, không âm và không trừ khi thiếu.
- Linh Tuyền claim ra material.
- Reward/summary/toast phản ánh đúng lượng nhận.
- Không còn runtime reference tới `player.spiritStone`.
- Save mới chỉ có stack `spirit_stone` trong materials.

### Regression hardening từ audit

- Cùng `effectGroup` + cùng stat/tag chỉ giữ modifier mạnh hơn; percent khác giá trị không bị cộng dồn ngoài ý muốn.
- Player chết bởi DoT/Ailment giữa lúc niệm không gây skill effect và không để cast state/bar bị kẹt.
- Reward particle từ enemy xuất phát theo enemy bounds/anchor, không đổi vị trí khi thay Player visual profile.
- Cadence mask nội suy mượt giữa hai snapshot, resync không drift, dừng đúng khi pause/incapacitated và không còn rAF sau unmount.
- Save version cũ tuân đúng nhánh đã chốt: hoặc bị từ chối mà không write, hoặc được backup trước write và normalize đủ schema hiện hành.
- Combat preload không queue trùng một texture key trong cùng lượt gọi.

### Regression và visual QA

- Full Vitest suite.
- `npm.cmd run type-check`.
- `npm.cmd run build`.
- Visual E2E tối thiểu ở 1280×720, 1600×900 và viewport hẹp được hỗ trợ.
- Kiểm tra command wheel không che panel, tooltip hoặc combat overlay.

## Acceptance criteria

- Home không còn top/bottom action bar hoặc khoảng layout bị chừa lại.
- Player cultivate PNG là trigger duy nhất để mở command wheel.
- Wheel giữ bốn nhóm semantic nhưng trình bày thành circular-orbit layout 360°, có thể mở bằng chuột, touch và bàn phím.
- Building thật dùng được từ cả hotspot và wheel với cùng một logic.
- Tàng Kinh Các chỉ còn ở vòng ngoài ngang với Cài Đặt và không có bất kỳ logic Building nào.
- Tab Nhân Vật dùng `player-mortal-v1.png`.
- Inventory có sort control bên phải pagination với tiêu chí riêng từng tab.
- Linh Thạch là material duy nhất trong MaterialBag, không còn state currency trên PlayerData.
- Không có save v42–v46 bị gắn nhãn version hiện hành khi còn thiếu field bắt buộc; mọi overwrite do migration (nếu còn) đều có backup trước đó.
- Timed effect cùng nhóm không cộng dồn percent sai; Player đã chết không hoàn tất cast; reward enemy không dùng Player body anchor.
- Cadence HUD giữ smoothing chỉ-presentation mà không thay đổi timer gameplay.
- Tests, type-check và build pass; visual QA không phát hiện click xuyên, overlap hoặc motion gây khó chịu.
