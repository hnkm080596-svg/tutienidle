// Di chuyển PNG (+ JSON atlas đi kèm, xem ghi chú ROUTABLE_EXTENSIONS)
// từ asset-drop/ (thư mục thả file phẳng, xem asset-drop/README.md)
// vào đúng vị trí trong public/assets/, dựa thuần vào TÊN FILE — không
// cần bảng tra thủ công. Quy ước: `__` trong tên file = dấu `/` trong
// đường dẫn đích. Ví dụ:
//   frames__pham_khi.png              -> public/assets/frames/pham_khi.png
//   equipment__quality-backdrop__bao_khi.png
//                                      -> public/assets/equipment/quality-backdrop/bao_khi.png
//
// Chạy: npm run assets:route

import { readdirSync, mkdirSync, renameSync, existsSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DROP_DIR = join(ROOT, 'asset-drop')
const DEST_ROOT = join(ROOT, 'public', 'assets')

// .json — atlas TexturePacker đi kèm 1 spritesheet .png (vd
// idle.png/idle.json, xem MainScene.ts's preload()) — phải route CÙNG
// file .png tương ứng để Phaser load.multiatlas() tìm thấy cả 2 cạnh
// nhau ở đích.
const ROUTABLE_EXTENSIONS = ['.png', '.json']

const files = readdirSync(DROP_DIR).filter((f) => ROUTABLE_EXTENSIONS.includes(extname(f).toLowerCase()))

if (files.length === 0) {
  console.log('asset-drop/ không có file .png/.json nào — không có gì để route.')
  process.exit(0)
}

let moved = 0
let skipped = 0

for (const file of files) {
  const ext = extname(file)
  const relParts = file.slice(0, -ext.length).split('__') // bỏ đuôi file, tách theo "__"
  const destPath = join(DEST_ROOT, ...relParts) + ext
  const srcPath = join(DROP_DIR, file)

  if (existsSync(destPath)) {
    console.warn(`BỎ QUA (đã có file đích, xoá thủ công nếu muốn ghi đè): ${file} -> ${destPath}`)
    skipped++
    continue
  }

  mkdirSync(dirname(destPath), { recursive: true })
  renameSync(srcPath, destPath)
  console.log(`OK: ${file} -> ${destPath.slice(ROOT.length + 1)}`)
  moved++
}

console.log(`\nXong — đã chuyển ${moved} file, bỏ qua ${skipped} file trùng đích.`)
