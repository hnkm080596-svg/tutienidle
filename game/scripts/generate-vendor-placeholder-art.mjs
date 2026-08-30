// Placeholder art cho building "vendor" (Ký Bảo Các, 2026-08-30) — user
// sẽ cung cấp asset thật sau qua asset-drop/ + npm run assets:route.
// Placeholder này CHỈ để dongFuBuildingAssets.test.ts (RGBA 1254x1254,
// đúng 4 file kỹ thuật/building) không đỏ trong lúc chờ ảnh thật — xoá/
// ghi đè trực tiếp khi có asset thật, không cần sửa code nơi khác.
import { createCanvas } from 'canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SIZE = 1254
const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public/assets/buildings/dong-fu/v2/vendor',
)

// Khớp visualBounds trong DongFuBuildingArt.ts: x150 y200 w950 h850.
const BOUNDS = { x: 150, y: 200, width: 950, height: 850 }

mkdirSync(OUT_DIR, { recursive: true })

function save(name, draw) {
  const canvas = createCanvas(SIZE, SIZE)
  const ctx = canvas.getContext('2d')
  draw(ctx)
  writeFileSync(path.join(OUT_DIR, name), canvas.toBuffer('image/png'))
}

// base.png — hình quầy hàng đơn giản (mái + quầy + 2 cột), tông vàng đồng
// khác biệt các building khác để dễ nhận trên map trong lúc chờ art thật.
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

// silhouette-mask.png — cùng hình dạng base nhưng đặc 1 màu (dùng cho
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

// ground-shadow.png — bóng bầu dục mờ dưới chân building.
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

// locked-overlay.png — phủ tối vùng building khi CHƯA xây (chỉ hiện khi
// status === 'locked', xem DongFuBuildingSprite.vue).
save('locked-overlay.png', (ctx) => {
  const { x, y, width, height } = BOUNDS

  ctx.fillStyle = 'rgba(10,10,10,0.55)'
  ctx.fillRect(x, y, width, height)
})

console.log(`Vendor placeholder art written to ${OUT_DIR}`)
