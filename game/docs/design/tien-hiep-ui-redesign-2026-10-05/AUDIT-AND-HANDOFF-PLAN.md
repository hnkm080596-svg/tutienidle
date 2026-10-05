> HISTORICAL AUDIT: draft/HOLD status superseded by README.md, WIRING-PLAN.md and PACK-VALIDATION.json. Preserved for provenance.

# Tiên Hiệp UI — audit, art direction và plan bàn giao

Ngày: 2026-10-05. Branch: codex/hoa-cau-fireball-vfx.
Worktree: E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx.
Baseline: f8af8007b0b6519e6aa6997fedad2cc77939538a.
Trạng thái: đang audit và sản xuất art; chưa wiring, chưa commit/push, chưa nghiệm thu runtime.

## Quyết định đã chốt

Toàn bộ UI gồm onboarding, home, progression, inventory, production, combat, tribulation, settings, quest, modal và trạng thái lỗi. Desktop ngang ưu tiên; tối thiểu 1280x720, thiết kế tham chiếu 1672x941, kiểm tra thêm 1920x1080. Không scale toàn màn hình đến mức chữ không đọc được; màn hẹp dùng nội dung cuộn và detail dock chuyển thành tab/drawer. Không đặt ngân sách dung lượng nhân danh user; ưu tiên chất lượng hình ảnh. Mobile vẫn cần bố cục dùng được nhưng không ưu tiên ngang desktop.

Concept mới: giấy ngà + mực đen + vàng cổ, sơn thủy sáng có chiều sâu. Thay skin cyan/scanline ở những consumer còn dùng. Dùng đúng thuật ngữ đạo lộ. Các đạo lộ chung khung, khác icon/màu/họa tiết. Không tạo chức năng hay thay gameplay. Không gom logic Túi/Trang Bị. Cho phép bố cục/tên mới nhưng phải báo bảng trước/sau.

Nhân vật động có sẵn do user phụ trách. Không vẽ nhân vật/portrait mới, không đóng nhân vật vào background. Logo có sẵn được giữ. Command wheel chỉ mở khi bấm nhân vật. Nút không đủ điều kiện không nhận hành động; lý do vẫn đọc được qua nội dung cạnh nút hoặc vùng mô tả có thể focus. Không dùng hover làm cách duy nhất để giải thích. Animation nhẹ; art động cần thiết dùng Arcadia, không tự tạo pipeline khác.

Agent hiện tại: audit + thiết kế + vẽ UI art + plan. Agent sau: wiring. Các asset mới là version riêng, không ghi đè pack cũ, không sửa registry production trong đợt authoring.

## Nguồn và mức bằng chứng

component-census.csv liệt kê toàn bộ Vue component tại baseline, KHÔNG chứng minh từng component có route sống. existing-chrome-census.csv lấy 43 entry registry hiện tại, 42 ready và scrollbar pending. ready là trạng thái file/registry, không là phê duyệt chất lượng theo concept mới. Docs cũ có baseline devin/frontend-ready và nhiều mô tả Future: chỉ tham khảo, không xem là nguồn trạng thái runtime. Code hiện tại và consumer thực tế quyết định.

Đã đọc: GameRoot, panelIds, registry huyenKimChrome, InkNineSlice, CharacterPanel/CharacterSurface/CharacterFidelityScene/Figure/characterUi, PaperPanelNavigation, PlayerPortrait; đã kiểm tra hình preview 03-slots-nodes-hud.

Đã xác nhận source:
- Registry hỗ trợ real PNG border-image, ready/pending, đường dẫn qua AssetBaseUrl.
- CharacterFidelityFigure dùng CHARACTER_ART.figure -> scene/character-v2/figure.png tĩnh. Khác yêu cầu mới. Agent wiring cần consumer PlayerPortrait/EntitySpriteCanvas có sẵn, chọn profile/idle đúng; không thay model gameplay.
- PaperPanelNavigation hiện là rail giấy nhỏ với icon hình thoi, chưa tương ứng rail mực đen/icon lớn trong ảnh mới. locked hiện emit select và để host quyết định; thiết kế mới cần khóa UI rõ và giữ gate host.
- Kỹ năng dùng node-ring-v1 và paper-nine-slice riêng; cần map cả các đường dẫn trực tiếp này, không chỉ registry chung.
- Thiên Cơ có source useThienCoEntries và DongFuBoard; không phải chức năng mới.
- Preview pack cũ có slot bạc và nhiều node/HUD hình học đơn giản. Đây là bằng chứng về pack preview, chưa kết luận mọi màn runtime dùng các hình đó.

