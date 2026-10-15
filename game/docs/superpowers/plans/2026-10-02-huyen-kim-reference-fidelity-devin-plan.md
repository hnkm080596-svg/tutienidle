# Huyền Kim Reference Fidelity — Devin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. If isolated workers are used under the repository QA protocol, use `superpowers:subagent-driven-development` and its ownership rules. Steps use checkbox (`- [ ]`) syntax for tracking. The assigned implementer is Devin; this document does not dispatch any agent.

**Goal:** Hoàn thiện giao diện Huyền Kim trên các luồng thật của game, bám sát bố cục, chất liệu, màu sắc, tiêu điểm và chiều sâu của bộ reference; giữ nguyên luật gameplay và các giới hạn Beta.

**Architecture:** Vue/Phaser tiếp tục trình bày dữ liệu và phát lệnh tới các owner hiện hữu. Tái sử dụng primitive tương tác, hệ thống viewport, registry asset và các background parallax; thay bố cục, skin, kích thước và cách ghép scene tại đúng consumer. Mỗi lát cắt phải cho ra một màn chạy thật có thể đối chiếu trực tiếp với reference trước khi lan sang các màn khác.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, Phaser, Vite, Vitest, Playwright; dùng phiên bản đang pin trong checkout, không nâng dependency cho nhiệm vụ này.

**Spec:** Phần hợp đồng thị giác và ma trận scene trong tài liệu này, cùng `game/docs/design/huyen-kim-scene-layout-spec.{md,json}`, `huyen-kim-reference-audit.md`, `frontend-contract.md`, `huyen-kim-component-state-matrix.md`, `huyen-kim-ui-art-manifest.json` và ảnh dưới `game/docs/design/references/huyen-kim/scenes/`.

**Status:** PLAN_READY — tài liệu kế hoạch, chưa thực hiện production changes hoặc chứng nhận QA. Ngày lập: 2026-10-02. Các checkbox bên dưới đều là việc Devin phải thực hiện.

## 1. Outcome và thứ tự ưu tiên

Người dùng đã bác bỏ hình ảnh runtime của PR97 vì không giống reference. Nhiệm vụ hiện tại là hoàn thiện **toàn bộ 18 scene trong layout spec**, không dừng ở chín gói stable art hoặc chín bài test của PR97. Bao gồm cả chrome, layout, bố cục cảnh, thông tin, tương tác, responsive và visual acceptance.

Thứ tự authority:

1. Yêu cầu mới nhất của người dùng và `AGENTS.md`.
2. Luật gameplay/Beta/discovery và API/read-model hiện hành.
3. Reference có tên trong bảng §5: authority cho diện mạo và bố cục.
4. Hợp đồng thị giác trong kế hoạch này và layout spec đã hiệu chỉnh theo domain.
5. Asset manifest và các hợp đồng kỹ thuật về slice, alpha, parallax.
6. Code hiện hữu là điểm xuất phát; các prompt handoff cũ là lịch sử.

Kế hoạch này thay mục tiêu hẹp trong `huyen-kim-devin-art-handoff-prompt.md`: "integrate only stable art into the existing UI" không còn là điều kiện hoàn thành. "Substrate/chrome only" vẫn đúng với **trách nhiệm của asset**: ảnh không được chứa luật gameplay. Nó không cấm tái bố cục toàn màn hình.

Các chi tiết reference đã bị forensic audit đánh dấu INVALID/RESERVED/scope-hidden không được triển khai. Ví dụ: VIP/chat, currency thứ tư, random-name, chọn starter, các tab/phần thưởng/hệ thống chưa có domain. Giữ cấu trúc thị giác bằng nội dung hợp lệ; không bịa tính năng để lấp chỗ trống.

## 2. Baseline và nguyên nhân đã xác minh

Mốc đã đọc khi lập kế hoạch:

- PR97: `https://github.com/hnkm080596-svg/tutienidle/pull/97`.
- PR head: `f3461e69124a7e72d6d5061277e95b7978baee2b`.
- PR base: `devin/frontend-ready @ d6e50e5131fe31ce748d251d486192aa20ae36e1`.
- Checkout chỉ dùng để viết tài liệu: `E:\tutienidle`, branch `qa/beta-2026-09-29`, HEAD `5f152ec25eb37c08bfe03e8e6691d32fa32b7ab4`.
- Đây là các mốc lịch sử cho kế hoạch. Devin phải đọc lại PR/base/head đang thực tế, ghi SHA và dirty state trước khi làm; không mặc định các SHA trên vẫn mới nhất.

| Bằng chứng tại PR head trên | Hệ quả / công việc bắt buộc |
|---|---|
| `AuthEntryScreen.vue`: diff 3 dòng thêm / 3 dòng bỏ; đổi backdrop và z-index | Dựng form lệch phải, tỷ lệ card, title, controls và footer theo reference |
| `CharacterCreationScreen.vue`: diff 2/2; chỉ đổi backdrop | Dựng vùng focal bên trái và talent grid 3×3 bên phải |
| `DongFuScene.vue` không có trong diff PR97 | Đưa Động Phủ thành lát cắt ưu tiên; có screenshot wheel đóng và mở |
| Động Phủ đã dùng stack 10 lớp, `DongFuArt` + `DongFuStackLoader` | Bảo toàn parallax/lifecycle/variant; không gọi scene này là chưa có parallax |
| `RealmPanel.vue` chỉ thêm substrate vào hero và ảnh body vào phần cũ | Dựng ascent-map thật; cho Body một composition riêng, không giấu dưới phần Realm kéo dài |
| `src/ui/huyen-kim-chrome.json`: **20/20 slot vẫn `pending`**, URL cũ nằm ở thư mục phẳng | Đối chiếu manifest thực tế có thư mục con, cập nhật registry và migrate các caller còn dùng skin cũ |
| `InkNineSlice.vue`: `chromeId` mới đi qua registry; `assetId` cũ vẫn đi qua CSS fallback | Kiểm tra từng consumer; file art tồn tại chưa có nghĩa runtime dùng art |
| Preview `06-complete-ui-art-pack.png` còn nhiều khung/nút gradient hình học đơn giản | Xem chất lượng art ở kích thước thật trước khi gọi pack là đủ; thiếu mỹ thuật phải có yêu cầu art cụ thể |
| `huyen-kim-stable-art.spec.ts` chụp screenshot và kiểm tra presence/order/drift | Bổ sung phép kiểm composition, ảnh đối chiếu và regression baseline có nguồn chấp nhận rõ ràng |
| CI đã đọc: `asciiComments.test.ts` và `InkWashBackdrop.test.ts` thất bại | Sửa comment mới; thay oracle lỗi thời bằng coverage hành vi tương đương/mạnh hơn, không xóa bảo vệ |

Runtime đã chơi trực tiếp: Login → chơi khách → tạo `KiemTam` → Động Phủ → Cảnh Giới, tại 1280×720. Ảnh lưu ở máy lập kế hoạch:

`C:\Users\hnkm0\.codex\visualizations\2026\10\01\01a0f7b5-053f-71d0-a72c-75577519a956\pr97-{login,character-creation,main,realm}.png`.

Các ảnh này là **before**, không phải golden baseline. Nếu Devin không truy cập máy này, tự chụp lại từ candidate của mình; không coi local URL `54838` là server được phép dùng làm bằng chứng cho worktree khác.

## 3. Global constraints

