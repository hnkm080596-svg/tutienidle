import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../public/assets/buildings/dong-fu/v2/', import.meta.url))
const buildingIds = [
  'spirit_spring',
  'equipment_hall',
  'pill_room',
  'teleport_array',
  'gathering_outpost',
]
const requiredNames = [
  'base.png',
  'silhouette-mask.png',
  'ground-shadow.png',
  'locked-overlay.png',
]
const technicalFiles = buildingIds.flatMap((buildingId) =>
  requiredNames.map((name) => ({
    file: join(root, buildingId, name),
    width: 1254,
    height: 1254,
  })),
)
const seasonFiles = ['spring', 'summer', 'autumn', 'winter'].map((season) => ({
  file: join(root, 'shared', 'seasons', `${season}.png`),
  width: 1672,
  height: 941,
}))
const files = [...technicalFiles, ...seasonFiles]

if (technicalFiles.length !== 20 || seasonFiles.length !== 4) {
  throw new Error('Expected 20 technical PNGs and four season overlays')
}

function assertExactPngNames(directory, expectedNames) {
  const actualNames = readdirSync(directory)
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .sort()
  const expected = [...expectedNames].sort()

  if (actualNames.length !== expected.length || actualNames.some((name, index) => name !== expected[index])) {
    throw new Error(`${directory}: expected PNGs [${expected.join(', ')}], found [${actualNames.join(', ')}]`)
  }
}

for (const buildingId of buildingIds) {
  assertExactPngNames(join(root, buildingId), requiredNames)
}
assertExactPngNames(
  join(root, 'shared', 'seasons'),
  seasonFiles.map(({ file }) => file.split(/[\\/]/).at(-1)),
)

for (const { file, width: expectedWidth, height: expectedHeight } of files) {
  const result = execFileSync(
    'magick',
    ['identify', '-format', '%w %h %[channels] %[fx:minima.a] %[fx:maxima.a]', file],
    { encoding: 'utf8' },
  ).trim()
  const fields = result.split(/\s+/)
  const [width, height] = fields
  const alphaMin = fields.at(-2)
  const alphaMax = fields.at(-1)
  const channels = fields.slice(2, -2).join(' ')

  if (
    Number(width) !== expectedWidth
    || Number(height) !== expectedHeight
    || !channels?.includes('a')
    || Number(alphaMin) !== 0
    || Number(alphaMax) <= 0
  ) {
    throw new Error(`${file}: invalid alpha contract (${result})`)
  }
}
