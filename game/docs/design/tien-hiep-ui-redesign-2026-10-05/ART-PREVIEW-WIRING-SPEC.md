# Art preview and later wiring specification

User ruling, 2026-10-05. This is the maintained record of requirements to preserve when wiring approved art. Work proceeds one scene at a time: create components and compose the scene, show the interactive preview, collect feedback, revise, repeat until the user approves.

## Completion boundary

The current deliverable is finished artwork, coherent composition and the required visual component states. Interactive previews demonstrate those states and transitions. Wording, sample values, validation, commands and simulated outcomes in a preview are review aids; they do not establish new gameplay/backend rules or require production integration to complete an art iteration.

Do not wire authentication, gameplay or persistence as part of this art task. Record requested behavior here for the future implementer. Preserve explicit user decisions; distinguish a visual requirement from a proposed implementation. Preview approval does not certify production wiring or backend correctness.

## Auth scene

Preview: `/ui-auth-preview.html`.

| ID | Requirement to preserve when wiring | Preview / art acceptance |
|---|---|---|
| AUTH-01 | Five opening actions: login, create account, trial/continue, settings, exit game. Exact copy remains adjustable. | Consistent reusable button art, readable normal/hover/pressed/disabled states. |
| AUTH-02 | Login/register/settings panels open from the right and close toward the right. All dismissal paths use the same exit transition. | Both slide-in and slide-out are visible. A panel must not disappear immediately when dismissed. |
| AUTH-03 | Retain the exiting panel and its content until slide-out finishes; unmount/hide it only after transition completion. | Current preview uses 360 ms in each direction. This is an initial presentation value, not a gameplay timer. Reduced motion may omit motion. |
| AUTH-04 | No X button. Clicking anywhere outside the active panel dismisses it; Escape also dismisses it. | Outside dismissal demonstrates AUTH-02/03. |
| AUTH-05 | Opening/closing a panel must not scroll or shift the full scene. Focus must not pull an offscreen sliding panel into view. | Background composition stays stationary throughout both transitions; focus enters after slide-in. |
| AUTH-06 | Use existing login/register presentation components when later integrating, preserving the actual authentication owner. | Existing credential form is reused with simulated submission only. No account is created. |
| AUTH-07 | When a saved character is available, the third action reads Continue and resumes it. Otherwise Trial goes to character creation. | Preview provides a simulated saved-character toggle; no save is read or written. |
| AUTH-08 | Opening settings include appropriate pre-game audio/display/language controls from existing settings. | Audio on/off, master/music/effect/UI volume, reduced shake, UI text scale and language are illustrated. No persistence/game settings integration is required here. |
| AUTH-09 | Exit Game has a previewable confirmation and exit state. Actual application exit belongs to later runtime wiring. | Confirmation and exit are simulated; the preview does not close the browser. |
| AUTH-10 | Secondary panels use warm paper, restrained watercolor scenery and gold/cloud ornamentation from the same visual system. | Avoid plain white backdrops and mismatched chrome. Exterior decorative cutouts use transparency where appropriate. |
| AUTH-11 | Hover is visible but restrained and consistent across suitable buttons. | Muted warm gold, soft narrow glow and faint cloud ornaments. The earlier strong bright glow is superseded; disabled controls do not show an active hover. |
| AUTH-12 | Login/register use the same warm paper backdrop as Settings, with cloud ornamentation and the same button backdrop as the main opening scene. | The former dark auth inspector is superseded. Scenery is proportionally cropped, never stretched to fit a panel. Buttons reuse the main scene's nine-slice artwork, preserving corner geometry. Placeholder titles/copy are not gameplay requirements. |
| AUTH-13 | ID/password use simple dark input surfaces with thin muted gold borders, following the supplied auth reference. | The ornate scroll-shaped input artwork is superseded. Retain readable labels, input icons, password reveal and a subtle focused border. |

## Future changes

Append each newly requested behavior under its scene with a stable ID, the user's intent, the visual demonstration and the obligation for later wiring. Do not infer gameplay rules from placeholder copy or mock data. If a requested integration changes existing game semantics, the future implementer must raise that conflict with the user.

## Current iteration evidence

The slide-out issue was caused by the transition wrapper detecting no duration on its own element while the animated transform lived on a descendant. The preview now explicitly retains the transition wrapper for both 360 ms phases. Verify opening and each dismissal path in the interactive preview; this is presentation evidence, not backend certification.

### AUTH-14 — Không có thanh tab
Đăng nhập và đăng ký mở từ hai nút ở scene chính. Scene con không có thanh tab chuyển qua lại.