- Chỉ viết production trong worktree implementation đã ghi nhận. Với kế hoạch Markdown này áp dụng ngoại lệ P2 docs-only; không tạo worktree để viết tài liệu.
- Không tự commit/push/merge/deploy. Quyền thực hiện những thao tác đó chỉ đến từ chỉ thị trực tiếp của người dùng, không đến từ kế hoạch hoặc skill.
- Giữ gameplay/state/save/API authority. Không đổi balance, số talent, số tầng, số slot, unlock, domain topology, reward hoặc kết quả chiến đấu để giống hình.
- `scope-hidden` nghĩa là không có DOM, teaser, tooltip hoặc đường mở vào. `progression-locked` dùng mô hình khóa hợp lệ và lý do từ owner.
- Gameplay action phải theo hợp đồng click-time validation hiện hành, trả lý do tiếng Việt và failure atomic. Auth/form validation giữ đúng hợp đồng service, không áp dụng máy móc luật nút gameplay cho mọi form.
- UI text qua i18n; comment code English ASCII. Typography phải hiển thị đúng dấu tiếng Việt.
- Không tạo spritesheet entity, portrait/content illustration mới, tâm pháp, icon thuốc/skill/material/item/equipment/reward, boss/stage/chapter/realm-emblem hoặc animated VFX trong nhiệm vụ implement.
- Dùng art nội dung hiện có hoặc slot trung tính có kích thước đúng. Các nội dung bị loại trừ không được dùng làm lý do bỏ composition, khung, icon chức năng hoặc stable art.
- Background nhiều lớp là yêu cầu bắt buộc: alpha đúng, chung camera, đúng thứ tự, bounded drift, không hở mép, reduced motion đúng. Không dùng ảnh master phẳng hoặc ảnh reference nguyên màn làm runtime background chứa UI.
- Một source cho mỗi loại registry; không thêm danh sách asset đường dẫn rời rạc trong từng component. Giữ một owner cho tooltip, focus trap, button, slot, projection/hit-test.
- Target desktop: 1280×720, 1366×768, 1600×900, 1920×1080; kiểm thêm cửa sổ thay đổi tỷ lệ bằng viewport/letterbox hiện hữu. Không tự thiết kế lại thành mobile app.
- Thiết kế 1672×941 phải map qua logical stage hiện có. Không scale hai lần hoặc trộn CSS `vw/vh` bên ngoài stage với pixel bên trong mà không kiểm projection.
- Mỗi vấn đề mỹ thuật được xác định bằng region + reference + ảnh runtime + mô tả sai khác. Không dùng nhận xét chung "đã polish" làm bằng chứng.

## 4. Hợp đồng thị giác và nguồn art

### 4.1 Tiêu chuẩn để một scene được công nhận

Mỗi scene phải đạt đồng thời:

| Trục đánh giá | Điều kiện bắt buộc |
|---|---|
| Composition | Đúng vị trí và tỷ lệ tương đối của focal, navigation, information rail và CTA theo ref/scene spec đã hiệu chỉnh |
| Hierarchy | Nhìn nhanh nhận ra nhân vật/cảnh/đối tượng trung tâm và hành động chính; danh sách text không chiếm toàn bộ tiêu điểm |
| Material | Sơn mài/mực, giấy khi ref dùng giấy, kim loại vàng cổ có chi tiết tương xứng; không còn bevel bạc hoặc khối vàng nhạt vô chủ làm skin mặc định |
| Palette | Bầu cảnh, độ sáng/tối, ivory text, gold/jade/cinnabar có vai trò nhất quán; không phủ một tờ giấy be lớn lên mọi màn chỉ vì có shell dùng chung |
| Art integration | Ảnh nằm trong bố cục được thiết kế, không lộ dạng poster chữ nhật dán lên panel; frame, mist, mask hòa vào scene; không méo góc/roller/nhân vật |
| Content | Dữ liệu thật, có trạng thái ít/nhiều/khóa/max/empty hợp lệ; không cắt nội dung cần thao tác và không nhồi nội dung ngoài Beta |
| Interaction | Hitbox đúng hình, focus thấy được, không che CTA, không mất thao tác sau mở/đóng/re-enter/resize |
| Motion | Parallax có chiều sâu nhưng không tranh sự chú ý; transition không ngăn gameplay và không rò timer/listener |

Mục tiêu giống reference là giống cách tổ chức và chất lượng thể hiện; không yêu cầu pixel-identical với chữ, số, portrait và tính năng AI bịa trong ảnh. Cũng không được dùng câu này để hợp thức hóa bố cục hoàn toàn khác.

Các vùng chính dùng `x/y/w/h` của scene-layout JSON làm điểm xuất phát. Đặt dung sai geometry mặc định ±3% mỗi trục của logical stage để phát hiện lệch rõ rệt. Mọi thay đổi vượt dung sai phải có giải thích gắn với domain/khả năng đọc và ảnh đối chiếu; một average score không được bù cho lỗi mất focal hoặc CTA.

Reference full-scene chi phối tỷ trọng cảnh và hierarchy. Imperial-scroll spec chi phối vỏ chung và vùng an toàn. Khi hai thứ tạo ra màn be trống hoặc mất tiêu điểm như PR97, sửa cấu trúc/skin của vỏ để giữ composition; không xem bộ tọa độ cũ là lý do chấp nhận kết quả bị người dùng bác bỏ. Ghi thay đổi vào cùng layout spec để chỉ có một target đang hoạt động.

### 4.2 Phân công art — implementer

| Hạng mục | Owner / xử lý |
|---|---|
| Ghép ảnh đã có, CSS/SVG hình học, nine-slice, layout, runtime states | Devin |
| Đánh giá chrome có đạt reference ở tỷ lệ thật hay không | Devin phải kiểm và trả gap có bằng chứng |
| Vẽ lại stable frame, button, plaque, ornament, nền cảnh còn thiếu | UI Art Agent; Devin lập art request rõ ràng, không tự thay bằng mockup sơ sài rồi đánh dấu hoàn thành |
| Spritesheet và các content art bị loại trừ | Giữ consumer/placeholder hiện tại; không đưa vào backlog bắt buộc của mission này |
| Painted Sơn Hà geography hoặc bộ Động Phủ mới không có trong pack | World/background art dependency; kiểm kho asset trước, lập yêu cầu layer nếu thiếu |
| QA, browser, kiểm gameplay, final report | Devin/Implementer |

Art request phải chứa: scene + region, ref crop, ảnh runtime hiện tại, asset ID/path, kích thước/canvas, alpha, nine-slice/text-safe rect nếu có, layer/depth/drift nếu là nền, lỗi hiện tại, và tiêu chuẩn chấp nhận. Đính kèm vào `docs/qa/huyen-kim-reference-fidelity/art-gaps.md` trong worktree implementer.

Đặc biệt: Động Phủ của ref dùng bầu cảnh núi/đền/thác và bố cục khác bộ nền vàng xám đang chạy. Không hứa chỉ đổi CSS sẽ làm hai bộ tranh giống nhau. Nếu kho asset không có kit phù hợp, hoàn thiện layout với slot/layer contract và ghi **ART_BLOCKED** cho độ giống phần world; tiếp tục các scene độc lập. Toàn bộ mission chưa đạt visual acceptance nếu stable focal/background cần thiết vẫn thiếu. Placeholder của content art bị loại trừ không được đánh đồng với blocker stable art này.

### 4.3 Parallax contract

