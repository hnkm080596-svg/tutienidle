import { describe, expect, it } from 'vitest'
import { selectTarget, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'

// QA debug evidence (2026-09-04 quick review) — xác nhận hành vi thật của
// selectTarget qua helper trả về id: bảo vệ chống lại false positive do
// optional-chain sai (.id trên string). Đây là regression test cho chính
// quy trình viết probe, không phải production behavior.
function entity(id: string, column: number, row: number): CombatEntity {
  return { id, x: column, row: row as never, alive: true } as unknown as CombatEntity
}

function participant(id: string, e: CombatEntity): TurnBattleParticipant {
  return { id, entity: e, speed: 10, priority: 0, actionGauge: 0, alive: e.alive, buffs: new TurnBuffPool() }
}

describe('selectTarget probe hygiene (QA)', () => {
  it('same-row ưu tiên: qua helper trả string, assert trực tiếp không double-chain', () => {
    const actor = participant('actor', entity('actor', 0, 4))
    const otherRowNear = participant('otherRowNear', entity('otherRowNear', 1, 5))
    const sameRowFar = participant('sameRowFar', entity('sameRowFar', 3, 4))

    const chosenId: string | undefined = selectTarget(actor, [otherRowNear, sameRowFar])?.id
    expect(chosenId).toBe('sameRowFar')
  })
})
