# Tooltip / Item Inspect Revamp Plan

## 1. Mục tiêu

Xây lại tooltip thành một hệ thống `Item Inspect Card` thống nhất cho Equipment, Material, Pill, Talisman, Formation và Technique. Floating UI chỉ phụ trách định vị; Vue/TypeScript phụ trách nội dung; CSS và theme token phụ trách toàn bộ phần nhìn. Asset mới duy nhất được yêu cầu là PNG icon của từng item.

Hệ thống hoàn tất phải:

- Không tràn viewport, tự đổi hướng và bám đúng slot khi scroll/resize.
- Không chạy theo con trỏ đối với rich item tooltip.
- Thể hiện rõ hai trục độc lập của Equipment: Quality và Rarity/Phẩm.
- Phân biệt dữ liệu thuộc item với đầu tư thuộc equipment slot.
- Có equipment comparison theo semantic tone.
- Hỗ trợ tooltip chữ cũ mà không gây regression.
- Có keyboard focus, Escape-to-close, `role="tooltip"` và `aria-describedby`.
- Không cần PNG nền, frame hoặc badge mới; mọi trang trí ngoài item icon dùng CSS.

## 2. Nguyên tắc kiến trúc

Luồng dữ liệu chuẩn:

```text
Domain template / instance / stack / slot state
                    ↓
              Tooltip builder
                    ↓
          Semantic tooltip view model
                    ↓
       TooltipHost + presentational components
                    ↓
            CSS theme + Floating UI
```

- Builder đọc domain data, registry và formatter; builder quyết định section, label và semantic tone.
- Renderer không đọc registry, không tính stat và không biết `EquipmentSystem`.
- Không dùng HTML string hoặc `v-html`.
- Không lưu presentation state vào item/slot/save data.
- `PlainTooltipContent` được giữ tương thích trong giai đoạn migration.

## 3. Dependency

Thêm `@floating-ui/vue`, chỉ dùng làm positioning engine.

Middleware dự kiến:

```ts
[
  offset(10),
  flip({ fallbackPlacements: ['left-start', 'top-start', 'bottom-start'] }),
  shift({ padding: 12 }),
  size({ padding: 12 }),
]
```

Placement mặc định của item card là `right-start`; `autoUpdate` giữ card bám anchor khi scroll, resize hoặc layout đổi.

## 4. Semantic view model

```ts
type TooltipKind =
  | 'plain'
  | 'equipment'
  | 'material'
  | 'pill'
  | 'talisman'
  | 'formation'
  | 'technique'
  | 'building'

type TooltipTone =
  | 'default'
  | 'muted'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'accent'
  | 'special'

interface TooltipBadge {
  text: string
  tone?: TooltipTone
}

interface TooltipRow {
  id: string
  label: string
  value?: string
  detail?: string
  tone?: TooltipTone
  valueTone?: TooltipTone
  emphasis?: 'normal' | 'strong'
}

interface TooltipSection {
  id: string
  title?: string
  badge?: string
  rows: TooltipRow[]
  tone?: TooltipTone
}

interface RichTooltipContent {
  kind: Exclude<TooltipKind, 'plain'>
  header: {
    title: string
    iconPath?: string
    eyebrow?: string
    badges?: TooltipBadge[]
    qualityKey?: string
  }
  description?: string
  sections: TooltipSection[]
  footer?: { hint?: string; note?: string }
  density?: 'standard' | 'detailed'
}
```

Không giữ value như một chuỗi thiếu ngữ nghĩa khi UI cần biết positive/negative/warning. Tone được quyết định tại builder, không suy ngược bằng CSS.

## 5. Layout chung

### Header

- Icon vuông 56 x 56, nền trong suốt.
- Tên là điểm nhấn chính; màu tên và accent lấy từ Quality khi có.
- Badge metadata thể hiện item type, Phẩm, Quality và trạng thái `Đang trang bị`.
- Quality điều khiển accent/glow; Phẩm là badge riêng để hai trục không nhập nhằng.
- Icon thiếu hoặc lỗi dùng fallback CSS/monogram, không request placeholder 404.

### Description

- Nội dung dễ đọc, xuống dòng tự nhiên.
- Lore dài nằm sau header và trước stat sections.

### Sections

- Heading nhỏ, divider mảnh.
- Row hai cột label/value; cho phép `detail` ở dòng phụ.
- Empty section không render.

### Footer

- Context action do caller cung cấp: trang bị, tháo, sử dụng, chọn.
- Note giải thích luật quan trọng, ví dụ đầu tư được giữ theo equipment slot.

