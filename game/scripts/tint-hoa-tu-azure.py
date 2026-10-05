#!/usr/bin/env python3
"""One-off hue-rotate of the Hoa Tu charge atlas into the azure family.

The empowered (bac 2) Ly Hoa Thuat cast flies azure art; the converging
charge still burns orange. This shifts the whole sheet's hue so the
charge reads the same azure family as hoa-cau-phoenix-empowered.png
(dominant hue ~190-200 deg) while alpha and luminance stay untouched.

Usage: python3 scripts/tint-hoa-tu-azure.py [--shift 160] [--preview]
"""
import argparse
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

GAME_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = GAME_ROOT / 'public/assets/vfx/hoa-cau-thuat/charge'
DST_DIR = GAME_ROOT / 'public/assets/vfx/hoa-cau-thuat/charge-azure'
PNG_NAME = 'hoa-tu-charge-azure.png'
JSON_NAME = 'hoa-tu-charge-azure.json'


def hue_rotate(path: Path, degrees: float) -> Image.Image:
    """Rotate the HSV hue channel by `degrees`; alpha and value preserved."""
    rgba = Image.open(path).convert('RGBA')
    rgb = rgba.convert('RGB')
    hsv = np.asarray(rgb.convert('HSV'), dtype=np.uint8).copy()
    # PIL HSV packs 0-360 deg into 0-255; shift wraps mod 256.
    shift = round(degrees * 255 / 360) % 256
    hsv[..., 0] = (hsv[..., 0].astype(np.uint16) + shift) % 256
    tinted = Image.fromarray(hsv, 'HSV').convert('RGB')
    tinted.putalpha(rgba.getchannel('A'))
    return tinted


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--shift', type=float, default=160.0,
                        help='hue rotation in degrees (default 160)')
    parser.add_argument('--preview', action='store_true',
                        help='also write side-by-side crops of frame_40')
    args = parser.parse_args()

    DST_DIR.mkdir(parents=True, exist_ok=True)
    tinted = hue_rotate(SRC_DIR / 'hoa-tu-charge.png', args.shift)
    tinted.save(DST_DIR / PNG_NAME)

    atlas = json.loads((SRC_DIR / 'hoa-tu-charge.json').read_text())
    if 'image' in atlas.get('meta', {}):
        atlas['meta']['image'] = PNG_NAME
    (DST_DIR / JSON_NAME).write_text(json.dumps(atlas, indent=2) + '\n')
    print(f'wrote {DST_DIR / PNG_NAME} + {JSON_NAME} (shift {args.shift} deg)')

    if args.preview:
        # frame_40 sits mid-charge (ball formed, still converging).
        box = (0, 5 * 192, 192, 6 * 192)
        source = Image.open(SRC_DIR / 'hoa-tu-charge.png').convert('RGBA').crop(box)
        out = Image.new('RGBA', (192 * 2 + 8, 192), (0, 0, 0, 0))
        out.paste(source, (0, 0))
        out.paste(tinted.crop(box), (192 + 8, 0))
        preview = DST_DIR / 'preview-frame40-side-by-side.png'
        out.save(preview)
        print(f'wrote {preview}')


if __name__ == '__main__':
    main()
