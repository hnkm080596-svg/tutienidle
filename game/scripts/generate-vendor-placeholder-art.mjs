// Placeholder art cho building "vendor" (Ky Bao Cac, 2026-08-30) - user
// se cung cap asset that sau qua asset-drop/ + npm run assets:route.
// Placeholder nay CHI de dongFuBuildingAssets.test.ts (RGBA 1254x1254,
// dung 4 file ky thuat/building) khong do trong luc cho anh that - xoa/
// ghi de truc tiep khi co asset that, khong can sua code noi khac.
import { createCanvas } from 'canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SIZE = 1254
const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public/assets/buildings/dong-fu/v2/vendor',
)

// Khop visualBounds trong DongFuBuildingArt.ts: x150 y200 w950 h850.
const BOUNDS = { x: 150, y: 200, width: 950, height: 850 }

mkdirSync(OUT_DIR, { recursive: true })

function save(name, draw) {
  const canvas = createCanvas(SIZE, SIZE)
  const ctx = canvas.getContext('2d')
  draw(ctx)
  writeFileSync(path.join(OUT_DIR, name), canvas.toBuffer('image/png'))
}

// base.png - hinh quay hang don gian (mai + quay + 2 cot), tong vang dong
// khac biet cac building khac de de nhan tren map trong luc cho art that.
save('base.png', (ctx) => {
  const { x, y, width, height } = BOUNDS
  const roofH = height * 0.32
  const counterH = height * 0.28

  ctx.fillStyle = '#b8862f'
  ctx.beginPath()
  ctx.moveTo(x, y + roofH)
  ctx.lineTo(x + width / 2, y)
  ctx.lineTo(x + width, y + roofH)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#8a6423'
  ctx.fillRect(x + width * 0.08, y + roofH, width * 0.84, height - roofH - counterH)

  ctx.fillStyle = '#d9a53f'
  ctx.fillRect(x + width * 0.05, y + height - counterH, width * 0.9, counterH)

  ctx.fillStyle = '#4a3210'
  ctx.fillRect(x + width * 0.15, y + height - counterH * 0.55, width * 0.18, counterH * 0.55)
  ctx.fillRect(x + width * 0.67, y + height - counterH * 0.55, width * 0.18, counterH * 0.55)
})

// silhouette-mask.png - cung hinh dang base nhung dac 1 mau (dung cho
// glow outline khi hover/selected qua filter sepia trong DongFuBuildingSprite).
save('silhouette-mask.png', (ctx) => {
  const { x, y, width, height } = BOUNDS
  const roofH = height * 0.32

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(x, y + roofH)
  ctx.lineTo(x + width / 2, y)
  ctx.lineTo(x + width, y + roofH)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(x + width * 0.05, y + roofH, width * 0.9, height - roofH)
})

// ground-shadow.png - bong bau duc mo duoi chan building.
save('ground-shadow.png', (ctx) => {
  const { x, y, width, height } = BOUNDS
  const cx = x + width / 2
  const cy = y + height
  const rx = width * 0.42
  const ry = height * 0.06

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx)
  gradient.addColorStop(0, 'rgba(0,0,0,0.45)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
})

// locked-overlay.png - phu toi vung building khi CHUA xay (chi hien khi
// status === 'locked', xem DongFuBuildingSprite.vue).
save('locked-overlay.png', (ctx) => {
  const { x, y, width, height } = BOUNDS

  ctx.fillStyle = 'rgba(10,10,10,0.55)'
  ctx.fillRect(x, y, width, height)
})

console.log(`Vendor placeholder art written to ${OUT_DIR}`)
