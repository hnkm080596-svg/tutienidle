import { describe, expect, it } from 'vitest'
import { calculateEffectiveStats, type StatModifier } from '../stats/StatCalculator'
import { createDefaultPlayer, resolvePlayerFinalStats } from './Player'
// Importing the path system registers its phap_tu delta deriver with the
// stats module (D12 contract) — the registration itself is under test.
import {
  PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT,
  PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT,
} from './CultivationPathSystem'

// Task 7 (D12/D19, INV-10): attunement feeds MP ONLY through the phap_tu
// domain gate — emitted once at assembly from resolved attribute totals,
// and re-emitted as a gated delta by the registered deltaDeriver when
// attunement moves mid-battle.

function attunementBuff(flat: number): StatModifier {
  return {
    id: `test:attunement:${flat}`,
    sourceId: 'test',
    sourceType: 'buff',
    stat: 'attunement',
    flat,
  }
}

describe('phap_tu attunement -> MP emission (D12)', () => {
  it('assembly: a phap_tu player gains MP from attunement through the gate', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.baseStats.attunement = 10

    const stats = resolvePlayerFinalStats(player, [])

    expect(stats.maxMp).toBeCloseTo(10 * PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT, 6)
    expect(stats.manaRegenPerTurn).toBeCloseTo(10 * PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT, 6)
  })

  it('assembly: a non-phap_tu player gets no MP from attunement', () => {
    const player = createDefaultPlayer()
    player.baseStats.attunement = 10

    const stats = resolvePlayerFinalStats(player, [])

    expect(stats.maxMp).toBe(0)
    expect(stats.manaRegenPerTurn).toBe(0)
  })

  it('assembly: modifier-driven attunement counts toward the MP emission', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.baseStats.attunement = 5

    const stats = resolvePlayerFinalStats(player, [attunementBuff(5)])

    expect(stats.maxMp).toBeCloseTo(10 * PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT, 6)
  })

  it('INV-10: a mid-battle attunement delta emits the gated MP delta exactly once', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.baseStats.attunement = 10
    const resolved = resolvePlayerFinalStats(player, [])

    const effective = calculateEffectiveStats(resolved, [attunementBuff(5)])

    // Base 10 already contributed at assembly; the delta pass must add
    // ONLY the +5 delta's share — 15 x rate total, not 25 x rate.
    expect(effective.attunement).toBe(15)
    expect(effective.maxMp).toBeCloseTo(15 * PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT, 6)
    expect(effective.manaRegenPerTurn).toBeCloseTo(15 * PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT, 6)
  })

  it('a non-attunement delta emits no MP delta', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.baseStats.attunement = 10
    const resolved = resolvePlayerFinalStats(player, [])

    const effective = calculateEffectiveStats(resolved, [
      { id: 'test:str', sourceId: 'test', sourceType: 'buff', stat: 'strength', flat: 5 },
    ])

    expect(effective.maxMp).toBe(resolved.maxMp)
    expect(effective.manaRegenPerTurn).toBe(resolved.manaRegenPerTurn)
  })
})
