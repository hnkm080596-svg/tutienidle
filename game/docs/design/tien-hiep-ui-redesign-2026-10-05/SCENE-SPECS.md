# Thiết kế toàn bộ bề mặt UI

Baseline `f8af8007b0b6519e6aa6997fedad2cc77939538a`, implementation trên `codex/tien-hiep-ui-redesign`. Không thay admission/release scope. Màn scope-hidden vẫn hidden trong build hiện tại, dù có thiết kế và fixture riêng để dùng khi được mở lại. Không tự mở Pháp Bảo/Trận Pháp/Đồng Hành hay đạo lộ khác.

## Hệ bố cục

- World: vista là nền, HUD mực-vàng tối đa 9% chiều cao, nhãn/biển thay cho panel lớn. Động Phủ: wheel mở khi bấm nhân vật, Thiên Cơ phải thu gọn được, không chen vào hit target công trình.
- Paper page: envelope giấy ngà 88% chiều ngang, 79% chiều cao, rail mực riêng trái, title plaque chồng nhẹ góc trên. Body không gắn fixed pixel vào cả game; grid theo container, các vùng dữ liệu cuộn độc lập.
- Tree: header đạo lộ và element tabs trên, cây khoảng 65% nội dung, inspector khoảng 30%; dữ liệu topology thật quyết định node/edge.
- Workshop: list/master 25%, focal/selected 35%, detail/queue 35%; rút focal khi dữ liệu dày. Bảng chi phí gần CTA, có lý do khóa đọc được.
- Detail collection: list/grid 65%, inspector 30%; chọn/reopen giữ semantics hiện có. Ô trống không được giả thành item.
- Battle: canvas toàn vùng; dark plate cho vitals/topbar/order/dock, paper chỉ cho log/detail/modal. Inset do contract hiện tại quyết định, không hardcode che battlefield.
- Ceremony: trung tâm 65–75% chiều ngang, title ribbon vàng hoặc chu sa, rewards dynamic grid, footer action. Không nhét preview fixture vào production.
- Dialog: panel-frame trên paper, max-width theo nội dung; title, mô tả, action rõ. Focus/Escape/backdrop theo host hiện có.

1672×941 là viewport tham chiếu. PC kiểm tra tại 1280×720, 1672×941 và 1920×1080. Giữ body dễ đọc, rail cuộn; 1920×1080 mở vùng dữ liệu, không phóng chữ quá lớn. Mobile và viewport dưới 1000px được hoãn theo yêu cầu mới nhất của user.

## Spec từng màn

