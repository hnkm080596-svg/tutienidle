# Handoff toàn bộ UI Huyền Kim cho implementer

## Nhánh và vị trí bàn giao

- Nhánh thực tế đang dựng UI: `codex/hk-login-fidelity` (đã kiểm tra trực tiếp bằng Git).
- Worktree: `E:\tutienidle\.agent-worktrees\hk-login-fidelity`.
- Root ứng dụng: `E:\tutienidle\.agent-worktrees\hk-login-fidelity\game`.
- Nhánh người dùng cung cấp lúc bắt đầu: `devin/hk-scaffold-qa-fixes`; không phải nhánh đang chứa vòng dựng UI này.
- Các thay đổi UI hiện vẫn là file sửa/chưa được Git theo dõi trong worktree, **chưa commit hoặc push**. Chỉ checkout tên nhánh từ remote sẽ không tự có đầy đủ bản dựng. Implementer phải được bàn giao cả thay đổi và asset trong worktree; việc commit/push/integrate cần người dùng cho phép riêng.

Ngày2026-10-03. Đây là yêu cầu tích hợp UI đã được người dùng duyệt, không phải yêu cầu thiết kế lại gameplay. Đọc các cập nhật mới nhất từ người dùng trước khi bắt đầu.

## 1. Mục tiêu và thứ tự ưu tiên

Đưa diện mạo UI production về đúng bản duyệt: chất liệu giấy, nét mực, ngọc bích tối, viền vàng cổ, bố cục và tỷ lệ. Các ảnh tham chiếu không còn chỉ là gợi ý mỹ thuật. Tuy vậy, chi tiết thừa do AI tạo và thông tin gameplay không được xác thực không phải yêu cầu nghiệp vụ.

Thứ tự khi có mâu thuẫn: quyết định mới nhất của người dùng → bố cục/bản duyệt đã được người dùng chấp thuận → source và hành vi domain hiện tại đã audit → tài liệu tham khảo. Tài liệu scene/component không phải nguồn sự thật tuyệt đối. Không thay luật chỉ vì mockup có một con số, icon hoặc nút.

Workspace dựng UI: `E:\tutienidle\.agent-worktrees\hk-login-fidelity`, branch `codex/hk-login-fidelity`. Không giả định nhánh Devin có đủ thay đổi này; audit diff/asset/entrypoint thực tế trước khi bắt đầu. Không tự merge, commit, push, deploy hay xóa file hệ thống project. Không lấy main checkout bẩn làm bản duyệt của worktree.

## 2. Luật làm việc bắt buộc: audit từng chức năng, rồi hỏi kỹ người dùng

Không nhận danh sách plugin rồi nối máy móc. Với **mỗi chức năng**, audit theo vòng sau:

1. Đọc source consumer và domain owner hiện tại, xem runtime đang làm gì. Đối chiếu read-model, command, eligibility, state lifetime, reset/restore, persistence và i18n. Tách rõ verified / stale doc / fixture / chưa rõ.
2. So sánh UI production với ảnh mẫu và bản duyệt mới; ghi component còn thiếu, tương tác, states, artifact đang dùng và phần AI dư thừa phải loại.
3. Lập bảng mapping: component → dữ liệu đọc từ đâu → ý định người chơi → command thuộc ai → phản hồi thành công/thất bại → điều kiện và trường hợp chưa xác định. Không tính damage, cost, reward, stat hay eligibility trong Vue để lấp chỗ trống.
4. Nếu có thiếu hụt/mâu thuẫn/luật chưa rõ, **grill người dùng ngay**: nêu bằng chứng source và bản duyệt, chỉ ra hệ quả, đưa lựa chọn cụ thể và hỏi đến khi hết mơ hồ. Không tự chốt theo tài liệu, theo tên nút, theo suy đoán hay theo lời agent trước. Dừng riêng chức năng cần quyết định, tiếp tục phần độc lập đã rõ.
5. Sau khi rõ contract, nối UI với chủ sở hữu hiện hữu, giữ primitive/mechanism reusable. Thay presentation consumer có chủ đích, không mount HUD mới chồng HUD cũ.
6. Verify hành vi thật và hình ảnh ở các kích thước màn hình; đưa bằng chứng và giới hạn cho người dùng duyệt. Làm từng scene/chức năng có thể review, không một PR khổng lồ không thể chấm.

Ví dụ phải hỏi: nút Rèn này là slot-level hay item-instance-level; khóa dòng nào được phép; Hóa Luyện khác Phân Giải ở đầu ra/chi phí nào; món đang mặc có được chọn không; một phần batch bị từ chối thì toàn batch atomic hay từng món; cái nào scope-hidden nhưng chỉ cần art/UI; dùng resource count ở source nào; ảnh có thao tác domain chưa tồn tại. Không tự mở khóa beta hoặc dựng thuật toán mới để hợp thức hóa UI.

## 3. Các quyết định UI đã chốt

