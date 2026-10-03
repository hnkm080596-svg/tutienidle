# Danh sách điểm nối logic cho UI Huyền Kim

Cập nhật: 2026-10-03. Phạm vi hiện tại: dựng UI để duyệt hình ảnh, không mở rộng gameplay/backend/save. Đây là danh sách hook cho implementer, không phải plugin cần cài đặt.

## Quy tắc hình ảnh đã chốt

- Từng scene được người dùng chấm trước khi chuyển scene tiếp theo.
- Login và Tạo nhân vật dùng chung cảnh nền parallax, cùng nhân vật nhìn từ sau; không thay cảnh trái.
- Chuyển Login ↔ Tạo nhân vật: chiếu chỉ trượt ra bên phải rồi chiếu mới đi vào; không phủ đen phong cảnh.
- Khung thiết kế 1440 × 810 được scale đồng đều theo `min(viewportWidth / 1440, viewportHeight / 810)`. Màn khác tỷ lệ có khoảng đệm; không kéo méo, không tự đổi số cột.
- Thiên phú và kỹ năng: hai hàng độc lập, mỗi hàng ba ô vuông icon + tên, chi tiết qua hover/focus, có phân trang.
- Thông báo có vùng cố định; trạng thái chọn/lỗi không đẩy các thành phần khác.
- Panel Nhân Vật dùng giấy phẳng, không bắt buộc hình chiếu chỉ/trục cuộn. Chiến Lực in trực tiếp trên giấy, không khung/huy hiệu riêng; Chi Tiết dùng chung nền giấy, chỉ phân cách bằng đường mực mảnh.
- Phân cấp đã chốt: chỉ bốn scene chính là Login, Động Phủ, Độ Kiếp và Combat; scene chính sở hữu background. Các màn/panel phụ nằm trên scene chính phù hợp và KHÔNG có background riêng. Phải xác định scene cha trước khi làm từng màn phụ, không suy ra mọi màn đều nằm trên Động Phủ.
- Tạo nhân vật thuộc Login. Nhân Vật thuộc Động Phủ: toàn bộ nền panel Nhân Vật là tờ giấy; panel không sở hữu background phía sau. Preview host tái sử dụng `DongFuVista`; chỉ nội dung/lớp giấy thay đổi. Độ Kiếp là scene chính riêng, không phải panel trên Động Phủ.
- Khung panel/bảng/nút chữ nhật có kích thước thay đổi phải dùng 9-slice, không kéo giãn toàn bộ PNG. Bốn góc giữ tỷ lệ; cạnh chỉ giãn theo trục của cạnh; nền giữa giãn độc lập. Họa tiết giữa mép khung, huy hiệu và tiêu đề phải là lớp riêng nếu cần giữ hình dáng.
- Tách hai thao tác: resize khung bên trong scene bằng 9-slice; resize toàn scene bằng scale đồng đều của `SceneDesignCanvas`. Kích thước góc được giữ trong tọa độ thiết kế, sau đó scale cùng toàn bộ UI.

## Điểm nối