### Density

- `compact`: tooltip chữ/resource/nút.
- `standard`: Material/Pill/Talisman/Formation/Technique.
- `detailed`: Equipment và comparison.

Chiều rộng mục tiêu: compact 240px, standard 320px, detailed 380px. Max height là viewport trừ 24px; body được scroll nếu thực sự cần.

## 6. Layout theo item type

### Equipment

1. Header: icon, tên ghép, slot, Quality, Phẩm, trạng thái equipped.
2. Mô tả.
3. Main stat và thiên hướng slot.
4. Comparison khi hover item trong bag và slot tương ứng đang có equipment.
5. Affix: prefix/suffix, tier, capacity và ô chưa mở.
6. Rèn: forge points và forge potential/cap cần thiết cho quyết định.
7. Đầu tư vị trí: enhance, formation, talisman; chỉ hiện khi item đang mặc.
8. Footer action.

`Thiên hướng` không còn là một section đơn độc. Main-stat roll và template range được tách thành các row dễ đọc.

Comparison dùng một card, không mở card thứ hai. Delta có tone positive/negative/muted; builder xử lý trường hợp stat mất hoàn toàn, stat mới xuất hiện và stat không đổi.

### Pill

1. Header + Phẩm + owned count.
2. Mô tả.
3. Hiệu ứng tức thời.
4. Hiệu ứng vĩnh viễn.
5. Buff có thời hạn, tách value và duration.
6. Điều kiện/giới hạn nếu domain có dữ liệu.
7. Footer sử dụng.

### Talisman

1. Header + Phẩm + owned count.
2. Mô tả.
3. Công dụng và số ô Affix mở thêm.
4. Đối tượng áp dụng, khả năng cộng dồn và trần nếu hệ thống có dữ liệu.
5. Footer chọn mục tiêu.

### Formation

1. Header + Phẩm + owned count.
2. Mô tả.
3. Trigger.
4. Mỗi stack, max stacks và tổng tối đa ở các row riêng.
5. Footer socket/select.

### Technique

1. Header + nguyên tố/hệ + tier hiện tại.
2. Mô tả.
3. Chiến Đấu.
4. Tu Luyện.
5. Đột Phá.
6. Tiến độ nếu context cần.

Tiếp tục tái sử dụng logic từ `buildTechniqueSections`, nhưng adapter về view model chung.

### Material

1. Header + category + owned count.
2. Mô tả.
3. Niên đại/nguyên tố nếu có.
4. Nguồn chính.
5. `Dùng để` chỉ khi có thể suy từ recipe index thật; không bịa dữ liệu.

Material được bổ sung `icon?: string` trên template. Đây không phải player state và không yêu cầu save migration.

## 7. Interaction và accessibility

- Rich tooltip neo vào owner element thay vì bám `mousemove`.
- Show delay 120–180ms; chuyển nhanh từ slot A sang B không lặp delay.
- Hide delay khoảng 60ms để tránh flicker; owner unmount đóng ngay.
- Đóng khi Escape, đổi panel/tab hoặc window mất focus.
- Hỗ trợ pointer enter/leave và focus in/out.
- Tooltip có ID ổn định, `role="tooltip"`; owner chỉ nhận `aria-describedby` khi mở.
- Transition: opacity + translate 4px + scale rất nhẹ, khoảng 120ms; tôn trọng `prefers-reduced-motion`.
- Tooltip không interactive ở phase đầu (`pointer-events: none`); action vẫn thuộc owner/context UI.

## 8. Component structure

```text
src/components/common/tooltip/
├── TooltipHost.vue
├── TooltipCard.vue
├── TooltipHeader.vue
├── TooltipSection.vue
├── TooltipRow.vue
└── PlainTooltip.vue

src/composables/tooltips/
├── buildEquipmentTooltip.ts
├── buildMaterialTooltip.ts
├── buildPillTooltip.ts
├── buildTalismanTooltip.ts
├── buildFormationTooltip.ts
├── buildTechniqueTooltip.ts
└── tooltipFormatters.ts
```

- `TooltipHost`: Teleport, transition, Floating UI và lifecycle.
- Các component còn lại thuần presentation.
- Builder đang nằm trong Bag Section được chuyển ra file riêng.

## 9. CSS và theme

Thêm token vào `src/assets/theme.css`, không hardcode màu rải rác:

```css
--tooltip-bg: ...;
--tooltip-bg-raised: ...;
--tooltip-border: ...;
--tooltip-divider: ...;
--tooltip-text: ...;
--tooltip-text-muted: ...;
--tooltip-positive: ...;
--tooltip-negative: ...;
--tooltip-warning: ...;
--tooltip-shadow: ...;
```

Card dùng layered gradients, border, box shadow và pseudo-elements để có phong cách linh bảng/ngọc giản. Không dùng ảnh nền tooltip. Không blur cả card. Quality được map qua `--tooltip-accent`; Phẩm hiển thị bằng badge.

## 10. Quy ước PNG icon item

```text
public/assets/items/
├── equipment/
├── materials/
├── pills/
├── talismans/
├── formations/
└── techniques/
```

- Tên file theo item ID.
- Tỉ lệ 1:1, nền trong suốt, khuyến nghị 256 hoặc 512px.
- Chủ thể nằm trong safe area 80–86%.
- Không nhúng frame, quality glow, số lượng hoặc chữ vào ảnh.
- Item template giữ đường dẫn trong field `icon?: string`; equipment instance có thể override bằng icon được roll từ `iconPool`.

## 11. Phases triển khai

### Phase 1 — Foundation

- Inventory tất cả consumer của `v-tooltip`.
- Thêm regression tests cho state/directive hiện tại.
- Thêm Floating UI.
- Chuyển state từ cursor coordinates sang owner/reference element.
- Giữ tương thích tooltip string/plain.

### Phase 2 — Unified model và builders

- Thêm semantic view model và adapter tạm cho rich model cũ.
- Tách builder cho từng item type.
- Thêm Material builder và `Material.icon?`.
- Chuẩn hóa formatter, row ID và semantic tone.

### Phase 3 — Renderer và CSS

- Tạo TooltipHost/Card/Header/Section/Row/Plain.
- Thêm theme tokens, density, quality accent, responsive size và fallback icon.
- Không đổi gameplay logic.

### Phase 4 — Equipment UX

- Xây hierarchy mới.
- Làm rõ Quality/Phẩm.
- Hoàn thiện affix capacity, forge và slot-investment sections.
- Hoàn thiện automatic comparison.

### Phase 5 — Các item còn lại

- Migrate Pill, Talisman, Formation, Technique và Material.
- Chuẩn hóa owned count, action hints và text dài tiếng Việt.

### Phase 6 — Accessibility/polish

- Keyboard focus, ARIA, Escape, delay, fast switching và cleanup.
- Kiểm tra resize, scroll và browser zoom.

### Phase 7 — Cleanup

- Xóa rich model/CSS/position state cũ sau migration.
- Cập nhật comment và asset constant lỗi thời.
- Xóa `TOOLTIP_BACKDROP_PATH` nếu không còn consumer.

## 12. Tests và verification

### Unit tests

- Equipment trong bag không hiện slot investment.
- Equipment equipped hiện đúng enhance/formation/talisman.
- Comparison trả đúng delta và tone.
- Affix capacity đúng theo rarity và bonus slot.
- Pill phân loại effect đúng.
- Formation tính đúng per-stack/max-stack/total.
- Material không icon vẫn build được.
- Không render empty section hoặc chuỗi `NaN`/`undefined`.
- Owner A không đóng tooltip của owner B; unmount và delay cleanup đúng.

### Component/integration tests

- Plain và rich tooltip render đúng.
- Icon error dùng fallback.
- Tone và Quality map đúng CSS/data attributes.
- Long title không phá layout.
- Reference element và floating styles được nối đúng.
- ARIA được gắn/gỡ theo open state.

### Visual QA

- Slot ở bốn góc viewport.
- Equipment dài nhất và comparison nhiều stat nhất.
- Không icon/icon lỗi/icon hợp lệ.
- Quality thấp nhất/cao nhất.
- Viewport hẹp và browser zoom 80–200%.
- Nội dung tiếng Việt dài và có dấu.

Sau mỗi phase lớn chạy:

```bash
npm.cmd test
npm.cmd run type-check
npm.cmd run build
```

## 13. Tiêu chí nghiệm thu

- Không tooltip nào tràn viewport hoặc rung theo chuột.
- Equipment bag tự so sánh với đúng slot đang mặc.
- Quality và Phẩm phân biệt được ngay từ header.
- Dữ liệu item và đầu tư slot không bị trộn lẫn.
- Mọi item category có structured tooltip.
- Material hỗ trợ PNG icon; thiếu icon không vỡ layout.
- Plain tooltip không regression.
- Hover và keyboard focus đều hoạt động.
- Không hardcode theme rải rác và không dùng asset ngoài item icon.
- Tests, type-check và build đều qua.