- Canvas thiết kế1440×810. Toàn bộ component scale đồng tỷ lệ theo viewport, có letterbox khi cần. Không reflow tùy tiện làm xô vị trí/tỷ lệ; không giảm riêng font/nút/art làm khác bản duyệt. Test browser zoom lẫn resize. Scroll chỉ trong danh sách/ngăn đã dành chỗ.
- Frame kéo giãn dùng9-slice; không stretch nguyên bitmap làm méo góc. Text, icon, node, số liệu và hitbox tách khỏi art. Không gen text gameplay vào bitmap.
- Background/parallax hiện hữu phải giữ. Main contexts là Login, Động Phủ, Độ Kiếp, Combat. Các panel chức năng dùng giấy phủ trên Động Phủ; không gen thêm nền riêng cho từng panel.
- Thanh điều hướng giấy dùng chung `PaperPanelNavigation`, danh sách động/scroll, không cố định4mục hay clone mỗi panel một thanh.
- Notice/error dành sẵn diện tích, không chèn vào làm đẩy form/nút hay che ngôn ngữ. Login bỏ chữ “hoặc”. Chữ trên nút phải căn giữa khung.
- Tạo nhân vật: thiên phú và kỹ năng khởi đầu là hai loại độc lập, ô vuông icon+tên, tooltip khi hover/focus; cùng một màn. Không tự coi3kỹ năng là3thiên phú. Lựa chọn Huy Kiếm/Huy Quyền trong bản duyệt chưa nối logic; audit và hỏi trước khi nối.
- Đăng nhập → Tạo nhân vật giữ cảnh trái, trượt tờ giấy sang phải; không đổi nền trái.
- Nhân vật: giấy là toàn bộ nền panel; chiến lực không cần một frame riêng.
- Đăng Tiên: art gói trong giấy,6mốc chính3/6/9/12/15/18; các bậc còn lại là UI ở thang, không thêm18tầng vẽ cứng.
- Tâm pháp/kỹ năng: vị trí và topology node do từng loại cung cấp; art node/info-frame reusable, không lấy một cây mẫu áp cho mọi loại.
- Luyện thể: lật3trang, silhouette đen tu tiên; phàm nhân đứng tấn, luyện khí thái cực, chu thiên ngồi thiền. Không thay bằng3hình ngồi thiền.
- Trang Bị: giữ vùng nhân vật ở trái để thêm ảnh sau, không tự gen nhân vật. Tooltip trang bị chỉ hiện hover/focus, không dựng cột tooltip cố định giữa.
- **Rèn nằm trong Trang Bị**: giữ vùng trái và các ô đang mặc. Vùng phải chuyển giữa túi Trang Bị và5tab rèn; không đồng thời hiện ba lô với workspace rèn. `/ui-forge.html` là bản thử phụ, không phải flow cuối.
- Cường Hóa/Tẩy Luyện/Tinh Luyện dùng art lò luyện khí **như lớp minh họa nền của vùng rèn trên giấy**, không phải item card, không khung riêng, không thay nền Động Phủ. Comparison/cost/action là lớp UI phía trên. Hóa Luyện/Phân Giải **không có thẻ món lớn**: dùng lưới toàn bộ trang bị trong túi như bag, multi-select, output/notice/action phía dưới. Thông tin output mẫu không phải luật thật. Audit selection constraints/confirmation với domain và hỏi người dùng.
- **Túi Đồ khác túi Trang Bị**: nguyên liệu, đan dược và vật phẩm thường về Túi Đồ; chỉ trang bị ở túi Trang Bị. Không tạo kho authoritative trùng, không tự di chuyển/xóa save data. Fixture Túi Đồ hiện còn nhóm/icon trang bị thử: bỏ nhóm đó khi tích hợp theo quyết định này.

## 4. Inventory bề mặt cần audit và tích hợp

