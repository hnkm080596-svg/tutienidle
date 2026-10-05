import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPhoenixProjectile } from './build-phoenix-projectile.mjs'

test('keeps an editable transparent projectile active through a full 1.2-second flight', () => {
  const { doc } = buildPhoenixProjectile()
  assert.equal(doc.id, 'fx_hoa_cau_phoenix_projectile')
  assert.equal(doc.comp.dur, 1.2)
  assert.deepEqual([doc.exp.t0, doc.exp.t1, doc.exp.frames, doc.exp.mode], [0, 1.2, 36, 'rgba'])
  assert.ok(doc.layers.some(layer => layer.type === 'sprite' && layer.end >= 1.2 && layer.sp.x > 0))
  assert.ok(doc.layers.every(layer => !/impact|explosion|smoke/i.test(layer.name)))
})

test('leaves a real layered particle tail behind a right-facing fire core', () => {
  const { doc } = buildPhoenixProjectile()
  const streams = doc.layers.filter(layer => layer.type === 'emitter' && layer.em.rate > 0)
  assert.ok(streams.length >= 3)
  assert.ok(streams.some(layer => layer.pt.render === 'trail'))
  assert.ok(streams.some(layer => layer.pt.turbMode === 'curl'))
  assert.ok(streams.every(layer => layer.em.bursts.length === 0 && Number.isInteger(layer.em.seed)))
  assert.ok(streams.some(layer => layer.em.angle === 180 && layer.em.x < 45))
  assert.ok(doc.layers.some(layer => layer.type === 'postfx' && layer.fx.effect === 'displace'))
  for (const id of ['lr_hc_phoenix_gold_core', 'lr_hc_phoenix_shell', 'lr_hc_phoenix_halo']) {
    const head = doc.layers.find(layer => layer.id === id)
    assert.ok(head.sp.aspect >= 1, `${id} must not form a vertical disc`)
  }
})

test('restarts every continuous particle stream before the end of the Arcadia active loop', () => {
  const { doc } = buildPhoenixProjectile()
  const layers = Object.fromEntries(doc.layers.map(layer => [layer.id, layer]))
  for (const id of ['lr_hc_phoenix_sparks', 'lr_hc_phoenix_tongues',
    'lr_hc_phoenix_upper_ribbon', 'lr_hc_phoenix_lower_ribbon']) {
    const first = layers[id]
    const repeat = layers[`${id}_loop`]
    assert.ok(repeat, `${id} needs a seeded loop counterpart`)
    assert.equal(first.em.seed, repeat.em.seed)
    assert.equal(repeat.start - first.start, 1.2)
    assert.equal(first.opacity.keys.at(-1).v, 0)
    assert.equal(repeat.opacity.keys[0].v, 0)
    assert.equal(repeat.opacity.keys.at(-1).v, 1)
  }
})
