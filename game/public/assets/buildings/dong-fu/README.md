# Động Phủ building art

All source buildings use a `1254 × 1254` transparent canvas and a consistent elevated three-quarter front view.

Active world objects rendered from the current project data:

- `scripture_pavilion.png` — Tàng Kinh Các (static world object)
- `spirit_spring.png` — Linh Tuyền
- `equipment_hall.png` — Khí Đường
- `pill_room.png` — Đan Phòng
- `teleport_array.png` — Truyền Tống Trận
- `gathering_outpost.png` — Sản Xuất

Interaction states should reuse the same base PNG so its silhouette and hit target remain stable:

- default: unchanged art
- hover: slight upward offset plus warm outline/drop glow derived from alpha
- selected: persistent gold/jade outline and a separate ground selection ring
- locked/unbuilt: grayscale, reduced brightness and opacity
- upgradeable: separate pulsing badge or particle overlay

The open center of `teleport_array.png` is genuinely transparent so portal VFX can be rendered independently.

`buildings-contact-sheet.png` is a QA preview, not a runtime texture.
