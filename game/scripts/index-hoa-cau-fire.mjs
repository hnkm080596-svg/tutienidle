// Reindex existing Fire 9/20 PNGs without touching their source atlases.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const [number, slug] of [[9, 'fire-9'], [20, 'fire-20']]) {
  const source = path.join(root, `public/assets/vfx/spritesheets/火 (${number}).json`)
  const data = JSON.parse(readFileSync(source, 'utf8').replace(/^\uFEFF/, ''))
  const frames = {}
  for (let index = 0; index <= 26; index += 1) {
    frames[`frame_${index}`] = data.frames[`frame_${index}`]
    if (!frames[`frame_${index}`]) throw new Error(`Missing occupied Fire ${number} frame ${index}`)
  }
  const target = path.join(root, `public/assets/vfx/hoa-cau-thuat/${slug}.atlas.json`)
  writeFileSync(target, `${JSON.stringify({
    frames,
    meta: { image: `火 (${number}).png`, size: { w: 1600, h: 600 }, scale: '1', frameCount: 27 },
  }, null, 2)}\n`)
  console.log(`${slug}: 27 occupied frames indexed`)
}
