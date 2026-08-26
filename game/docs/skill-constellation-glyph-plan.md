# Kế hoạch Skill Constellation dạng chữ Hán

## 1. Mục tiêu

Thay phần Node Tree dạng thẻ chữ nhật trong Skill Panel bằng bản đồ kỹ năng dạng chòm sao:

- Mỗi kỹ năng hoặc progression node là một điểm sáng có thể tương tác.
- Các điểm và đường nối tạo thành chữ Hán đại diện cho con đường đang xem.
- Pháp Tu dùng `火`, `木`, `水`, `金`, `土` cho năm hệ cơ bản.
- Kiếm Tu dùng `剑` và Thể Tu dùng `体` khi hai path có progression data phù hợp.
- Giữ nguyên logic mua node, prerequisite, Cảm Ngộ, modifier, save và combat hiện tại.
- Node Inspector tiếp tục là nơi hiển thị tên, mô tả, chi phí và điều kiện chi tiết.

Thiết kế học cấu trúc SVG/data-driven từ repo `zwelz3/constellation`, nhưng renderer được viết lại thành Vue 3 + TypeScript để tích hợp trực tiếp với game.

## 2. Hiện trạng đã xác nhận

### Pháp Tu

- `SkillPathPanel.vue` chỉ mở Node Tree khi `cultivationPath === 'phap_tu'`.
- `ElementPathList.vue` chọn một trong năm nhánh Ngũ Hành.
- `NodeTreePanel.vue` lấy node từ `nodeRegistry`, suy ra parent từ prerequisite và xếp node thành các hàng theo depth.
- `SkillConnections.vue` đo DOM rect rồi vẽ đường Bézier parent → child.
- `NodeInspector.vue` đã tách thao tác xem node khỏi thao tác mua node.
- Dữ liệu hiện có đủ để tạo glyph có mật độ rõ ràng:

| Nhánh | Chữ | Số progression node hiện tại |
|---|---:|---:|
| Hỏa | `火` | 11 |
| Mộc | `木` | 11 |
| Thủy | `水` | 11 |
| Kim | `金` | 11 |
| Thổ | `土` | 10 |

### Kiếm Tu

- Kiếm Tu hiện dùng kit cố định gồm ba skill.
- Skill Panel đang hiển thị danh sách skill và `SkillDetailView`, không dùng `ProgressionNode`.
- Ba skill không đủ tạo một glyph `剑` dễ đọc và cũng không có semantic mua node.

### Thể Tu

- Engine đã có một phần plumbing Momentum/Break và test liên quan.
- `CultivationPathId` chưa có `the_tu`; Thể Tu chưa phải path chơi được.
- Chưa có technique, skill kit và progression nodes chính thức để đưa vào Skill Panel.

## 3. Quyết định thiết kế

### 3.1. Dùng SVG 2D và tọa độ thủ công

- Không dùng force-directed layout vì vị trí node phải ổn định và tạo được chữ.
- Không dùng radial layout của repo tham chiếu cho glyph chính.
- Mỗi glyph khai báo `viewBox`, danh sách slot và danh sách nét riêng.
- Tọa độ gắn với `nodeId`, không gắn theo index mảng, để việc thêm/sắp xếp lại data không tráo vị trí node âm thầm.
- Renderer có fallback layout theo depth cho branch chưa có glyph config hoàn chỉnh.

### 3.2. Tách gameplay graph khỏi presentation graph

Có hai loại connection:

- `glyph`: nét trang trí tạo hình chữ, không phải điều kiện mở khóa.
- `prerequisite`: quan hệ gameplay thật từ `ProgressionNode.prerequisites`.

Quy tắc hiển thị:

- Nếu một nét glyph trùng prerequisite, chỉ render một path và dùng trạng thái gameplay.
- Nét glyph không phải prerequisite luôn mảnh và mờ hơn.
- Prerequisite không trùng nét glyph dùng nét đứt hoặc một lớp ánh sáng riêng.
- UI phải có chú giải ngắn để người chơi không hiểu mọi nét chữ là điều kiện mua node.

### 3.3. Dùng giản thể cho Kiếm và Thể

- Dùng `剑` và `体` cho renderer chính.
- `劍` và `體` có quá nhiều nét so với số node dự kiến, khó đọc ở kích thước panel.
- Tên tiếng Việt trong UI vẫn là Kiếm Tu và Thể Tu.

### 3.4. Node nhỏ, thông tin đặt ngoài bản đồ

