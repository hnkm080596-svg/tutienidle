import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Split authored art without painting, alpha removal, or background flattening.
const root = resolve('public/assets/ui/tien-hiep-2026-10')
const names = ['home', 'character', 'skill', 'equipment', 'sect', 'guild',
  'inventory', 'alchemy', 'forge', 'body', 'companion', 'exploration',
  'portal', 'formation', 'artifact', 'realm', 'technique', 'quest',
  'compass', 'settings', 'feedback', 'opportunity', 'production', 'vendor']
const output = resolve(root, 'icons')
await mkdir(output, { recursive: true })
const source = resolve(root, 'source/brush-icons-atlas-v1.png')
const metadata = await sharp(source).metadata()
if (metadata.width !== 1536 || metadata.height !== 1024 || !metadata.hasAlpha) {
  throw new Error('Expected an authored 1536x1024 RGBA icon atlas')
}
const entries = []
for (const [index, name] of names.entries()) {
  const region = { left: index % 6 * 256, top: Math.floor(index / 6) * 256, width: 256, height: 256 }
  await sharp(source).extract(region).png().toFile(resolve(output, `${name}.png`))
  const stats = await sharp(resolve(output, `${name}.png`)).stats()
  entries.push({ name, sourceRect: region, alphaMin: stats.channels[3].min, alphaMax: stats.channels[3].max, opaque: stats.isOpaque })
}
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ source: 'brush-icons-atlas-v1.png', entries }, null, 2) + '\n')
console.log(`Exported ${entries.length} transparent authored icon cells`)

const anatomySource = resolve(root, 'source/body-glyphs-atlas-v1.png')
const anatomyNames = ['body-flame', 'body-brain', 'body-lungs', 'body-heart', 'body-foot', 'body-arm']
const anatomyEntries = []
for (const [index, name] of anatomyNames.entries()) {
  const region = { left: index % 3 * 512, top: Math.floor(index / 3) * 512, width: 512, height: 512 }
  await sharp(anatomySource).extract(region).resize(256, 256).png().toFile(resolve(output, `${name}.png`))
  const stats = await sharp(resolve(output, `${name}.png`)).stats()
  anatomyEntries.push({ name, sourceRect: region, alphaMin: stats.channels[3].min, alphaMax: stats.channels[3].max, opaque: stats.isOpaque })
}
await writeFile(resolve(output, 'body-manifest.json'), JSON.stringify({ source: 'body-glyphs-atlas-v1.png', entries: anatomyEntries }, null, 2) + '\n')
console.log(`Exported ${anatomyEntries.length} anatomical glyph cells`)