- Auth/Creation: `auth-creation` L0–L5; Realm: `realm-ascent` L0–L4; Skill: `skill-tree` L0–L3. Đọc `stable-scene-extension.json` làm nguồn thứ tự/drift/canvas.
- Động Phủ: tiếp tục dùng `DongFuArt`, `DongFuStackLoader`, `DongFuBuildingArt` và variant season/time hiện hữu. Nếu đổi world kit, map đầy đủ vào contract đó và chứng minh anchor/camera/hitbox đồng bộ. Không gắn thêm một renderer cạnh tranh.
- Tribulation: sky/storm-far/storm-near/dais/vignette theo renderer hiện hành; entity/VFX vẫn tách lớp đúng owner.
- Một stack dùng một phép biến đổi scene và chung registration. Cover/overscan phải giữ alignment; không tăng scale độc lập từng lớp để che seam rồi làm núi/kiến trúc lệch nhau. Phân biệt drift design-px và rendered-px.
- Neutral, bốn góc cực trị, resize và reduced-motion đều cần ảnh/video ngắn; không chỉ test độ dài array.
- Không chỉnh quá mạnh saturation/contrast/blur toàn lớp để che asset không phù hợp. Đánh giá tranh gốc và nguồn ánh sáng trước.

## 5. Ma trận toàn bộ scene — dùng tên file, không suy số

`Sxx` dưới đây là số scene trong layout spec. `Rxx` là tên file ảnh đã commit. Có **18 scene / 17 ảnh trực tiếp**; Inventory lấy grammar từ Equipment. Từ S09 trở đi không có ánh xạ số 1:1.

| Scene | Reference dưới `references/huyen-kim/scenes/` | Deliverable nhìn thấy được |
|---|---|---|
| S01 Login | `01-login.jpg` | Vista chiếm trái, card giấy/khung bên phải, title rõ, fields/tab/CTA vừa card, footer không rơi khỏi màn |
| S02 Character Creation | `02-character-creation.jpg` | Focal trái từ art hiện có, scroll phải, tên + 9 talent dạng grid 3×3; detail giải thích riêng, CTA/reroll luôn tiếp cận được |
| S03 Động Phủ | `03-dong-fu.jpg` | World dominant khoảng ≥70% khi wheel đóng; nhân vật/dais, wheel radial hai vòng, plaques gắn building, HUD biên, Thiên Cơ gọn |
| S04 Character | `04-character.jpg` | Nhân vật/Ngũ Hành làm focal; identity, 5 thuộc tính và allocate, talent, derived detail thành vùng rõ |
| S05 Realm | `05-realm.jpg` | Đường thăng cảnh giới trên phong cảnh, node thực bám đường; rail phải progress/rate/passive/requirements/CTA; không có hàng card phẳng che tranh |
| S06 Technique | `06-technique.jpg` | Active technique: info trái, plinth và content slot giữa, grade track, so sánh nâng cấp phải |
| S07 Skill | `07-skill.jpg` | Node graph radial theo topology thực, substrate nhiều lớp, identity/element trái, inspector phải; edges/locks/selection rõ |
| S08 Body | `08-body.jpg` | Figure/kinh mạch lớn làm focal, chapter rail, orb/điểm có ý nghĩa domain, tier và detail/invest bên phải |
| S09 Inventory | `12-equipment.jpg` — grammar bag grid | Ba category thật, grid/detail/capacity rõ; không bịa reference standalone hoặc category |
| S10 Exploration | `09-exploration.jpg` | Map zone/chapter/stage, route nodes và boss đúng domain, detail/mode/CTA phải; chrome và world art tách nhau |
| S11 Alchemy | `11-alchemy.jpg` | Recipe trái, cauldron giữa, preview/variants/costs phải, queue strip có tiến độ/cancel |
| S12 Equipment | `12-equipment.jpg` | Paperdoll với 6 socket, item detail, operation rail Beta, bag; không quay lại ba panel tranh chỗ hoặc kéo figure méo |
| S13 Combat | `10-combat.jpg` | Battlefield dominant khoảng ≥75%; player HUD, turn strip, AI, skill dock và log bám biên, không chồng hitbox |
| S14 Tribulation | `13-tribulation.jpg` | Chapter tracker, cảnh bão nhiều lớp, dais/entity, question/answers phải, status trái, HP dưới; result đúng phase |
| S15 Victory | `14-victory.jpg` | Ceremonial envelope, title, reward/growth thật, manual/auto actions đúng state |
| S16 Defeat | `15-defeat.jpg` | Cùng family với Victory, cinnabar, hint/partial loot và retry/return đúng countdown |
| S17 Settings | `16-settings.jpg` | Navigation/sections rõ, controls cùng family, các save/account/confirm hoạt động; chỉ option có API |
| S18 Quest | `17-quest.jpg` | List trái/detail phải, progress/objective/reward/shortfall/claim có phân cấp; không daily/category/deep-link giả |

### Các hiệu chỉnh domain bắt buộc

- Talent: 9 offers từ service; compact card cho overview, description ở vùng detail/focus. Không giảm thành 3 vì ảnh mẫu chỉ có 3.
- Realm: số tầng/tên/tier lấy từ canonical realm data. Không hardcode "18" vào mọi realm: runtime Phàm Nhân đã có requirement Tầng 12. Canonical realm ladder không đồng nghĩa danh sách tầng nội bộ; xem đúng owner cho từng loại node. Node inspect không tự đột phá, tầng tự tăng vẫn tự tăng, CTA chỉ phát command domain hiện hành.
- Skill: chỉ thay vị trí node/edge, không sửa graph phụ thuộc, cost hoặc visibility. Ring cho 8 kinh mạch chỉ khi chapter thực sự có 8 điểm; chapter khác dùng tập node riêng.
- Technique/Body cần composition độc lập theo spec, nhưng chưa giả định có route/domain API mới. Ưu tiên presentation view selection trong shell host; nếu cần mở rộng UI navigation thì chỉ thêm state điều hướng tối thiểu, cùng gating, không tạo owner gameplay mới.
- S05/S08 và S06/S07 phải có ảnh capture riêng sau khi điều hướng tới view tương ứng. Không chụp một panel hai lần rồi đổi tên file thành hai scene.
- Equipment dùng 6 socket và các operation Beta thật. Combat giữ strategy/role/state hiện hành. Các dữ liệu và số lượng phải được re-audit trong checkout execution.

## 6. G0/G1 — task card và ownership

**Responsibility:** Chuyển toàn bộ presentation đang lệch reference sang composition và chrome nhất quán, chạy qua luồng sản phẩm thực và giữ domain authority.

**Production chains cần duy trì:**

- `GameRoot` → onboarding screens → auth/creation services.
- `GameRoot` → Động Phủ/HUD/wheel → UI store/navigation → panel host → canonical query/command.
- `DongFuArt` + variant → loader → `DongFuScene` → rendered layer/building → cùng anchor cho `HomeBuildingIcons`.
- Existing combat/tribulation runtime → canvas/DOM presentation → typed input/ack → gameplay owner. Không đưa resolution sang UI.