### AUTH-15 — Chơi Thử / Tạo Nhân Vật
Chuyển sang scene phụ riêng, không slide. Giữ nguyên background lớn của scene mở đầu; nút quay lại ở góc trên trái. Bảng tối viền vàng gồm chín thẻ thiên phú, bảng mô tả, tên và nút ngẫu nhiên, năm lựa chọn phía dưới và nút bắt đầu như concept đã duyệt. Toàn bộ chữ, thông tin và lựa chọn là mock để duyệt art; chưa xác định thay đổi logic. Người dùng sẽ xử lý nội dung sau.

### AUTH-16 — Hover và CTA tạo nhân vật
Hover là một thay đổi art nhẹ, đồng thời; không có đợt sáng/mây thứ hai theo sau. CTA Bắt Đầu Tu Hành nằm giữa, đè qua viền đáy bảng như concept; trạng thái mặc định tối, chữ ngà không phát sáng. Không thay đổi logic.

### HOME-CHARACTER-01 — Scene phụ trên Động Phủ
Panel Nhân Vật mở trực tiếp trên nền Động Phủ, tối đa 80% rộng và 75% cao. Cây icon điều hướng ở bên trái. Mainstat dùng ống màu và trạng thái MAX; dữ liệu mock. Mainstat và card Cơ Bản thẳng hàng gần đường phân cách dưới tiêu đề. Chi tiết tách thành Cơ Bản, Chiến Đấu, Khác; chỉ vùng chi tiết cuộn, không hiển thị thanh cuộn. Cuộn bên ngoài vùng chi tiết không chuyển cuộn vào bảng. Không wire gameplay.

### HOME-NAV-02 — Cây điều hướng độc lập
Trục thẳng, các nút huy hiệu tròn + bảng tên cùng vị trí ngang. Cây ở ngoài panel scene con, cho phép cuộn riêng và ẩn thanh cuộn (người dùng duyệt ngoại lệ này). Nút scene đang mở glow nhẹ và scale 1.1; khoảng cách phải đủ để không chồng nút. Khi wire sau này, active theo scene đang mở, không theo hover. Hiện chỉ panel Nhân Vật được nối trong preview.

### HOME-CHARACTER-02 — Card và hiệu ứng
Card dùng một backdrop art 9-slice chung; bảo toàn góc khi thay kích thước. Ba card chi tiết chia đều chiều cao bên phải, mỗi nội dung card cuộn độc lập; không cuộn cả cột. Bỏ mũi tên góc phải. Ống mainstat có dòng năng lượng CSS theo màu, chỉ chạy trong phần đã nạp; reduced-motion dùng ánh tĩnh.

### HOME-NAV-03 — Vùng nhìn thấy của cây
Nền giấy mờ nhẹ chỉ phủ vùng cây, clip đúng mép trên/dưới. Hiện khoảng bảy mục, cuộn các mục còn lại; không hiển thị scrollbar. Đường nối dùng raster art riêng, không dùng đường CSS/SVG tạm.

### SHARED-PANEL-01 — Kích thước chuẩn dùng tiếp
Panel scene con trên canvas 1440×810: trái 24%, rộng 74%, trên 12.5%, cao 75%. Background giấy art và kích thước của Nhân Vật là chuẩn chung cho các panel tiếp theo. Cây điều hướng là surface độc lập trái 18px, rộng 300px, cùng chiều cao và vị trí dọc; đủ chỗ cho art nối, nút scale 1.1, glow và dư mép. Surface dùng raster backdrop riêng, không dùng CSS để vẽ nền. Vùng bên trong scroll và clip, khoảng bảy mục nhìn thấy.

### HOME-SKILL-01 — Panel Kỹ Năng
Cùng rectangle và nền giấy với Nhân Vật. Cây điều hướng độc lập, active theo panel. Ngũ Hành đổi cây mock; bấm node đổi bảng thông tin. Node đã học/khả dụng/khóa, nút nâng cấp chỉ là preview không tiêu hao hay đổi gameplay. Dữ liệu cây lấy fixture hiện có, không phải spec cây chính thức.

### HOME-NAV-04 — Bỏ bottom navigator
Bỏ thanh điều hướng ngang dưới Động Phủ. Wheel sẽ thiết kế ở bước sau. Trong preview hiện tại cây trái vẫn hiển thị ở Động Phủ để mở Nhân Vật/Kỹ Năng và quay về Động Phủ; không wire gameplay.