## Inventory màn và thiết kế đích

| Nhóm | Consumer/host cần kiểm tra | Thiết kế đích |
|---|---|---|
| Đăng nhập | AuthEntryScreen, onboarding/login components | Vista lớn, form giấy, logo có sẵn, đủ auth/error/loading |
| Tạo nhân vật | CharacterCreationScreen, Creation* | Form giấy, talent card, input rõ; không tạo lựa chọn gameplay mới |
| Động Phủ | DongFuStage, DongFuFidelityScene, DongFuHud, DongFuWheel, DongFuBoard | Vista chính, HUD mực-vàng, wheel kín mặc định, Thiên Cơ giấy |
| Nhân Vật | CharacterScene/Surface, CharacterFidelity* | Rail mực trái; identity 20%, nhân vật động 30%, stats 25%, detail 25% vùng nội dung |
| Túi | InventorySurface/Fidelity, BagGrid, SlotView | Paper grid + tab/filter/capacity; giữ category và operation thực tế |
| Trang bị trên người | EquipmentPaperdoll, EquipmentFidelityScene | Nhân vật động + socket thật; không tự thêm slot theo ảnh |
| Khí Đường | EquipmentSurface, ForgeFidelityScene, equipment-hall/* | Rail operation, item được chọn, chi phí/kết quả; dùng operation hiện có |
| Kỹ Năng | SkillSurface, SkillFidelityScene, SkillPaper* | Đạo lộ/element tabs, cây đúng dữ liệu, inspector giấy |
| Công Pháp | TechniquePanel/Surface/Fidelity | Focal art có sẵn, grade, so sánh, nâng cấp |
| Cảnh Giới | RealmSurface/Fidelity, BreakthroughRequirementPanel | Trục cảnh giới và detail, điều kiện/chi phí thật |
| Luyện Thể | BodySurface/Fidelity, realm sections | Nội dung progression có sẵn, sơ đồ/badge; không vẽ lại nhân vật |
| Quán Khí | QuanKhiPanel | Chi tiết lựa chọn và confirm cùng skin |
| Pháp Bảo | ArtifactPanel, artifact/* | Art vật phẩm có sẵn, progression/grade/path cards |
| Trận Pháp | TranPhapPanel, formation preview | Grid formation và detail; giữ render/wiring Phaser |
| Đồng Hành | CompanionPanel | Card/slot, detail, action thật |
| Chi Hiền Quán | WorkerLodgePanel, worker-lodge/* | Recruit/relationship/gift cùng tab và list-row |
| Luyện Đan | PillRoomPanel, AlchemySurface/Fidelity | Recipe list, cauldron có sẵn nếu đạt, queue, cost, feedback |
| Sản xuất | ProductionPanel, construction gate, BuildingDetailPopover | List job/resource, điều kiện, nâng cấp |
| Bản Đồ/ải | StageSelectPanel, ExplorationSurface/Fidelity | Map chrome, node/state, detail; geography dùng art có sẵn |
| Thương nhân | VendorPanel | Item rows, selected item, giá và mua |
| Tàng Kinh Các | ScripturePavilionPanel, LoreCodex/Modal | Reading paper, mục lục, text thoáng |
| Nhiệm Vụ | QuestScene/Fidelity | List, objective/progress/reward/claim thật |
| Cài Đặt | SettingsSurface/Fidelity, Settings*Section | Section rail, input/toggle/slider/account/save/update |
| Chiến đấu | CombatFidelityScene, CombatSceneOverlay, skill dock/topbar/order/log/AI | HUD mực tối, vàng cổ, silhouette rõ; không sửa timing/resolution |
| Độ Kiếp | TribulationFidelity*, overlay, chapter/status/mind/HP | Cinematic dark HUD, question paper, result; không thêm meter |
| Thắng/Thua | VictoryScene/Fidelity, DefeatFidelityScene | Ribbon vàng/chu sa, reward slot động, action thật |
| Micro/system | ConfirmModal, Tooltip, Toast, OfflineSummary, TalentEntitlement, Tutorial, Loading/Error/SaveIncompatible | Bộ khung chung, đầy đủ focus/loading/error/locked/empty |

## Art direction và decomposition

Không bake chữ/số/logo/nhân vật vào component. Giấy và frame tách lớp. Không dùng frame ornament dày cho từng cell: cell dùng góc vàng nhỏ, selected thêm overlay. Vàng cổ #B88A45/#E5C678 (mốc thiết kế, điều chỉnh theo art), mực #141B1B, giấy #F1E4C8, chữ #30291D. Hỏa chu sa, Mộc ngọc, Thủy lam, Kim vàng nhạt, Thổ hổ phách; không đổi enum/state gameplay. Chữ display phải có đủ dấu Việt; body dễ đọc, ưu tiên 16px tại runtime desktop. Icon vàng sáng trên mực, dark-gold trên giấy.

Nhân Vật mẫu: ngoài cùng là world vista; rail mực trái; paper sheet trung tâm; identity và power ribbon trái; vùng nhân vật không nền baked; stats/talent/elements phải nhận dynamic count và các main stats hiện có; detail cuộn độc lập. Không sao chép Lv/sect/thống kê giả từ ảnh. Vùng animation dùng contain, neo chân rõ, không cắt kiếm/tóc; bounds thực tế cần agent wiring kiểm tra theo từng profile. Vùng click tách khỏi decorative glow.

## Backlog art mới — chưa phải asset đã hoàn tất

P0 shared: page-frame, paper-tile, dark-panel-frame, title-plaque, section-header, sidebar-rail, nav-entry, nav-selected-overlay, button-primary, button-secondary, button-compact, icon-button, slot-frame, slot-selected-overlay, orb-frame, orb-selected-overlay, resource-pill, identity-plate, avatar-ring, progress-track, divider, tooltip-frame, modal-frame.
P1 specialized: building-plaque, thien-co-row, quest-tracker, tree-lock, node-pips, talent-card, power-ribbon, list-row, tab-normal, tab-selected, text-field, toggle-track/thumb, slider-track/thumb, reward-ribbon-gold, reward-ribbon-red, timer-ring, formation-slot, stage-node, boss-marker.
P2 polish: cloud-corner overlays, empty-state motif, notice-seal, subtle active loop. Logo/character excluded. Functional glyphs đã có SVG: giữ hoặc chỉnh đồng bộ khi hợp; không vẽ raster thay thế mặc định.

Mỗi asset đơn lẻ PNG alpha; ghi width/height thật, alpha range, padding/safeRect, slice insets sau khi inspect. Khung chạm biên/corner không thể stretch thì tách corner và edge, không ép nine-slice. Không tự tuyên bố raw imagegen output là production-ready. Resize/crop/export chỉ sau khi source và điều kiện alpha đã được kiểm tra. Dùng file version mới trong game/public/assets/ui/tien-hiep-2026-10/. Không cập nhật ready trước khi file/export/consumer đúng.

## Plan agent wiring — chạy sau khi bộ art hoàn tất

1. Xác nhận branch/base và đọc decisions, census, asset manifest cuối. Không lấy basename hoặc slice cũ cho file mới.
2. So sánh asset cũ/mới bằng scene thật. Lập consumer map: registry và đường dẫn trực tiếp trong fidelity components. Không tạo skin song song không có consumer.
3. Wiring bộ nền/khung/nút/slot dùng chung trước. Giữ API component và domain command hiện có. Chuyển tintable đúng theo kiểu art; painted gold giữ màu gốc.
4. Wiring Nhân Vật mẫu, thay figure tĩnh bằng animated consumer đúng profile; không hardcode mortal. Chứng minh profile/cảnh giới/đạo lộ đổi art đúng.
5. Wiring Home/HUD/Thiên Cơ/wheel. Wheel chỉ mở khi bấm; đóng/mở không thay gameplay state. Building hotspot và label khớp vùng bấm.
6. Wiring inventory/equipment/skill; giữ slot count, effect/cost/grade và cây thật. Lý do khóa có thể đọc bằng keyboard/touch. Disabled không bypass gate domain.
7. Wiring progression, alchemy/production/vendor/companions/artifact/formation/lore.
8. Wiring combat/tribulation/results; giữ trình tự ack, timers, resolver và lifecycle hiện tại. Arcadia chỉ author UI motion nếu cần; đọc tooling guide trước khi export.
9. Wiring onboarding/settings/quest/system overlay và trạng thái empty/error/offline.
10. Giao bảng đổi tên và bố cục trước/sau. Hiện CHƯA có đổi tên được quyết định; không coi audit title là rename directive.
11. Kiểm tra màn thực ở 1280x720, 1672x941, 1920x1080 và cửa sổ hẹp: đọc chữ, click, scroll, tooltip, focus, animation bounds, layering, success/failure, close/reopen. Screenshot có art đẹp chưa chứng minh wiring đúng.

## Bàn giao cuối cần có

Asset manifest: id, file path, dimensions, alpha, safeRect, slice/stretch strategy, tintable, intended consumers, states, source prompt. Scene layouts cụ thể và before/after. Preview/contact sheet chỉ để review, không là texture production. Các phần chưa kiểm chứng phải hiện rõ; không commit/push/merge từ plan này. Nhóm art và plan hiện vẫn đang sản xuất.

### Audit bổ sung — source consumer thực tế

LeftPanel hiện mount CharacterSurface khi characterSceneTab=character; CharacterPanel/CharacterScene cũ không phải đường mount trực tiếp này. Vì vậy sửa CharacterFidelityFigure mới tác động đường UI đang dùng. Agent cần tránh wiring vào component cũ không có consumer.
DongFuStage -> useThienCoEntries -> home UI model -> DongFuHomeContent -> DongFuBoard là chuỗi Thiên Cơ xác nhận bằng source. Các entry/CTA phải tiếp tục dùng identity và action từ host.
EquipmentFidelityScene có #doll và #workspace production slot; fallback của preview có summary/characterImage mẫu. Không chuyển dữ liệu fallback thành production. Dùng slot production và model thật. Các tên nhóm trong bảng inventory không là bằng chứng route cho mọi file cũ.

### Art đã sinh — draft

page-frame-v1.png: 1536x1024, alpha tại tâm=0 và góc=0, Format32bppArgb. Chưa xác nhận toàn bộ biên/alpha fringe hoặc inset co giãn. Ornamental corner bất đối xứng; phải tách corner overlay nếu nine-slice làm méo.
button-primary-v1.png: bản nguồn, chưa export runtime. Họa tiết landscape trên mặt nút cần kiểm tra ở kích thước thật để không gây nhiễu vùng chữ. Không được dùng bản raw lớn như background cover mà cắt mất đầu nút.
Tool: built-in ImageGen. Đường dẫn: game/public/assets/ui/tien-hiep-2026-10/drafts/. Không sửa registry production.

### Layout Nhân Vật — tọa độ thiết kế tham chiếu

character-layout-reference.csv ghi rect cho viewport 1672x941: rail tách ngoài paper, identity trái, animation giữa, stats và detail bên phải. Rect là thiết kế mới, không là sửa code. Frame nguồn 3:2 không stretch toàn ảnh sang rect 1470x740: ghép corner/edge hoặc nine-slice đủ safe zone. Tại 1280x720 chuyển theo grid linh hoạt và giảm khoảng trang trí; body giữ tối thiểu khoảng 16px đọc được. Nếu không đủ chiều ngang, detail chuyển thành tab; không nén chữ đồng loạt theo scale. Sidebar danh mục nhiều hơn ảnh phải cuộn; không ép 11 entry vào font 12px. Đây là thiết kế có chủ ý khác bố cục rail hiện tại và phải thể hiện trong before/after handoff.

orb-frame-v1.png: bản nguồn vòng vàng/mực; preview có fringe đỏ/vàng quanh viền và sát mép canvas. HOLD, không wiring. Cần sửa source bằng ImageGen rồi kiểm tra trên nền giấy/mực tại kích thước node 64/96/144px. Không dùng kết quả alpha tâm/góc để bỏ qua lỗi fringe. Bộ ba draft là bước kiểm chứng chất liệu, không phải bộ UI hoàn chỉnh.

ui-art-consumer-search.txt là census tham chiếu đường dẫn UI art/registry trong source, phục vụ tìm consumer trực tiếp. Không phải reachability analysis hoàn chỉnh và không chứng minh mọi match đang render. Agent wiring phải đối chiếu route/host trước khi sửa. Không chỉ thay huyen-kim-chrome.json rồi mặc định toàn bộ fidelity surfaces nhận art mới.

orb-frame-v2.png: đã sửa bằng ImageGen, padding cải thiện nhưng preview vẫn có fringe đỏ/vàng. HOLD như v1, chưa export production. Không tính lần sửa này là hoàn tất art. Cần kiểm tra compositing thực trên nền sáng/tối rồi sửa tiếp nếu fringe còn hiện ở kích thước sử dụng.
