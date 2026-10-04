import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPhoenixProjectile } from './build-phoenix-projectile.mjs'

// Empowered (Phap The) phoenix variant (2026-10-04): same authored flight
// as the normal comet but the fire palette hue-shifts to azure - Minh's
// spec maps empowered Ly Hoa Thuat to a blue projectile while the normal
// cast keeps red. The recolor runs offline in this builder (doc data in,
// doc data out) so the render never tints at runtime.
const HUE_SHIFT_DEG = 175

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = t => {
    const u = ((t % 1) + 1) % 1
    if (u < 1 / 6) return p + (q - p) * 6 * u
    if (u < 1 / 2) return q
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6
    return p
  }
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)]
}

const isColor = v => Array.isArray(v) && v.length === 3
  && v.every(n => Number.isFinite(n) && n >= 0 && n <= 255)

function recolor(value) {
  if (Array.isArray(value)) {
    if (isColor(value)) {
      const [h, s, l] = rgbToHsl(value)
      // Achromatic cores stay warm-white -> cool-white; saturated fire hues rotate.
      return s < 0.12 ? hslToRgb([210, 0.3, l]) : hslToRgb([h + HUE_SHIFT_DEG, s, l])
    }
    return value.map(recolor)
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = recolor(v)
    return out
  }
  return value
}

export function buildPhoenixProjectileEmpowered() {
  const base = buildPhoenixProjectile()
  const doc = recolor(base.doc)
  doc.id = 'fx_hoa_cau_phoenix_empowered'
  doc.name = 'Hoa Cau Phoenix Empowered'
  return { ...base, doc }
}

const sourceFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === sourceFile) {
  const target = process.argv[2]
  if (!target) throw new Error('Pass a new Arcadia library JSON path')
  const absoluteTarget = resolve(target)
  if (existsSync(absoluteTarget)) {
    const current = JSON.parse(readFileSync(absoluteTarget, 'utf8'))
    if (current.doc?.id !== 'fx_hoa_cau_phoenix_empowered') {
      throw new Error(`Refusing to overwrite another effect: ${current.doc?.id}`)
    }
  }
  writeFileSync(absoluteTarget, `${JSON.stringify(buildPhoenixProjectileEmpowered(), null, 2)}\n`)
}