### HOME-SKILL-02 — Frame và đường nối
Bốn raster frame tròn reusable: parent/main/sub/passive, nền và lòng frame transparent; icon là lớp riêng. Có hover/focus, selected glow trên frame, pressed, locked muted. Đường nối SVG viền vàng + nút kim cương; hai đầu node đã học thì ánh sáng chạy loop. Đây là mapping trạng thái fixture để duyệt, khi wire phải lấy trạng thái từ owner gameplay. Reduced-motion tắt loop. Backdrop điều hướng phiên bản mới tối, mép giấy sáng nối với panel; giữ navigation độc lập.

### HOME-SKILL-03 — Đường nối bằng art ống
Thay đường nối dựng hình bằng raster skill-connection-pipe-v1.png. Asset có viền vàng và lòng ống tối; SVG chỉ đặt/xoay asset và chạy ánh sáng trong lòng trên nhánh activated fixture. Không dùng CSS để vẽ hình ống. Khi wire, activation do gameplay cung cấp.

### HOME-NAV-05 — Nối backdrop bằng sơn thủy
Mép nối vàng dày bị bỏ. Raster overlay núi, mây, cành lá có alpha chồng qua ranh giới sidebar và panel giấy. Nút điều hướng nằm trên overlay để không bị che.

### HOME-EQUIPMENT-01 — Bốn tab dùng chung bố cục
Trang Bị, Cường Hóa, Tẩy Luyện, Tinh Luyện. Không có Hóa Luyện/Phân Giải trong bản thiết kế này; không xóa hai chức năng khỏi game. Sáu slot tròn chia hai cột ba hàng; vùng giữa để trống cho art idle đã có. Bỏ bảng so sánh giữa và lực chiến. Túi bên phải chiếm toàn bộ workspace; card dưới trái là tổng stat cộng từ trang bị. Kích thước và nền panel tuân theo SHARED-PANEL-01.

### HOME-EQUIPMENT-02 — Lựa chọn và component art
Ba tab luyện khí chọn trực tiếp từ sáu slot bên trái; không lặp hình vật phẩm hay danh sách chọn vật phẩm bên phải. Chuyển tab giữ nguyên vị trí sáu slot, vùng idle và card tổng stat. Item art dùng nguyên file đã có trong game, không vẽ lại. Component UI reusable gồm slot tròn, slot túi, card 9-slice, nút, dấu phân cách, vòng cấp cường hóa, tab brush và ống năng lượng. Asset giữ alpha ngoài silhouette; hình đặt contain, card và nút dùng 9-slice.

### HOME-EQUIPMENT-03 — Preview và wire sau
Filter/sort/chọn túi, chọn slot, khóa dòng tẩy luyện, xem kết quả mock và các nút thao tác chỉ thay state cục bộ của preview; không gọi service, store, RNG game, mutation hay save. Stat/giá/cấp hiện tại là chữ mẫu, không xác định công thức hay điều kiện thao tác. Khi wire, owner trang bị/luyện khí hiện có cung cấp model và kết quả; không suy diễn logic từ mẫu. Tooltip và art idle động chưa nằm trong bước này. Hover nhẹ, selected glow ở frame, pressed tối hơn; ống năng lượng chỉ chạy trong phần fill và dừng loop khi reduced-motion.

### EQUIPMENT-FILTER-04: replacement art and interaction states
Four bag filters only: All, Weapon, Armor, Jewelry. Remove Other from this preview. The eight-column slot grid and four-column filter row share their outer bounds; each filter occupies two slot columns including the intervening gap. New transparent complete raster states: equipment-filter-{normal,hover,selected,pressed}-v2.png. Render with contain, no nine-slice or distortion. Hover and press switch immediately, with no delayed secondary glow. Selection remains gold on hover; pressed temporarily uses recessed amber art. Slot frame hover and selection have visible quality-tinted halos, leaving original item art untouched. All interaction remains local preview state; future wiring must preserve these presentation states.


