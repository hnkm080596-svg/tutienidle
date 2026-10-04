import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Shared helpers for the mob-attack Arcadia builders: same sparse-track idiom
// the hoa-cau-thuat generators use, plus the write-on-run entrypoint guard so
// a builder only ever rewrites the JSON mirror that carries its own doc.id.
export const track = pairs => ({ keys: pairs.map(([t, v]) => ({ t, v })) })
export const curve = (...pts) => ({ pts: pts.map(([t, v]) => ({ t, v })) })
export const grad = (...stops) => ({ stops: stops.map(([t, c]) => ({ t, c })) })

export function texture(name, svg) {
  return {
    id: `tex_${name}_${createHash('sha256').update(svg).digest('hex').slice(0, 12)}`,
    name: name.replaceAll('_', ' '),
    svg,
  }
}

export function texPayloads(textures) {
  return Object.fromEntries(textures.map(({ id, svg }) => [id,
    `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`]))
}

export function texMeta(textures) {
  return textures.map(({ id, name }) => ({ id, name, sheet: null }))
}

export function writeOnRun(buildFn, docId, importMetaUrl) {
  const sourceFile = fileURLToPath(importMetaUrl)
  if (!process.argv[1] || resolve(process.argv[1]) !== sourceFile) return
  const target = process.argv[2]
  if (!target) throw new Error('Pass the Arcadia library JSON path')
  const absoluteTarget = resolve(target)
  if (existsSync(absoluteTarget)) {
    const existing = JSON.parse(readFileSync(absoluteTarget, 'utf8'))
    if (existing.doc?.id !== docId) throw new Error(`Refusing to overwrite another effect: ${existing.doc?.id}`)
  }
  writeFileSync(absoluteTarget, `${JSON.stringify(buildFn(), null, 2)}\n`)
}
