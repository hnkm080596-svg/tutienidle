// Index the supplied, unmodified 256px portal sheets for Phaser's atlas loader.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, 'public/assets/vfx/hoa-cau-thuat/portal')
const portals = [
  ['open', 1, 24, 3],
  ['active', 0, 51, 6],
  ['close', 0, 14, 2],
]
mkdirSync(directory, { recursive: true })
for (const [phase, first, last, rows] of portals) {
  const filename = `mystic-portal-blood-${phase}`
  const frames = {}
  for (let index = first; index <= last; index += 1) {
    const frame = { x: (index % 10) * 256, y: Math.floor(index / 10) * 256, w: 256, h: 256 }
    frames[`frame_${index}`] = {
      frame,
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: 256, h: 256 },
      sourceSize: { w: 256, h: 256 },
    }
  }
  const atlas = {
    frames,
    meta: {
      image: `${filename}.png`,
      size: { w: 2560, h: rows * 256 },
      scale: '1',
      firstOccupiedFrame: first,
      lastOccupiedFrame: last,
      frameCount: last - first + 1,
    },
  }
  writeFileSync(path.join(directory, `${filename}.atlas.json`), `${JSON.stringify(atlas, null, 2)}\n`)
  console.log(`${phase}: ${Object.keys(frames).length} occupied frames`)
}