| Màn | Bố cục, art dùng | Dữ liệu / thao tác giữ nguyên | Trạng thái cần thể hiện |
|---|---|---|---|
| Đăng nhập | World + paper form bên phải, logo hiện có, title-plaque, text-field, primary/secondary | AuthEntryScreen, GuestUpgradeCard, auth/continue/guest APIs | Login/register/guest, invalid input, loading, service failure, có/không save |
| Tạo nhân vật | Vista trái, paper phải; tên, talent cards, CTA | CharacterCreationScreen + creation service; 9 talent roll thật, starter scope thật | Chưa nhập, tên hợp lệ/không hợp lệ, roll, selection, pending/failure |
| Động Phủ | World-vista/props hiện có, identity-plate/avatar, resource-pill, building-plaque, orb-frame; Thiên Cơ panel | DongFuStage và read-model; useThienCoEntries, commandWheelCatalog, betaWheelSlots | Wheel kín/mở, đủ/thiếu điều kiện, badges, board rỗng/thu gọn, quest absent/active/claimable |
| Nhân Vật | Theo character-layout-reference.csv; animation giữa, identity trái, stats/detail phải | CharacterSurface model, select/allocate intent; main stats đúng nguồn, Ngũ Hành không giả tỷ lệ | Points=0/>0, capped, in-battle allocation lock, nhiều talent, tooltip attribution, profile/armed changes |
| Túi | Paper + tab category thật, slot-frame grid, capacity/filter footer, inspector | InventorySurface, BagGrid, bag section models và action hiện có | Empty/filled, filter no-match, selected, capacity full, stack count, long names, page đổi |
| Trang Bị | Paper; animation + socket thật trái, bag hoặc forge workspace phải | EquipmentSurface production #doll/#workspace; EquipmentPaperdoll, canonical BagGrid, operation APIs | Socket empty/filled, compare, equip/unequip eligibility, tooltip, selected lost after mutation |
| Khí Đường | Sidebar operation riêng bên trong paper; selected item, cost, result | Enhance/Wash/Refine/Dissolve/Decompose thực tế; beta tab visibility giữ nguyên | Quote/cost, insufficient, confirm, pending/accepted wash nếu có, batch/no selection, unavailable op |
| Kỹ Năng | Header đạo lộ, element tabs nếu model có; tree+detail; orb và SVG lock | SkillSurface/SkillPaper*, canPurchase/upgrade/role model; node positions đẹp nhưng edge và prerequisite đúng data | Locked/available/learned/max, mutual exclusion, root commitment, gate block, active role |
| Công Pháp | Focal art hiện có + grade track; current/next card, cost/CTA | TechniqueSurface, active technique/grade/canonical upgrade | Chưa mở, current/max, thiếu chi phí, selected, description dài |
| Cảnh Giới | Ladder/ascent trái; realm/cultivation/rate/requirements phải | RealmSurface, realm advance/breakthrough read-model/commands | Current/locked/max release ceiling; thiếu requirement, can advance, tribulation route |
| Luyện Thể | Chapter rail, focal/diagram hiện có, tier/details/cost | BodySurface/Fidelity và registry Bát Mạch/Chu Thiên/Luyện Thể thật | Locked/available/max, hidden branch không render, invest failure, overflow text |
| Quán Khí | Paper ritual selector + detail + confirm, cùng button/node skin | QuanKhiPanel và initiation domain; offerable ways giữ admission | Chưa chọn, selected, unavailable, confirm/cancel, failed commit |
| Pháp Bảo | Collection/detail: item art hiện có, grade/path/EXP bar | ArtifactPanel và artifact domain; không gộp EXP với kỹ năng | Scope-hidden, chưa sở hữu, EXP cap, grade gate, upgrade cost |
| Trận Pháp | Formation canvas 65%, detail/controls 30%, slot-frame/orb markers | TranPhapPanel và projection/preview contracts | Scope-hidden, empty/occupied/invalid slot, drag hover, confirm/revert nếu có |
| Đồng Hành | Collection cards + detail, slot/gold headers | CompanionPanel domain model, recruit/equip/management thật | Scope-hidden, none/owned/selected/locked, costs, failure |
| Chi Hiền Quán | Recruit/relationship/gift tabs, list-row+detail | WorkerLodgePanel và ChieuMo/DuyenPhan/QuaTang consumers | Scope-hidden, empty, insufficient, selected, item/worker removal |
| Luyện Đan | Recipe list 25%, cauldron hiện có 30%, detail/queue 40% | AlchemySurface/PillRoomPanel; recipes/jobs/cancel/current capacity | No recipe, materials short, job active/done/full, cancellation, brew failure |
| Sản xuất | Job/resource rows, progress-track, building header | ProductionPanel, BuildingConstructionGate, BuildingDetailPopover | Unbuilt/buildable/realm lock, cost short, active/ready, upgrade max |
| Bản Đồ | Stage/route art hiện có + marker, chapter tabs, detail | ExplorationSurface/StageSelectPanel; zone/chapter/stage and modes thật | Locked/available/cleared/perfect, boss, mode selection, start failure, ceiling |
| Thương nhân | Grid/list + item inspector + cost/quantity controls hiện có | VendorPanel canonical buy/sell commands | Empty, stock/state if present, cannot afford, count bounds, item removed |
| Tàng Kinh Các | Reading paper, left contents, right readable article | ScripturePavilionPanel/LoreCodex; không nhập selector đạo lộ vào lore | Empty collection, section selected, long text, search nếu đã có |
| Nhiệm Vụ | List+detail, objective progress, reward slots, claim | QuestScene/Fidelity and questOps models | No quest, ongoing/completed/claimed, insufficient objective, scope-hidden daily |
| Cài Đặt | Internal section rail; actual selects/radios/sliders/toggles | SettingsSurface và save/account/update/language/audio/UI scale commands | Valid/dirty/pending/error, confirm destructive action, update state, account state |
| Chiến đấu | Dark vitals/turn/dock/AI/log panels + orb skills | CombatSceneOverlay/Fidelity and existing insets/events/acks | Intro/countdown/active/paused, cooldown/cost/invalid target, cast feedback, exit confirm |
| Độ Kiếp | World sky + chapter tracker, dark vitals, paper mind card | Tribulation overlay/Fidelity; actual chapter/question/answer/time/HP | Question active/answered/expired, hp low, chapter change, success/failure; no invented auto/skip |
| Thắng | Paper ceremony, gold ribbon, reward grid | VictorySurface/Fidelity and reward summary; auto/manual action semantics | Empty/many rewards, retry countdown, next/retry eligibility, continue absent in auto |
| Thua | Same ceremony with cinnabar ribbon, reason/partial rewards | DefeatFidelity and existing retry/return/countdown semantics | Cultivation-gap hint, timer, retry canceled by existing interaction, partial/no reward |
| Hệ thống / micro | Panel/tooltip/button/row primitives, no sci-fi scanline | Tooltip, Toast, Confirm, OfflineSummary, TalentEntitlement, Breakthrough, Tutorial, WorldAnnouncement, Loading/Error/SaveIncompatible | Empty/loading/error/locked/confirm, long localized text, z-order, keyboard focus, screen reader status |