| ID | Bề mặt / component | Dữ liệu đưa vào | Sự kiện đưa ra | Hiện trạng / việc nối sau |
|---|---|---|---|---|
| UI-01 | `AuthEntryScreen` | trạng thái tài khoản, lỗi, loading, ngôn ngữ | đăng nhập, đăng ký, chơi khách, tiếp tục | Giữ nguyên kết nối hiện có; đợt UI không sửa xác thực. |
| UI-02 | `CreationNameSection` | `modelValue`, `validName`, `disabled` | `update:modelValue` | Nhập đạo danh; kiểm tra tên thực tế thuộc implementer. |
| UI-03 | `CreationTalentSection` | `talents`, `selectedIds`, `rolling`, `error`, `creating` | `toggle(talent)`, `reroll` | Giữ nguồn offer hiện có; UI không đổi luật sinh/chọn. |
| UI-04 | `CreationStarterSlot` | `options: { id, name, description, icon?, motif }[]`, `modelValue`, `disabled` | `update:modelValue` | Chỉ chọn thử trong UI; CHƯA truyền vào create/save/bootstrap. `motif` là biểu tượng sword/orb/fist dùng lúc chưa có icon riêng. Implementer nối lựa chọn thật sau. |
| UI-05 | `CreationChoiceTile` | tên, icon/symbol, tooltip, selected, disabled | `select` | Dùng chung cho hai nhóm. Icon thiên phú hiện dùng symbol theo nhóm, thay art riêng sau qua đầu vào `icon`. |
| UI-06 | `CreationChoicePager` | `items`, `label`, `busy` | thay trang nội bộ | Ba ô/trang; tự tính số trang theo dữ liệu. Selection do component cha giữ, không phụ thuộc trang. |
| UI-07 | `CreationFooter` | `ready`, `creating`, `summary`, `error` | `finish` | Giữ handler tạo hiện có; không đưa skill preview vào payload. Cần nối đầy đủ khi mở lựa chọn skill thật. |
| UI-08 | Tooltip dùng chung | `title`, `description`, `contained` | hover/focus/Escape | `contained` giữ tooltip trong canvas để scale cùng chữ/icon. Chỉ trình bày dữ liệu, không tính hiệu ứng. |
| UI-09 | `OnboardingStage` | nội dung route từ host | `close/open` của hiệu ứng chiếu | Chỉ điều khiển hình ảnh, host hiện hữu vẫn sở hữu đổi màn. |
| UI-10 | `SceneDesignCanvas` | kích thước chuẩn (1440 × 810) | scale dẫn xuất từ kích thước khung | Chỉ logic UI; tất cả thành phần trong canvas scale cùng nhau. |
| UI-11 | Khung 9-slice | texture, inset cắt theo pixel nguồn, độ rộng viền hiển thị, kích thước tối thiểu, padding nội dung | không có sự kiện gameplay | Bắt buộc cho khung co giãn. Asset `scene/dong-fu-v2/panel-nine-slice.png` + JSON: nguồn 1254², inset 360 mỗi cạnh, viền mẫu 52 px; consumer chọn độ rộng viền thiết kế phù hợp. Đã dùng trong bản duyệt Scene 03, chưa nối màn game chính. Không kéo giãn toàn bộ PNG. Ornament trung tâm tách lớp. |
| UI-12 | `DongFuFidelityScene` | `DongFuUiModel`, `notice`, `selected` | `action(id)` | Màn duyệt riêng `/ui-dong-fu.html`. Chưa mount vào `GameRoot`. Host cung cấp bản đọc dữ liệu và xử lý command sau; scene không import gameplay/store. |
| UI-13 | `DongFuHud` | tên, cảnh giới, progress label/percent, danh sách resource đã format | `action(character/feedback/inventory/settings)` | Số liệu hiện là fixture duyệt hình. Không tự tính cảnh giới hoặc số dư. |
| UI-14 | `DongFuWheel` | danh sách action (id, labelKey, symbol), selected, open | `action(id)` | Chọn hiện viền sáng; bấm nhân vật để ẩn/hiện vòng. Implementer cung cấp danh sách/availability thực tế sau. Không đổi route trong bản duyệt. |
| UI-15 | `DongFuBoard` | entries (id, labelKey, detailKey, symbol), open | `action(id)`, `toggle` | Đóng/mở Thiên Cơ Bảng chỉ đổi trạng thái UI. Chưa nhận thưởng, nâng cấp hay thu tài nguyên. |
| UI-16 | Building plaques | sáu building ID, labelKey, symbol, x/y trên canvas 1440 × 810 | `action(buildingId)` | Tên kiểm theo catalog công trình. Các vị trí là anchor trình bày trên cảnh mới; implementer nối popover sau. Không cắt rời building khỏi master. |
| UI-17 | `DongFuVista` / `DongFuArtFrame` | art registry; normalized pointer CSS vars; borderWidth | không có | Hai plane rear/foreground parallax, giảm chuyển động theo hệ điều hành. Frame dùng metadata slice nguồn; borderWidth là px thiết kế, scale cùng scene. Đã dùng 9-slice cho board, identity, resource, building, quest. |

## Nhân Vật — panel phụ trên Động Phủ