| Q | Bản đồ kế hoạch / bằng chứng Devin phải ghi trước edit |
|---|---|
| Q1 | Bảng §5 và visual gates §4/§8; quan sát full scene và thao tác thật |
| Q2 | Domain owner giữ nguyên; registry/chrome presenter/shell/layout mỗi phần một owner |
| Q3 | UI view/focus/selection thuộc UI lifecycle; domain data vẫn của service/system; không persist một bản clone domain vào component |
| Q4 | Dẫn entry và host thực cho từng scene, chỉ rõ canonical query và action handler đang dùng |
| Q5 | Census `InkNineSlice`, `GameButton`, `OverlayPanel`, `SysPanel`, slots/tooltips/tab/focus helpers trước khi thêm primitive; không giả định tên primitive trong spec cũ vẫn tồn tại |
| Q6 | Registry/layout ở presentation/UI; core không import Vue/Phaser/UI spec |
| Q7 | Transition/parallax chỉ vẽ; event/clock/domain giữ timing và outcome |
| Q8 | Ghi đủ Beta verdict, lock reason, failure semantics, domain counts khi chuyển layout |
| Q9 | Opening/closing/preview không tiêu tiền, roll, award hoặc unlock ngoài command vốn có |
| Q10 | Re-enter, interrupted transition, stale preload, resize, reset: dispose/ignore callback đúng session |
| Q11 | Mỗi skin cũ/duplicate panel: live, migrated hoặc retained với consumer và lý do cụ thể |
| Q12 | 18-scene matrix, consumer census, candidate-bound evidence và protocol verdict; không DONE theo số file/test |

Triggered module U1–U6 toàn mission. Module S cho async assets/onboarding/lifecycle; C/P17 cho combat/tribulation presentation seams; E/L cho action/read-model consumers bị chuyển. Đọc pha tương ứng trong `roadmap.md` và QA hiện hành trước khi sửa consumer đó. Không tự mở mission refactor core chỉ vì kiểm tra chạm domain.

Devin phải hoàn tất G0/G1 trong ledger thực, chạy readiness `qa:internal prepare`/`preflight` theo schema đang cài. Nội dung bảng trên là kế hoạch, không phải evidence đã PASS.

## 7. Lát cắt thực hiện

Các path dưới đây tương đối với `game/`, trừ khi ghi khác. File đề xuất tạo mới phải được census để tránh duplicate; nếu đã tồn tại owner tương đương, sửa owner đó và ghi mapping vào ledger. Mỗi task có checkpoint độc lập; các checkpoint không tự cấp quyền commit/merge.

### Task 0 — Khóa candidate, references, before và asset gaps

**Files đọc:** `../AGENTS.md`, `../AstraDoctrine.md`, `docs/architecture/architecture-worker-workflow.md`, `docs/qa/protocol/{README,defect-taxonomy,ledger-schema,learning,agent-instructions}.md`, `docs/roadmap.md`, các spec ở header, current PR diff, `src/ui/huyen-kim-chrome.json`, `src/ui/huyenKimChrome.ts`, `src/presentation/huyenKim/StableSceneArt.ts`.

**Evidence tạo:** `docs/qa/huyen-kim-reference-fidelity/{intake.md,scene-matrix.md,asset-consumer-census.md,art-gaps.md}` và run ledger theo protocol. Evidence ảnh nằm trong run evidence directory, không trộn vào production assets.

- [ ] Đọc current PR metadata, refs, worktrees và status. Reuse implementation worktree phù hợp; nếu cần checkout mới, tạo branch `codex/huyen-kim-reference-fidelity` từ PR97 head được xác minh. Không tích hợp vào master để thử.
- [ ] Xác nhận kế hoạch và toàn bộ dependency spec/reference có mặt trong checkout Devin; file chưa commit phải được cung cấp qua attachment/copy tài liệu, không tự push để chuyển file.
- [ ] Tạo 18 dòng scene matrix với route/entry, domain fixture hợp lệ, source owner, reference path, acceptance criteria và trạng thái `NOT_STARTED`.
- [ ] Chụp before cho các scene reachable tại 1280×720. Đọc cả ảnh reference và runtime, không chỉ DOM snapshot.
- [ ] Lập census: asset manifest ID → runtime registry entry → URL thật → primitive → caller → computed paint. Tìm caller `asset-id` cũ, `chrome-id` pending, URL phẳng sai, CSS override và duplicate backdrop.
- [ ] Xem chrome contact sheet và mẫu button/panel ở tỷ lệ runtime. Lập art-gap cho sai material/focal/world; không mặc định nhãn `DONE` trong asset manifest chứng minh chất lượng thị giác.
- [ ] Ghi CI failures hiện tại và reproduction baseline. Đọc source guard trước khi chọn replacement test.

**Checkpoint:** Có scope 18 màn và nguồn dữ liệu/ảnh/asset rõ. Gap art có owner và region. Không cần chờ user chọn lại concept đã được chỉ định bằng reference.

### Task 1 — Sửa registry/chrome và một đường render hoàn chỉnh

**Modify:** `src/ui/huyen-kim-chrome.json`, `src/ui/huyenKimChrome.ts`, `src/components/common/primitives/InkNineSlice.vue`, `src/components/common/GameButton.vue`, `src/assets/huyen-kim.tokens.css`; `src/assets/theme.css`/`system-theme.css` chỉ các rule thực sự gây conflict.

**Test:** `src/ui/huyenKimChrome.test.ts` (tạo nếu chưa có), `src/components/common/primitives/InkNineSlice.test.ts`, existing GameButton tests; consumer test mới chỉ cho invariant còn thiếu.

**Consumes:** Production art manifest; existing `chromeSlice(id)` / `HUYEN_KIM_CHROME` / `InkNineSlice` props. **Produces:** Cùng API, metadata chính xác, ready asset thật được vẽ ở consumer thật.

- [ ] Chuyển manifest paths có `public/` sang public URLs qua resolver, giữ category subfolders. Đối chiếu dimensions/slices/center/tintable/minimum-size bằng art thực tế.
- [ ] Chỉ đặt `ready` khi file tồn tại và metadata đúng. Nhập các family còn thiếu mà consumers thật cần; không tạo registry cạnh tranh với `StableSceneArt` cho background.
- [ ] Sửa xử lý 1x/2x nếu slice pixel khác tỷ lệ; ảnh 2x không được làm góc dày gấp đôi. Xem cả DPR 1/2 ở minimum và large size.
- [ ] Migrate một primary button, input, information card và plaque trên Login pilot sang `chrome-id` phù hợp; giữ accessible name/handler/focus.
- [ ] Loại bỏ xung đột CSS cho nhóm đã migrate, không quét xóa toàn bộ fallback dùng bởi caller khác. Fallback còn cần cho asset failure phải nhẹ, không phủ che art ready.
- [ ] Chạy focused tests, browser computed paint và crop ảnh thật. Nếu button/frame vẫn sai material so với ref, dùng art-gap và sửa tại owner; không đi tiếp bằng cách đổi màu tất cả thành vàng.

Ví dụ binding minh họa, chỉ dùng khi ID và slice đã xác minh:

```vue
<InkNineSlice chrome-id="surface-m-panel" layer="surface" />
<InkNineSlice chrome-id="frame-m-modal" layer="frame" />
```

Không chỉ đổi một trạng thái `pending` thành `ready`: ví dụ `frame-xs-tooltip` có đường thật `/assets/ui/huyen-kim/frames/frame-xs-tooltip@1x.png`, không phải đường phẳng trong registry cũ.

**Checkpoint:** Một screen thật có chrome thật đúng material; không có 404, double-frame hoặc scaled corners. Mọi thay đổi shared primitive có census các caller bị ảnh hưởng.