| Bề mặt | Bản duyệt | Audit trước khi nối |
|---|---|---|
| Đăng nhập | `/` | Form mode, validation, locale, provider/auth authority; notice không xô UI. |
| Tạo nhân vật | Flow từ Login | Name, talents vs starter skills, rolling/selection ownership, tooltip/paging, transitions. Lựa chọn UI chưa chứng minh bootstrap/save. |
| Động Phủ | `/ui-dong-fu.html` | Read-model resources/name/realm/opportunities, hitbox/hover/select, scene navigation; giữ background/parallax đã có. |
| Nhân vật | `/ui-character.html` | Stats/vitals/elements/combat power format từ owner; optional portrait. |
| Cảnh giới | `/ui-realm.html` | Currentfloor/progress/eligibility/command,18bậc vs6mốc art; không tiến cấp từ click UI thuần. |
| Tâm pháp | `/ui-technique.html` | Owned/list/selected/equip/upgrade, tooltip và dynamic contents. |
| Kỹ năng | `/ui-skill.html` | Skill/node tree model và topology từng loại, selection/unlock/equip, costs/locks/beta gates. |
| Luyện thể | `/ui-body.html` | Three chapters, nodes/unit read-model và progress/requirements, switching không kích hoạt progression. |
| Thám hiểm | `/ui-exploration.html` | Mapnodes/edges/stage selection/unlock/challenge, fixture30nodes không quy định content thật. |
| Combat | `/ui-combat.html` | HUD read-model, gauges, AI controls, skills/vitals, Vue↔Phaser ownership và cleanup. Không sửa resolve hoặc outcome theo animation. |
| Luyện đan | `/ui-alchemy.html` | Recipe/material/queue/status, start/cancel request, timer/quantity/eligibility, giữ art đan lô hiện có. |
| Trang Bị + rèn | `/ui-equipment.html` | Sockets/bag/hovertooltip, equip/unequip,5ops, batch selection, locked lines, preview receipt, confirmation, atomicity và state refresh. |
| Độ Kiếp | `/ui-tribulation.html` | Three phase read-model, answers/timer/strike/vitals/result, không dùng fixturephase để định nghĩa domain state machine. |
| Chiến thắng | `/ui-victory.html` | Reward/growth đã resolve, retry/continue; mount/click không grant lại reward. |
| Thất bại | `/ui-defeat.html` | Reason/rewards thực tế nếu có, retry/home; không suy ra reward từ bộ mẫu. |
| Cài Đặt | `/ui-settings.html` | Audio/locale/scale/motion,save/export/import/feedback APIs, actual persistence; selectors hiện chỉ localUI. |
| Nhiệm Vụ | `/ui-quest.html` | List/status/objectives/reward/claim/follow, sourcequest categories; ảnh mẫu daily/weekly không tự tạo luật. |
| Túi Đồ | `/ui-inventory.html` | Non-equipmentitems/filter/search/sort/use/tooltip; quantity/read-model owner, không chứa nguyên liệu ở túi Trang Bị. |

## 5. Điểm nối và fixture cần thay

`docs/design/huyen-kim-ui-plugin-list.md` là catalog hooks UI-01–80 và cập nhật batch bag; **không phải plugin cài đặt**. Read full current component source vì contract có thể đã đổi trong vòng duyệt.

`src/ui-preview/**`, standalone `ui-*.html`, display rows/cost/output/level hardcode trong fidelity components là fixture hoặc demo. Không copy số mẫu thành formula/content rule; không import fixture vào domain. Khi tích hợp, chuyển các giá trị cần thiết thành readonly display props từ domain owner và typed commands. Hiện action chuỗi mode:itemIds:kind là bridge của bản duyệt; đổi sang typed request rõ ràng khi nối thật, không dùng split-string làm protocol production.

Lock flags và batch selections hiện là localUI; chuyển vào host phù hợp. Host reconcile selection theo item identity khi inventory thay đổi; clear stale selection khi đổi operation/session. Domain xác nhận items còn tồn tại/eligible tại command time. UI không authoritative cho receipt, randomness, cost, reward hay item consumption.

Các frame/assets mới nằm dưới `public/assets/ui/huyen-kim/scene/*-v2/`; giữ bản nguồn/version/provenance. `forge-v2/furnace-v1.png` là lò luyện khí transparent mới; dùng object-fit contain, không stretch. Existing content icons dễ thay thế không cần gen hàng loạt. Questbanner là crop tạm của nền hiện có, không phải yêu cầu gen backgroundmới.

## 6. Checklist nghiệm thu của implementer

- Đã audit từng chức năng và có mapping source/owner/commands, câu hỏi chưa rõ được người dùng giải đáp; không tự đánh dấu fixture là completegameplay.
- Từng scene so với bản duyệt ở1440×810,1920×1080,1000×800 và browser zoom; toàn bộ scale đồng tỷ lệ, framecorner không méo, tooltip/scroll/notice không che nhau.
- Drive actualflow, không chỉ trực tiếp mở preview. Click/key/focus/hover, empty/loading/error/locked/success states, re-entry/reset/restore where relevant. Mọi nút quan trọng có phản hồi tiếngViệt qua i18n.
- Không mount2HUD/renderers, không leak timers/listeners, không nối presentation completion với thưởng/chi phí/kết quả domain.
- Dùng protocol QA của project cho productionintegration: typecheck/tests/build theo risk, OCR, runtime và review đúngworktree. UIpreview delivery chưa phải QA_FIXED_POINT_REACHED hay merge-ready.
- Báo rõ scene/function đã làm, evidence, deviations được người dùng chấp thuận, blockers và câu hỏi. Không chỉ trả DONE khi chưa chứng minh production consumers đã sử dụng component/art mới.

## 7. Cách giao việc

Implement từng scene/chức năng có checkpoint người dùng, bắt đầu audit source rồi mới nối. Luôn giữ nguyên các quyết định mỹ thuật đã duyệt. Nếu cần đổi UI để phù hợp contract thật, cho người dùng xem khác biệt và hỏi trước, không âm thầm giảm fidelity. Không gộp unrelated gameplay rewrites vào mission UI. Bất kỳ điểm thiếu/mâu thuẫn nào: grill người dùng đến khi rõ rồi mới tiếp tục phần đó.