- Minor node: đường kính mục tiêu 30–34px.
- Major/root node: đường kính mục tiêu 42–48px.
- Không đặt mô tả dài trong node.
- Tên ngắn chỉ hiện khi hover/focus hoặc khi node được chọn.
- Toàn bộ mô tả, chi phí và prerequisite tiếp tục hiển thị trong `NodeInspector`.

## 4. Data model đề xuất

Tạo file `src/data/progression/SkillConstellationLayouts.ts`:

```ts
export type SkillConstellationGlyphId =
  | 'fire'
  | 'wood'
  | 'water'
  | 'metal'
  | 'earth'
  | 'sword'
  | 'body'

export interface ConstellationPoint {
  nodeId: string
  x: number
  y: number
  emphasis?: 'normal' | 'major' | 'root'
  labelPlacement?: 'top' | 'right' | 'bottom' | 'left'
}

export interface ConstellationGlyphStroke {
  fromNodeId: string
  toNodeId: string
}

export interface SkillConstellationLayout {
  id: SkillConstellationGlyphId
  glyph: string
  viewBox: string
  points: ConstellationPoint[]
  strokes: ConstellationGlyphStroke[]
}
```

Không thêm tọa độ presentation vào `ProgressionNode`. Gameplay data và layout data phải thay đổi độc lập.

Validation thuần TypeScript cần kiểm tra:

- Không có `nodeId` trùng trong một layout.
- Mọi đầu mút của stroke tồn tại trong `points`.
- Mọi node trong branch được gán đúng một điểm.
- Layout không tham chiếu node ngoài branch tương ứng.
- Branch có node mới nhưng chưa có slot phải báo lỗi test thay vì âm thầm bỏ node.

## 5. Cấu trúc component

```text
SkillPathPanel.vue
├── ElementPathList.vue
├── SkillConstellationPanel.vue
│   ├── ConstellationBackdrop.vue
│   ├── ConstellationConnections.vue
│   └── ConstellationNode.vue
├── NodeInspector.vue
└── SkillLoadoutStrip.vue
```

### `SkillConstellationPanel.vue`

- Lấy node đã lọc theo `branchTag` từ registry.
- Ghép node runtime với tọa độ layout qua `nodeId`.
- Tính trạng thái `purchased`, `purchasable`, `locked`, `selected`, `unlocking`.
- Phát event `select` có contract tương thích với `NodeTreePanel` hiện tại.
- Nhận `unlockTrigger` để giữ nguyên luồng animation sau khi mua node.
- Quản lý `viewBox`, responsive scaling, keyboard navigation và fallback layout.

### `ConstellationConnections.vue`

- Vẽ path từ tọa độ SVG trực tiếp; không cần `getBoundingClientRect()` cho glyph mode.
- Render lớp nét glyph trước, lớp prerequisite sau.
- Hỗ trợ trạng thái `locked`, `available`, `active`, `unlocking`.
- Giữ animation `stroke-dashoffset` cho luồng mở khóa.
- Tôn trọng `prefers-reduced-motion`.

### `ConstellationNode.vue`

- Render bằng `<g>` kết hợp `<circle>` hoặc dùng SVG `foreignObject` chỉ khi thật sự cần.
- Có hit area tối thiểu khoảng 40px dù vòng tròn nhìn thấy nhỏ hơn.
- Dùng `role="button"`, `tabindex="0"`, `aria-label` đầy đủ.
- Enter/Space chọn node giống click.
- Không tự gọi `purchaseNode`; thao tác mua vẫn thuộc `NodeInspector`.

### `ConstellationBackdrop.vue`

- Vẽ chữ Hán rất mờ phía sau để tăng khả năng nhận diện hình.
- Dùng chính glyph character làm watermark, không dùng làm nguồn tọa độ.
- Có thể thêm nebula/particle tĩnh bằng CSS/SVG, không dùng animation nặng liên tục.

## 6. Quy tắc ánh xạ node vào glyph

### Nguyên tắc chung

1. Root node đặt tại giao điểm hoặc điểm thị giác quan trọng nhất của chữ.
2. Node Luyện Khí nằm trên các nét đầu/ngoài.
3. Hai Major Trúc Cơ loại trừ nhau nằm ở hai nhánh thị giác đối xứng hoặc tách biệt rõ.
4. Minor của từng Major tiếp tục nằm trên nét phát triển từ Major đó.
5. Node chỉ có realm prerequisite nhưng không có parent node đặt trên nét ngang hoặc giao điểm chung.
6. Cố gắng để prerequisite thật trùng với hướng phát triển của nét chữ.