| ID | Bề mặt | Đầu vào / sự kiện | Điểm nối sau |
|---|---|---|---|
| UI-18 | `CharacterFidelityScene` | `CharacterUiModel`, notice, selectedElement; emits select/element | Panel giấy thuần UI, không background, không store. Preview host riêng `/ui-character.html` dùng `DongFuVista` bên dưới. |
| UI-19 | `CharacterFidelityIdentity` | name, realm, path, combatPower dạng chuỗi | Nối bản đọc nhân vật; không tính chiến lực trong UI. Không có môn phái/danh hiệu do ảnh AI tự thêm. |
| UI-20 | `CharacterFidelityFigure` | elements gồm id, số đã format, tọa độ trình bày; selected | Chọn/hover ngũ hành chỉ xem thông tin; không đổi hệ nhân vật. Art figure có thể thay theo nhân vật. |
| UI-21 | `CharacterFidelityStats` | stats (value, fill, color, symbol), elements | Fill là dữ liệu trình bày, không phải giới hạn chỉ số gameplay. Thiên phú hiện là ô chờ nối dữ liệu thật. |
| UI-22 | `CharacterFidelityDetails` | combat/other arrays, open; emits toggle | Cuộn danh sách, đóng/mở chỉ là state UI. Implementer nối stat read-model đã format. |
| UI-23 | Thanh chức năng trong giấy | emits select(nav.id) | Chưa đổi panel game thật. Nút quay về chỉ về bản duyệt Động Phủ; host runtime nối navigation sau. |

## Chưa nối logic

Kỹ Năng: UI-32–35 và hợp đồng node/bảng thông tin trong [skill-v2-components.md](skill-v2-components.md). Không cố định cấu trúc cây; vị trí và edges do host từng loại cung cấp. Preview `/ui-skill.html` dùng chung thanh điều hướng.

## Cảnh Giới và thanh điều hướng chung

| ID | Bề mặt | Đầu vào / sự kiện | Điểm nối sau |
|---|---|---|---|
| UI-24 | `PaperPanelNavigation` | items `{id,label,icon}[]`, active, label, backLabel; select(id), back | Đã dùng chung cho bản duyệt Nhân Vật và Cảnh Giới. Không giới hạn 4 mục. Danh sách dài cuộn trong chiều cao cố định. Host quyết định mục nào được hiển thị và điều hướng; component không sở hữu route/gameplay. |
| UI-25 | `RealmFidelityScene` | model, navigation, selected, notice; selectFloor/navigate/back/breakthrough | Preview `/ui-realm.html`, giấy 9-slice trên DongFuVista hiện có. Không scene background mới. |
| UI-26 | `RealmPaperMap` | current, selected; select(floor) | 18 mốc UI, 6 bậc chính 3/6/9/12/15/18; số còn lại trên cầu thang. Anchor thuộc trình bày, không định nghĩa luật tầng gameplay. |
| UI-27 | `RealmPaperDetails` | model đã format, selected, notice; breakthrough | Progress chỉ hiển thị; CTA phát ý định, chưa gọi logic. Vùng thông báo cố định. Implementer nối điều kiện/thông số thật sau. |

Danh sách 9 mục trong `ui-preview/paperNavigation.ts` chỉ là fixture duyệt. Nhân Vật ↔ Cảnh Giới đổi URL preview; các mục chưa dựng hiện thông báo, không giả lập gameplay.

Kiểm tra đợt Cảnh Giới: type-check và kiểm tra trình duyệt trực tiếp; không tuyên bố QA fixed point, merge-ready hay hoàn thành logic.

### Các việc logic còn lại

## Tâm Pháp — panel giấy dùng chung nền Động Phủ

| ID | Bề mặt | Đầu vào / sự kiện | Điểm nối sau |
|---|---|---|---|
| UI-28 | `TechniqueFidelityScene` | model, navigation, selected, notice; navigate/back/select/advance | Bản duyệt `/ui-technique.html`; dùng đúng PaperPanelNavigation của Nhân Vật/Cảnh Giới. Không mount vào gameplay. |
| UI-29 | `TechniquePaperInfo` | name, quality, description, sections/rows đã format | Nối read-model tâm pháp sau. Chỉ số và mô tả hiện là fixture, không khẳng định cân bằng thật. |
| UI-30 | `TechniquePaperArtifact` | art URL, stages, mastery label/percent, selected; select(id) | Art bí kíp tạm được user cho phép; đổi qua model.art. Các mốc là band hiển thị, chọn không thay đổi rank hoặc tu luyện. |
| UI-31 | `TechniquePaperUpgrade` | currentGrade, nextGrade, material name/amountLabel, notice; advance | Một dòng material theo bề mặt hiện có, không sao chép các nguyên liệu AI tự thêm. Host nối eligibility/cost/command sau; vùng thông báo cố định. |

