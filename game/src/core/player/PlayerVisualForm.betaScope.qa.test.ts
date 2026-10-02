// F-VISUAL-PROFILE (FIX WAVE 4) - regression guard asserting CLOSED.
// resolvePlayerVisualProfileId switched on the ungated cultivationPath:
// a carried 'sword' save returned the 'kiem_tu' profile so dedicated
// sword textures rendered on PlayerPortrait/PhaserCanvas/MainScene/
// CombatScene. getCultivateTexture gated only the hidden-way override,
// never the profile lookup itself. Both seams now collapse a carried
// way_out_of_scope save to the mortal (pham_nhan) figure BEFORE any
// dormant art can be reached.
import { describe, expect, it } from 'vitest'

import { lockBetaFeaturesForTests } from '../game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../game/__fixtures__/betaWaysUnlock'
import { resolvePlayerVisualProfileId } from './PlayerVisualForm'
import {
  CULTIVATE_TEXTURE_OVERRIDES,
  getCultivateTexture,
  PLAYER_VISUAL_PROFILES,
} from '@/presentation/art/PlayerVisualProfiles'
import type { CultivationWayId } from './CultivationPathKit'

// Re-pin the canonical beta lock (global setup unlocks ways/features).
lockBetaFeaturesForTests()
lockBetaWaysForTests()

const MORTAL_CULTIVATE = PLAYER_VISUAL_PROFILES.mortal.cultivateTextureKey!

describe('resolvePlayerVisualProfileId - carried way_out_of_scope saves', () => {
  it.each([
    ['sword', 'sword_pathway'],
    ['body', 'body_pathway'],
    ['sword', 'hidden_sword_pathway'],
    ['body', 'hidden_body_pathway'],
    ['spell', 'hidden_spell_pathway'],
  ])('(%s, %s) resolves mortal - the dormant way record brands nothing', (path, way) => {
    expect(
      resolvePlayerVisualProfileId({ cultivationPath: path, cultivationWay: way }),
    ).toBe('mortal')
  })

  it('a path-only carried sword save (way absent) resolves mortal via the scope gate', () => {
    expect(resolvePlayerVisualProfileId({ cultivationPath: 'sword' })).toBe('mortal')
  })

  it('a path-only carried body save (way absent) resolves mortal via the scope gate', () => {
    expect(resolvePlayerVisualProfileId({ cultivationPath: 'body' })).toBe('mortal')
  })

  it('control: the beta spell pair still resolves phap_tu', () => {
    expect(
      resolvePlayerVisualProfileId({ cultivationPath: 'spell', cultivationWay: 'spell_pathway' }),
    ).toBe('phap_tu')
  })

  it('control: a way-less mortal save resolves mortal', () => {
    expect(resolvePlayerVisualProfileId({})).toBe('mortal')
  })
})

describe('getCultivateTexture - dormant ways never reach dedicated art', () => {
  it.each<CultivationWayId>([
    'sword_pathway',
    'hidden_sword_pathway',
    'body_pathway',
    'hidden_body_pathway',
    'hidden_spell_pathway',
  ])('%s collapses to the mortal cultivate texture', (way) => {
    // The carried way record must not repaint the live figure even when
    // a dormant profile id arrives on the same surface.
    expect(getCultivateTexture(PLAYER_VISUAL_PROFILES.kiem_tu, way).key).toBe(MORTAL_CULTIVATE)
  })

  it('the hidden_spell override itself stays dormant', () => {
    const hiddenOverride = CULTIVATE_TEXTURE_OVERRIDES.hidden_spell_pathway
    expect(hiddenOverride).toBeDefined()
    expect(
      getCultivateTexture(PLAYER_VISUAL_PROFILES.phap_tu, 'hidden_spell_pathway').key,
    ).not.toBe(hiddenOverride!.key)
  })

  it('control: the beta spell way keeps the profile cultivate art', () => {
    expect(
      getCultivateTexture(PLAYER_VISUAL_PROFILES.phap_tu, 'spell_pathway').key,
    ).toBe(PLAYER_VISUAL_PROFILES.phap_tu.cultivateTextureKey)
  })

  it('control: no way falls back to the profile art (mortal here)', () => {
    expect(getCultivateTexture(PLAYER_VISUAL_PROFILES.mortal, undefined).key).toBe(MORTAL_CULTIVATE)
  })
})
