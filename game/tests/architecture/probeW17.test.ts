import { describe, expect, it } from 'vitest'
import { resolveAudioCue } from '../../src/core/audio/AudioCueManifest'
import { templateExprText } from './helpers/commentStrip'
describe('w17 probes', () => {
  it('resolveAudioCue: Object.prototype members -> undefined', () => {
    for (const id of ['constructor', 'toString', 'hasOwnProperty', 'combat.constructor']) {
      expect(resolveAudioCue(id), id).toBeUndefined()
    }
    expect(resolveAudioCue('ui.click')).toBeDefined()
    expect(resolveAudioCue('combat.cast.nonexistent')).toBeDefined()
  })
  it('templateExprText: > inside quoted attr does not truncate tag', () => {
    const vue = `<template><div v-if="x > 0" @click="cue('bogus.zz')"></div></template>`
    expect(templateExprText(vue)).toContain("cue('bogus.zz')")
  })
  it('templateExprText: {{ }} inside literal attr value stays excluded', () => {
    const vue = `<template><div title="a>b" data-y="{{ import(x) }}"></div></template>`
    expect(templateExprText(vue)).not.toContain('import(x)')
  })
  it('templateExprText: top-level foreign blocks are inert, nested elements stay live', () => {
    const vue = [
      '<template>',
      '<i18n>{{ cue(\'nested.live\') }}</i18n>',
      '<template v-if="x">{{ cue(\'inner.live\') }}</template>',
      '</template>',
      '<docs>{{ cue(\'docs.dead\') }}</docs>',
      '<route>{{ cue(\'route.dead\') }}</route>',
    ].join('\n')
    const out = templateExprText(vue)
    expect(out).toContain("cue('nested.live')")
    expect(out).toContain("cue('inner.live')")
    expect(out).not.toContain('docs.dead')
    expect(out).not.toContain('route.dead')
  })
})