### Task 2 — Hoàn thiện S01/S02 làm mẫu chất lượng đầu tiên

**Modify:** `src/components/onboarding/{AuthEntryScreen,CharacterCreationScreen,GuestUpgradeCard}.vue`, `src/components/common/HuyenKimParallaxStack.vue` nếu cần geometry, shared chrome consumers; CSS rule tại owner đã census.

**Test:** Existing auth/creation tests; tạo `tests/e2e/huyen-kim-reference-fidelity.spec.ts` cho composition/flow. Reuse boot/presentation-idle/guest helpers trong E2E hiện hữu, không bịa endpoint.

**Consumes:** Auth/creation service và parallax registry cũ. **Produces:** Hai screen đúng ref với state services nguyên vẹn.

- [ ] S01: di chuyển toàn bộ auth card sang phải theo `auth-scroll`; dành vùng cảnh trái, dùng paper/ink treatment đúng ref; giảm hierarchy trùng lặp như nhiều kicker/title lớn.
- [ ] Giữ login/register/guest/resume/locale/error/upgrade/cross-account confirm. Footer nằm trong card; khi state thêm content thì cuộn trong body card, CTA và notice vẫn có đường tiếp cận.
- [ ] S02: bố cục focal trái / panel phải; chỉ dùng character asset hiện có. Sắp 9 offers thành 3×3 tại 1280×720; compact title/seal/summary, selected detail mở trong vùng dự kiến, không chín đoạn văn dài đẩy CTA khỏi màn.
- [ ] Giữ reroll, tên hợp lệ, chọn một talent, creating/error state. Không thêm random-name, starter selector hoặc sinh talent illustrations.
- [ ] Kiểm layout ở 4 viewport, tiếng Việt/English và error dài; full-window scroll không được là cách duy nhất để tới CTA.
- [ ] Thu before/reference/after cùng tỷ lệ; annotate card/focal/CTA. So material và typography bằng mắt, cùng kiểm bounding-box. Trình mẫu này trong báo cáo tiến độ trước khi propagate chrome sang hàng loạt màn.

**Checkpoint:** S01/S02 đạt từng trục §4.1. Nếu vẫn là form đen ở giữa hoặc danh sách talent kéo dài, checkpoint FAIL dù flow chạy và tests xanh.

### Task 3 — S03 Động Phủ: world, dais, wheel, HUD và buildings

**Modify:** `src/components/game/{DongFuScene,DongFuCommandWheel,HomeBuildingIcons,GlobalTopBar,ThienCoRail}.vue`, `src/presentation/background/{DongFuArt,DongFuBuildingArt,DongFuStackLoader}.ts` chỉ khi cần đổi presentation geometry/assets; reuse `useThienCoEntries` và canonical quest surface query.

**Optional create:** `src/components/game/HuyenKimQuestTracker.vue` nếu chưa có equivalent consumer; component chỉ đọc quest surface và dùng hành động thực đã hỗ trợ.

**Test:** Existing `DongFuScene.test.ts`, `DongFuCommandWheel.test.ts`, `HomeBuildingIcons.test.ts`, art/loader tests; E2E wheel/hotspot/re-entry.

**Consumes:** Existing background variants/stack/placements, `betaWheelSlots()`, `isBetaBuildingSurface`, UI navigation và Thiên Cơ entries. **Produces:** Ref-shaped home với cùng navigation/domain semantics.

- [ ] Chọn kit background có thể đáp ứng art direction; nếu kit hiện hữu không đủ, ghi art request layer rõ như §4.2, tiếp tục phần layout độc lập.
- [ ] Bố trí player/dais và khoảng thở; giữ bầu cảnh dominant. Cân lại layer foreground/mist/architecture và horizon trên một camera chung.
- [ ] Dựng wheel radial hai orbit theo slot list thực. Có ảnh trạng thái đóng/mở; glyph/label dễ đọc và có focus ring. Giữ keyboard shortcut thực đang có, không đổi Tab thành shortcut spec cũ mà bỏ khả năng người chơi đang dùng.
- [ ] Gắn plaques vào building anchors; rendering và hitbox cùng projection ở mọi scale/parallax. Không đặt label bên ngoài viewport như screenshot cũ.
- [ ] Identity/resource/utilities thành cụm ở biên; Thiên Cơ có collapsed/open state và không chặn cultivation focal hoặc slot wheel. Quest tracker đọc state thật, không tạo quest navigation mới nếu API chưa có.
- [ ] Kiểm trạng thái có ít/nhiều entry, building locked/available, wheel keyboard, Esc/focus return, mở panel rồi quay về; variant load cũ không thay đè variant mới.

**Checkpoint:** Động Phủ thay đổi rõ về composition, chrome và focal theo ref; world art dependency nếu còn phải hiện trong verdict. Không coi đổi vài glyph là hoàn thành S03.

### Task 4 — Shell và điều hướng các scene chức năng

**Modify:** `src/components/common/OverlayPanel.vue`, `src/components/common/system/SysPanel.vue`, `src/components/layout/{GameRoot,LeftPanel,RightPanel,FunctionOverlayPanel}.vue`, `src/stores/ui.ts` chỉ khi cần route presentation tối thiểu; tìm owner current trước khi edit.

**Conditional create:** `src/components/common/HuyenKimSceneFrame.vue` nếu `SysPanel` chưa thể giữ một frame dùng chung qua slots; không dựng thêm modal/focus/nav stack cạnh tranh. Shell chỉ sở hữu vỏ/reveal/layout slots.

**Test:** Existing overlay/focus/UI-store tests; E2E one-shell, re-entry, back/Esc và hidden-route absence.

- [ ] Census một entry và một host cho mỗi scene; bỏ double-shell/nested-scroll tại consumer đã migrate.
- [ ] Chốt các vùng title/nav/content/detail/footer. Paper/ink skin theo màn và reference, tránh một nền be phủ kín mọi viewport.
- [ ] Rollers/frame/plaque giữ tỷ lệ; không kéo mảnh hình nắp tròn thành cột khổng lồ. Safe areas bảo vệ label/close/CTA.
- [ ] Body và Technique có view riêng. Reuse body chapter components/TechniqueBand domain bindings; chuyển ownership presentation gọn tại host. Một view đang mở tương ứng một mounted content tree, không thêm hidden duplicate chứa cùng action/watchers.
- [ ] Mọi entry/rail đi qua gating hiện hành; focus trap, scroll containment và close semantics chỉ một owner. Close/reveal interrupted không mất focus hoặc khóa pointer toàn game.

**Checkpoint:** Shell đã chứng minh bằng một real scene, không chỉ Storybook/gallery. Không bắt scene phải dùng layout cũ chỉ vì nó có sẵn.

### Task 5 — S05 Realm và S08 Body

**Modify:** `src/components/panels/RealmPanel.vue`, existing breakthrough requirement host, `src/components/panels/realm/{BodyChapterNav,BodyRefinementSection,MeridianSection,ZhouTianSection}.vue` theo consumer census.

**Conditional create:** `src/components/panels/BodyPanel.vue` là presentation composition riêng nếu Task 4 chưa có owner tương đương. Chuyển binding hiện hữu, không copy công thức/cost hoặc lặp subscription.

**Test:** `RealmPanel.test.ts`, chapter consumer tests và E2E riêng cho Realm/Body.