### Hỏa `火`

- Root tại giao điểm trung tâm.
- Hai nhánh Major Trúc Cơ đi xuống trái/phải.
- Các minor chung và minor Luyện Khí tạo hai chấm trên cùng cùng nét dọc giữa.
- Minor theo specialization kéo dài hai chân chữ Hỏa.

### Mộc `木`

- Root tại giao điểm nét ngang và nét dọc.
- Minor chung tạo trục dọc/ngang.
- Hai specialization đi chéo xuống trái/phải.

### Thủy `水`

- Root gần trung tâm.
- Các node Luyện Khí tạo chấm/nét trái và nét móc trung tâm.
- Hai specialization phát triển sang hai phía dưới.

### Kim `金`

- Root ở đỉnh hoặc tâm trên.
- Major specialization nằm trên hai nét xiên chính.
- Minor tạo cấu trúc chữ phía dưới; cần ưu tiên độ rõ vì `金` nhiều nét hơn ba chữ trên.

### Thổ `土`

- Root ở giao điểm trung tâm.
- Hai nét ngang cần chia thành nhiều segment vì branch có 10 node.
- Hai Major specialization đặt ở hai đầu nét ngang dưới hoặc hai phía của trục.

### Kiếm `剑`

- Chưa kích hoạt trong production cho đến khi có progression nodes thật.
- Layout config có thể được chuẩn bị sau khi chốt số node và prerequisite của Kiếm Tu.
- Không dùng ba active skill hiện tại làm ba progression node giả.

### Thể `体`

- Chỉ triển khai sau khi `the_tu` được thêm chính thức vào path kit.
- Glyph config phải được author cùng lúc với progression nodes để tránh UI đi trước gameplay.

## 7. Trạng thái hình ảnh

| Trạng thái | Node | Connection |
|---|---|---|
| Locked | tối, giảm opacity, viền mảnh | nét glyph mờ; prerequisite mờ/đứt |
| Purchasable | pulse rất nhẹ hoặc halo | prerequisite dẫn vào node sáng vừa |
| Purchased | tô màu theo hệ, glow ổn định | đường đã kích hoạt sáng rõ |
| Selected | vòng ngoài màu vàng | các đường liên quan tăng opacity |
| Unlocking | scale/pulse ngắn | năng lượng chạy parent → child |
| Excluded | ký hiệu khóa riêng | nhánh loại trừ giảm opacity rõ ràng |

Màu lấy từ `ELEMENT_COLOR_VARS`. Không hard-code lại palette Ngũ Hành trong component.

## 8. Interaction và accessibility

- Click node luôn chọn để xem, kể cả locked node.
- Chỉ nút `Lĩnh Ngộ` trong `NodeInspector` thực hiện mua.
- Hover/focus hiển thị tên node và trạng thái ngắn.
- Keyboard navigation ban đầu theo thứ tự stroke/layout khai báo; có thể nâng cấp sang điều hướng không gian sau.
- Focus ring không phụ thuộc màu nguyên tố.
- Không dùng màu làm tín hiệu duy nhất cho locked/purchased/excluded.
- `prefers-reduced-motion` tắt flow/pulse nhưng vẫn cập nhật trạng thái tức thời.

## 9. Responsive layout

### Desktop

- Giữ bố cục ba cột hiện tại.
- Cột giữa dành phần lớn diện tích cho SVG.
- Inspector vẫn ở dưới panel.

### Màn hình hẹp

- Cho phép SVG co theo `viewBox` trước khi thêm pan/zoom.
- Node không được nhỏ hơn hit target tối thiểu.
- Nếu không đủ chỗ, chuyển Skill Loadout xuống dưới thay vì bóp glyph.
- Không triển khai zoom tự do ở phase đầu nếu năm glyph vẫn vừa panel.

### Màn hình rất nhỏ

- Cho phép pan có giới hạn trong SVG container.
- Tooltip chuyển thành tap-to-select và đọc thông tin trong Inspector.

## 10. Tích hợp repo tham chiếu và giấy phép

Repo `zwelz3/constellation` dùng MIT License. Có thể port các phần phù hợp nhưng phải tránh kéo nguyên ứng dụng single-file vào game.

Có thể học hoặc port có chọn lọc:

- Phân lớp SVG edges/nodes/labels.
- Glow, halo, progress ring và animation stroke.
- Cách giữ layout ổn định và ưu tiên tọa độ hand-authored.
- Kỹ thuật responsive SVG/viewBox.

Không port:

- Radial `normalize()` làm layout chính.
- `localStorage`, XP/progress và editor riêng của Constellation.
- DOM renderer `buildScene()` nguyên trạng.
- Obsidian, journal, resource index và data authoring UI.

Nếu sao chép phần code đáng kể, thêm `THIRD_PARTY_NOTICES.md` và giữ MIT notice. Pin tài liệu tham chiếu theo revision đã phân tích:

```text
fad6627cf8046bde02fa28f72fedf334bb64763d
```

## 11. Các phase triển khai

### Phase 0 — Chốt wireframe và glyph coordinates

- Vẽ tọa độ nháp cho `火 木 水 金 土` trong cùng một `viewBox` chuẩn.
- Ánh xạ toàn bộ node ID hiện tại vào từng glyph.
- Review khả năng đọc chữ ở kích thước panel thật.
- Chốt style phân biệt glyph edge và prerequisite edge.

Điều kiện hoàn thành:

- Mỗi node Pháp Tu có đúng một slot.
- Cả năm chữ nhận diện được khi chỉ nhìn điểm và đường nối.
- Hai nhánh specialization của mỗi hệ không gây hiểu nhầm.

### Phase 1 — Data contract và validation

- Thêm typed layout definitions.
- Thêm helper lấy layout theo branch.
- Thêm unit test integrity cho point/stroke/node mapping.
- Không thay đổi `ProgressionNode` và save schema.

### Phase 2 — SVG renderer dùng chung

- Tạo `SkillConstellationPanel`, `ConstellationConnections`, `ConstellationNode`.
- Port có chọn lọc glow/halo/stroke animation phù hợp.
- Giữ contract `select` và `unlockTrigger` hiện tại.
- Thêm fallback layout để lỗi config không làm panel trắng.

### Phase 3 — Tích hợp năm hệ Pháp Tu

- Thay `NodeTreePanel` bằng constellation renderer tại nhánh Pháp Tu.
- Giữ `ElementPathList`, `NodeInspector`, `SkillLoadoutStrip`.
- Kiểm tra mua node, excluded node, realm prerequisite và refresh state.
- Có thể giữ `NodeTreePanel` cũ tạm thời làm fallback trong phase chuyển đổi.

### Phase 4 — Polish và responsive

- Hoàn thiện selected/available/locked/unlocking visuals.
- Thêm watermark chữ, chú giải connection và tooltip.
- Kiểm tra desktop, cửa sổ Electron hẹp và màn hình cảm ứng.
- Kiểm tra reduced motion và keyboard interaction.

### Phase 5 — Kiếm Tu

Chỉ bắt đầu sau khi có thiết kế progression Kiếm Tu:

- Định nghĩa progression nodes và prerequisite Kiếm Tu trên hạ tầng `ProgressionNode` chung.
- Chốt số node phù hợp với `剑`.
- Tạo layout `sword` và thay danh sách ba skill bằng constellation khi data sẵn sàng.
- Việc chuyển ba skill kit hiện tại thành node phải là quyết định gameplay riêng, không nằm trong refactor UI Pháp Tu.

### Phase 6 — Thể Tu

Chỉ bắt đầu sau khi Thể Tu trở thành path chính thức:

- Mở rộng `CultivationPathId` với `the_tu`.
- Thêm technique, skill kit, progression data, save handling và combat HUD tương ứng.
- Tạo layout `body` theo `体`.
- Bổ sung migration/versioning nếu production save đã tồn tại.

## 12. Danh sách file dự kiến

### File mới

- `src/data/progression/SkillConstellationLayouts.ts`
- `src/data/progression/SkillConstellationLayouts.test.ts`
- `src/components/panels/skill-constellation/SkillConstellationPanel.vue`
- `src/components/panels/skill-constellation/ConstellationConnections.vue`
- `src/components/panels/skill-constellation/ConstellationNode.vue`
- `src/components/panels/skill-constellation/ConstellationBackdrop.vue`
- `THIRD_PARTY_NOTICES.md` nếu port code đáng kể từ repo tham chiếu.

### File sửa trong phase Pháp Tu

- `src/components/panels/SkillPathPanel.vue`
- Có thể giữ hoặc thu hẹp trách nhiệm của `src/components/panels/loadout-sections/NodeTreePanel.vue`.
- Có thể tái sử dụng hoặc thay thế `src/components/panels/loadout-sections/SkillConnections.vue`.
- CSS/theme chỉ sửa nếu cần token chung; không đổi toàn bộ theme.

### Không sửa trong phase UI

