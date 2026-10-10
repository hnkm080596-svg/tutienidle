/**
 * QA FIXPOINT probe (run qa-fixpoint-master) - isolates the meridian
 * progress arm of the persisted-modifier reconcile. Under the beta
 * lock the upstream bodyPath verdict already drops every meridian
 * claim, so this gate is only observable while bodyPath is live:
 * an 'bat-mach:*' payload on an UNOPENED meridian is a forged claim
 * and must emit nothing; the canonical payload on an OPENED meridian
 * resolves from the authored builder.
 */
import { describe, expect, it } from 'vitest'
import {
  createDefaultPlayer,
  resolvePlayerStatAssembly,
  type PlayerData,
} from '@/core/player/Player'
import { MERIDIANS } from '@/data/realm/Meridians'
import { unlockAllFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import type { StatModifier } from '@/core/stats/StatCalculator'

unlockAllFeaturesForTests()

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return { ...createDefaultPlayer(), ...overrides }
}

const MERIDIAN = MERIDIANS[0]!

function meridianPayloads(p: PlayerData): void {
  for (const stat of MERIDIAN.stats) {
    p.modifiers.push({
      id: `bat-mach:${MERIDIAN.id}:${stat}`,
      sourceId: MERIDIAN.id,
      sourceType: 'realm',
      stat,
      percent: MERIDIAN.percentAtFullTier,
    })
  }
}

describe('meridian progress gate while bodyPath is live', () => {
  it('a payload on an unopened meridian emits nothing', () => {
    const p = player()
    meridianPayloads(p)

    const stats = resolvePlayerStatAssembly(p, []).stats
    const base = resolvePlayerStatAssembly(player(), []).stats
    for (const stat of MERIDIAN.stats) {
      expect(stats[stat as keyof typeof stats]).toBe(base[stat as keyof typeof base])
    }
  })

  it('control: a canonical payload on an opened meridian emits the authored modifier', () => {
    const p = player()
    p.bodyProgression.meridian.progress = Object.fromEntries([MERIDIAN.id].map((id) => [id, 100]))
    meridianPayloads(p)

    const stats = resolvePlayerStatAssembly(p, []).stats
    const base = resolvePlayerStatAssembly(player(), []).stats
    const emitted = MERIDIAN.stats.some(
      (stat) => stats[stat as keyof typeof stats] !== base[stat as keyof typeof base],
    )
    expect(emitted).toBe(true)
  })
})