- [ ] S05: thay layout hàng card dọc hiện tại bằng path/nodes trên ascent vista; dùng canonical realm/tầng/milestone data, không suy progress từ vị trí node.
- [ ] Căn path vào đường núi với node/label đọc được; selected/current/complete/locked phân biệt bằng shape/label và màu. Rail chứa tên, progress, rate/ETA, passive, requirement và đúng CTA domain.
- [ ] S08: figure và meridian overlay cùng canvas/pivot; runtime node bám vùng authored, không vẽ progression vào bitmap. Chapter/tier/data đổi đúng mà không reset selection vô cớ.
- [ ] Cho Body chiếm vùng focal đúng spec thay vì một ảnh 170px ở cuối Realm. Reuse existing figure; không sinh entity animation.
- [ ] Thử insufficient cost, đủ cost, max/ceiling và late-state bằng owner/API fixture hợp lệ. Invest/advance chỉ thay state một lần, opening panel không có side effect.
- [ ] Chụp hai route/view riêng; màn Body không bị đánh dấu pass nhờ ảnh Realm.

**Checkpoint:** Thang cảnh giới và silhouette/kinh mạch là hai composition nhìn ra đúng ref, gameplay counts/costs nguyên vẹn.

### Task 6 — S06 Technique và S07 Skill

**Modify:** `src/components/panels/SkillPathPanel.vue`, `src/components/panels/skill-path/{TechniqueBand,NodeTreePanel,NodeInspector,NativeCoreDetail}.vue` và existing detail consumers được census.

**Conditional create:** `src/components/panels/TechniquePanel.vue`; `src/presentation/huyenKim/skillGraphLayout.ts` cho hàm geometry thuần nếu layout radial chưa có owner.

**Test:** Existing skill-path/TechniqueBand tests, pure layout collision coverage nếu thêm layout helper, E2E pre/post commitment + selection/upgrade.

- [ ] S06: dựng tech info / artifact slot trên plinth / grade track / upgrade compare theo ref; lấy grade/effects/cost từ owner, dùng existing illustration hoặc neutral slot có chủ ý.
- [ ] S07: project node graph thật sang core/orbits; giữ toàn bộ edges/prerequisites/visibility. Layout helper chỉ nhận ID, edge, kích thước và trả tọa độ, không biết unlock/cost rule.
- [ ] Node art, labels và edge anchoring không chồng nhau tại 1280×720. Inspector độc lập cuộn body khi text dài, CTA ở footer. Pan/zoom chỉ dùng nếu graph thật cần và có thể tương tác bằng keyboard.
- [ ] Kiểm learned/available/locked/max, precommit Ngũ Hành và committed branch, hidden role không xuất hiện; click node không tự học/chi tiền.
- [ ] Test keyboard traversal theo topology/roving focus hiện hành; canvas decoration không chặn DOM node.

**Checkpoint:** Hai view riêng có hierarchy đúng; radial layout không làm biến đổi domain graph. Tâm pháp/skill icon mới vẫn nằm ngoài scope art.

### Task 7 — S04 Character, S09 Inventory, S12 Equipment

**Modify:** `src/components/panels/{CharacterPanel,CharacterDetailCard,InventoryPanel,EquipmentHallPanel,EquipmentPaperdoll}.vue`; `BagGrid`/`SlotView`/pagination consumer paths tìm bằng census, dùng primitive cũ.

**Test:** Existing character/equipment/bag interaction tests; E2E detail, allocate, socket, pagination/drag nếu có.

- [ ] S04: portrait/element wheel thành focal, identity/talent và 5 stats tách hierarchy, derived detail không che cả màn. Element/cost/allocate đọc qua bindings cũ.
- [ ] S09: ba categories thật, capacity/tools rõ, grid cell thống nhất; rarity/count/lock labels nằm trong safe area; tooltip/detail không ra ngoài stage.
- [ ] S12: paperdoll đúng tỷ lệ với 6 socket, item detail, operation rail và compact bag; empty/locked/equipped/enhanced phân biệt. Không thêm tab wash/refine/decompose nếu scope-hidden.
- [ ] Kiểm scrolling bên trong, selected item mất/đổi sau operation, inventory đầy, keyboard và native drag/drop tại các flow đang hỗ trợ. Cùng slot projection cho render/hit/drop.

**Checkpoint:** Cả ba màn có ảnh và thao tác riêng; item art cũ không làm mất layout/chrome đúng ref.

### Task 8 — S10 Exploration và S11 Alchemy

**Modify:** `src/components/panels/{StageSelectPanel,AlchemyView,PillRoomPanel}.vue`, map chrome consumers; không đổi `Stages.ts`/recipe data để vừa layout.

**Test:** Existing stage/alchemy tests; E2E select stage/mode/start, recipe/variant/queue/cancel.

- [ ] S10: dựng vùng map rõ với chapter/stage nodes; dùng số zone/chapter/stage hiện hành. Boss marker gắn đúng stage, mask/frame không che nodes/labels.
- [ ] Route/stage labels ở DOM/SVG runtime; geography art thuộc world source. Missing geography phải có art-gap, không lấy scene ref có chữ baked làm bản đồ.
- [ ] Detail/modes/CTA nằm trong rail phải; progression lock và scope-hidden khác nhau; chọn mode vẫn theo owner cũ.
- [ ] S11: dùng cauldron prop stable làm focal; recipes/variant/cost/preview và queue quanh nó. Không quantity stepper, speedup hoặc paid slots nếu không có domain.
- [ ] Thử recipe thiếu material, job full, cancel, scrolling recipe, stage locked/cleared/perfect và vào combat rồi quay lại; không mất selection/state hợp lệ.

**Checkpoint:** Map và cauldron có vai trò thị giác trung tâm; list và queue vẫn phản ánh state thật.

### Task 9 — S13 Combat và S14 Tribulation

**Modify:** Existing `src/components/game/combat/` overlay/top-bar/skill-dock/AI/turn-strip/log owners, `src/components/game/tribulation/TribulationSceneOverlay.vue`, `src/game/scenes/TribulationScene.ts`, `src/game/support/InkWashUiPhaser.ts` và current player/enemy HUD renderer chỉ khi skin/projection cần đổi.

**Required read:** `roadmap.md` R1–R6, maintained combat QA/ack/timing contract; dùng `combat-ui-audit-capture` khi phù hợp và xác nhận đúng worktree.

**Test:** Existing combat overlay layout/E2E, Phaser UI tests, live action playback và tribulation phase flow. Full verify vì chạm shared presentation/assets/scene-sensitive consumers.

- [ ] S13: giữ battlefield dominant; đồng bộ bars/portrait/turn tokens/skill orbs/material với scene khác. Dành insets đúng cho dock/log/AI; tránh canvas HUD và DOM HUD cùng hiển thị.
- [ ] Không đổi turn engine, timing, casts, damage, ack semantics hoặc actor spritesheets. Mọi nút/vfx vẫn đi qua entry hiện hành.
- [ ] Chơi thật một battle có chọn skill/auto-manual/pause/exit/finish; kiểm progression và kết quả bằng state riêng với ảnh hình.
- [ ] S14: xếp storm layers/dais/entity đúng depth; question card phải, status trái, HP dưới và chapter tracker động. Không meter/auto/skip invented.
- [ ] Kiểm resize/reduced motion, timer chạy, answer sai/đúng, timeout và result/re-entry qua các fixture hợp lệ; không dùng presentation completion để quyết định thắng/thua.

**Checkpoint:** Có timed runtime evidence cho canvas và DOM; boot/screenshot tĩnh không chứng minh animation/wiring.

