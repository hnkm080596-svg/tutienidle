import { describe, expect, it } from 'vitest'

import { BODY_REFINEMENT_TIERS } from '../../../data/realm/BodyRefinement'
import { BODY_VITALITY_ENDURANCE_THRESHOLD_PER_POINT } from '../../stats/TheTuStatChannels'
import { createDefaultPlayer, resolvePlayerFinalStats, resolvePlayerStatAssembly } from '../../player/Player'
import { investBodyChapterState } from './BodyProgressionSystem'

// M-F (D1) - Body Refinement contributes BASE STATS: its deltas join
// player.baseStats into an ephemeral assembledBase BEFORE derived stats
// and modifier layers run (resolvePlayerStatAssembly). These tests pin
// the assembly contract: additive merge (never overwrite), percent
// layers multiply the boosted base, attribute-reactive channels see the
// body-boosted totals, and persisted baseStats is never mutated.
describe('Body base-stat assembly (D1)', () => {
  it('completed-tier deltas add ONTO a non-zero base stat - never overwrite it', () => {
    const baseline = createDefaultPlayer()
    const player = createDefaultPlayer()

    // Luyen Bi grants defense (default base 5, non-zero). A merge that
    // overwrote instead of adding would resolve to the delta alone
    // (plus the strength-derived flat, never the base too).
    player.bodyProgression.body_refinement.completedTiers = 1

    const baselineStats = resolvePlayerFinalStats(baseline, [])
    const stats = resolvePlayerFinalStats(player, [])
    const delta = BODY_REFINEMENT_TIERS[0]!.baseGains.defense ?? 0

    expect(stats.defense).toBeCloseTo(baselineStats.defense + delta)
    expect(stats.defense).toBeGreaterThan(delta)
  })

  it('percent modifiers multiply the body-boosted base (strict layering)', () => {
    const baseline = createDefaultPlayer()
    const player = createDefaultPlayer()

    player.bodyProgression.body_refinement.completedTiers = 1

    const baselineWithPercent = resolvePlayerFinalStats(baseline, [
      { id: 'test:def', sourceId: 'test', sourceType: 'buff', stat: 'defense', percent: 0.5 },
    ])
    const stats = resolvePlayerFinalStats(player, [
      { id: 'test:def', sourceId: 'test', sourceType: 'buff', stat: 'defense', percent: 0.5 },
    ])

    const delta = BODY_REFINEMENT_TIERS[0]!.baseGains.defense ?? 0
    // The body delta joins the base BEFORE the percent layer: it is
    // multiplied too - not added after.
    expect(stats.defense).toBeCloseTo(baselineWithPercent.defense + delta * 1.5)
  })

  it('body vitality delta flows into attribute-reactive channels (vitality -> maxHp/hpRegen)', () => {
    const withoutBody = createDefaultPlayer()
    const withBody = createDefaultPlayer()

    // 5 completed tiers include Luyen Tang (vitality delta).
    withBody.bodyProgression.body_refinement.completedTiers = 5

    const baseline = resolvePlayerFinalStats(withoutBody, [])
    const boosted = resolvePlayerFinalStats(withBody, [])

    expect(boosted.vitality).toBeCloseTo(1 + (BODY_REFINEMENT_TIERS[4]!.baseGains.vitality ?? 0))
    // deriveAttributeModifiers: vitality -> maxHp (+8/pt), hpRegenPerTurn
    // (+0.1/pt) - the body-boosted vitality feeds those channels.
    expect(boosted.maxHp).toBeGreaterThan(baseline.maxHp)
    expect(boosted.hpRegenPerTurn).toBeGreaterThan(baseline.hpRegenPerTurn)
  })

  // Spec sec.3.3/Invariant 6 - way facets read the ASSEMBLED attribute
  // totals: a body_pathway player's vitality facet must scale with the
  // body-boosted vitality, not the persisted raw base.
  it('the active way facet sees body-boosted attribute totals (body_pathway vitality -> enduranceThreshold)', () => {
    const baseline = createDefaultPlayer()
    const player = createDefaultPlayer()

    baseline.cultivationPath = 'body'
    baseline.cultivationWay = 'body_pathway'
    player.cultivationPath = 'body'
    player.cultivationWay = 'body_pathway'
    // 5 completed tiers include Luyen Tang (vitality delta).
    player.bodyProgression.body_refinement.completedTiers = 5

    const vitDelta = BODY_REFINEMENT_TIERS[4]!.baseGains.vitality ?? 0
    const baselineAssembly = resolvePlayerStatAssembly(baseline, [])
    const assembly = resolvePlayerStatAssembly(player, [])

    const baselineFacet = baselineAssembly.wayFacetModifiers.find(
      m => m.id === 'body:vitality:enduranceThreshold',
    )
    const facet = assembly.wayFacetModifiers.find(
      m => m.id === 'body:vitality:enduranceThreshold',
    )

    // Vitality default base 1: facet flat = vitality * per-point channel.
    expect(baselineFacet?.flat).toBeCloseTo(1 * BODY_VITALITY_ENDURANCE_THRESHOLD_PER_POINT)
    expect(facet?.flat).toBeCloseTo(
      (1 + vitDelta) * BODY_VITALITY_ENDURANCE_THRESHOLD_PER_POINT,
    )
    // Final enduranceThreshold = base 10 + facet flat.
    expect(assembly.stats.enduranceThreshold).toBeCloseTo(
      baselineAssembly.stats.enduranceThreshold +
        vitDelta * BODY_VITALITY_ENDURANCE_THRESHOLD_PER_POINT,
    )
  })

  it('persisted baseStats is never mutated by body progression - invest + assembly leave it raw', () => {
    const player = createDefaultPlayer()

    player.realmId = 'qi_refining'
    const baseBefore = { ...player.baseStats }

    investBodyChapterState(player, 'body_refinement', 20, 0)
    resolvePlayerFinalStats(player, [])

    expect(player.baseStats).toEqual(baseBefore)
    expect(player.modifiers.filter(m => m.id.startsWith('luyen-the:'))).toHaveLength(0)
  })

  it('meridian stays a modifier chapter - its gains still arrive via bat-mach:* modifiers', () => {
    const withMeridian = createDefaultPlayer()
    const withoutMeridian = createDefaultPlayer()

    withMeridian.realmId = 'qi_refining'
    withMeridian.realmLevel = 18
    withMeridian.bodyProgression.meridian.openedIds = ['nham_mach']
    withMeridian.modifiers = [
      {
        id: 'bat-mach:nham_mach:maxHp',
        sourceId: 'nham_mach',
        sourceType: 'realm',
        stat: 'maxHp',
        percent: 0.05,
      },
    ]

    // Vitality-derived maxHp lives in the base for BOTH players - the
    // meridian percent multiplies whatever the assembled base resolves.
    const baseline = resolvePlayerFinalStats(withoutMeridian, [])
    const stats = resolvePlayerFinalStats(withMeridian, [])

    expect(stats.maxHp).toBeCloseTo(baseline.maxHp * 1.05)
  })
})
