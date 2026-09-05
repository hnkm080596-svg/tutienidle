import { describe, expect, it } from 'vitest'
import { planCombatantSpriteReconciliation } from './combat-entity-reconciliation'
import type { TurnBattleEntityVisualState } from '@/core/battle/turn/TurnActionPresentationEvents'

function state(overrides: Partial<TurnBattleEntityVisualState> = {}): TurnBattleEntityVisualState {
  return {
    id: 'enemy-1',
    row: 4,
    column: 10,
    currentHp: 50,
    maxHp: 100,
    alive: true,
    ...overrides,
  }
}

describe('planCombatantSpriteReconciliation', () => {
  it('creates a sprite for an id not yet known', () => {
    const actions = planCombatantSpriteReconciliation(new Set(), [state({ id: 'enemy-1' })])

    expect(actions).toEqual([{ type: 'create', state: state({ id: 'enemy-1' }) }])
  })

  it('updates a known id that is still present and alive', () => {
    const known = new Set(['enemy-1'])
    const incoming = state({ id: 'enemy-1', row: 5, column: 8, currentHp: 30 })

    const actions = planCombatantSpriteReconciliation(known, [incoming])

    expect(actions).toEqual([{ type: 'update', state: incoming }])
  })

  it('removes a known id whose latest state reports alive: false', () => {
    const known = new Set(['enemy-1'])
    const incoming = state({ id: 'enemy-1', alive: false })

    const actions = planCombatantSpriteReconciliation(known, [incoming])

    expect(actions).toEqual([{ type: 'remove', id: 'enemy-1' }])
  })

  it('removes a known id that is absent entirely from the incoming list', () => {
    const known = new Set(['enemy-1'])

    const actions = planCombatantSpriteReconciliation(known, [])

    expect(actions).toEqual([{ type: 'remove', id: 'enemy-1' }])
  })

  it('removes only the absent id when another known id is still present and alive', () => {
    const known = new Set(['enemy-1', 'enemy-2'])
    const incoming = state({ id: 'enemy-2' })

    const actions = planCombatantSpriteReconciliation(known, [incoming])

    expect(actions).toContainEqual({ type: 'update', state: incoming })
    expect(actions).toContainEqual({ type: 'remove', id: 'enemy-1' })
    expect(actions).toHaveLength(2)
  })

  it('handles a mix of create/update/remove within one snapshot', () => {
    const known = new Set(['enemy-1', 'enemy-2', 'enemy-3'])
    const states = [
      state({ id: 'enemy-1', currentHp: 40 }), // update
      state({ id: 'enemy-4', currentHp: 100 }), // create
      state({ id: 'enemy-2', alive: false }), // remove (dead)
      // enemy-3 absent entirely — remove
    ]

    const actions = planCombatantSpriteReconciliation(known, states)

    expect(actions).toContainEqual({ type: 'update', state: states[0] })
    expect(actions).toContainEqual({ type: 'create', state: states[1] })
    expect(actions).toContainEqual({ type: 'remove', id: 'enemy-2' })
    expect(actions).toContainEqual({ type: 'remove', id: 'enemy-3' })
    expect(actions).toHaveLength(4)
  })

  it('applies the same rules independently for a players list and an enemies list', () => {
    const knownPlayers = new Set(['player'])
    const knownEnemies = new Set(['enemy-1'])

    const playerActions = planCombatantSpriteReconciliation(knownPlayers, [
      state({ id: 'player', row: 4, column: 1, currentHp: 80, maxHp: 100 }),
      state({ id: 'companion-1', row: 5, column: 1, currentHp: 60, maxHp: 60 }),
    ])
    const enemyActions = planCombatantSpriteReconciliation(knownEnemies, [
      state({ id: 'enemy-1', alive: false }),
    ])

    expect(playerActions).toContainEqual({
      type: 'update',
      state: state({ id: 'player', row: 4, column: 1, currentHp: 80, maxHp: 100 }),
    })
    expect(playerActions).toContainEqual({
      type: 'create',
      state: state({ id: 'companion-1', row: 5, column: 1, currentHp: 60, maxHp: 60 }),
    })
    expect(enemyActions).toEqual([{ type: 'remove', id: 'enemy-1' }])
  })

  it('returns no actions for an empty snapshot with no known ids', () => {
    expect(planCombatantSpriteReconciliation(new Set(), [])).toEqual([])
  })
})