Tâm Pháp đã được nối vào điều hướng giữa ba bản duyệt; scene game thật vẫn giữ nguyên. Canvas đồng tỷ lệ và parallax dùng cơ chế hiện có. Chưa có QA fixed-point/release certification.

### Logic chưa nối (tiếp)

- Nối Huy Kiếm / Huy Quyền / Linh Bạo vào tạo nhân vật, save, backend và bootstrap.
- Đổi luật thiên phú, kỹ năng, cân bằng hoặc dữ liệu gameplay.
- Thay bộ icon nội dung dễ thay đổi bằng art chính thức.
- QA logic, QA toàn dự án, xác nhận merge/release. Người dùng xử lý sau đợt duyệt UI.

## Luyện Thể — ba trang silhouette

| ID | Bề mặt | Điểm nối sau |
|---|---|---|
| UI-36 | `BodyFidelityScene` | Host cung cấp model/navigation/selection/notice; nhận ý định chuyển chapter, chọn unit, điều hướng và nâng cấp. Chuyển trang chỉ là trình bày. |
| UI-37 | `BodyPaperFigure` | Model chứa chapter, units, progress và progressLabel; select(id) chỉ chọn thông tin. Ba silhouette ánh xạ theo chapter, node độc lập với art. |
| UI-38 | `BodyPaperDetails` | Hiển thị thông tin unit, material/amount đã format và vùng thông báo cố định; host nối lệnh gameplay sau. |
| UI-39 | `BodyPreview` | Fixture cho `/ui-body.html`, không persist. Thay fixture bằng read-model của chủ sở hữu gameplay khi tích hợp. |

Art và phạm vi: [body-v2-art-provenance.md](body-v2-art-provenance.md). Không tạo nền mới; dùng chung giấy, điều hướng và nền Động Phủ.

## Thám Hiểm — Sơn Hà Đồ

UI-40–43: [exploration-v2-ui-task.md](exploration-v2-ui-task.md). Preview `/ui-exploration.html`: ba dải địa hình trên giấy, node và edges tách khỏi art, bảng chi tiết nhận model, CTA chỉ emit ý định. Fixture 30 node không định nghĩa số ải gameplay. Dùng chung nền Động Phủ, navigation và canvas scale đồng tỷ lệ.

## Combat — chỉ HUD

UI-44–49: [combat-v2-ui-task.md](combat-v2-ui-task.md). `/ui-combat.html` duyệt player plate, thanh lượt, tên ải, bảng AI, thanh máu địch và skill dock. Tất cả là props/emits và fixture. Không sửa background/parallax/runtime combat. Khi tích hợp phải chọn một renderer cho mỗi HUD, không mount chồng HUD mới với canvas/DOM cũ.

## Luyện Đan — panel giấy

UI-50–55: [alchemy-v2-ui-task.md](alchemy-v2-ui-task.md). Preview `/ui-alchemy.html` dùng lại đan lô, giấy, navigation và nền Động Phủ; dữ liệu mẫu cho danh sách, dược thảo và hàng chờ. Chọn phương/dược thảo chỉ đổi UI; luyện/hủy không gọi domain. Không gen icon thuốc hoặc sửa background.

## Ghi chú phạm vi triển khai

### Phân tách Túi Đồ / túi Trang Bị — yêu cầu handoff bắt buộc

Theo yêu cầu người dùng ngày2026-10-03:

- **Túi Đồ** là nơi hiển thị nguyên liệu, đan dược và các vật phẩm sử dụng/thu thập khác không phải trang bị.
- **Túi ở màn Trang Bị** chỉ hiển thị các món trang bị; không đưa nguyên liệu, đan dược hoặc vật phẩm thường vào lưới này.
- Nguồn chọn nguyên liệu cho các chức năng rèn đọc từ chủ sở hữu inventory và được trình bày qua Túi Đồ; nguồn chọn món cần rèn đọc từ chủ sở hữu equipment. Không tạo hai kho authoritative hoặc nhân đôi cùng vật phẩm để đáp ứng hai UI.
- Đây là phân tách bề mặt trình bày, không tự ý thay schema save, di chuyển/xóa dữ liệu hay đổi luật chứa đồ. Implementer phải nối đúng read-model/command của chủ sở hữu hiện có.
- Fixture `/ui-inventory.html` hiện còn tab và icon trang bị dùng thử. Chúng không phải yêu cầu giữ trang bị trong Túi Đồ: khi hoàn thiện phân tách, bỏ nhóm này khỏi Túi Đồ và giữ nó ở túi Trang Bị.

