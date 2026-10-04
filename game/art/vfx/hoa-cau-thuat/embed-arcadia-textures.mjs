import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const effectPath = process.argv[2]
if (!effectPath) throw new Error('Pass the Arcadia effect JSON path')
const absoluteEffectPath = resolve(effectPath)
const effect = JSON.parse(readFileSync(absoluteEffectPath, 'utf8'))
if (effect.doc?.id !== 'fx_hoa_cau_triple_fire_circle') {
  throw new Error(`Refusing to update unexpected effect: ${effect.doc?.id}`)
}

const sourceDir = dirname(fileURLToPath(import.meta.url))
const svgData = (name, color) => {
  const svg = readFileSync(join(sourceDir, name), 'utf8').replaceAll('#fff', color)
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

effect.tex = {
  tex_hc_fire_sigil: svgData('fire-circle-sigil.svg', '#ffd17b'),
  tex_hc_fire_character: svgData('fire-character.svg', '#fff1bc'),
}
writeFileSync(absoluteEffectPath, `${JSON.stringify(effect, null, 2)}\n`)
