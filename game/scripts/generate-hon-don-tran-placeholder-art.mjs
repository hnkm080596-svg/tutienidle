// Hỗn Độn Trận visual test tooling (2026-09-06) — placeholder spritesheet
// 32-frame DÙNG CHUNG cho MỌI entity combat (player/enemy/companion, kể cả
// trận đấu thật), thay thế việc mỗi entity tái dùng ảnh tĩnh của chính nó
// làm "sheet" 1-frame. Mỗi frame là 1 thân người cách điệu + số thứ tự lớn
// (0-31) — nhìn là biết ngay AnimationManager có thực sự chạy hay bị đứng
// (đúng lớp bug freeze 2026-09-05, chỉ khác là ở animation thay vì tick
// loop). Xoá/ghi đè trực tiếp khi có content thật, không cần sửa code nơi
// khác (chỉ cần đổi hằng số trong CombatAnimationSet.ts).
import { createCanvas } from 'canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRAME_WIDTH = 200
const FRAME_HEIGHT = 350
const FRAME_COUNT = 32

const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public/assets/characters/placeholder',
)

mkdirSync(OUT_DIR, { recursive: true })

const canvas = createCanvas(FRAME_WIDTH, FRAME_HEIGHT * FRAME_COUNT)
const ctx = canvas.getContext('2d')

for (let frame = 0; frame < FRAME_COUNT; frame++) {
  const top = frame * FRAME_HEIGHT

  // Hue xoay theo frame — thêm 1 tín hiệu trực quan phụ (không chỉ số) để
  // nhận ra animation đang chạy ngay cả khi không đọc kịp số.
  const hue = Math.round((frame / FRAME_COUNT) * 360)

  ctx.fillStyle = `hsl(${hue}, 55%, 45%)`
  ctx.fillRect(0, top, FRAME_WIDTH, FRAME_HEIGHT)

  // Thân người cách điệu: đầu tròn + thân chữ nhật bo góc, để rõ đây là
  // "nhân vật đứng" chứ không phải khối màu vô nghĩa.
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(FRAME_WIDTH / 2, top + FRAME_HEIGHT * 0.18, FRAME_WIDTH * 0.16, 0, Math.PI * 2)
  ctx.fill()

  const bodyX = FRAME_WIDTH * 0.28
  const bodyY = top + FRAME_HEIGHT * 0.32
  const bodyW = FRAME_WIDTH * 0.44
  const bodyH = FRAME_HEIGHT * 0.56
  const radius = FRAME_WIDTH * 0.08

  ctx.beginPath()
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, radius)
  ctx.fill()

  // Số thứ tự — tín hiệu chính để test animation, to và tương phản cao.
  ctx.fillStyle = '#111111'
  ctx.font = `bold ${Math.round(FRAME_HEIGHT * 0.22)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(frame), FRAME_WIDTH / 2, top + FRAME_HEIGHT / 2)
}

writeFileSync(path.join(OUT_DIR, 'combat-anim-32frame.png'), canvas.toBuffer('image/png'))

console.log(`Hỗn Độn Trận placeholder spritesheet written to ${OUT_DIR}/combat-anim-32frame.png (${FRAME_WIDTH}x${FRAME_HEIGHT * FRAME_COUNT}, ${FRAME_COUNT} frames)`)
