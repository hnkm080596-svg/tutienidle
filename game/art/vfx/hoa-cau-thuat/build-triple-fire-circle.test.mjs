import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { buildTripleFireCircle } from './build-triple-fire-circle.mjs'

function sample(track, time) {
  if (typeof track === 'number') return track
  const keys = track.keys
  if (time <= keys[0].t) return keys[0].v
  for (let index = 1; index < keys.length; index++) {
    const right = keys[index]
    const left = keys[index - 1]
    if (time <= right.t) {
      const progress = (time - left.t) / (right.t - left.t)
      return left.v + (right.v - left.v) * progress
    }
  }
  return keys.at(-1).v
}

test('reveals static calligraphy then three separated rings from inside out', () => {
  const effect = buildTripleFireCircle()
  const layers = Object.fromEntries(effect.doc.layers.map(layer => [layer.id, layer]))
  assert.equal(effect.doc.layers.length, 66)
  assert.equal(effect.doc.textures.length, 54)
  assert.equal(layers.lr_hc_calligraphy.sp.rot, 0)
  assert.ok(layers.lr_hc_calligraphy.sp.size <= 68)
  assert.ok(sample(layers.lr_hc_calligraphy.opacity, 0.12) > 0)
  assert.equal(sample(layers.lr_hc_inner_ring.opacity, 0.12), 0)
  assert.ok(sample(layers.lr_hc_inner_ring.opacity, 0.30) > 0)
  assert.equal(sample(layers.lr_hc_middle_ring.opacity, 0.30), 0)
  assert.ok(sample(layers.lr_hc_middle_ring.opacity, 0.48) > 0)
  assert.equal(sample(layers.lr_hc_outer_ring.opacity, 0.48), 0)
  assert.ok(sample(layers.lr_hc_outer_ring.opacity, 0.68) > 0)
  assert.equal(sample(layers.lr_hc_outer_ring.opacity, 2.04), 0)
})

test('starts on reveal with each outer ring 25 percent faster than the inner ring', () => {
  const layers = Object.fromEntries(buildTripleFireCircle().doc.layers.map(layer => [layer.id, layer]))
  const outer = layers.lr_hc_outer_ring.sp.rot
  const middle = layers.lr_hc_middle_ring.sp.rot
  const inner = layers.lr_hc_inner_ring.sp.rot
  assert.equal(sample(inner, 0.20), 0)
  assert.equal(sample(middle, 0.38), 0)
  assert.equal(sample(outer, 0.56), 0)
  assert.ok(Math.abs(sample(inner, 0.30) - 2.25) < 0.000001)
  assert.ok(Math.abs(sample(middle, 0.48) + 2.8125) < 0.000001)
  assert.ok(Math.abs(sample(outer, 0.66) - 3.515625) < 0.000001)
  assert.ok(Math.abs(sample(inner, 1.20) - 22.5) < 0.000001)
  assert.ok(Math.abs(sample(middle, 1.38) + 28.125) < 0.000001)
  assert.ok(Math.abs(sample(outer, 1.56) - 35.15625) < 0.000001)
  assert.ok(Math.abs(sample(inner, 2.04) - 34.65) < 0.000001)
  assert.ok(Math.abs(sample(middle, 2.04) + 38.25) < 0.000001)
  assert.ok(Math.abs(sample(outer, 2.04) - 41.484375) < 0.000001)
})

test('embeds deterministic Chinese-character ring textures and calligraphic path', () => {
  const first = buildTripleFireCircle()
  const second = buildTripleFireCircle()
  assert.deepEqual(first.tex, second.tex)
  assert.equal(Object.keys(first.tex).length, 54)
  for (const [id, dataUrl] of Object.entries(first.tex)) {
    assert.match(dataUrl, /^data:image\/svg\+xml;base64,/)
    const svg = Buffer.from(dataUrl.split(',')[1], 'base64').toString('utf8')
    if (id.startsWith('tex_hc_calligraphy')) {
      assert.match(svg, /<path\b/)
      assert.doesNotMatch(svg, /<text\b/)
    } else if (id.includes('_glyph_')) {
      assert.equal([...svg.matchAll(/<text\b/g)].length, 2)
      assert.doesNotMatch(svg, /<circle\b/)
    } else {
      assert.match(svg, /[炎焰熾煉煌燼炬灼焚燦]/)
      assert.match(svg, /<circle\b/g)
    }
  }
})