### HOME-BODY-01: Luyen The interactive art preview
Entry: Dong Fu independent navigation body opens HomeBodyArtPanel. Shared outer rectangle: left24%, top12.5%, width74%, height75%. Inner layout 20/50/30. Three family navigation entries Ren The / Khai Mach / Dan Linh, reuse existing shared raster card/button art and new normal/lit navigation medallions. All use silhouette-seated-v1.png. Only upgrade and navigation are interactive, plus eight-page meridian pagination. Preview counters are local fixtures, not game progression.
Ren The: upgrade cycles gray/jade/violet/gold and then swaps process art; this is only a visual demo. Khai Mach: ten separately positioned nodes, straight tube raster connections, activated core loops; page changes only mock node coordinates. Dan Linh: eight composable pieces plus stars, rotating orbit art. Future domain owner supplies values/activation/process/page, no formulas or storage in presentation. Preserve reduced-motion static fallback and separate alpha-bearing art layers. Existing material art reused.
Evidence: type check passed; body + equipment browser scope 3 tests passed. Actual screenshots body-{ren,khai,dan}-v2.png. Confirmed visible seated silhouette, card CTA inside bounds, ten meridian nodes, mock paging, original item art retained, storage unchanged by mock interaction. This is art preview verification; not production QA certification.


## BODY preview revision 2026-10-06
Rèn Thể now displays all six independent overlay groups together in one shared silhouette stage, per latest review request. Bì contour, Nhục biceps, ten repeated Cốt vertebrae with connecting core, one Tạng heart, Huyết channels, and a small Mạch circle within forehead with three separate nodes. Two states only: silver-gray and gold. Upgrade toggles mock preview state; no domain commands or storage.
Dẫn Linh: Tiểu Chu Thiên consists of one core and two orbit layers, each half its prior size. Đại Chu Thiên adds three outer orbit layers around the same center. Independent starting angles, directions, periods (19/27/33/43/51 seconds) and phase offsets avoid synchronized rotation. Reduced-motion keeps all layers static. This is a presentation specification for later wiring, not a change to game progression.

## HOME-TECHNIQUE preview 2026-10-06
Approved Tam Phap concept uses the shared panel rectangle and independent home navigation. Manual art area is intentionally EMPTY per user instruction: no book, pedestal or temporary artwork. Four milestone controls, current selection glow, mastery tube, attribute card, grade comparison, material and upgrade art reuse the common components. Milestone selection and upgrade only mutate local preview values; no gameplay commands, costs, persistence or backend wiring. Production consumer must supply actual stages, eligibility and read-only stat values later. Right card retains original size and is translated upward 28px, not stretched.
Validation: type-check passed; interactive browser test verifies empty art area, four milestones, mock upgrade, unchanged local storage, asset decoding and button containment. Screenshot: runtime-evidence/technique-empty-art-v1.png.

## HOME-REALM interactive transition 2026-10-06
Shared panel and navigation; horizontal circular milestone timeline with one expanded central realm card and two lower information regions. Upgrade is mock only. On advance: existing card clips inward to a circle and fades over 250 ms; track translates left one milestone over 700 ms; next card reveals outward from a circle over 450 ms. Artwork is not stretched during the reveal. Ignore repeat presses during transition; after-enter releases the preview interaction guard. Reduced-motion skips transitions. Preview cycles sample milestones 1/4/8/12/13/16/18 and wraps for demonstration only; this is NOT a progression rule. Backend wiring must consume an authoritative successful upgrade before starting the visual transition, never award progression from animation completion. Navigation unmount cancels all transition visuals; no persistence or resource mutations. Card text/requirements are placeholder content for review.

### Realm optional tiers and separate actions
Two independent buttons share the active card footer. Đột Phá previews the next tier. Độ Kiếp previews the next realm, resetting its sample tier to 1. Optional tiers 13–18 remain accessible for additional benefits; they do not block the realm transition. Mock eligibility is tier >=12 solely for demonstration; production eligibility, tribulation outcome, benefits and optional-tier rules must be provided by gameplay authority. Ineligible Độ Kiếp uses muted locked button art and ignores clicks in preview. Both visual transitions use the same slide/card reveal. No game logic was changed.

## HOME-INVENTORY 2026-10-06
Kho Vat follows approved first inventory concept: shared parchment panel, three primary tabs (equipment/materials/pills), dark search field, seven equipment filters, 12x4 slot grid, centered pagination art and sort control at bottom-right. Existing equipment/material/pill images are reused; no new item illustrations. Search, category, selected slot, sorting and tab state are local mock presentation. Sample data fits one page; previous/next remain inactive until later real pagination binding. Tooltip design deferred. No inventory mutation, equip/use action, storage or gameplay wiring.
Unfinished artifact/companion/guild/sect/secret-realm navigation moves to the final five positions, grayscale and disabled; both native disabled controls and navigation guard prevent opening them in this preview. This does not change production progression or locks.

