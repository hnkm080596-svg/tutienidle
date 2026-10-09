# Generates a self-contained HTML gallery of every art the legacy
# equipment panel (legacy/ui-equipment.html) uses. Thumbnails are
# base64-embedded so the file travels alone.
import base64, io, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")
OUT = os.path.join(ROOT, "docs", "equipment-legacy-art-inventory.html")

def thumb(rel, max_w=480):
    path = os.path.join(PUB, rel.replace("/", os.sep))
    im = Image.open(path).convert("RGBA")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()

def card(rel, name, where, note=""):
    data = thumb(rel)
    note_html = f'<div class="note">{note}</div>' if note else ""
    return f'''<div class="card"><div class="img"><img src="data:image/png;base64,{data}"></div>
<div class="meta"><b>{name}</b><div class="file">{rel}</div><div class="where">{where}</div>{note_html}</div></div>'''

def row_cards(pairs):
    out = []
    for rel, name, where in pairs:
        out.append(card(rel, name, where))
    return "".join(out)

groups = [
 ("Backdrop Động Phủ (DongFuVista, 2 lớp parallax theo chuột)", [
   ("assets/ui/huyen-kim/scene/dong-fu-v2/rear.png", "rear.png", "Lớp xa cảnh nền — dịch chuyển -3px theo con trỏ"),
   ("assets/ui/huyen-kim/scene/dong-fu-v2/foreground.png", "foreground.png", "Lớp gần cảnh nền — dịch chuyển -8px theo con trỏ"),
 ]),
 ("Giấy nền + khung panel (fidelity scene + global tien-hiep-ui.css)", [
   ("assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png", "shared-paper-page-v1.png", "Tờ giấy lớn làm nền .equipment-paper (backgroundImage)"),
   ("assets/ui/tien-hiep-2026-10/runtime/paper-panel.png", "paper-panel.png", "Border-image khung giấy — global rule *-paper, viền 52px slice 240/320"),
   ("assets/ui/tien-hiep-2026-10/runtime/paper-surface.png", "paper-surface.png", "Texture giấy lặp 512×384 phủ ::before trong giấy"),
   ("assets/ui/tien-hiep-2026-10/source/world-vista.png", "world-vista.png", "Vệt màu nước loang trong mặt giấy (cover, dưới texture)"),
   ("assets/ui/tien-hiep-2026-10/source/warm-branch-corner-v1.png", "warm-branch-corner-v1.png", "Cành trang trí góc trái-dưới giấy (::before, opacity .55)"),
 ]),
 ("Tiêu đề + card + tab", [
   ("assets/ui/tien-hiep-2026-10/controls/equipment-divider-v1.png", "equipment-divider-v1.png", "Gạch mực dưới tiêu đề Trang Bị + dưới header Túi Trang Bị"),
   ("assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png", "character-card-nine-slice-v2.png", "Card tối nine-slice: Thuộc Tính, Túi Trang Bị, card Forge"),
   ("assets/ui/tien-hiep-2026-10/controls/equipment-tab-brush-v1.png", "equipment-tab-brush-v1.png", "Nét bút vàng sau nhãn tab đang chọn (nav + chip lọc)"),
 ]),
 ("Nhân vật + 6 socket tròn", [
   ("assets/ui/huyen-kim/scene/equipment/equipment-paperdoll-base@1x.png", "equipment-paperdoll-base@1x.png", "Hình mannequin đứng giữa doll (@2x ở production)"),
   ("assets/ui/tien-hiep-2026-10/controls/equipment-brush-circle-v1.png", "equipment-brush-circle-v1.png", "Vòng brush vàng lớn quanh nhân vật (ornament)"),
   ("assets/ui/tien-hiep-2026-10/controls/equipment-circle-frame-v1.png", "equipment-circle-frame-v1.png", "Vòng tròn vàng có mây quanh mỗi ô trang bị (6 ô)"),
 ]),
 ("Icon vật phẩm (dữ liệu, 8 họ base-*)", [
   ("assets/equipment/items/base-kiem/kiem-03.png", "base-kiem/kiem-03.png", "Ví dụ họ Kiếm — icon hiện trong socket + ô túi"),
   ("assets/equipment/items/base-bao/bao-04.png", "base-bao/bao-04.png", "Ví dụ họ Bào"),
   ("assets/equipment/items/base-gioi/gioi-04.png", "base-gioi/gioi-04.png", "Ví dụ họ Giới (nhẫn)"),
 ]),
 ("Lò rèn + nguyên liệu (forge workspace)", [
   ("assets/ui/huyen-kim/scene/forge-v2/furnace-v1.png", "furnace-v1.png", "Lò rèn bên trái vùng workspace khi mở tab op"),
   ("assets/materials/linh_khoang.png", "linh_khoang.png", "Icon Linh Khoáng — ô nguyên liệu + kết quả nhận"),
   ("assets/materials/linh_moc.png", "linh_moc.png", "Icon Linh Mộc — ô kết quả nhận"),
 ]),
 ("Chip nguyên liệu preview (resource-*-v1)", [
   ("assets/ui/tien-hiep-2026-10/controls/resource-coin-v1.png", "resource-coin-v1.png", "Chip Tiền trong hàng nguyên liệu của preview forge"),
   ("assets/ui/tien-hiep-2026-10/controls/resource-crystal-v1.png", "resource-crystal-v1.png", "Chip Tinh Thể"),
   ("assets/ui/tien-hiep-2026-10/controls/resource-essence-v1.png", "resource-essence-v1.png", "Chip Tinh Hoa"),
   ("assets/ui/tien-hiep-2026-10/controls/resource-jade-v1.png", "resource-jade-v1.png", "Chip Ngọc"),
 ]),
 ("Chrome ô SlotView (ô vuông trong túi + ô trang bị)", [
   ("assets/ui/tien-hiep-2026-10/runtime/slot-frame.png", "slot-frame.png", "Khung vuông global — global rule ép lên mọi .slot-view"),
   ("assets/ui/ink-wash/slices/frame-s-slot@1x.png", "frame-s-slot@1x.png", "Khung vẽ ink-wash nine-slice (lớp .slot-view__frame-art)"),
   ("assets/ui/Slot/inv-slot-backdrop.png", "inv-slot-backdrop.png", "Nền ô item mặc định (gạch tối)"),
   ("assets/ui/Slot/slot-backdrop.png", "slot-backdrop.png", "Nền ô equipment (kính mờ) — variant 'equipment'"),
   ("assets/ui/Slot/bag-slot-hover.png", "bag-slot-hover.png", "Sheen trắng hover (fallback variant item)"),
   ("assets/ui/Slot/slot-frame-hover.png", "slot-frame-hover.png", "Khung vàng nhạt khi hover/focus ô"),
   ("assets/ui/Slot/seal-frame.png", "seal-frame.png", "Con dấu khắc nâu sau chữ phẩm (vd. '九') góc trái-trên ô"),
 ]),
 ("Tooltip + viền khung phụ", [
   ("assets/ui/huyen-kim/scene/dong-fu-v2/panel-nine-slice.png", "panel-nine-slice.png", "Viền nine-slice .gear-tooltip khi hover vật phẩm"),
   ("assets/ui/tien-hiep-2026-10/runtime/panel-frame-v2.png", "panel-frame-v2.png", "Border-image chung: tooltip, rail nav trái, khung bảng phụ"),
 ]),
]

