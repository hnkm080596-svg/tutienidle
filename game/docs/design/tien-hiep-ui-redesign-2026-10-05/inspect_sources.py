from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[3]
folder = root / 'public/assets/ui/tien-hiep-2026-10/source'
reports = []
for file in sorted(folder.glob('*.png')):
    pixels = np.asarray(Image.open(file).convert('RGBA'))
    alpha = pixels[:, :, 3]
    ys, xs = np.where(alpha >= 8)
    red = (pixels[:, :, 0] > 200) & (pixels[:, :, 1] < 70) & (pixels[:, :, 2] < 70)
    report = dict(id=file.stem, width=int(pixels.shape[1]), height=int(pixels.shape[0]),
                  alphaMin=int(alpha.min()), alphaMax=int(alpha.max()),
                  centerAlpha=int(alpha[alpha.shape[0]//2, alpha.shape[1]//2]),
                  transparentPixels=int((alpha == 0).sum()),
                  redVisible=int((red & (alpha > 0)).sum()),
                  redInvisible=int((red & (alpha == 0)).sum()),
                  redAlphaMax=int(alpha[red].max()) if red.any() else 0,
                  redAbove32=int((red & (alpha > 32)).sum()),
                  bounds=dict(x=int(xs.min()), y=int(ys.min()),
                              width=int(xs.max()-xs.min()+1), height=int(ys.max()-ys.min()+1)))
    reports.append(report)
Path(__file__).with_name('source-metrics.json').write_text(json.dumps(reports, indent=2), encoding='utf-8')
print(json.dumps([dict(id=r['id'],redVisible=r['redVisible'],redInvisible=r['redInvisible']) for r in reports]))
