# Plan wiring toàn bộ UI

> Phần kế hoạch cũ bên dưới là lịch sử của bản production bị từ chối. Branch hiện tại là `codex/tien-hiep-ui-redesign`. Chuẩn mới và component thật nằm trong `SHARED-VISUAL-CONTRACT.md` và `UI-SHARED-CONSUMER-MAP.md`; bộ xem 32 bố cục nằm tại `/ui-design-review.html`. Không tiếp tục dùng pack/chrome cũ để tuyên bố đúng concept. Vendor hiện là bán vật liệu; Pháp Bảo là một Ngũ Hành Châu; các mẫu anatomy không phải gameplay tier. Luôn dùng census hiện tại trước migration.

Branch **codex/hoa-cau-fireball-vfx**. Worktree **E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx**. App root **game/**. Baseline **f8af8007b0b6519e6aa6997fedad2cc77939538a**. Authoring hiện untracked, chưa commit/push. Agent nhận việc phải dùng file local tại đây hoặc gói ZIP, không giả định remote branch có art.

## Contract tiếp nhận

Thiết kế chuyển sang sơn thủy sáng / giấy ngà / mực vàng. Giữ gameplay, APIs, costs, slot counts, skill prerequisites, save và progression. Layout chỉ nhận read-model và issue command hiện có. Khóa UI bằng eligibility hiện tại, giữ validation domain tại click/commit. Không tự tạo rules hoặc thay failure atomicity. Chữ đi qua i18n hiện có.

Re-audit HEAD và status trước wiring; giữ thay đổi art/docs của đợt này. Nếu source drift, cập nhật consumer census và baseline, không thực hiện theo tên component cũ một cách mù quáng. File chưa tracked vẫn là deliverable được user yêu cầu.

## 1. Shared skin và renderer

Consumer: huyenKimChrome registry, InkNineSlice và primitives button/panel/tooltip/slot/tab/field. Tìm cả direct asset URLs bằng ui-art-consumer-search.txt; thay registry không phủ hết fidelity components.

- Load pack theo AssetBaseUrl hiện có. Pixel sourceRect đã loại khoảng trống lớn của ảnh, threshold alpha 8 chỉ xác định rect, không sửa alpha.
- Frame: nine-slice sau sourceRect; slices là **source pixels**, destinationBorder là CSS pixels. Center page/panel/slot transparent; paper-surface đặt riêng dưới khung. Navigation rail center fill.
- Horizontal plates: three-slice sourceRect, capFraction .22; giữ caps, kéo phần giữa. Tránh ép button dài thành hình vuông; compact utility dùng orb-frame. Canvas preview là mẫu hình học, agent có thể dùng crop+CSS border-image hoặc renderer tương đương.
- Orb/avatar/building dùng contain-sourceRect; world-vista cover; paper là surface/tile. Không kế thừa slice/1×2× của pack cũ. Giữ góc khi đổi kích thước; dùng border ngoài lớp content.
- Các ornament cũ imperial-scroll-roller/corner/cloud được suppress vì frame mới đã có ornament. **alchemy-cauldron-prop được giữ**, không suppress. Null legacyMapping phải phân biệt theo preserved/suppressed.
- Chữ/icon/số/content độc lập. Bitmap mới không tint; glyph SVG có thể recolor vàng. Item/skill art giữ màu gốc; rarity bằng inner ring/badge riêng, không tô cả PNG.
- Native scrollbar được skin mực vàng với track/thumb; progress-track dùng chung vật liệu, không giả slider giá trị mới.

Deliverable: shared components có normal/hover/pressed/focus/selected/disabled/loading/error. Nút khóa không emit command, không dùng opacity làm cách giải thích duy nhất. Empty slot không có glyph giả.

## 2. Nhân Vật trước, rồi Động Phủ và navigation

**Nhân Vật:** LeftPanel → CharacterSurface → CharacterFidelityScene/Figure là chain đang mounted; không chỉ sửa CharacterPanel/CharacterScene lịch sử. Áp layout CSV làm anchor ban đầu, dùng container grid với 4 vùng identity / figure / stats / details. Chiến lực/points/talent/ngũ hành đều lấy model, không dùng số trong ảnh.

Figure hiện dùng CHARACTER_ART.figure tĩnh. PlayerPortrait có EntitySpriteCanvas nhưng ENTITY_ART_MODE tại HEAD là static; chỉ đổi wrapper chưa bảo đảm animation. Resolve clip hiện có cho UI theo profile/armed state, không đổi global flag làm ảnh hưởng battle. Ví dụ catalogue phap_tu_shared có idle 33 frame, sheet và atlas ở assets/characters/animated/phap_tu_shared. Preview chỉ dùng clip đó minh họa; production phải resolve nhân vật thực. Không vẽ nhân vật mới hoặc sửa spritesheet.

**Động Phủ:** DongFuStage / DongFuHomeContent / fidelity HUD/wheel/board. DongFuHomeContent cũng dùng DONG_FU_ART.cultivator tĩnh: thay renderer figure ở đây nữa. World-vista là scenery trang trí, giữ building props và hit targets hiện tại ở layer riêng; không biến palace painted thành command. Không thay day/night/game seed như tác dụng phụ đổi background.

Thiên Cơ: DongFuStage → useThienCoEntries → model → DongFuHomeContent → DongFuBoard. Giữ entries breakthrough/quest/ready/active/upgradeable và target thật, không viết timer/event service mới.

Wheel đóng mặc định; nhấn figure mở, nhấn lại/ngoài/Escape đóng; focus không mất sau đóng. Entry thực từ catalogue và betaWheelSlots, badges thật. Navigation canonical có 11 IDs: character, realm, technique, skill, body, inventory, exploration, alchemy, equipment, quest, settings. Không thêm entry theo screenshot. Scope-hidden không bật.

Nghiệm thu: figure animate và đổi profile đúng; board live refresh không cần reopen; wheel gating đúng; nav keyboard/scroll; không che building click targets tại 3 desktop sizes.

## 3. Túi, Trang Bị, Kỹ Năng, progression

InventorySurface/BagGrid/SlotView: slot-frame + category/tab/filter/capacity thật; inspect item, stack, empty/no-match/full. Grid 8 columns là reference khi đủ rộng, không bắt buộc mọi viewport.

EquipmentSurface/Fidelity: dùng production **#doll/#workspace** slots và EquipmentPaperdoll. Không đem fallback figureImage/fixture summary numbers vào game. Giữ socket list thực, equip/unequip/compare và selected refresh. Khí Đường dùng operation tabs có sẵn, không gộp logic inventory vào equipment.

SkillSurface/Fidelity/SkillPaper*: đổi cả node-ring-v1 và paper-nine-slice URLs trực tiếp. Orb frame chứa **canonical skill icon**, lock SVG và level pips riêng. Edge/prerequisite từ data; selected inspector có current/next/cost/conditions; Hỏa/Kim/Mộc/Thủy/Thổ tabs chỉ hiện nếu model có. Không tự đổi topology/rules theo tree fixture.

Technique/Realm/Body/QuanKhi: áp scene table, giữ APIs và allowed ways. Đạo Lộ là nhãn display; phong cách phụ Kim vàng, Mộc ngọc, Thủy lam, Hỏa chu sa, Thổ nâu vàng; không suy ra tỷ lệ từ art.

Nghiệm thu: actions, eligibility/reason/refresh đúng trước-sau; locked vẫn detail được; selected item/node bị mất xử lý đúng; long localized text, many talents và overflow không đè CTA.

## 4. Workshop, map, quests, lore và màn đang hidden

Alchemy/PillRoom giữ cauldron/art, recipes và queue; Production/building giữ construction gates; Vendor giữ canonical buy/sell; Quest giữ claim; Exploration giữ stage/mode/ceiling; Scripture/Lore giữ reading/search có thật.

Artifact/TranPhap/Companion/WorkerLodge: thiết kế collection/master-detail như SCENE-SPECS nhưng không đổi admission/beta scope. Trang đã hidden không được unhide để “cho đủ UI”. Dùng art hiện có khi scope cho phép.

Nghiệm thu: empty/loading/error/insufficient/active/ready/max; long list cuộn trong vùng, action/cost gần nhau; không command mới và không query làm gameplay mutation.

## 5. Auth, settings, system/micro

AuthEntryScreen/CharacterCreationScreen: world + paper form, logo wordmark hiện có, input/talent cards, auth errors/loading/save compatibility thật.

Settings: select/radio đúng semantics language/UI scale; slider cho volume; save/account/update giữ behavior. Rename display ở locale, không rename ID:

| Nếu nhãn cũ tồn tại trong locale | Nhãn mới |
|---|---|
| Kho Vật | Túi |
| Sơn Hà Đồ | Bản Đồ |
| Tâm Pháp (nav technique) | Công Pháp |
| Đạo Tu khi nói về cultivation way | Đạo Lộ |

Báo diff i18n thực tế, không mass replace tên content trong data. Logo giữ Tu Tien IDLE.

Tooltip/Toast/Confirm/OfflineSummary/Tutorial/Loading/Error/SaveIncompatible và entitlement dùng panel/row/button primitives. Modal focus trap/restore và z-order theo host; không cấy actions save/destructive vào preview fixture.

## 6. Battle, Tribulation, results và nghiệm thu tổng

CombatSceneOverlay/Fidelity/topbar/order/skilldock/log/AI: dark plates, orb skill frames, gold state; giữ Phaser viewport insets, timing, ack và authoritative outcomes. Không dùng world-vista Động Phủ thay battle stage; preview combat chỉ minh họa HUD skin.

Tribulation: skin chapter/vitals/mind-question/results; dùng question/time/answer thật, không thêm skip/auto. Victory/Defeat: ribbon vàng/chu sa, real reward grid, countdown/retry/return hiện có; art mount không claim reward.

Mỗi nhóm wiring là một phần độc lập review được. Thực hiện 1→2 trước rồi 3/4/5, cuối 6; không một diff khổng lồ thay cả project mà không capture từng flow.

## Acceptance agent wiring phải bàn giao

Cho từng row SCENE-SPECS: consumer đang mounted, asset dùng, command owner giữ nguyên, eligibility+reason+refresh, state variants, viewport evidence, PASS/FAIL/BLOCKED/untested. Scope-hidden ghi source-backed design và runtime hidden, không giả bằng preview.

Capture game thật tại 1280×720 / 1672×941 / 1920×1080; zoom/UI scale theo settings thật. Mobile được hoãn theo yêu cầu mới nhất. Dữ liệu dày phải vẫn đọc/action được; rail/inspector scroll, không mất information. Check click, focus/Escape, disabled, modal layering, selected refresh, hover, animations/reduced motion, no console asset warnings.

Re-scan art URLs để không sót cyan/scanline hoặc legacy fidelity chrome ngoài registry. Không sửa art/data/gameplay ngoài nhiệm vụ chỉ vì audit gặp vấn đề khác. Chạy verification cần thiết cho production diff và browser flow thực. Authoring preview/JSON PASS không thay được runtime evidence.
