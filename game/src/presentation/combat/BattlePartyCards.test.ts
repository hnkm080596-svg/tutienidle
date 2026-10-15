import { describe, expect, it } from 'vitest'
import { battlePartyCards } from './BattlePartyCards'
import type { TurnBattleParticipant } from '@/core/battle/turn/TurnBattleSystem'
import { createBaseStats } from '@/core/stats/StatBlock'

function participant(id: string, row: 0 | 1 | 2, x: number): TurnBattleParticipant {
  const stats = createBaseStats()
  return { id, entity: { id, name: id, type: 'player', baseStats: stats, stats, currentHp: 100, maxHp: 100, currentMp: 0, currentWard: 0, turnsSinceLastHitLanded: 0, realmIndex: 0, row, x, alive: true }, speed: 1, priority: 0, actionGauge: 0, alive: true, consecutiveHardCcTurns: 0 }
}
describe('battle party cards', () => {
  it('uses admitted battle positions rather than roster insertion order and leaves input untouched', () => {
    const input = [participant('player', 2, 1), participant('ally', 0, 2)]
    expect(battlePartyCards(input).map(p => p?.id ?? null)).toEqual(['ally', 'player', null, null, null])
    expect(input[0]?.id).toBe('player')
  })
  it('reserves all five positions with no invented participants', () => {
    expect(battlePartyCards([])).toEqual([null, null, null, null, null])
  })
})