### UI chức năng rèn — phạm vi cần hoàn thiện tiếp

Source hiện có năm bề mặt: Cường Hóa (`enhance`), Tẩy Luyện (`wash`), Tinh Luyện (`refine`), Hóa Luyện (`dissolve`), Phân Giải (`decompose`). `EquipmentScene.vue` hiện lọc beta bằng `isBetaEquipmentTab`; Cường Hóa/Hóa Luyện được hiển thị, ba bề mặt còn lại scope-hidden. Người dùng yêu cầu làm lại UI rèn. Phạm vi dựng cả năm hay chỉ hai chức năng beta đang chờ xác nhận; không tự mở khóa gameplay.

Đã dựng cả5tab theo xác nhận người dùng. **Bề mặt chính là `/ui-equipment.html`: giữ nguyên nhân vật/6ô trang bị bên trái; 5tab rèn thay thế túi trang bị bên phải. Khi đang rèn, túi bên phải không mount. Nút Túi Trang Bị chuyển lại lưới trong cùng vùng phải; không hiển thị lưới và rèn đồng thời.** `/ui-forge.html` chỉ còn bản duyệt phụ, không phải cách tích hợp được chọn. Panel giấy trên nền Động Phủ có sẵn, khung9-slice, so sánh chỉ số / nguyên liệu và chi phí / kết quả / thông báo dành chỗ trước. Không thực thi rèn hoặc thay beta scope gameplay.

| ID | Bề mặt | Điểm nối sau |
|---|---|---|
| UI-78 | `ForgeFidelityScene` | items/item/mode từ host, emit mode(id),select(itemId),action({mode,itemId,kind}). Chỉ điều phối presentation. |
| UI-79 | `ForgeFidelityWorkspace` | Hiển thị focus item, so sánh/thu hồi, chi phí/cảnh báo. Lock state hiện chỉ local UI; khi tích hợp phải đưa lock selection lên host và bind preview receipt/domain eligibility, không coi số mẫu là công thức. |
| UI-80 | `EquipmentFidelityScene` / preview | Chọn ô trang bị trái để đổi món rèn. Mode presentation chọn bag hoặc1trong5tab rèn ở vùng phải. Action hiện emit chuỗi mode:itemId:kind; implementer thay bằng typed domain request phù hợp. `/ui-forge.html` giữ làm bản phụ, không điều hướng ra khỏi Trang Bị trong luồng chính. Mọi CTA chỉ hiện notice. |

Các dòng chỉ số, cost và output hiện là fixture minh họa trong workspace; implementer thay bằng display model từ domain, không copy số mẫu làm luật gameplay. Nguyên liệu lấy từ inventory/Túi Đồ, món rèn từ equipment/túi Trang Bị. Hóa Luyện/Phân Giải cần xác nhận thật trước command phá hủy; UI preview chưa nối command.

UI-81 `ForgeBatchBag`: cập nhật theo người dùng: Hóa Luyện/Phân Giải thay toàn bộ workspace đơn món bằng lưới items trong túi; không thẻ món lớn. Multi-select/selectAll là localUI; emit submit({mode,itemIds}). Host/domain cung cấp eligibility/output và confirmation khi nối thật. Main Equipment preview có adapter action chuỗi tạm, không sử dụng làm protocol production.

Handoff đầy đủ: [UI-IMPLEMENTER-HANDOFF.md](UI-IMPLEMENTER-HANDOFF.md). Implementer phải audit từng chức năng, hỏi kỹ người dùng khi source/doc/visual/logic mâu thuẫn, không tự chốt luật.

## Bốn màn cuối — Thất Bại / Cài Đặt / Nhiệm Vụ / Túi Đồ