## 14. Ràng buộc triển khai

- Không thay đổi save format chỉ để phục vụ tooltip.
- Không đưa computed presentation fields vào domain item/slot state.
- Không thay đổi EquipmentSystem, crafting hoặc loot nếu tooltip chỉ cần đọc dữ liệu.
- Bất kỳ dữ liệu mới nào như recipe usage index phải được suy từ registry/data hiện có, không được duplicate bằng authoring thủ công.
- Thực hiện theo thứ tự Foundation → Model → Renderer/CSS → Equipment → các item khác → Accessibility/Cleanup.

## 15. Quyết định equipment bổ sung (2026-08-22)

- `smelt/disassemble` có nghĩa là **Phân Giải**: nhận một `EquipmentInstance` chưa trang bị, xóa instance và trả Bụi Cốt. Nó không tạo equipment mới, không tiêu Linh Thiết và không tiêu Linh Thạch.
- Quality lúc tạo instance bị gate theo đại cảnh giới. Phàm Nhân chỉ roll Phàm Khí; các cảnh giới sau mở thêm bậc và phân phối dịch dần lên trên. Không roll toàn bộ 9 bậc bằng một bảng global.
- Equipment Rarity hiển thị bằng đúng năm nhãn `Hoàng / Huyền / Địa / Thiên / Tiên`; giữ ID nội bộ hiện tại nếu cần tương thích save.
- Affix Prefix/Suffix không bao giờ được ghép vào tên equipment. Tên affix phải tự nhiên khi đứng độc lập trong danh sách chỉ số; bỏ kiểu `Của Nhanh Nhẹn`.
- Tier Affix ưu tiên biểu đạt bằng màu. Năm tier ánh xạ lên các bậc `1–3–5–7–9` của thang màu chuẩn. Chữ số La Mã chỉ được giữ ở nơi cần accessibility/tooltip chi tiết, không lặp trong row chính.
- Hoàng dùng màu bậc 1; Tiên dùng hiệu ứng bảy màu bậc 9 có fallback sáng rõ. Các nhãn Quality, Rarity và Affix tier đều có semantic color riêng, không chỉ là text phẳng.

## 16. Thang màu phẩm chất thống nhất (2026-08-23)

Mọi hệ thống dùng chung một thang chuẩn 9 bậc:

```text
1 Xám → 2 Bạc/Trắng → 3 Lục → 4 Thanh → 5 Lam
→ 6 Tím → 7 Kim → 8 Xích → 9 Bảy màu
```

- Equipment Quality có 9 bậc nên ánh xạ 1:1.
- Hệ 5 bậc như Equipment Rarity, Phẩm và Affix Tier ánh xạ đều vào `1–3–5–7–9`.
- Hệ có số bậc khác phải chuẩn hóa đều hai đầu thang 1–9, không tạo palette độc lập.
- Bậc 9 dùng màu sáng làm fallback cho border/shadow và gradient bảy màu cho text/badge khi CSS hỗ trợ.

## 17. Slot Revamp — CSS-only presentation (2026-08-23)

### 17.1. Mục tiêu và ranh giới asset

`SlotView` trở thành primitive hiển thị chung cho Equipment, Material, Pill,
Talisman, Formation, Technique và các ô chọn mục tiêu. Người thêm nội dung chỉ
cần cung cấp PNG icon trong suốt của item và dữ liệu domain sẵn có.

- PNG được phép: duy nhất artwork/icon của item.
- CSS phụ trách: nền, backdrop, frame, viền, góc trang trí, glow, hover, focus,
  selected, quality, rarity, amount, caption, lock, disabled, processing và marker.
- Loại bỏ phụ thuộc runtime của Slot vào `SLOT_ASSETS.backdrop`,
  `SLOT_ASSETS.frame`, `SLOT_ASSETS.hoverFrame`, `QUALITY_FRAME_PATHS`,
  `QUALITY_BACKDROP_PATHS` và `PHAM_FRAME_PATHS`.
- Không nhúng frame, nền, badge, chữ, số lượng hoặc glow vào PNG item.
- Không thêm dependency UI mới; CSS, Vue và TypeScript hiện tại là đủ.
- Không thêm presentation state vào save data hoặc equipment instance.

### 17.2. State model phân tầng

Không dùng một danh sách boolean độc lập có thể mâu thuẫn. Slot nhận các trục
semantic loại trừ lẫn nhau:

```ts
type SlotAvailability = 'available' | 'disabled' | 'locked'
type SlotInteraction = 'idle' | 'selected' | 'processing'
type SlotValidation = 'neutral' | 'valid' | 'invalid' | 'missing'
type SlotMarker = 'none' | 'equipped' | 'new'
type SlotComparison = 'neutral' | 'upgrade' | 'downgrade'

interface SlotPresentationState {
  availability?: SlotAvailability
  interaction?: SlotInteraction
  validation?: SlotValidation
  marker?: SlotMarker
  comparison?: SlotComparison
}
```

`hover`, `focus-visible`, `pressed` và lỗi tải ảnh là trạng thái DOM cục bộ,
không phải prop/domain state. `filled/empty` được suy từ `item`; không truyền
thêm boolean `hasItem`.

Quy tắc ưu tiên:

1. `locked` chặn interaction và validation.
2. `disabled` chặn click nhưng vẫn cho tooltip giải thích.
3. `processing` chặn click, giữ nguyên nhận diện Quality/Rarity.
4. `selected` thắng hover nhưng không che validation.
5. `valid/invalid/missing` chỉ xuất hiện trong một workflow chọn mục tiêu.
6. `equipped/new` là marker nhỏ, không thay đổi màu nền toàn slot.
7. `upgrade/downgrade` là chỉ báo comparison nhỏ, không dùng làm màu Quality.

### 17.3. Layer contract

Thứ tự render cố định từ thấp lên cao:

```text
0  CSS base surface/backdrop
1  CSS Quality tint/aura
2  PNG item icon hoặc CSS monogram fallback
3  CSS Quality frame
4  CSS validation overlay
5  CSS hover/focus/selected overlay
6  Rarity, equipped/new, comparison, enhance badges
7  amount và caption
8  locked/disabled/processing veil + status glyph
```

Mỗi layer dùng pseudo-element hoặc element semantic nhỏ. Không dùng ảnh trang
trí. `pointer-events: none` cho mọi layer ngoại trừ chính button.

### 17.4. Ngôn ngữ hình ảnh

- Quality 9 bậc map 1:1 vào `--rank-color-1` đến `--rank-color-9`; điều khiển
  viền, tint nền và glow. Bậc cao tăng độ tinh xảo/glow, không tăng độ dày khung
  tới mức làm thay đổi kích thước layout.
- Rarity 5 bậc map `1–3–5–7–9`, hiển thị bằng badge góc nhỏ dạng CSS; không
  dùng thêm một frame lớn cạnh tranh với Quality.
- Bậc 9 dùng `--rank-gradient-9` ở viền/badge phù hợp và có solid-color fallback.
- Empty slot dùng bề mặt trung tính, outline nét đứt nhẹ và glyph loại slot nếu
  caller cung cấp; không dùng màu Quality.
- Hover nâng sáng và dịch icon tối đa 1–2px. Selected dùng vòng focus vàng rõ.
- Locked làm tối có kiểm soát và dùng icon khóa CSS/SVG nội tuyến hiện có;
  tooltip phải nói rõ điều kiện mở.
- Disabled giảm contrast; không dùng biểu tượng khóa để tránh sai nghĩa.
- Processing dùng veil + spinner CSS và tôn trọng `prefers-reduced-motion`.
- Valid/upgrade dùng jade; invalid/missing/downgrade dùng crimson nhưng luôn có
  glyph/shape để không phụ thuộc riêng vào màu.
- Caption một dòng ellipsis ở grid nhỏ; context rộng có thể cho phép hai dòng.

### 17.5. API dự kiến của SlotView

```ts
interface SlotViewProps<T> {
  item: T | null
  icon?: string
  label?: string
  amount?: number
  qualityRank?: number
  rarityRank?: number
  state?: SlotPresentationState
  badges?: readonly SlotBadge[]
  tooltip?: TooltipContent
  accessibleLabel?: string
}
```

- Ưu tiên rank chuẩn hóa thay vì để renderer biết ID domain như `pham_khi`.
- Adapter tại Equipment/Bag/Paperdoll chuyển domain data thành rank và state.
- Badge có semantic kind (`enhance`, `equipped`, `new`, `comparison`) thay vì
  để từng panel tự absolute-position bên ngoài Slot.
- Giữ adapter tương thích tạm thời cho props `rarity`, `itemRarity`, `highlight`
  trong quá trình migration; xóa sau khi mọi consumer đã chuyển.
- Button dùng `disabled` thật khi phù hợp, `aria-disabled` khi vẫn cần focus để
  đọc lý do, `aria-busy` cho processing và tên truy cập không phụ thuộc caption.

