// Prints normalized ArtExtent {x,y,w,h} (0..1 of source) for each static PNG -
// the alpha bounding box of the figure, same measurement as opaqueBounds() in
// pack-mortal-combat-art.mjs. Paste output into the extent constants in
// src/presentation/art/CombatPresentationCatalogue.ts.
import { createCanvas, loadImage } from 'canvas'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public')

const TARGETS = [
  'assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png',
  'assets/characters/player/phap-tu/player-phap-tu-v1.png',
  'assets/characters/placeholder/entity-placeholder.png',
]

function opaqueBounds(ctx, w, h) {
  const { data } = ctx.getImageData(0, 0, w, h)
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < 0) throw new Error('fully transparent image')
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

for (const rel of TARGETS) {
  const img = await loadImage(path.join(ROOT, rel))
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const b = opaqueBounds(ctx, img.width, img.height)
  console.log(rel)
  console.log(
    `  { x: ${(b.x / img.width).toFixed(6)}, y: ${(b.y / img.height).toFixed(6)}, ` +
      `w: ${(b.w / img.width).toFixed(6)}, h: ${(b.h / img.height).toFixed(6)} }`,
  )
}
