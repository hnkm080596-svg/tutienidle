import { describe, expect, it } from 'vitest'
import { techniqueCodexUrl } from './techniqueArt'
describe('technique codex art', () => {
  it('uses the fire book only for a fire affinity', () => {
    expect(techniqueCodexUrl('fire')).toContain('technique-fire-codex-v1.png')
    expect(techniqueCodexUrl('metal')).toContain('technique-codex-v1.png')
    expect(techniqueCodexUrl(undefined)).toContain('technique-codex-v1.png')
  })
})
