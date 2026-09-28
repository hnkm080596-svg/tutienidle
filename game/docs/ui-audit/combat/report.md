# UI Audit — Combat slice

Branch: `devin/ui-scan-combat` · Target: `origin/master` (merge #40) · Tester: character "UI Audit Chiến" (Kiếm Tu path, guest save), fought Thanh Vân • Động 1 & 2 (Dã Trư / Sơn Khấu / Tĩnh Anh Sơn Khấu), đánh tay + auto, thua lẫn thắng.

## Verdict

**Overall: D+** — nền mỹ thuật trận đấu rất đẹp (scene tranh thủy mặc, sprite rõ, intro/countdown/pause/victory frame đều có gia vị "nghi lễ"), và turn-order strip là phần UI thông tin tốt nhất của trận. Nhưng combat đang ở trạng thái **gãy ở mức lõi**: toàn bộ skill bar manual sụp xuống 2×2px vô hình trong một dock rỗng chiếm 27–47% màn hình; tiêu đề thắng/trận tối chữ trên nền tối; màn thua tự tắt sau 10s không đếm ngược; không có cách thoát trận (modal thoát tồn tại nhưng là dead code). Người chơi mới vào trận thấy một phần ba màn hình là ngăn kéo đen trống — điều đó phá vỡ cả "trực quan" lẫn "đẹp" dù artwork bên dưới rất tốt.

## Graded screens

| # | Screen | Grade | Short verdict |
|---|--------|-------|----------------|
| 1 | Stage select (Truyền Tống Trận) — nút chọn chế độ trận | C | Mode buttons rõ; tên tầng bị truncate "…"; title header tối chữ |
| 2 | Combat intro "Vào Trận" | B | Serif vàng lớn, stage phụ đề; dock rỗng đã hiện trong intro |
| 3 | Countdown 3-2-1 "Xuất Trận!" | A− | Số lớn giữa sân, rõ ràng |
| 4 | Battle view (canvas + HUD composition) | D | Scene đẹp nhưng 27vw bên phải là void đen; AI panel lơ lửng; HP bar địch quá mảnh |
| 5 | Turn order strip ("Hiệp X/20 · Lượt tới" + chips) | B− | Marker ▶ tới lượt rõ; tràn/clip dưới dock ở màn hẹp; chip trùng tên không phân biệt |
| 6 | Skill bar / action row (dock) | F | Slot render 2×2px — toàn bộ affordance/cooldown/cost/tooltip vô hình (tooltip vẫn hoạt động trên nút ma) |
| 7 | Player HP/MP/Thế bars | C | HP bar dưới-trái ổn nhưng HP lặp 3 nơi; "Player" label EN hardcode; MP/Thế gated sang path khác (xem note) |
| 8 | Battle log "Nhật ký" | C+ | Câu VI đọc được, collapse toggle tốt; text xám đều không màu theo actor/damage; nằm chồng trong vùng dock |
| 9 | Auto vs Manual toggle ("Thủ công") | D | Checkbox trơ trọi trong void; auto mode = dock chết hoàn toàn; không giải thích manual đổi gì |
| 10 | Pause overlay (tab hidden) | B+ | Card sạch, dim nhẹ giữ cảnh trận; có nút Tiếp tục; EN/VI đều tốt |
| 11 | Exit confirm modal | B (function) / F (reachability) | Modal tốt (scrim, destructive đỏ, Esc) nhưng **không ai gọi** — dead code |
| 12 | Victory panel "★ THẮNG ★" | C | Rewards + retry/continue/auto-countdown đầy đủ; **title vô hình**; tên item rút gọn kỳ lạ; toast flood che phủ |
| 13 | Defeat panel "☠ THẤT BẠI" | C+ | Hint copy tốt (phân biệt thiếu tu vi vs thiếu gear); tự về sau 10s không báo; rewards khi có kill |
| 14 | Loot toast stream (trong trận) | C | Card đẹp nhưng chất chồng cả cạnh phải (≤15 card), tên ellipsis cắt giữa chữ, đè dock/strip/counter |
| 15 | Narrow viewport 820px / 480px | D/F | Dock 47%/49% của màn hình vẫn rỗng; strip bị cắt; 480px thực tế không chơi được |

## Findings (ordered by severity)

### [Critical] Skill slots render ở 2×2px — manual combat không thể bấm
- **Screen:** battle view → right dock (TurnCombatSkillBar trong CombatSkillDockPanel)
- **Player sees/does:** tick "Thủ công" → "Đến lượt bạn — chọn kỹ năng" hiện, nhưng không có nút nào để bấm. Chỉ có một viền xanh jade 2px là dấu vết của slot đang `is-tappable`. Đo DOM: mọi `.turn-combat-skill-bar__slot-button` đều `w:2, h:2` (button không có `width`; `SlotView` bên trong là `width:100%; aspect-ratio:1` → sụp còn ~0). Click vào vùng 2px đó vẫn submit turn (log ghi "UI Audit Chiến dùng Huy Kiếm") — tức interaction sống nhưng presentation chết: cooldown mask, resource cost, icon, label, orb picker, passive emblem đều đã code xong và đều bị chôn.
- **Why it's a problem:** manual mode — toàn bộ điểm tương tác của combat — biến mất khỏi UI.
- **Suggestion:** đặt kích thước tường minh cho `.turn-combat-skill-bar__slot-button` (vd `width:64px`, hoặc token `--slot-size` truyền xuống SlotView như inventory), thêm visual e2e/percy cho dock vì regression này đi qua được suite hiện tại.
- **Shots:** `42-dock-manual.png`, `41-manual-awaiting-choice.png`, `45-slot-hover-tooltip.png`

### [High] Skill dock: ngăn kéo rỗng gắn cố định 27–47% màn hình
- **Screen:** mọi trạng thái fighting
- **Player sees:** panel đen `clamp(340px, 27vw, 440px)` (≤900px: `min(44vw, 400px)`) full-height bên phải, chỉ chứa checkbox "Thủ công" + bar hỏng ở mép trên — ~94% diện tích là void. Ở 820px dock rộng 386px → battlefield còn ~434px; 480px dock chiếm ~49%. Dock `z-index:12` còn **chặn pointer** lên phần UI bên dưới (đo được: click `stage-start-button` bị aside dock chặn) và che nửa phải của turn strip.
- **Why it's a problem:** trả giá layout lớn nhất của combat cho phần tử không chứa gì; vỡ responsive ở mọi width dưới ~1000px.
- **Suggestion:** dock ôm content (`width:auto` khi chỉ còn bar) hoặc chuyển thành bottom-bar; dưới ~700px collapse thành sheet trượt lên; tối thiểu ẩn dock khi không còn control nào hiển thị.
- **Shots:** `42-dock-manual.png`, `70-narrow-820.png`, `71-narrow-480.png`

### [High] Title victory "★ THẮNG ★" vô hình (chữ tối trên nền tối)
- **Screen:** CombatVictoryPanel (cùng pattern trên header "Truyền Tống Trận" của stage select và reward names)
- **Player sees:** sau khi thắng, panel hiện nhưng title gần như không đọc được. Nguyên nhân: `combat-victory-panel__title` dùng `var(--paper-text)` = `#211f1a` — token này chỉ được remap sang màu sáng bên trong `.ink-drawer`; surface `surface-xl-paper-scroll` giờ là dark mode (`surface-700→900`). Reward names cũng dùng `--paper-text-soft` `#5e5a50` → ~3:1 contrast trên nền tối.
- **Suggestion:** đổi sang `var(--surface-text)`/`--chrome-100` và `--surface-text-soft`, hoặc bọc panel trong scope token của `.ink-drawer`. Defeat dùng `--crimson` nên không bị.
- **Shots:** `50-victory-panel.png`, `51-victory-panel-2.png`, `08-stage-select.png`

### [High] Defeat panel tự tắt sau 10s không báo trước
- **Screen:** CombatDefeatPanel
- **Player sees:** đang đọc hint/rewards thì màn tự biến về Động Phủ (`startReturnCountdown(10)` chạy ngay khi mount, kể cả manual mode). Chỉ nút "Tái Chiến" hiện countdown (và chỉ ở repeat mode); nút "Về Động Phủ" không hiển thị đếm ngược → player không biết màn sắp đóng. (Đã xảy ra trong session test: panel biến mất giữa lúc đang xem.)
- **Suggestion:** render countdown lên nút "Về Động Phủ" (giống retry countdown), hoặc chỉ auto-return khi `battleRunMode !== 'manual'`.
- **Shots:** `12-combat-hud-live.png`

### [High] Toast flood: ≤15 thẻ loot chất dọc hết cạnh phải trong/sau trận
- **Screen:** bất kỳ trận nào có drop (ToastContainer `top:24 right:24`, `maxVisible` theo chiều cao — 800px → ~15)
- **Player sees:** một victory 8–10 drop → toàn bộ mép phải là cột thẻ "NHẬN ĐƯỢC" đè lên dock, turn strip, kill counter; tên item `text-overflow: ellipsis` cắt giữa từ ("Huyền - Thanh Vã…", "Hoàng - Thanh Vã…"). Toasts vẫn spam khi victory panel đã mở, che luôn cả phần panel.
- **Suggestion:** cap 3–4 toast trong combat, gom trùng ("Tinh Hoa Phàm Thể ×3"), hoặc chuyển thành feed trong battle log; cho name 2 dòng thay vì ellipsis.
- **Shots:** `50-victory-panel.png`, `63-log-toggled.png`, `80-en-locale-combat.png`

### [High] Không có cách thoát trận đang đánh; exit modal là dead code
- **Screen:** battle HUD
- **Player sees:** vào trận khó quá → không nút rút lui, không Esc-exit; phải thua (~20 hiệp) hoặc reload. `CombatScene.requestCombatExit()` (L1703) emit `combat_exit_request` nhưng **không có call site production nào** — modal tồn tại, hoạt động tốt khi emit tay (scrim, "Ở Lại"/"Thoát Trận" đỏ destructive, Esc = ở lại). Comment TopBar nói cố ý "không có rút lui" — nhưng modal đã được build, tức intent từng tồn tại.
- **Suggestion:** gắn affordance (nút ✕ trên top bar hoặc Esc trong trận) vào modal hiện có; hoặc xoá hẳn path chết. Trạng thái hiện tại là worst of both.
- **Shots:** `60-exit-confirm-modal.png`

### [Medium] Turn order strip bị clip dưới dock / đè lên AI panel ở màn hẹp
- **Screen:** TurnOrderStrip (`top: var(--combat-topbar-h)`, full-width)
- **Player sees:** strip trải full viewport (820px) trong khi dock phủ từ x434 → queue "Lượt tới" bên phải bị dock rỗng che mất; ở 480px chip đè cả lên mép AI panel và text "Lượt"/"Chiến"/"Dã" vỡ thành mảnh trong dock. Ngay cả ở 1280, chip cuối hàng tới đứng mép dock.
- **Suggestion:** giới hạn strip trong battlefield width (`right: <dockWidth>`) hoặc wrap 2 dòng; scroll nội bộ thay vì tràn.
- **Shots:** `70-narrow-820.png`, `71-narrow-480.png`, `61-pause-overlay.png`

### [Medium] Player HP hiển thị 3 lần, label sprite là "Player" hardcode EN
- **Screen:** battle view
- **Player sees:** cùng một HP "106/108" xuất hiện ở (a) chip giữa trên cùng, (b) chip "UI Audit Chiến" trong strip kèm bar xanh, (c) thanh đỏ canvas dưới-trái. Sprite player có nhãn chữ "Player" (English, không đổi theo locale) trong khi mọi nơi khác dùng tên nhân vật. Text "106/108" dưới-trái đè lên mép thanh máu, hơi tràn.
- **Suggestion:** giữ 1 chỗ authoritative (strip chip) + bar dưới sprite không cần số; đổi label sprite thành tên nhân vật hoặc ẩn.
- **Shots:** `62-battle-log-live.png`, `80-en-locale-combat.png`, `71-narrow-480.png`

### [Medium] HP bar địch là sợi chỉ đỏ ~30×4px, không đọc được
- **Screen:** battle view
- **Player sees:** slivers đỏ mảnh trên đầu quái, không số, không chiều dài tương đối rõ rệt; khi có 2-3 con cùng tên không thể biết con nào sắp chết để ưu tiên (kể cả với "HP thấp nhất" AI).
- **Suggestion:** tăng chiều cao/độ tương phản bar, flash trắng khi trúng đòn, hover enemy → chip chi tiết.
- **Shots:** `41-manual-awaiting-choice.png`, `46-after-basic-skill.png`

### [Medium] Quái trùng tên → chip/sprite không phân biệt được
- **Screen:** turn strip + battlefield
- **Player sees:** "Dã Trư | Dã Trư", "Sơn Khấu | Sơn Khấu" trong queue và 2 sprite giống hệt nhau + 2 nhãn giống hệt nhau. Đọc queue không biết lượt này của con nào; khi con chết không map được chip ↔ sprite.
- **Suggestion:** suffix instance ("Dã Trư A/B" hoặc số mờ), hoặc tô tint chip trùng màu marker trên sprite.
- **Shots:** `41-manual-awaiting-choice.png`, `80-en-locale-combat.png`

### [Medium] "Thủ công" checkbox trơ trọi + manual mode không tự giải thích
- **Screen:** dock top
- **Player sees:** một checkbox nhỏ "Thủ công" là control duy nhất nhìn thấy trong 370px tối; bật nó chỉ đổi sang text "Đến lượt bạn — chọn kỹ năng" — không có slot nào (bug critical). "Thủ công" là **chuỗi VI hardcode trong template** (giữ VI khi locale=en), toast eyebrow "Nhận được" cũng hardcode. Không có tooltip giải thích manual = chọn chiêu mỗi lượt.
- **Suggestion:** i18n hóa "Thủ công"/"Nhận được"; đặt toggle vào top bar hoặc làm segmented control "Tự động / Thủ công"; khi bật manual lần đầu show 1-line coachmark.
- **Shots:** `41-manual-awaiting-choice.png`, `61-pause-overlay.png`, `80-en-locale-combat.png`

### [Medium] Reward list dùng tên template trần ("Kiếm +6", "Giới +1") trong khi toast hiện tên đầy đủ
- **Screen:** victory/defeat reward list
- **Player sees:** summary items hiển thị `item.name` = template name trần ("Kiếm", "Quyền", "Trụy", "Châu", "Giới", "Bào") — mất phần quality + zone ("Huyền - Thanh Vân Kiếm") mà toast đang show. Đọc như danh sách fragment; không icon, không màu quality.
- **Suggestion:** đưa composed display name (đã có `composeEquipmentDisplayName`) vào `BattleRewardItem.name`, hoặc render item name theo cùng segment model của toast.
- **Shots:** `50-victory-panel.png`, `51-victory-panel-2.png`

### [Low] AI Mục Tiêu panel lơ lửng trên scene trong intro + combat
- **Screen:** battlefield trái
- **Player sees:** radiogroup 5 option nổi trên tranh thủy mặc, bám suốt intro/fight; nhìn như panel debug; không có nút collapse. Radio nhỏ (16px) khó bấm ở viền.
- **Suggestion:** collapse thành popover từ một chip "AI: Gần nhất ▸" trên top bar, hoặc đặt trong dock khi dock được sửa.
- **Shots:** `11-fight-00.png`, `41-manual-awaiting-choice.png`

### [Low] Exit modal có thể bật trên victory screen (trạng thái đã kết thúc)
- **Screen:** exit confirm over result
- **Player sees:** emit `combat_exit_request` khi victory panel đang mở → modal "Thoát trận… trận đấu hiện tại sẽ bị huỷ" chồng lên màn đã thắng. Gate chỉ check `combatOrigin === 'stage'`, không check battle state.
- **Suggestion:** ignore event khi `battle.state !== 'fighting'`.
- **Shots:** `60-exit-confirm-modal.png`

### [Low] Battle log phẳng, không hierarchy
- **Screen:** "Nhật ký" bottom-right (trong vùng dock)
- **Player sees:** "Lượt 2: Dã Trư dùng Vật Công → UI Audit Chiến" — text xám đều nhau, không damage số, không màu player/enemy; max 30 dòng, panel 260×~200px. Đọc được nhưng scan chậm.
- **Suggestion:** colorize actor (jade/danger như strip chips), nối damage vào cuối dòng, highlight cast của player.
- **Shots:** `62-battle-log-live.png`

### [Low] Tên tầng stage select truncate "…" mất thông tin phân biệt
- **Screen:** Truyền Tống Trận → lưới "Chọn tầng"
- **Player sees:** "Hung Dã Trư - H…", "Ngân Hồ - Thiết…", "Hung Thủy Lang…" — suffix mang tên quái chủ bị cắt; phải click từng tầng để xem đội hình.
- **Suggestion:** tooltip hover hiện tên đầy đủ, hoặc cho card 2 dòng.
- **Shots:** `08-stage-select.png`

### [Low] Victory panel không có auto-continue cho manual — đúng, nhưng không có cách đọc reward sau khi bấm Tiếp Tục
- (giữ vì borderline): "Đánh Lại" disabled + countdown chỉ hiện ở auto modes; manual phải bấm tay — OK, nhưng "Tiếp Tục" làm mất reward list vĩnh viễn; player muốn xem lại "vừa nhận gì" không có chỗ.
- **Shots:** `50-victory-panel.png`

### [Nit] Vue DevTools anchor button lộ nửa nút ở bottom-center khi dev
- Chỉ trong dev build; trùng vùng log/chat future.
- **Shots:** `62-battle-log-live.png` (đáy giữa)

## Notes — màn gating/progression chưa đạt trực tiếp

- **Thế bar / MP "Linh Lực" bar / Kiếm bar / ward (Sơn Nhạc Hộ Thể):** nhân vật test theo Kiếm Tu (`maxMp=0`) → MP + Thế không render. Đọc code `PlayerHudLayer.updateThe`: pool ≤5 hiện **dot row** (1 pip/point) + chữ "PHAP THE" sáng khi `phapTheActive`; pool lớn hơn `THE_DOT_LANE_MAX` tự chuyển fill-bar (ung-thế). Kiếm bar poll mỗi frame. Chưa verify trực quan — cần char Pháp Tu.
- **Hộ interception prompt / reactive proc notifications:** không tìm thấy component interception riêng trong `components/game/combat/` — proc/reaction surfaces qua battle log + toast; "Hộ vệ" chỉ là archetype label trong stage select.
- **Cast-blocked feedback:** có state `is-insufficient`/`out-of-range` → slot grayscale 0.6 + opacity .7 — nhưng vô hình cùng với critical bug slot 2px. Không có toast "không đủ tài nguyên" riêng.
- **Screen shake / camera cues:** code có damage numbers `-N` (crit font 20px đậm, Back.easeOut pop), DoT floats, spawn rings, sprite hit-flash — đã thấy slash trail + flash trong shots; shake chưa tách biệt được từ ảnh tĩnh.
- **Hidden trial banner:** `combat-top-bar__trial` thay kill counter khi trial active — không reach được trong session.

## How each screen was reached

Chơi thật: guest → tạo char "UI Audit Chiến" → Tab wheel → teleport_array → stage select → Bắt Đầu. Manual mode qua checkbox. Victory force bằng `window.__tutienPhaserGame.registry.get('gameManager').getTurnBattle()` + flip `entity.alive=false` mỗi wave (stat pokes bị recalc ghi đè). Defeat = để boar đánh tự nhiên. Pause = fake `visibilitychange` + `document.visibilityState='hidden'` (tab-switch thật qua CDP không trigger). Exit modal = `eventBus.emit('combat_exit_request')`. EN locale = `__vue_app__.config.globalProperties.$i18n.locale='en'` (không có UI switch). Narrow = `page.setViewportSize`.
