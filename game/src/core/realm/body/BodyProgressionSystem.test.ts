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
  isBodyChapterUnlocked,
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

  it('routes meridian investments through the same dispatch', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 18
    // M-F-CHU-THIEN (C2C-59) - meridian is sequentially gated on
    // body_refinement completion; a coherent fixture completes it.
    player.physiqueGrade = 'bao'
    player.bodyProgression.body_refinement.completedTiers = 6

    const consumed = investBodyChapterState(player, 'meridian', 10, 0)

    expect(consumed).toBe(1)
    expect(player.bodyProgression.meridian.openedIds).toEqual(['nham_mach'])
    expect(player.modifiers.filter(m => m.id.startsWith('bat-mach:')).length).toBeGreaterThan(0)
  })

  it('sequential gate: meridian invest consumes nothing while body_refinement is incomplete (C2C-59)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 18
    player.bodyProgression.body_refinement.completedTiers = 5 // one tier short

    expect(investBodyChapterState(player, 'meridian', 10, 0)).toBe(0)
    expect(player.bodyProgression.meridian.openedIds).toEqual([])

    player.bodyProgression.body_refinement.completedTiers = 6
    player.physiqueGrade = 'bao'
    expect(investBodyChapterState(player, 'meridian', 10, 0)).toBe(1)
  })

  it('sequential gate: zhou_tian invest consumes nothing while meridian is incomplete (C2C-59)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 18
    player.physiqueGrade = 'bao'
    player.bodyProgression.body_refinement.completedTiers = 6
    player.bodyProgression.meridian.openedIds = MERIDIANS.slice(0, 7).map(m => m.id)

    expect(investBodyChapterState(player, 'zhou_tian', 50, 0)).toBe(0)
    expect(player.bodyProgression.zhou_tian.circulation).toBe(0)

    player.bodyProgression.meridian.openedIds = MERIDIANS.map(m => m.id)
    expect(investBodyChapterState(player, 'zhou_tian', 50, 0)).toBe(50)
    expect(player.bodyProgression.zhou_tian.circulation).toBe(50)
  })

  it('isBodyChapterUnlocked mirrors the sequential gate exactly', () => {
    const player = createDefaultPlayer()

    // Chapters with no authored prereqs are always unlocked.
    expect(isBodyChapterUnlocked(player, 'body_refinement')).toBe(true)
    expect(isBodyChapterUnlocked(player, 'meridian')).toBe(false)
    expect(isBodyChapterUnlocked(player, 'zhou_tian')).toBe(false)

    player.bodyProgression.body_refinement.completedTiers = 6
    expect(isBodyChapterUnlocked(player, 'meridian')).toBe(true)
    expect(isBodyChapterUnlocked(player, 'zhou_tian')).toBe(false)

    player.bodyProgression.meridian.openedIds = MERIDIANS.map(m => m.id)
    expect(isBodyChapterUnlocked(player, 'zhou_tian')).toBe(true)
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
    expect(getBodyChapterProgress(player, 'meridian')).toEqual({ completed: 2, total: 8 })
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
    // M-F-CHU-THIEN (C2C-64): meridian progress ALSO requires the
    // completed refinement predecessor - the fixture is coherent.
    player.realmId = 'qi_refining'
    player.physiqueGrade = 'bao'
    player.bodyProgression.body_refinement.completedTiers = 6
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
        // Grade coherent so ONLY the progress-at-6 violation fires.
        p.physiqueGrade = 'bao'
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
    // M-QI-07 - a 6/6 refinement chapter implies the transform already
    // fired; the persisted grade mirrors it (INV-8).
    player.physiqueGrade = 'bao'
    player.bodyProgression.body_refinement.completedTiers = 6
    player.bodyProgression.meridian.openedIds = MERIDIANS.map(m => m.id)
    expect(() => assertBodyProgressionIntegrity(player)).not.toThrow()
  })

  it('persisted sequential coherence: progressed/completed chapters require complete predecessors (C2C-64)', () => {
    // Crafted shape 1: meridian progressed while refinement incomplete.
    const meridianAhead = createDefaultPlayer()
    meridianAhead.realmId = 'qi_refining'
    meridianAhead.bodyProgression.meridian.openedIds = ['nham_mach']
    expect(() => assertBodyProgressionIntegrity(meridianAhead)).toThrow(/body_refinement/)

    // Crafted shape 2: zhou_tian progressed while meridian incomplete
    // (refinement complete + coherent grade, so ONLY the zhou_tian rule fires).
    const zhouTianAhead = createDefaultPlayer()
    zhouTianAhead.realmId = 'foundation_establishment'
    zhouTianAhead.physiqueGrade = 'bao'
    zhouTianAhead.bodyProgression.body_refinement.completedTiers = 6
    zhouTianAhead.bodyProgression.zhou_tian.circulation = 5
    expect(() => assertBodyProgressionIntegrity(zhouTianAhead)).toThrow(/meridian/)

    // The same chapters at zero progress stay coherent (a chapter is
    // only bound once it has progress or is complete).
    const untouched = createDefaultPlayer()
    expect(() => assertBodyProgressionIntegrity(untouched)).not.toThrow()

    // A missing prereq slice reports as a slice violation - the
    // coherence check never TypeErrors on it (derivationBlocked-style).
    const missingRefinement = createDefaultPlayer()
    missingRefinement.bodyProgression = {
      meridian: { openedIds: ['nham_mach'] },
      zhou_tian: { circulation: 0 },
    } as never
    expect(() => assertBodyProgressionIntegrity(missingRefinement)).toThrow(/body_refinement missing/)
  })
})