| ID | Bề mặt | Điểm nối sau |
|---|---|---|
| UI-69 | `DefeatFidelityScene` | Host cung cấp stage/reason/rewards/notice; nhận retry/home. Không grant reward, không suy ra kết quả combat khi mount. |
| UI-70 | `SettingsFidelityScene` | Host cung cấp groups/active; nhận select/update/action. Các ID save/export/import/feedback chỉ là ý định. |
| UI-71 | `SettingsFidelitySection` | Controls có id/label/kind/value/options; emit update(id, typed value). Host thực hiện audio/locale/scale/persistence sau. |
| UI-72 | `QuestFidelityScene` | Host cung cấp quests/selected/filter/rewards; nhận select/filter/action(questId). Trạng thái và eligibility thuộc domain. |
| UI-73 | `QuestFidelityDetail` | Display quest/objectives/rewards từ host. Claim/follow chỉ emit identity, không tự đổi trạng thái hay nhận vật phẩm. |
| UI-74 | `InventoryFidelityScene` | Host cung cấp items/selected/filter/query; nhận select/filter/query/sort/use(itemId). Không mutate inventory. |
| UI-75 | `InventoryFidelityDetail` | Item đã format; use(id) nối command sau. Icon và description là display data dễ thay thế. |
| UI-76 | `PaperPreviewSurface` | Dùng chung canvas1440×810, paper9-slice, nền Động Phủ và `PaperPanelNavigation`. Route preview độc lập, không dùng để điều khiển scene gameplay. |
| UI-77 | Four preview hosts | `/ui-defeat.html`, `/ui-settings.html`, `/ui-quest.html`, `/ui-inventory.html`: fixture không persist, không gọi domain. |

Chi tiết và evidence: [remaining-v2-ui-task.md](remaining-v2-ui-task.md). Bộ17 ảnh mẫu đã có các bề mặt duyệt; Túi Đồ là panel bổ sung. Đây là hoàn tất vòng dựng UI, không phải tích hợp gameplay hoặc QA toàn dự án.

## Chiến Thắng — bảng kết quả

UI-65–68: [victory-v2-ui-task.md](victory-v2-ui-task.md). `/ui-victory.html` có art tiêu đề Thắng riêng, giấy9-slice, reward slots và growth cards động; các nút emit retry/continue. Host cung cấp giá trị đã format và notice; không grant reward khi mount/click. Background combat hiện có chỉ trưng bày tĩnh. Prompt và provenance của asset nằm trong task doc.

## Độ Kiếp — HUD chính

UI-60–64: [tribulation-v2-ui-task.md](tribulation-v2-ui-task.md). `/ui-tribulation.html` duyệt thanh ba giai đoạn, realm/strike card, status, câu hỏi/đáp án và HP. Host cung cấp display model; UI emit answer(id)/back. Bốn layer background hiện có chỉ được hiển thị tĩnh làm ngữ cảnh, không sửa hệ thống. Timer, lôi kích và kết quả do domain nối sau.

## Trang Bị — hover tooltip

| ID | Bề mặt | Điểm nối sau |
|---|---|---|
| UI-56 | `EquipmentFidelityScene` | Host cung cấp sockets/items/navigation/notice và `characterImage` tùy chọn; nhận navigate/back/action. Vùng ảnh giữ sẵn, tooltip không chiếm cột cố định. |
| UI-57 | `EquipmentPaperItem` | Item display hoặc null, label; emit inspect(item)/leave. Hover/focus chỉ là UI, không thay trang bị. |
| UI-58 | `EquipmentPaperTooltip` | Item đã format, stats và tone từ domain; khung giấy 9-slice trong canvas scale. |
| UI-59 | `EquipmentPreview` | Fixture độc lập `/ui-equipment.html`; thay read-model và nối command khi tích hợp. |

Phạm vi: [equipment-v2-ui-task.md](equipment-v2-ui-task.md). Giữ vùng nhân vật để thêm ảnh sau, dùng icon có sẵn.

Worktree: `E:\tutienidle\.agent-worktrees\hk-login-fidelity`, branch `codex/hk-login-fidelity`.

Chủ sở hữu mới chỉ là trình bày: canvas giữ tỷ lệ, stage giữ cảnh nền và trượt chiếu, pager giữ trang, tile giữ trạng thái hình ảnh. `CharacterCreationScreen` vẫn giữ lựa chọn thiên phú; `previewSkillId` là state UI không persist. Không sửa core/service/save/SQL. Không commit, push hay xóa file dự án.