### Task 10 — S15/S16/S17/S18 và micro overlays

**Modify:** `src/components/game/combat/{CombatVictoryPanel,CombatDefeatPanel}.vue`, `src/components/panels/{SettingsPanel,QuestPanel}.vue`, shared `ConfirmModal`/building popover/tooltip consumers cần parity.

**Test:** Existing result/settings/quest/confirm tests; E2E manual/auto results, setting changes, quest claim và focus return.

- [ ] Victory/Defeat: dùng cùng ceremonial grammar và title/action layout, màu trạng thái khác nhau; reward count/partial loot/countdown theo domain. Không âm thầm bỏ secondary CTA trong manual state.
- [ ] Settings: sections/labels/controls cùng family; giữ locale/UI scale/audio/save/account/feedback/update support thực. Test export/import/reset bằng dữ liệu test cô lập, không dùng save của người dùng.
- [ ] Quest: list/detail đúng ref, objective/shortfall/reward rõ; claim đủ/thiếu điều kiện và claim lặp qua owner; hidden cadence không có tab.
- [ ] Micro overlays: frame vừa nội dung, không double scrim, focus/keyboard/Esc/return đúng, tooltip không che action đang thao tác.

**Checkpoint:** 18/18 scene có disposition; không để result/settings/quest giữ skin cũ vì ít được xem.

## 8. Verification: chứng minh đúng hình và đúng game

### 8.1 Hai loại visual oracle phải phân biệt

1. **Reference fidelity:** Mở ảnh reference và screenshot scene thật cạnh nhau cùng tỷ lệ; annotate focal/card/map/rail/CTA và mô tả từng sai khác. Người kiểm thị giác đọc ảnh, kiểm cả material/typography/density. Screenshot được lưu mà chưa ai đối chiếu là evidence chưa đánh giá.
2. **Regression baseline:** Chỉ tạo golden từ candidate đã đạt reference fidelity. `toHaveScreenshot` bảo vệ candidate đó khỏi lệch về sau, không tự chứng minh candidate giống concept. Không copy ảnh PR97 hoặc chạy `--update-snapshots` hàng loạt để biến sai thành đúng.

Không pixel-diff trực tiếp toàn ảnh AI reference với UI có dữ liệu thật rồi chỉnh threshold cho xanh. Các khác biệt có chủ ý phải được ghi thành vùng/content exception cụ thể, không mask toàn bộ panel hoặc focal.

### 8.2 Hợp đồng capture và selector

Trong `tests/e2e/huyen-kim-reference-fidelity.spec.ts`, reuse harness hiện hành và tạo hook quan sát ở presentation roots:

```ts
// Attribute contract for the relevant scene roots and regions.
// Values identify presentation only; they do not become navigation state.
type FidelitySceneId =
  | 'login' | 'creation' | 'dong-fu' | 'character' | 'realm'
  | 'technique' | 'skill' | 'body' | 'inventory' | 'exploration'
  | 'alchemy' | 'equipment' | 'combat' | 'tribulation'
  | 'victory' | 'defeat' | 'settings' | 'quest'

// Roots: data-hk-scene="login" etc.
// Regions: data-hk-region="auth-card", "focal", "primary-action".
```

Không cần tạo production union nếu runtime chưa có consumer cho type này; đây là contract cho harness/selector, không phải lý do thêm navigation store. Dùng getter/locator `getByTestId('auth-screen')` hiện hữu cùng region attributes mới.

Ví dụ regression geometry có thể làm đỏ trên bố cục PR97; chèn vào existing configured Playwright test file với imports từ `@playwright/test`:

```ts
test('login keeps the card right-aligned and the guest action inside it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  const root = page.getByTestId('auth-screen')
  await expect(root).toBeVisible()
  const card = root.locator('[data-hk-region="auth-card"]')
  const guest = root.locator('[data-hk-region="guest-action"]')
  await expect(card).toBeVisible()
  await expect(guest).toBeVisible()
  await expect.poll(async () => {
    const r = await root.boundingBox()
    const c = await card.boundingBox()
    const g = await guest.boundingBox()
    if (!r || !c || !g) return false
    return c.x >= r.x + r.width * 0.56
      && c.x + c.width <= r.x + r.width
      && g.y >= c.y
      && g.y + g.height <= c.y + c.height
      && g.y + g.height <= r.y + r.height
  }).toBe(true)
})
```

Test dùng browser context trống/cô lập và locale cố định từ harness, không clear save của người dùng. Geometry phải đo sau presentation idle. Guest action được đánh dấu tại chính nút hiện hữu, không tạo nút giả để test.

Sau fidelity review, stable screenshots dùng `expect(...).toHaveScreenshot(...)` với `animations: 'disabled'`, fixed viewport/locale/DPR/fonts và fixture state. Chỉ mask nội dung động không liên quan như timestamp nếu không thể cố định; record lý do. Canvas/action/parallax motion được kiểm riêng ở production timing, không vô hiệu mọi animation rồi nói motion PASS.

### 8.3 Test matrix và các detector bắt buộc

| Failure class | Detector / thao tác |
|---|---|
| Art có file nhưng chưa dùng | Manifest path + consumer census + network/computed paint + runtime crop; cố tình đặt pending/bad URL phải làm check thất bại |
| Form ở giữa hoặc CTA bị cắt | Bounding boxes tương đối với logical stage và screenshot 1280×720/error state |
| Talent thành danh sách dài | 9-card count, 3 hàng/3 cột theo geometry, CTA visible, keyboard chọn và xem description đầy đủ |
| Background lệch/hở mép | Pointer extremes cả hai trục, resize, cover, load transition, reduced motion; không chỉ neutral screenshot |
| Scene vẫn layout cũ | Reference/after comparison có reviewer, region deltas, vật liệu và focal checks |
| Một capture giả làm nhiều scene | Entry/state/scene ID/hash khác nhau phù hợp; Realm/Body và Technique/Skill không dùng cùng screenshot |
| Gameplay bị UI quyết định | Mở/đóng panel không mutation ngoài contract; action thiếu điều kiện không đổi balance; đủ điều kiện chỉ một command/receipt |
| Navigation/visibility bypass | Hidden ids không có root/entry/tooltip/deep-link; progression locks vẫn có lý do chính xác |
| Canvas/DOM lệch projection | Click/hit/drag, resize và insets trong browser thật |
| Popup/transition lỗi | Repeated open-close, interrupted animation, Esc/focus return, locale/text dài |
| Golden hợp thức hóa UI sai | Baseline provenance liên kết fidelity review và snapshot candidate; thay golden phải có diff review |

Chạy full-scene visual matrix 18 màn × 4 desktop viewport ở locale chính; English tối thiểu cho các màn text-heavy và shared chrome. Test UI scale options thật bằng Settings, không giả định một scale duy nhất. Capture world/home cả wheel đóng và mở. Late-state fixture phải đi qua test seam hợp lệ và ghi rõ fixture-injected; có ít nhất một natural player journey xuyên onboarding → home → progression/panel → combat → result → home.

Unreachable screen/state cần chỉ rõ thiếu API/fixture/tool nào và cách đã thử. Không sửa production scope gate để lấy screenshot. Evidence thiếu vẫn là `QA_UNVERIFIED`, không tự gạch khỏi tổng scope.

### 8.4 Gates của repository

