import sharp from 'sharp'
import { readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve('public/assets/ui/tien-hiep-2026-10')
const results = []
for (const folder of ['source', 'runtime']) {
  for (const name of (await readdir(resolve(root, folder))).filter(name => name.endsWith('.png')).sort()) {
    const { data, info } = await sharp(resolve(root, folder, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const alpha = (x, y) => data[(y * info.width + x) * info.channels + info.channels - 1]
    let transparent = 0
    let partial = 0
    for (let i = info.channels - 1; i < data.length; i += info.channels) {
      if (data[i] === 0) transparent++
      else if (data[i] < 255) partial++
    }
    const pixels = info.width * info.height
    results.push({ file: `${folder}/${name}`, width: info.width, height: info.height,
      transparentPct: Math.round(transparent / pixels * 10000) / 100,
      partialPct: Math.round(partial / pixels * 10000) / 100,
      corners: [alpha(0, 0), alpha(info.width - 1, 0), alpha(0, info.height - 1), alpha(info.width - 1, info.height - 1)],
      center: alpha(Math.floor(info.width / 2), Math.floor(info.height / 2)) })
  }
}
await writeFile('docs/design/tien-hiep-ui-redesign-2026-10-05/ALPHA-REVIEW.json', JSON.stringify(results, null, 2) + '\n')
console.log(`Audited ${results.length} PNGs; report records actual alpha, not preview RGB.`)