- `src/data/progression/PhapTuNodes.ts`.
- `src/core/progression/NodeSystem.ts`.
- Save schema/version.
- Combat skill execution.

## 13. Kiểm thử bắt buộc

### Unit

- Layout không có point ID trùng.
- Stroke không tham chiếu point không tồn tại.
- Mọi node trong từng nhánh Pháp Tu xuất hiện đúng một lần.
- Không có node từ branch khác lọt vào layout.
- Prerequisite connections được suy ra đúng, gồm `node`, `realm` và `excludesNode` theo presentation tương ứng.

### Component

- Render đúng glyph khi đổi Hỏa/Mộc/Thủy/Kim/Thổ.
- Click locked node vẫn phát event chọn.
- Selected state cập nhật khi đổi node.
- Purchased/purchasable cập nhật sau khi Player state thay đổi.
- `unlockTrigger` chạy connection trước rồi pulse node.
- Reduced motion không chạy animation dài.
- Keyboard Enter/Space chọn được node.

### Integration

- Mua node vẫn trừ đúng Cảm Ngộ một lần.
- Prerequisite và exclusion giữ nguyên hành vi.
- Node vừa mua cập nhật Inspector và glyph ngay lập tức.
- Đổi hệ xóa selection cũ như hiện tại.
- Save/load giữ nguyên purchased node IDs và không cần migration.

### Visual QA

- Năm chữ nhận diện được ở kích thước panel thực.
- Node label không che nhau.
- Connection không đi xuyên qua hit area gây rối.
- Màu locked/available/purchased đủ tương phản.
- Panel không tràn ở các kích thước viewport chính.

### Verification cuối mỗi phase code

```text
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

Chạy thêm E2E liên quan nếu thay đổi interaction hoặc responsive behavior.

## 14. Tiêu chí nghiệm thu Phase Pháp Tu

- Skill Panel hiển thị node dưới dạng điểm, không còn card chứa đầy đủ mô tả.
- Mỗi nhánh tạo được đúng chữ `火`, `木`, `水`, `金`, `土`.
- Chọn, xem điều kiện và mua node hoạt động như trước.
- Người chơi phân biệt được nét tạo chữ và prerequisite gameplay.
- Unlock animation chạy dọc connection rồi mới pulse node.
- Không đổi save schema và không làm mất tiến trình cũ.
- Không thêm dependency mới.
- Test, type-check và build đều qua.

## 15. Ngoài phạm vi Phase Pháp Tu

- Thiết kế progression gameplay mới cho Kiếm Tu.
- Phát hành Thể Tu.
- Thay đổi balance hoặc effect của node hiện có.
- Editor kéo-thả tọa độ glyph trong game.
- Force-directed/radial auto-layout toàn bộ skill graph.
- Đồng bộ dataset với Obsidian hoặc hệ thống authoring của repo tham chiếu.

## 16. Rủi ro và biện pháp

### Nét chữ gây hiểu nhầm prerequisite

- Dùng hai style connection rõ ràng và chú giải.
- Ưu tiên ánh xạ prerequisite trùng nét glyph khi author layout.

### Thêm node mới làm hỏng chữ

- Test bắt buộc mọi node phải có slot.
- Layout thay đổi cùng pull request thêm progression node.

### Node quá nhỏ hoặc khó click

- Tách visual radius khỏi hit radius.
- Kiểm tra pointer coarse và keyboard focus.

### Chữ Kim/Kiếm/Thể quá phức tạp

- Dùng dạng giản thể và glyph cách điệu.
- Không cố tái tạo đầy đủ nét font nếu số node không đủ.

### Animation làm giảm hiệu năng

- Chỉ animation khi chọn/mở khóa, không chạy particle liên tục trên mọi node.
- Ưu tiên CSS/SVG transform và stroke-dashoffset.
- Tắt filter/glow nặng khi đang resize/pan hoặc reduced motion.

## 17. Việc cần chốt trước khi code

- Chọn phong cách chữ: khải thư rõ nét hay triện thư cách điệu.
- Xác nhận dùng `剑`/`体` thay cho `劍`/`體`.
- Chốt nét glyph trang trí có luôn hiển thị hay chỉ hiện khi node liên quan được mở.
- Chốt có giữ `NodeTreePanel` cũ làm fallback/debug trong một phase hay thay ngay.
- Kiếm Tu sẽ có progression nodes mua bằng Cảm Ngộ hay giữ bộ ba skill cố định.
- Thể Tu dự kiến có bao nhiêu node để author glyph `体` đúng từ đầu.