test('keeps a two-pixel visible gap between the three thick-bordered rings', () => {
  const { tex } = buildTripleFireCircle()
  const borders = id => {
    const key = Object.keys(tex).find(key => key === id || key.startsWith(`${id}_`))
    const svg = Buffer.from(tex[key].split(',')[1], 'base64').toString('utf8')
    return [...svg.matchAll(/<circle cx="128" cy="128" r="([\d.]+)" stroke-width="([\d.]+)"\/>/g)]
      .map(([, radius, width]) => ({ radius: Number(radius), halfWidth: Number(width) / 2 }))
  }
  const outer = borders('tex_hc_outer_ring')
  const middle = borders('tex_hc_middle_ring')
  const inner = borders('tex_hc_inner_ring')
  assert.equal(outer.length, 2)
  assert.equal(middle.length, 2)
  assert.equal(inner.length, 2)
  assert.equal((outer[1].radius - outer[1].halfWidth) - (middle[0].radius + middle[0].halfWidth), 2)
  assert.equal((middle[1].radius - middle[1].halfWidth) - (inner[0].radius + inner[0].halfWidth), 2)
  assert.equal(outer[0].radius + outer[0].halfWidth, 114.5)
})

test('keeps both magic borders distinct at six pixels while decorative particles stay separate', () => {
  const effect = buildTripleFireCircle()
  assert.equal(effect.doc.layers.filter(layer => layer.type === 'sprite' && layer.id.includes('ring')).length, 3)
  for (const id of ['tex_hc_outer_ring', 'tex_hc_middle_ring', 'tex_hc_inner_ring']) {
    const key = Object.keys(effect.tex).find(key => key === id || key.startsWith(`${id}_`))
    const svg = Buffer.from(effect.tex[key].split(',')[1], 'base64').toString('utf8')
    const borders = [...svg.matchAll(/<circle\b[^>]*stroke-width="([\d.]+)"[^>]*\/>/g)]
    assert.equal(borders.length, 2, `${id} must have two border rails`)
    assert.ok(borders.every(([, width]) => Number(width) === 6), `${id} borders must stay legible without touching the next ring`)
  }
})

test('adds independently editable orbiting magic glints that awaken with each ring', () => {
  const effect = buildTripleFireCircle()
  const layers = Object.fromEntries(effect.doc.layers.map(layer => [layer.id, layer]))
  const specs = [
    ['lr_hc_inner_glints', 0.20, 43, 331],
    ['lr_hc_middle_glints', 0.38, 72, 541],
    ['lr_hc_outer_glints', 0.56, 101, 917],
  ]
  for (const [id, start, radius, seed] of specs) {
    const layer = layers[id]
    assert.equal(layer.type, 'emitter')
    assert.equal(layer.start, start)
    assert.equal(layer.em.seed, seed)
    assert.deepEqual(layer.em.bursts, [])
    assert.ok(layer.em.rate >= 16)
    assert.equal(layer.blend, 'add')
    assert.ok(sample(layer.opacity, 0.4) >= 0.9)
    assert.equal(layer.em.path.on, true)
    assert.equal(layer.em.path.closed, true)
    assert.equal(layer.em.path.mode, 'both')
    assert.equal(layer.em.path.aim, 'tangent')
    assert.ok(layer.em.path.flow !== 0)
    assert.ok(layer.em.path.lock >= 0.8)
    assert.ok(layer.em.path.nodes.length >= 8)
    for (const node of layer.em.path.nodes) {
      assert.ok(Math.abs(Math.hypot(node.x, node.y) - radius) < 0.001)
    }
    assert.ok(layer.pt.size >= 8 && layer.pt.size <= 10)
    assert.ok(layer.pt.life <= 0.7)
    assert.ok(layer.pt.glow <= 0.5)
    assert.equal(sample(layer.opacity, 2.04 - start), 0)
  }
  assert.equal(layers.lr_hc_inner_glints.em.path.flow > 0, true)
  assert.equal(layers.lr_hc_middle_glints.em.path.flow < 0, true)
  assert.equal(layers.lr_hc_outer_glints.em.path.flow > 0, true)
})

