import { describe, expect, it } from 'vitest'

import { MERIDIANS } from '../../../data/realm/Meridians'
import { BODY_REFINEMENT_TIERS } from '../../../data/realm/BodyRefinement'
import { createDefaultPlayer } from '../../player/Player'
import {
  applyAllBodyModifiers,
  assertBodyProgressionIntegrity,
  collectBodyBaseStatDeltas,
  computeBreakthroughGrade,
  getBodyChapterProgress,
  getBodyRefinementCompletedTiers,
  getOpenedMeridianCount,
  investBodyChapterState,
} from './BodyProgressionSystem'

describe('BodyProgressionSystem - unified invest dispatch', () => {
  it('routes to the addressed chapter, returns consumed, emits NO luyen-the modifiers and scrubs stale ones on success (D1)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.modifiers = [
      {
        id: 'luyen-the:luyen_bi:defense',
        sourceId: 'luyen_bi',
        sourceType: 'realm',
        stat: 'defense',
        percent: 0.08,
      },
    ]

    const consumed = investBodyChapterState(player, 'body_refinement', 10, 0)

    expect(consumed).toBe(10)
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(10)
    expect(player.modifiers.filter(m => m.id.startsWith('luyen-the:'))).toHaveLength(0)

    const countAfterFirst = player.modifiers.length
    investBodyChapterState(player, 'body_refinement', 5, 0)
    expect(player.modifiers).toHaveLength(countAfterFirst)
  })

  it('does NOT touch modifiers when the chapter consumes 0 (gated / complete / empty)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 1 // Luyen Bi locked (requiredRealmLevel 2)

    const consumed = investBodyChapterState(player, 'body_refinement', 100, 0)

    expect(consumed).toBe(0)
    expect(player.modifiers.filter(m => m.id.startsWith('luyen-the:'))).toHaveLength(0)
  })

  it('routes meridian investments (parked path) through the same dispatch', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 18

    const consumed = investBodyChapterState(player, 'meridian', 10, 0)

    expect(consumed).toBe(1)
    expect(player.bodyProgression.meridian.openedIds).toEqual(['nham_mach'])
    expect(player.modifiers.filter(m => m.id.startsWith('bat-mach:')).length).toBeGreaterThan(0)
  })
})

describe('BodyProgressionSystem - modifier rehydration + reads', () => {
  it('applyAllBodyModifiers scrubs luyen-the:* (D1: emitted none), rebuilds bat-mach:*, leaves unrelated slices', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.bodyProgression.body_refinement.completedTiers = 1
    player.bodyProgression.meridian.openedIds = ['nham_mach']
    player.modifiers = [
      {
        id: 'luyen-the:luyen_mach:maxHp',
        sourceId: 'luyen_mach',
        sourceType: 'realm',
        stat: 'maxHp',
        percent: 0.08,
      },
      {
        id: 'bat-mach:doc_mach:strength',
        sourceId: 'doc_mach',
        sourceType: 'realm',
        stat: 'strength',
        percent: 0.05,
      },
      {
        id: 'equipment:kiem:might',
        sourceId: 'kiem',
        sourceType: 'equipment',
        stat: 'might',
        percent: 0.1,
      },
    ]

    applyAllBodyModifiers(player)

    const ids = player.modifiers.map(m => m.id)
    expect(ids).toContain('equipment:kiem:might') // unrelated slices untouched
    expect(ids.filter(id => id.startsWith('luyen-the:'))).toHaveLength(0) // D1: never re-emitted
    expect(ids).not.toContain('bat-mach:doc_mach:strength')
    expect(ids).toContain('bat-mach:nham_mach:maxHp')
  })

  it('collectBodyBaseStatDeltas - zero state emits nothing; completed tiers sum their baseGains', () => {
    const player = createDefaultPlayer()

    expect(collectBodyBaseStatDeltas(player)).toEqual({})

    player.bodyProgression.body_refinement.completedTiers = 1
    const deltas = collectBodyBaseStatDeltas(player)

    expect(deltas).toEqual(BODY_REFINEMENT_TIERS[0]!.baseGains)
  })

  it('getBodyChapterProgress + derived count reads come from canonical state', () => {
    const player = createDefaultPlayer()

    player.bodyProgression.body_refinement.completedTiers = 3
    player.bodyProgression.meridian.openedIds = ['nham_mach', 'doi_mach']

    expect(getBodyChapterProgress(player, 'body_refinement')).toEqual({ completed: 3, total: 6 })
    expect(getBodyChapterProgress(player, 'meridian')).toEqual({ completed: 2, total: 9 })
    expect(getBodyRefinementCompletedTiers(player)).toBe(3)
    expect(getOpenedMeridianCount(player)).toBe(2)
  })

  it('computeBreakthroughGrade clamps completed tiers to 1..6 (0 -> 1)', () => {
    const player = createDefaultPlayer()

    expect(computeBreakthroughGrade(player)).toBe(1)
    player.bodyProgression.body_refinement.completedTiers = 4
    expect(computeBreakthroughGrade(player)).toBe(4)
  })
})

describe('BodyProgressionSystem - integrity gate', () => {
  it('passes the canonical default + valid mid-progress states', () => {
    const player = createDefaultPlayer()
    expect(() => assertBodyProgressionIntegrity(player)).not.toThrow()

    // M-E (D2): meridian progress requires the qi_refining page
    // unlocked - a mortal + opened meridian is now an integrity
    // violation, so legit progress fixtures carry the page realm.
    player.realmId = 'qi_refining'
    player.bodyProgression.body_refinement.completedTiers = 2
    player.bodyProgression.body_refinement.currentTierProgress = 5
    player.bodyProgression.meridian.openedIds = ['nham_mach']
    expect(() => assertBodyProgressionIntegrity(player)).not.toThrow()
  })

  it('throws on each spec sec.3.7 violation class', () => {
    const cases: Array<(p: ReturnType<typeof createDefaultPlayer>) => void> = [
      p => { p.bodyProgression.body_refinement.completedTiers = 1.5 },
      p => { p.bodyProgression.body_refinement.completedTiers = -1 },
      p => { p.bodyProgression.body_refinement.completedTiers = 7 },
      p => {
        p.bodyProgression.body_refinement.completedTiers = 0
        p.bodyProgression.body_refinement.currentTierProgress = 51 // >= Luyen Bi cap (50)
      },
      p => {
        p.bodyProgression.body_refinement.completedTiers = 6
        p.bodyProgression.body_refinement.currentTierProgress = 1
      },
      p => { p.bodyProgression.meridian.openedIds = ['huyen_mach'] },
      p => { p.bodyProgression.meridian.openedIds = ['doi_mach'] },
    ]

    for (const mutate of cases) {
      const player = createDefaultPlayer()
      mutate(player)
      expect(() => assertBodyProgressionIntegrity(player)).toThrow()
    }
  })

  it('accepts a fully-completed canonical state', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.bodyProgression.body_refinement.completedTiers = 6
    player.bodyProgression.meridian.openedIds = MERIDIANS.map(m => m.id)
    expect(() => assertBodyProgressionIntegrity(player)).not.toThrow()
  })
})
