// BLIND-REVIEW probe (2026-10-01 falsification sweep): the beta lock
// gates wasHiddenBreakthrough so NEW realm-passive grants never pick
// buildEnhancedModifiers while hiddenContent is scope-hidden. But
// grantRealmPassive is write-time only: a pre-beta save that already
// committed a hidden breakthrough carries the ENHANCED variants inside
// persisted player.modifiers, and no restore step re-derives or scrubs
// realm-sourced modifier entries (syncRealmPassive never runs on
// restore; applyAllBodyModifiers only rebuilds body slices).
//
// Expected under the beta scope contract: a flagged save's dormant
// records have no live effect - the enhanced (hidden-breakthrough)
// passive is hidden-content reward and must not emit on beta play.
// Actual: resolvePlayerStatAssembly reads player.modifiers verbatim, so
// the enhanced +20%-all-main-stats Kien Co passive still applies to a
// save that unsupportedReleaseReason itself flags
// 'hidden_progression_state'. The hiddenPerfection record below is the
// acceptance-coherent shape (assertHiddenPerfectionIntegrity passes),
// so this is a real pre-beta save, not a forged one.
import { describe, expect, it } from 'vitest'

import { lockBetaFeaturesForTests } from '../game/__fixtures__/betaFeaturesUnlock'
import { REALM_PASSIVES } from '../../data/realm/RealmPassives'
import { assertHiddenPerfectionIntegrity } from './hidden/HiddenPerfection'
import { createDefaultPlayer } from '../player/Player'
import { resolvePlayerStatAssembly } from '../player/Player'
import { unsupportedReleaseReason } from '../betaScopeSurface'
import { wasHiddenBreakthrough } from './hidden/HiddenLineage'

// Re-pin the canonical beta lock (global setup unlocks features).
lockBetaFeaturesForTests()

function carriedHiddenSave() {
  const player = createDefaultPlayer()
  player.realmId = 'foundation_establishment'
  // Acceptance-coherent hidden record (per assertHiddenPerfectionIntegrity):
  // hidden entry into foundation requires the qi_refining hidden body
  // completed; lineage stays active so lineageClosedByRealmId stays absent.
  player.hiddenPerfection.lineageActive = true
  player.hiddenPerfection.completedHiddenBodyRealmIds = ['mortal', 'qi_refining']
  player.hiddenPerfection.realms = {
    mortal: { bodyCompleted: true, discovered: true, frozen: false },
    qi_refining: { bodyCompleted: true, discovered: true, frozen: false },
  }
  player.hiddenPerfection.hiddenBreakthroughRealmIds = ['foundation_establishment']
  // State a REAL pre-beta save carries: grantRealmPassive already ran
  // with the hidden variant - markers + enhanced modifiers persisted.
  const definition = REALM_PASSIVES.find((p) => p.id === 'foundation_establishment')!
  player.grantedRealmPassiveIds.push('foundation_establishment')
  player.modifiers.push(...definition.buildEnhancedModifiers!(player))
  return player
}

describe('persisted enhanced hidden-breakthrough passive on a flagged save', () => {
  it('the save is flag-coherent, flagged out-of-scope, yet enhanced modifiers still emit', () => {
    const player = carriedHiddenSave()

    // The record is a legal pre-beta save shape - acceptance does not reject it.
    expect(() => assertHiddenPerfectionIntegrity(player)).not.toThrow()

    // Gate works for NEW writes: hidden breakthrough no longer reads.
    expect(wasHiddenBreakthrough(player, 'foundation_establishment')).toBe(false)
    // The flag works: the save is reported out of scope but keeps playing.
    expect(unsupportedReleaseReason(player)).toBe('hidden_progression_state')

    const { stats } = resolvePlayerStatAssembly(player, [])
    const baseline = createDefaultPlayer()
    baseline.realmId = 'foundation_establishment'
    const { stats: baselineStats } = resolvePlayerStatAssembly(baseline, [])

    // The enhanced Kien Co record stays persisted verbatim (deserialize
    // intact) but its entries resolve inert: the realm-passive emit
    // filter in resolvePlayerStatAssembly drops any entry whose realmId
    // sits in hiddenBreakthroughRealmIds while hiddenContent is locked.
    expect(stats.strength).toBe(baselineStats.strength)
    expect(stats.intelligence).toBe(baselineStats.intelligence)
    expect(
      player.modifiers.filter((m) => m.id.startsWith('realm-passive:kien_co:')).length,
    ).toBe(5)
  })
})