test('keeps ambient embers outside the sigil and preserves the transparent export', () => {
  const effect = buildTripleFireCircle()
  const layer = effect.doc.layers.find(item => item.id === 'lr_hc_ambient_embers')
  assert.equal(layer.type, 'emitter')
  assert.equal(layer.em.shape, 'ring')
  assert.ok(layer.em.sx >= 116)
  assert.ok(layer.em.sx + layer.em.sy / 2 + layer.pt.size / 2 < 128)
  assert.equal(layer.em.dir, 'out')
  assert.equal(layer.em.seed, 1209)
  assert.equal(effect.doc.exp.mode, 'rgba')
  assert.equal(effect.doc.comp.dur, 2.28)
})

test('carries brighter moving fire inside each subdued ring without covering its center', () => {
  const effect = buildTripleFireCircle()
  const layers = Object.fromEntries(effect.doc.layers.map(layer => [layer.id, layer]))
  const specs = [
    ['inner', 0.20, 43, 1],
    ['middle', 0.38, 72, -1],
    ['outer', 0.56, 101, 1],
  ]
  for (const [ring, start, radius, direction] of specs) {
    const line = layers[`lr_hc_${ring}_ring`]
    const current = layers[`lr_hc_${ring}_energy`]
    assert.equal(current.type, 'emitter')
    assert.equal(current.start, start)
    assert.equal(current.em.path.on, true)
    assert.equal(current.em.path.mode, 'both')
    assert.equal(current.em.path.closed, true)
    assert.equal(Math.sign(current.em.path.flow), direction)
    assert.equal(current.pt.render, 'trail')
    assert.ok(current.pt.size <= 4)
    assert.deepEqual(current.em.bursts, [])
    assert.ok(current.em.rate > 0)
    assert.ok(current.em.path.nodes.every(node => Math.abs(Math.hypot(node.x, node.y) - radius) < 0.001))
    assert.ok(sample(line.opacity, 1.1) < sample(current.opacity, 1.1 - start))
    assert.equal(sample(current.opacity, 2.04 - start), 0)
  }
  const center = layers.lr_hc_center_ember
  assert.equal(center.type, 'sprite')
  assert.equal(center.sp.sprite.id, 'soft')
  assert.ok(center.sp.size <= 56)
  assert.ok(sample(center.opacity, 1.1) <= 0.25)
  const innerFire = layers.lr_hc_center_fire
  assert.equal(innerFire.type, 'emitter')
  assert.equal(innerFire.em.path.mode, 'both')
  assert.equal(innerFire.em.path.closed, true)
  assert.ok(innerFire.em.path.nodes.every(node => Math.hypot(node.x, node.y) < 22))
  assert.equal(innerFire.pt.sprite.id, 'flame')
  assert.equal(innerFire.blend, 'add')
  assert.ok(innerFire.em.rate >= 24)
  assert.ok(innerFire.pt.size >= 14)
  assert.ok(sample(innerFire.opacity, 1.1 - innerFire.start) >= 0.8)
  assert.ok(effect.doc.layers.indexOf(innerFire) > effect.doc.layers.indexOf(layers.lr_hc_calligraphy))
  assert.equal(sample(innerFire.opacity, 2.04 - innerFire.start), 0)
  assert.equal(layers.lr_hc_calligraphy.sp.rot, 0)
})

test('brightens the stationary fire calligraphy through the 2.04-second peak', () => {
  const effect = buildTripleFireCircle()
  const layers = Object.fromEntries(effect.doc.layers.map(layer => [layer.id, layer]))
  const letter = layers.lr_hc_calligraphy
  const alpha = [0.2, 0.8, 1.4, 1.74, 2.02, 2.04].map(time => sample(letter.opacity, time))
  assert.ok(alpha.every((value, index) => index === 0 || value > alpha[index - 1]))
  assert.equal(alpha.at(-1), 1)
  assert.equal(letter.sp.rot, 0)
  assert.equal(letter.end, effect.doc.comp.dur)
  assert.equal(sample(layers.lr_hc_outer_ring.opacity, 2.04), 0)
})