sections = []
total = 0
for title, items in groups:
    cards = "".join(card(*i) for i in items)
    total += len(items)
    sections.append(f'<section><h2>{title} <span class="count">({len(items)})</span></h2><div class="grid">{cards}</div></section>')

html = f'''<!doctype html><html lang="vi"><meta charset="utf-8"><title>Art legacy — Panel Trang Bị</title>
<style>
body{{margin:0;background:#141210;color:#e8dcc0;font:14px/1.5 'Segoe UI',sans-serif}}
header{{padding:20px 28px 8px}}h1{{font-size:20px;color:#f0dfb0;margin:0}}header p{{color:#a89878;margin:4px 0 0}}
section{{padding:14px 28px}}h2{{font-size:15px;color:#e8c878;border-bottom:1px solid #4a3f28;padding-bottom:6px}}.count{{color:#a89878;font-weight:400}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}}
.card{{background:#1e1b16;border:1px solid #3a3226;border-radius:6px;overflow:hidden}}
.card .img{{height:130px;display:grid;place-items:center;background:repeating-conic-gradient(#242019 0 25%,#1b1813 0 50%) 0 0/18px 18px}}
.card img{{max-width:92%;max-height:120px;object-fit:contain}}
.meta{{padding:8px 10px}}.meta b{{color:#f0e0b4;font-size:13px}}.file{{color:#7d7158;font-size:11px;word-break:break-all;margin:2px 0 5px}}.where{{color:#c8b890;font-size:12px}}
</style>
<header><h1>Toàn bộ art trong bản LEGACY — Panel Trang Bị</h1>
<p>Scope: legacy/ui-equipment.html → EquipmentPreview → EquipmentFidelityScene + DongFuVista + chrome global. Tổng {total} file.</p></header>
{''.join(sections)}
'''

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print("written", OUT, f"{len(html)/1024:.0f}KB")