### 17.6. Component/CSS structure

```text
src/components/common/slot/
├── SlotView.vue
├── SlotBadges.vue
├── SlotStatusOverlay.vue
└── SlotTypes.ts

src/composables/slots/
├── buildEquipmentSlot.ts
├── buildStackSlot.ts
└── normalizeSlotRank.ts
```

Không bắt buộc tách toàn bộ file ngay. Chỉ tách khi `SlotView.vue` vượt quá một
renderer dễ đọc; ưu tiên migration tập trung thay vì rewrite các Bag Section.

Theme bổ sung token semantic, không hardcode màu trong component:

```css
--slot-surface;
--slot-surface-raised;
--slot-border;
--slot-hover;
--slot-selected;
--slot-valid;
--slot-invalid;
--slot-disabled-opacity;
--slot-caption-bg;
--slot-shadow;
```

### 17.7. Migration theo phase

#### Phase S1 — Inventory và contract

- Liệt kê toàn bộ consumer của `SlotView` và badge tự dựng quanh Slot.
- Chốt `SlotPresentationState`, rank normalization và precedence table.
- Thêm component tests giữ lại hành vi click/tooltip hiện tại.

#### Phase S2 — CSS renderer

- Thay backdrop/frame/hover PNG bằng gradient, border, shadow và pseudo-element.
- Render icon item và monogram fallback; xử lý `error` của ảnh.
- Thêm responsive caption, amount và focus-visible.
- Giữ API cũ qua compatibility adapter.

#### Phase S3 — Semantic states

- Thêm availability, interaction, validation, marker và comparison.
- Thêm ARIA, keyboard và reduced-motion.
- Bảo đảm state ưu tiên không tạo tổ hợp hình ảnh mâu thuẫn.

#### Phase S4 — Consumer migration

- Equipment bag: Quality, Rarity, equipped, comparison.
- Equipment paperdoll: empty/filled, enhance, formation/talisman marker.
- Material/Pill/Talisman/Formation/Technique: stack amount, selected và action
  validity.
- Equipment Hall: selected, processing, missing material và invalid target.

#### Phase S5 — Cleanup

- Xóa các prop compatibility và CSS badge bị trùng ở consumer.
- Xóa constant/path asset trang trí không còn consumer; không xóa file vật lý
  nếu chưa xác minh chúng không được nơi khác dùng.
- Cập nhật quy ước authoring: item mới chỉ khai báo `icon` và domain metadata.

### 17.8. Tests và visual QA

Component tests tối thiểu:

- Empty/filled và icon error fallback.
- Rank 1–9 map đúng data attribute/CSS variable.
- Rarity 5 bậc map đúng `1–3–5–7–9`.
- Locked/disabled/processing chặn action đúng và vẫn cung cấp mô tả phù hợp.
- Selected không bị hover ghi đè; validation vẫn nhìn thấy khi selected.
- Amount/caption/badge không chồng nhau ở kích thước nhỏ nhất.
- Tooltip vẫn neo đúng cùng Slot sau migration.
- Keyboard focus, `aria-disabled`, `aria-busy`, accessible name.

Visual matrix bắt buộc:

- Kích thước slot nhỏ/trung bình/lớn.
- Empty, icon hợp lệ, icon thiếu và icon lỗi.
- Quality 1, 5, 9; Rarity 1, 5, 9 theo rank chuẩn hóa.
- Selected + valid; selected + invalid; equipped; new; processing; locked.
- Caption tiếng Việt dài, amount lớn và zoom 80–200%.
- Light/dark không áp dụng nếu game chỉ có một theme, nhưng contrast phải đạt ở
  nền panel sáng nhất và tối nhất hiện có.

Sau mỗi phase chạy:

```bash
npm.cmd test
npm.cmd run type-check
npm.cmd run build
```

### 17.9. Tiêu chí nghiệm thu

- Thêm item mới chỉ cần PNG icon và khai báo data vốn có; không tạo asset nền,
  frame, hover hoặc rarity badge.
- Quality, Rarity và trạng thái tương tác đọc được trong dưới một giây mà không
  cần mở tooltip.
- Không có hai state quan trọng dùng cùng một tín hiệu hình ảnh.
- Slot ở mọi panel dùng cùng precedence, token, badge và accessibility contract.
- Không còn consumer trực tiếp của asset trang trí Slot cũ.
- Không thay đổi gameplay/save data; tests, type-check và build đều qua.