Devin là QA coordinator. Đọc protocol/schema hiện hành và thực hiện G2–G5; không sao chép báo cáo PR97 làm bằng chứng cho candidate mới.

Từ thư mục `game/` của implementation worktree:

```text
npm run type-check
npx vitest run src/components/common/primitives/InkNineSlice.test.ts src/components/common/HuyenKimParallaxStack.test.ts src/presentation/huyenKim/StableSceneArt.test.ts src/presentation/huyenKim/parallaxMath.test.ts
node public/assets/ui/huyen-kim/_source/generate-scene-extension.mjs --check
npm run verify
```

Lệnh scoped Vitest trên là nhóm foundation đã tồn tại tại baseline PR97; mỗi task bổ sung các consumer tests mới/hiện hữu liên quan và ghi path cụ thể vào ledger trước khi chạy. Với asset pipeline/shared root/Phaser/major changes và final candidate, P3 full = `npm run verify`; scoped runs chỉ hỗ trợ vòng sửa. Dừng ở failure đầu, phân loại và sửa task-caused failures.

Sau P3: P18 OCR Delegation Mode đúng diff/worktree và đủ coverage → P13/P14 browser thật tại server của worktree → P4 adversarial QA → P5 ≥3 review tuần tự trên resulting states. Các evidence đi vào **một** internal QA protocol ledger; không coi gate riêng là verdict cuối. Production fix từ bất kỳ gate nào invalidates affected evidence và quay lại verification/OCR/review theo protocol.

Giữ Clean A/B, fresh independent review, learning/root-class/sibling hunt và final aggregate verification khi protocol yêu cầu. Không dùng cùng context đóng vai reviewer độc lập. Nếu Devin không có năng lực isolation cần thiết, ghi gap đúng; không báo fixed point từ review giả. Không bắt UI Art Agent chạy QA cho phần implement.

## 9. First proof, checkpoints và dừng đúng chỗ

**BEFORE_WRITE:** Hoàn thành Task 0 census/reference mapping/readiness, xác định art gaps và baseline/checkout. Xác nhận background parallax là ràng buộc bắt buộc.

**BEFORE_PROPAGATION:** Task 1–2 phải chứng minh Login/Creation ở 1280×720 đã bám ref về composition/chrome/readability. Chỉ sau đó mới lan shared styling rộng; đồng thời làm S03 sớm để chứng minh screen người chơi thấy thường xuyên được đổi thực sự.

Checkpoints là công việc tự kiểm và báo cáo của Devin, không phải yêu cầu người dùng duyệt lại từng bước. Đưa ảnh cụ thể cho người dùng khi milestone có thay đổi rõ. Nếu người dùng bác bỏ hướng thẩm mỹ, cập nhật target trước khi tiếp tục propagate.

Tiếp tục tự xử lý trong scope: CSS cascade, wrong registry paths/status, slice scaling, layout/overflow, keyboard, migrate real consumer, failing task-caused tests. Chỉ dừng phần phụ thuộc khi: cần stable art chưa có; thiếu domain query/API mà tự tạo sẽ đổi luật sản phẩm; xung đột sửa file đang do người khác sở hữu; cần quyền commit/push/merge/deploy chưa được cấp. Công việc độc lập còn lại vẫn tiếp tục.

Không được tự thay scope thành "chỉ asset integration", "chỉ màn reachable", "chỉ 9 screenshots" hoặc "để QA sau merge".

## 10. Deliverables và điều kiện hoàn thành

Devin bàn giao:

1. Candidate source trên worktree/branch rõ, base/head/dirty-state manifest, file ownership và consumer migration census.
2. Scene matrix 18/18 với reference path, entry/fixture, viewport/locale, before/reference/after, nhận xét từng trục §4.1 và remaining gaps.
3. Artifact xem nhanh `docs/qa/huyen-kim-reference-fidelity/comparison-gallery.html` hoặc một gallery tương đương mở local được: một scene một khối ref/before/after, không chỉ contact sheet asset. Embed/link relative evidence assets để chuyển máy dùng được.
4. Art-gap report có owner/dependency, phân biệt stable art blocker và excluded content placeholder; nếu không còn gap thì ghi rõ `none` với census evidence.
5. Network/registry/parallax/nine-slice proof, gameplay interaction proof, tests/build/OCR/browser/adversarial/sequential evidence, protocol verdict trên exact aggregate candidate.
6. Tóm tắt ngắn cho người dùng: màn nào đã đổi, hình minh họa, còn thiếu gì, cái gì đã xác minh. Không buộc người dùng đọc log để phát hiện UI chưa xong.

Mission chỉ có thể gọi **hoàn thành như reference** khi mọi scene bắt buộc đạt composition/material/art integration và interaction acceptance, stable art blockers đã đóng, các deviation được chấp nhận rõ, và repository QA có verdict tương ứng hợp lệ. Technical PASS không thay thế visual acceptance; visual đẹp không thay thế logic/runtime proof. Nếu có ngoại lệ người dùng chấp nhận, báo `QA_ACCEPTED_WITH_EXCEPTIONS` cùng danh sách, không gọi hoàn thành tuyệt đối.

Final report phải ghi các pass P5 theo thứ tự, reviewed candidate, findings/fixes và re-verification. Commit/merge/push/deploy vẫn là thao tác cần quyền riêng.

## 11. Prompt khởi động cho Devin

> Hãy thực hiện `game/docs/superpowers/plans/2026-10-02-huyen-kim-reference-fidelity-devin-plan.md` từ đầu đến cuối, trên candidate tiếp nối PR97 được xác minh. Yêu cầu là hoàn thiện cả 18 scene theo reference và forensic corrections, gồm bố cục toàn màn hình, chrome/material, tiêu điểm, parallax nhiều lớp, thông tin và tương tác. Người dùng đã bác bỏ kết quả chỉ lót art vào UI cũ. Làm census registry/consumer và art gaps trước; chứng minh Login/Creation ở 1280×720, sau đó Động Phủ, rồi hoàn thiện các scene còn lại theo task order. Dùng đúng read-model/Beta authority, giữ loại trừ volatile content art, không đổi gameplay để giống hình. Bạn sở hữu implementation và QA. Mỗi scene cần ảnh reference/before/after và visual review, không chấp nhận asset presence hay số test xanh làm bằng chứng giống reference. Tiếp tục các phần độc lập khi gặp dependency; báo rõ stable art thiếu với request cụ thể. Đừng tự thu hẹp phạm vi hoặc gọi DONE khi vẫn còn visual mismatch/required evidence gap. Không commit/push/merge/deploy nếu người dùng chưa cấp quyền trực tiếp.

## 12. Planning validation record

- Scope: tài liệu Markdown duy nhất; không sửa production, test, asset, PR hoặc save của người dùng trong lần lập kế hoạch này.
- P2 docs exception: 2026-10-02, viết tại main checkout `E:\tutienidle`, file chính là tài liệu này; không đụng untracked work khác.
- G0/G1 planning: baseline nguồn và responsibility/consumer paths đã ghi ở §2/§6; implementation evidence được giao cho Devin và không đánh dấu PASS trước.
- Spec coverage: S01–S18 có reference mapping, task owner và acceptance; Inventory có derived reference công khai. Parallax/volatile art/QA ownership/Beta visibility đều có ràng buộc cụ thể.
- Production P3/P13/P14/P18/P4/P5: PLANNED, không chạy hoặc chứng nhận thay Devin trong lần lập kế hoạch.
