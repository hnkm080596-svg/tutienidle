# Kế hoạch xử lý phản hồi thao tác, UI vật phẩm và responsive

## 1. Mục tiêu

Đợt công việc này xử lý đồng thời các vấn đề sau:

- Khí Đường và các chức năng gameplay không giải thích rõ khi thao tác thất bại.
- Action gameplay bị khóa bằng `disabled`, khiến không thể click để kiểm tra logic và nhận phản hồi.
- Rarity/Quality trong tên ghép không giữ màu riêng khi xuất hiện trong tooltip.
- Linh Thạch chưa luôn nằm ở ô đầu sau mọi kiểu sort.
- Left Panel chưa co giãn phù hợp ở các độ phân giải khác nhau.
- Combat Scene lệch mặt đất ở viewport thấp, khiến unit có cảm giác đang bay.
- Tên niên đại của linh thảo/linh dược đang đặt sai thứ tự.
- Command wheel chứa nút Quán Khí không đúng ngữ cảnh.
- Nhiều tooltip/card diễn giải dài dòng hoặc lộ dữ liệu nội bộ.
- Khí Đường và nhiều UI khác còn hiển thị codename thay vì nhãn tiếng Việt.

Không thay đổi kiến trúc gameplay ngoài phạm vi cần thiết, không thêm dependency và không thực hiện save migration trong giai đoạn phát triển hiện tại.

## 2. Kết quả rà soát hiện trạng

### 2.1. Action không phản hồi rõ

`EquipmentHallPanel.vue` đang dùng các hàm `canEnhance`, `canWash`, `canRefine` để gắn trực tiếp vào `disabled`. Khi nút bị khóa, click không tới handler nên không thể kiểm tra logic runtime hoặc thông báo nguyên nhân.

Một số đường lỗi hiện còn đưa codename như `missing_spirit_stone`, `not_found` hoặc `unknown` vào toast.

### 2.2. Tooltip làm phẳng tên ghép

`EquipmentNaming.ts` đã có `NameSegment` cho Rarity và Quality, nhưng `useEquipmentTooltip.ts` chuyển tên thành một chuỗi phẳng. `Tooltip.vue` sau đó tô toàn bộ tiêu đề theo Quality. Vì vậy segment như chữ “Tiên” trong ảnh không giữ màu Rarity riêng.

### 2.3. Sort chưa có luật ghim Linh Thạch

`MaterialBagSection.vue` áp dụng `withDirection()` lên toàn bộ comparator. Chưa có bước ưu tiên Linh Thạch độc lập với mode và direction.

### 2.4. Responsive còn lệch giữa các lớp

Left Panel dùng `width: clamp(360px, 30vw, 480px)` nhưng chưa có breakpoint cho viewport rất hẹp hoặc thấp. Một số panel con vẫn có grid/min-width cố định.

Trong Combat, projection có thể ép chiều cao mặt đường tối thiểu, trong khi `ThanhVanBackdrop` vẫn kéo giãn các layer ảnh ra toàn canvas. Hai hệ geometry có thể lệch nhau ở màn hình thấp.

### 2.5. Dữ liệu trình bày chưa thống nhất

- Generator linh thảo đang ghép `${tên} ${niên đại}`.
- Khí Đường hiển thị trực tiếp `affixId`, `materialId`, slot và quality codename ở nhiều vị trí.
- Ba card khai thác Thanh Vân luôn hiện cả mô tả dài và trọng số tier nội bộ.
- `quan_khi` được khai báo trực tiếp trong command-wheel catalog dù Character Panel đã có entry đúng ngữ cảnh.

## 3. Nguyên tắc tương tác bắt buộc

### 3.1. Action gameplay luôn cho phép click

Không dùng native `disabled` để khóa action gameplay vì thiếu tài nguyên, thiếu điều kiện, đang cooldown hoặc chưa chọn đủ dữ liệu.

Mọi click phải đi qua cùng một handler:

```text
Người chơi click
    → tính lại điều kiện từ state hiện tại
    → nếu hợp lệ: thực thi transaction
    → nếu không hợp lệ: không mutate state, trả lý do có cấu trúc
    → UI hiển thị phản hồi tiếng Việt
```

Chỉ được dùng `disabled` cho trường hợp kỹ thuật ngắn hạn mà click lặp có thể tạo request/action trùng trong lúc transaction đang thực sự chạy. Ngay cả trường hợp này cũng phải có trạng thái hiển thị như “Đang xử lý…”, không được im lặng.

### 3.2. Core là nguồn xác thực cuối cùng

UI có thể tính preview điều kiện để đổi màu hoặc liệt kê yêu cầu, nhưng handler vẫn phải gọi kiểm tra trong core ở thời điểm click. Không dựa vào `canX()` cũ làm hàng rào duy nhất vì state có thể đã thay đổi.

