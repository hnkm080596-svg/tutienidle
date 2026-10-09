/**
 * Guard the Hoa Cau palm-anchor gate in CombatScene against art-cell drift.
 *
 * `hoaCauHandAnchor` places the fireball's origin at the raised palm of the
 * shared Phap Tu cast pose. CombatScene selects it by matching the player
 * sprite's sourceSize width against the art cell width - a literal. When the
 * phap_tu_shared sheets were swapped 244x252 -> 732x756 the literal stayed
 * `=== 244`, so the gate silently fell back to the generic body anchor and
 * the fireball no longer spawned at the hand. This pin binds the literal to
 * the declared cell so a future cell resize fails here instead of drifting.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHARACTER_ART } from '@/game/support/CharacterArt'

const sceneSource = readFileSync(
  join(process.cwd(), 'src/game/scenes/CombatScene.ts'),
  'utf8',
)

describe('CombatScene hoaCau hand-anchor gate', () => {
  it('gates the palm anchor on the declared phap_tu_shared cell width', () => {
    const { w, h } = CHARACTER_ART.phap_tu_shared.sourceSize
    expect(sceneSource).toContain(`sourceSize?.w === ${w}`)
    // The anchor fractions are authored against the same cell - keep the
    // two literals consistent so a resize is impossible to do halfway.
    const anchorSource = readFileSync(
      join(process.cwd(), 'src/game/support/skill-vfx/HoaCauFireballPresentation.ts'),
      'utf8',
    )
    expect(anchorSource).toContain(`/ ${w}`)
    expect(anchorSource).toContain(`/ ${h}`)
  })
})