## Art động và chuyển động

Nhân vật: clip/atlas đang có, resolve theo profile/armed/đạo lộ từ production catalogue. HEAD ENTITY_ART_MODE='static'; không đổi cờ toàn cục chỉ để UI có animation. UI figure renderer nhận clip từ owner hiện tại hoặc wrapper UI riêng; thiếu clip phải báo rõ, không tự vẽ/thay ảnh tĩnh. Home fidelity hiện cũng dùng DONG_FU_ART.cultivator tĩnh: cần thay vùng đó, không chỉ Nhân Vật.

Khung/nút không cần sprite animation riêng. Hover brightness khoảng 1.08, pressed 1px/100ms, selected overlay pulse chậm 1.8s opacity nhẹ, mở paper 220–320ms, tooltip 120ms. Reduced motion giữ trạng thái tĩnh. Animation không nhận authoritative gameplay outcome. Nếu cần custom UI VFX/sprite ở lần wiring, author/export qua Arcadia theo game/docs/tooling/arcadia-effects.md; pack này không đòi một custom animated VFX mới.

## Đổi tên và bố cục

Các tên đề xuất, cần agent thể hiện trong báo cáo wiring: 'Kho Vật' → 'Túi' (nav inventory); 'Sơn Hà Đồ' → 'Bản Đồ' (nav exploration); 'Tâm Pháp' → 'Công Pháp' (nav technique) nếu đúng locale hiện tại; 'Đạo Tu' → 'Đạo Lộ' trong nhãn UI khi nói về way. Đây là rename display, không đổi ID/API/data name. Tên nội dung do data sở hữu không mass-replace.

Sidebar chuyển từ rail giấy nhỏ sang rail mực vàng dễ đọc; chuyển vị trí không chuyển owner. Equipment và inventory có thể cùng ngôn ngữ visual nhưng không gộp action/logic. Không coi các menu/chi phí/số liệu trong ảnh tham chiếu là contract production.