Transaction thất bại không được trừ một phần tài nguyên hoặc mutate item.

### 3.3. Phản hồi phải phục vụ người chơi

- Không hiển thị codename hoặc enum thô.
- Nêu đúng tài nguyên/điều kiện thiếu và số đang có/số cần.
- Thông báo lặp liên tục phải được gộp để không spam.
- Điều kiện có thể quan sát trước nên hiện gần nút; kết quả click hiện thêm trong hộp phản hồi chung.

## 4. Workstream A — Action availability và hộp phản hồi toàn game

Mức ưu tiên: P0.

### 4.1. Mô hình điều kiện dùng chung

Tạo view model dùng chung, ví dụ:

```ts
interface ActionRequirementLine {
  code: string
  label: string
  current?: number
  required?: number
  met: boolean
}

interface ActionAvailability {
  allowed: boolean
  requirements: ActionRequirementLine[]
}
```

Core operation tiếp tục trả result có reason code để code điều khiển xử lý ổn định. Vue layer dùng một mapper tập trung để chuyển reason và requirement sang tiếng Việt.

### 4.2. Luồng click chuẩn

- Bỏ `:disabled="!canX(...)"` khỏi action gameplay.
- Đổi `canX()` thành hàm preview availability hoặc requirement rows.
- Handler luôn chạy khi click.
- Handler gọi operation thật trong core.
- Thành công mới bump state và phát notification thành công.
- Thất bại không mutate state và đẩy message đã dịch vào hộp phản hồi.

Áp dụng trước cho:

- Cường Hóa, Tẩy Luyện, Tinh Luyện, Hóa Luyện.
- Luyện đan.
- Xây và nâng công trình.
- Nâng cấp/bắt đầu vùng sản xuất.
- Thu hoạch Linh Tuyền.
- Luyện Thể.
- Học và nâng node kỹ năng.
- Chọn ải.
- Đột phá và chế tác vật phẩm đột phá.

Không áp dụng nguyên tắc này cho nút điều hướng thuần túy như trang trước/trang sau khi không có trang tương ứng; các control đó có thể giữ semantics disabled thông thường.

### 4.3. Hộp phản hồi góc dưới phải

Tạo một panel “Nhật ký thao tác” dùng chung, tách khỏi toast loot đang nằm ở góc trên phải.

Hành vi đề xuất:

- Neo góc dưới phải, không che combat control hoặc modal.
- Hiện 3–5 message gần nhất.
- Message mới nhất nổi bật hơn.
- Gộp message giống nhau trong một khoảng ngắn và tăng bộ đếm.
- Cho phép thu gọn, mở lại và xóa lịch sử.
- Có tone thành công, cảnh báo và lỗi.
- Không persist vào save.
- Có `aria-live` phù hợp để hỗ trợ accessibility.

Ví dụ phản hồi:

- `Không thể Cường Hóa: thiếu 20 Linh Thạch (đang có 80/100).`
- `Không thể Tinh Luyện: cần chọn một trang bị có ít nhất một dòng phụ.`
- `Không thể nâng cấp Huyền Thiết Quảng: thiếu 3 Thanh Vân Mộc.`

### 4.4. Tiêu chí hoàn thành

- Mọi action gameplay luôn nhận click.
- Mỗi click thất bại trả ít nhất một lý do tiếng Việt cụ thể.
- Không click thất bại nào làm mất tài nguyên hoặc thay đổi item.
- Không còn `unknown`, `missing_spirit_stone`, `not_found` trong UI người chơi.

## 5. Workstream B — Chuẩn hóa nhãn và loại bỏ codename

Mức ưu tiên: P0.

Tạo các resolver trình bày dùng chung thay vì để component fallback trực tiếp về ID:

- `materialLabel(id)`
- `affixLabel(id)`
- `equipmentSlotLabel(slot)`
- `equipmentQualityLabel(quality)`
- `equipmentRarityLabel(rarity)`
- `realmLabel(realmId)`
- `actionFailureLabel(reason)`

Khí Đường cần sửa trước:

- Tinh Luyện dùng `affix.name` kết hợp `statLabel(affix.stat)`, không dùng `rolled.affixId`.
- Chi phí dùng tên từ `MaterialRegistry`, không hiện `materialId`.
- Danh sách Hóa Luyện dùng tên slot, Quality và Rarity tiếng Việt.
- Preview phần thưởng dùng tên nguyên liệu.
- Toast lỗi dùng reason mapper.

Sau đó rà toàn bộ Vue template và composable để tìm:

- Interpolation trực tiếp ID/enum.
- Fallback kiểu `registry.has(id) ? registry.get(id).name : id` trong UI production.
- Chuỗi tiếng Anh/codename như `Realm Passive`, `tier`, `quality`, `slot` nếu có nhãn tiếng Việt tương ứng.

