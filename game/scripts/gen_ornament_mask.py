"""Extract an ornament-only alpha mask from slot-art PNGs.

Keeps pixels that are bright + warm (the gold ornament), drops the dark
interior and transparent padding. Output alpha = art_alpha * ornament-ness,
so it can drive CSS mask-image for the Pham recolor layer.
"""
from PIL import Image
import os

SRC = "public/assets/ui/tien-hiep-2026-10/controls"

for name in ("item-slot-v2.png", "equipment-socket-v2.png"):
    path = os.path.join(SRC, name)
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    op = out.load()
    kept = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            # ornament = luminous; interior is near-black (<~45)
            warm = r >= b * 1.15  # gold skews red/green over blue
            if lum > 60 and warm:
                # scale alpha by luminance so bright filigree is solid,
                # darker shading keeps a softer tint
                k = min(255, int(255 * (lum / 200.0)))
                op[x, y] = (255, 255, 255, (a * k) // 255)
                kept += 1
    dst = os.path.join(SRC, name.replace(".png", "-ornament-mask.png"))
    out.save(dst)
    print(f"{name}: {w}x{h} kept {kept}px -> {dst}")