test('individual Chinese characters light sequentially and remain lit through the 2.04-second peak', () => {
  const effect = buildTripleFireCircle()
  const layers = Object.fromEntries(effect.doc.layers.map(layer => [layer.id, layer]))
  const specifications = [['inner', 10, 0.20], ['middle', 16, 0.38], ['outer', 24, 0.56]]
  for (const [ring, count, reveal] of specifications) {
    const base = layers[`lr_hc_${ring}_ring`]
    const glyphs = Array.from({ length: count }, (_, index) => layers[`lr_hc_${ring}_glyph_${String(index + 1).padStart(2, '0')}`])
    assert.ok(glyphs.every(Boolean))
    assert.ok(sample(base.opacity, 1.1) <= 0.62)
    assert.ok(glyphs.every(glyph => glyph.type === 'sprite' && glyph.blend === 'add'))
    assert.ok(glyphs.every(glyph => glyph.start === 0 && glyph.end === 2.28))
    assert.ok(glyphs.every(glyph => sample(glyph.opacity, reveal) === 0))
    assert.ok(glyphs.every(glyph => sample(glyph.opacity, 2.04) >= 0.85))
    assert.ok(glyphs.every(glyph => sample(glyph.sp.rot, 1.1) === sample(base.sp.rot, 1.1)))
    const onsets = glyphs.map(glyph => glyph.opacity.keys.find(key => key.v > 0).t)
    const firstOn = Math.min(...onsets)
    const lastOn = Math.max(...onsets)
    assert.ok(firstOn < lastOn && firstOn >= reveal)
    assert.ok(lastOn < 2.04)
    assert.equal(onsets[0], firstOn)
    assert.ok(glyphs.some(glyph => sample(glyph.opacity, firstOn) === 0))
    assert.ok(sample(glyphs[0].opacity, 1.74) > 0)
    assert.equal(sample(base.opacity, 2.04), 0)
  }
})

test('keeps each rotating glyph legible after the preview circle is foreshortened', () => {
  const effect = buildTripleFireCircle()
  const layers = effect.doc.layers.filter(layer => /_glyph_/.test(layer.id))
  assert.equal(layers.length, 50)
  for (const layer of layers) {
    assert.ok(layer.glowL >= 0.45, `${layer.id} needs its own visible edge glow`)
    assert.ok(layer.glowLR <= 6)
    const svg = Buffer.from(effect.tex[layer.sp.sprite.texId].split(',')[1], 'base64').toString('utf8')
    const fontSize = Number(svg.match(/font-size="([\d.]+)"/)?.[1])
    assert.ok(fontSize >= 19, `${layer.id} is too small when viewed as a vertical ellipse`)
  }
})

test('after the unchanged 2.04-second peak, glyph rings dissolve outside-in and fire calligraphy fades last', () => {
  const effect = buildTripleFireCircle()
  const layers = Object.fromEntries(effect.doc.layers.map(layer => [layer.id, layer]))
  const glyph = ring => layers[`lr_hc_${ring}_glyph_01`]
  for (const ring of ['outer', 'middle', 'inner']) {
    assert.equal(sample(glyph(ring).opacity, 2.04), 0.9)
    assert.equal(sample(glyph(ring).opacity, 2.28), 0)
  }
  assert.ok(sample(glyph('outer').opacity, 2.12) < sample(glyph('middle').opacity, 2.12))
  assert.ok(sample(glyph('middle').opacity, 2.16) < sample(glyph('inner').opacity, 2.16))
  assert.equal(sample(glyph('outer').opacity, 2.18), 0)
  assert.equal(sample(layers.lr_hc_calligraphy.opacity, 2.04), 1)
  assert.ok(sample(layers.lr_hc_calligraphy.opacity, 2.18) > 0)
  const lastAtlasFrameCenter = 2.28 * (63.5 / 64)
  assert.equal(sample(layers.lr_hc_calligraphy.opacity, lastAtlasFrameCenter), 0)
  assert.equal(sample(layers.lr_hc_calligraphy.opacity, 2.28), 0)
  assert.equal(effect.doc.exp.t1, 2.28)
})