### Storage scope correction
Inventory navigation/title is now Trữ Vật. Only Nguyên Liệu, Đan Dược and Phân Giải tabs remain. Phân Giải uses existing equipment art as selectable mock inputs and a separate result/action card. Preview action shows a notice without consuming items. Equipment's Trang Bị bag header now has Hóa Luyện immediately beside the capacity expansion button; it remains a mock action pending dedicated design and later domain wiring. This supersedes the earlier inventory equipment tab and earlier exclusion of these actions.

## HOME-ALCHEMY 2026-10-06
Shared 20/50/30 panel: independently scrollable pill recipe list (hidden scrollbar), central existing cauldron art, selected existing pill art over cauldron center, four surrounding ingredient slots with required/owned quantity text and straight raster tube connectors. Right card contains four rectangular progress rows with energy tubes and a preview start button. Recipe selection replaces center pill and right heading. Start toggles local progress samples and connector flow; reduced motion freezes flow. Labels and progress channels are illustrative presentation placeholders, not new gameplay rules. Existing cauldron, pill, material and reusable slot/button art are reused; no item art regeneration. Later gameplay must supply recipes, quantities and actual progress through read-only presentation data; animation never consumes materials or awards pills.

## HOME-FORMATION 2026-10-06
Approved 3x3 formation composition is reproduced inside the shared panel: current formation marker and board left, three formation choices/information/selected position right, existing companion portraits in bottom roster, reset/confirm art actions. Preview selection is a detached local draft: choose board cell then roster portrait; each mock companion occupies at most one cell. Ninth mock cell is locked to show locked art. Confirm only shows a notice, reset restores sample draft. No formation loadout, battle placement, companion ownership or rank logic is wired. Rank tab displays placeholder progress for visual review only. Existing character portraits are used and not regenerated.
Redundant Luyện Khí navigation and home landmark are removed from this preview; actions are represented under Trang Bị and Trữ Vật as directed.

## HOME-MAP
Bản Đồ opens the existing Sơn Hà Đồ composition inside the shared home panel bounds. Reuses PaperSceneDesigns and existing landscape/item art. This connection is preview-only; stage/chapter controls retain the existing static mock behavior, with no gameplay or persistence commands.

## HOME-QUEST
Quest navigation opens the shared panel. Components: category button (normal/hover/selected/pressed), list row and status badge, energy tube, detail banner, objective marker, reward slot, claim action. Category and task selection use detached preview state. Claim displays a notice only. Gameplay filtering, eligibility, rewards and persistence remain unwired.

## HOME-SETTINGS / HOME-HELP
Settings and Help use the shared panel rectangle and existing card/button art. Settings exposes four audio sliders, enable sound, reduced shake/motion, UI scale, language, reset; image quality is a proposed preview control and needs backend capability confirmation at wiring time. All settings are detached and neither persisted nor sent to game services; language selection is illustrative. Help has five selectable topic pages; copy is placeholder for later editing. Verified navigation, slider and option interaction, topic switching and unchanged localStorage.

## HOME-PRODUCTION
Shared panel: Khai Vật Đường heading, horizontal Linh Mạch storage/harvest card, three reusable ProductionSourceArtCard instances. Source component contains landscape banner, material medallion, title/type badge, description, level, energy progress, repeat checkbox, costs and upgrade button states. Existing item art is reused. Harvest sets mock storage to zero; upgrade increments mock level capped at nine; repeat toggles detached UI state. No timers, resource awards, resource spending, gameplay services or persistence. Source landscape illustrations currently reuse existing warm landscape assets. Browser verified all three cards, repeat/upgrade/harvest and unchanged localStorage; type-check passed.

## TRIBULATION COMPONENT ART
Asset pack: public/assets/ui/tien-hiep-2026-10/tribulation/manifest-v1.json. Includes title/chapter plaques, optional chapter tassel, question panel, four answer-button states, countdown badge, HP frame, time tube and caption plaque. Alpha validated on source sheet (0..255); preserve aspect ratios. No baked text, character, dais or background. Typography, HP fill and countdown belong to separate presentation layers. No tribulation gameplay code changed.

## COMBAT COMPONENT ART
Pack: public/assets/ui/tien-hiep-2026-10/combat/manifest-v1.json. Includes area title, player status, initiative strip, portrait ring states, four control-button states, skill tray/ring/label, item slot/quantity badge, HP caption/tube/fill, enemy HP and expand button. Keep aspect ratios; overlay text and existing portraits/skill icons independently. All generated component exterior and portrait holes verified alpha=0 at sampled points. No combat logic, scene topology, timing or gameplay wiring changed. Initiative source artwork currently has four inset circular sockets; dynamic queue count must be reviewed at preview assembly rather than inferred as a game rule.