Fallback ID chỉ được giữ trong log phát triển hoặc assertion chẩn đoán; UI người chơi dùng nhãn an toàn như “Dữ liệu không hợp lệ” nếu registry thật sự thiếu entry.

## 6. Workstream C — Màu Rarity/Quality theo từng segment

Mức ưu tiên: P0.

Mở rộng `EquipmentTooltipContent` để mang `nameSegments: NameSegment[]` thay vì chỉ có tên chuỗi phẳng.

`Tooltip.vue` render bằng cùng primitive đã dùng trong `SlotView` và toast loot:

- Segment Rarity dùng `--grade-{rarity}`.
- Segment tên vật phẩm dùng `--eq-quality-{quality}`.
- Bậc tối đa dùng gradient hiện có.
- Border/accent tổng thể vẫn có thể theo Quality.

Với ảnh tham chiếu:

- “Tiên” nhận màu Rarity Tiên.
- “Thanh Vân Hải Giày” nhận màu Quality của món.
- Không tô toàn bộ tiêu đề bằng một màu duy nhất.

Test cần phủ năm Rarity, chín Quality, gradient bậc tối đa và item thiếu zone name.

## 7. Workstream D — Ghim Linh Thạch vào ô đầu

Mức ưu tiên: P0.

Tạo comparator ghim riêng, chạy trước comparator sort thông thường và không đi qua `withDirection()`:

```text
Linh Thạch trước
    → sort theo mode/direction đã chọn
    → stable original index
```

Áp dụng cho:

- Default/reset.
- Phân loại.
- Niên đại.
- Số lượng.
- Tên.
- Nguồn chính.
- Cả asc và desc.

Thực hiện trước pagination để Linh Thạch luôn ở ô đầu trang 1.

## 8. Workstream E — Sửa quy tắc tên tài nguyên

Mức ưu tiên: P0.

Đổi generator linh thảo từ:

```ts
`${herb.name} ${HERB_AGE_LABELS[age]}`
```

thành:

```ts
`${HERB_AGE_LABELS[age]} ${herb.name}`
```

Ví dụ: `Thập Niên Tụ Linh Thảo`.

Rà thêm:

- Tên quáng dùng phẩm đứng trước tên quáng.
- Tên linh dược/linh thảo trong recipe, túi đồ, phần thưởng và Đan Phòng.
- Consumer đọc `material.name`, không tự ghép lại theo thứ tự khác.

Không đổi material ID và không thực hiện save migration.

## 9. Workstream F — Gỡ Quán Khí khỏi command wheel

Mức ưu tiên: P0.

Xóa slot `quan_khi` khỏi `COMMAND_WHEEL_SLOTS`.

Giữ nguyên:

- `QuanKhiPanel`.
- Standalone panel state cần cho Character Panel.
- Nút Quán Khí trong Character Panel, chỉ xuất hiện khi đạt điều kiện.
- Luồng chọn Pháp Tu/Kiếm Tu và đột phá liên quan.

Test xác nhận:

- Wheel không còn nút Quán Khí.
- Nút trong Character Panel vẫn mở đúng panel ở tầng phù hợp.
- Người chơi chưa đạt điều kiện không thể mở nghi lễ qua shortcut ngoài ngữ cảnh.

## 10. Workstream G — Responsive Left Panel

Mức ưu tiên: P0.

Thay chiến lược chỉ dùng `clamp(360px, 30vw, 480px)` bằng layout có breakpoint hoặc container query:

- Desktop lớn: panel giới hạn khoảng 480px.
- Desktop nhỏ: panel co theo viewport thật.
- Viewport rất hẹp: drawer gần/full width nhưng vẫn giữ lối đóng.
- Viewport thấp: header và action chính giữ được khả năng truy cập; nội dung chi tiết scroll.

Rà các layout con:

- Lưới bốn cột của Khí Đường.
- Card tối thiểu 220px của Sản Xuất.
- Inventory, paperdoll và sort/pagination.
- Character Panel.
- Các modal/panel có `min-width` cố định.

Ưu tiên responsive theo chiều rộng thật của container thay vì chỉ theo `window`.

Ma trận nghiệm thu:

- `800×600`
- `1024×576`
- `1280×720`
- `1280×800`
- `1366×768`
- `1920×1080`
- `2560×1440`

## 11. Workstream H — Căn unit Combat vào mặt đất

Mức ưu tiên: P0.

Không sửa bằng offset thủ công. Dùng một nguồn geometry chung:

```text
Combat insets
    → PerspectiveGeometry
    → horizonY / roadBottomY
    → grid, unit foot point, battle-ground art
```

Truyền geometry hoặc projection bounds vào backdrop để:

- Crop/scale layer theo tỉ lệ thiết kế thay vì kéo méo toàn màn hình.
- Căn layer battle-ground với `horizonY`.
- Neo chân unit vào đúng mặt đường sau mọi lần resize.
- Giữ background, foreground, grid và VFX cùng hệ tọa độ.

Thêm unit test cho geometry màn thấp/màn rộng, test resize scene và screenshot regression tại tối thiểu `800×600`, `1280×720`, `1920×1080`.

## 12. Workstream I — Rút gọn tooltip và nội dung diễn giải

Mức ưu tiên: P1.

Phân loại nội dung thành:

1. Luôn hiện: thông tin cần để quyết định thao tác ngay.
2. Tooltip ngắn: giải thích thuật ngữ trong một hoặc hai câu.
3. Advanced/Alt: range roll, tier pool, công thức hoặc số liệu chuyên sâu.
4. Ẩn hoàn toàn: codename, trọng số nội bộ và implementation detail.

Riêng ba vùng khai thác Thanh Vân, card mặc định chỉ giữ:

- Tên vùng.
- Cấp và tốc độ.
- Loại sản phẩm.
- Trạng thái/thời gian còn lại.
- Chi phí nâng cấp.
- Auto.

Ẩn khỏi card mặc định:

- Chuỗi diễn giải quy trình dài.
- Trọng số tier `60/20/10`, `40/40/20`, `20/40/40`.
- Mô tả trùng với tên/chức năng.
- Thông tin không giúp quyết định action hiện tại.

Rà toàn bộ `v-tooltip`, `description` và rich tooltip. Tránh lặp cùng một nội dung ở card, tooltip và label nút.

## 13. Thứ tự triển khai

1. Action availability, luồng click luôn mở và hộp phản hồi.
2. Label resolver và loại bỏ codename.
3. Màu name segment trong tooltip.
4. Ghim Linh Thạch.
5. Sửa tên tài nguyên.
6. Gỡ Quán Khí khỏi wheel.
7. Responsive Left Panel.
8. Geometry Combat.
9. Content/tooltip audit toàn game.

Các workstream nên được chia thành thay đổi tập trung, tránh gộp responsive Combat với refactor nội dung tooltip trong cùng một lượt triển khai.

## 14. Kế hoạch kiểm thử

### 14.1. Unit và component test

- Action thất bại luôn gọi handler nhưng không mutate state.
- Action thành công chỉ trừ tài nguyên đúng một lần.
- Reason code luôn map sang tiếng Việt.
- Khí Đường hiển thị requirement current/required đúng.
- Tooltip render màu từng segment đúng.
- Linh Thạch đứng đầu ở mọi mode/direction.
- Tên niên đại được ghép đúng thứ tự.
- Command wheel không render Quán Khí.
- Character Panel vẫn mở được QuanKhiPanel đúng điều kiện.
- Projection/backdrop dùng chung geometry sau resize.

### 14.2. Visual và E2E

- Chụp Left Panel và Combat Scene theo ma trận resolution.
- Kiểm tra unit foot point nằm trên mặt đường.
- Kiểm tra hộp phản hồi không che action chính, combat bar hoặc modal.
- Click từng action khi thiếu mỗi loại điều kiện và xác nhận message cụ thể.
- Click nhanh lặp lại và xác nhận không trừ tài nguyên, không spam message vô hạn.

### 14.3. Verification cuối

Chạy tại `game/`:

```powershell
npm.cmd test
npm.cmd run type-check
npm.cmd run build
npm.cmd run test:e2e
```

Mọi failure do implementation gây ra phải được sửa trước khi hoàn thành. Save migration không nằm trong phạm vi xác minh của đợt này.

## 15. Definition of Done

- Action gameplay không bị khóa vì điều kiện gameplay và luôn nhận click.
- Click không hợp lệ được core từ chối an toàn và UI giải thích chính xác.
- Không còn codename trong UI người chơi thuộc phạm vi đã rà.
- Rarity và Quality giữ màu riêng trong mọi context tên ghép.
- Linh Thạch luôn ở ô đầu sau sort.
- Tên niên đại đúng trật tự tiếng Việt.
- Command wheel không còn Quán Khí.
- Left Panel dùng được ở toàn bộ ma trận resolution.
- Unit Combat bám đúng mặt đất ở màn thấp và sau resize.
- Tooltip/card ngắn gọn, không lộ trọng số hoặc chi tiết nội bộ không cần thiết.
- Unit test, type-check, build và E2E đều đạt.




Not done — significant remaining scope:

Workstream A/B's other listed actions (buildings, production upgrades, Linh Tuyền harvest, Luyện Thể, skill nodes, stage select, breakthrough/item crafting) still use old disabled/toast patterns.
Workstream G's full audit (Character Panel, inventory pagination, remaining modals) beyond what I touched.
Workstream I (tooltip/content trim across the whole game, Thanh Vân exploration cards) not started.