test('dissolution embers appear only after the brightness peak and die before the final frame', () => {
  const layers = Object.fromEntries(buildTripleFireCircle().doc.layers.map(layer => [layer.id, layer]))
  for (const [ring, start, radius] of [['outer', 2.05, 101], ['middle', 2.10, 72], ['inner', 2.14, 43]]) {
    const layer = layers[`lr_hc_${ring}_dissolve`]
    assert.equal(layer.type, 'emitter')
    assert.equal(layer.start, start)
    assert.equal(layer.em.shape, 'ring')
    assert.equal(layer.em.sx, radius)
    assert.equal(layer.em.rate, 0)
    assert.ok(layer.em.bursts[0].n >= 5)
    assert.ok(layer.start + layer.pt.life * (1 + layer.pt.lifeRnd) < 2.28)
  }
})

test('glyph ignition follows the rotation direction of its own ring', () => {
  const layers = Object.fromEntries(buildTripleFireCircle().doc.layers.map(layer => [layer.id, layer]))
  const litAt = (ring, index) => layers[`lr_hc_${ring}_glyph_${String(index).padStart(2, '0')}`]
    .opacity.keys.find(key => key.v > 0).t
  assert.ok(litAt('inner', 1) < litAt('inner', 2))
  assert.ok(litAt('inner', 2) < litAt('inner', 10))
  assert.ok(litAt('outer', 1) < litAt('outer', 2))
  assert.ok(litAt('outer', 2) < litAt('outer', 24))
  assert.ok(litAt('middle', 1) < litAt('middle', 16))
  assert.ok(litAt('middle', 16) < litAt('middle', 15))
  assert.ok(litAt('middle', 15) < litAt('middle', 2))
})

test('both border rails are half as visible without dimming their glyphs', () => {
  const effect = buildTripleFireCircle()
  const layers = Object.fromEntries(effect.doc.layers.map(layer => [layer.id, layer]))
  for (const [ring, expectedAlpha] of [['inner', 0.31], ['middle', 0.28], ['outer', 0.25]]) {
    const svg = Buffer.from(effect.tex[layers[`lr_hc_${ring}_ring`].sp.sprite.texId].split(',')[1], 'base64').toString('utf8')
    const borderOpacity = Number(svg.match(/<g fill="none" stroke="[^"]+" stroke-opacity="([\d.]+)"/)?.[1])
    assert.equal(sample(layers[`lr_hc_${ring}_ring`].opacity, 1.1) * borderOpacity, expectedAlpha)
    assert.doesNotMatch(svg, /<text[^>]+stroke-opacity=/)
  }
})

test('changes texture identity with its content so Arcadia cannot reuse a stale cached image', () => {
  const effect = buildTripleFireCircle()
  for (const meta of effect.doc.textures) {
    const layer = effect.doc.layers.find(item => item.sp?.sprite?.texId === meta.id)
    assert.ok(layer, `${meta.name} must be referenced by a layer`)
    const dataUrl = effect.tex[meta.id]
    assert.ok(dataUrl, `${meta.name} must carry its embedded texture`)
    const svg = Buffer.from(dataUrl.split(',')[1], 'base64')
    const digest = createHash('sha256').update(svg).digest('hex').slice(0, 12)
    assert.ok(meta.id.endsWith(`_${digest}`), `${meta.name} must have a content-derived id`)
  }
})

test('grades heat from white-hot inside to saturated vermilion outside with subdued line opacity', () => {
  const effect = buildTripleFireCircle()
  const layers = Object.fromEntries(effect.doc.layers.map(layer => [layer.id, layer]))
  const ringSvg = layerId => Buffer.from(effect.tex[layers[layerId].sp.sprite.texId].split(',')[1], 'base64').toString('utf8')
  assert.match(ringSvg('lr_hc_inner_ring'), /stroke="#fff4c6"/)
  assert.match(ringSvg('lr_hc_middle_ring'), /stroke="#ff9b3d"/)
  assert.match(ringSvg('lr_hc_outer_ring'), /stroke="#ff5830"/)
  assert.equal(sample(layers.lr_hc_inner_ring.opacity, 1.1), 0.62)
  assert.equal(sample(layers.lr_hc_middle_ring.opacity, 1.1), 0.56)
  assert.equal(sample(layers.lr_hc_outer_ring.opacity, 1.1), 0.5)
})
