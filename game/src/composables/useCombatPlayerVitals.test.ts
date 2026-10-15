// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useCombatPlayerVitals } from './useCombatPlayerVitals'

const fixture = vi.hoisted(() => ({ players: [{ entity: { id: 'companion', currentHp: 90, maxHp: 100 } }, { entity: { id: 'player', currentHp: 40, maxHp: 80 } }] }))
const version = ref(0)
vi.mock('./useGameState', () => ({ useStateVersion: () => ({ stateVersion: version }) }))
vi.mock('./useTurnBattleInfo', () => ({ useTurnBattleInfo: () => ({ battle: computed(() => { version.value; return { players: fixture.players } }), isBattleInProgress: computed(() => true) }) }))

beforeEach(() => {
  fixture.players = [{ entity: { id: 'companion', currentHp: 90, maxHp: 100 } }, { entity: { id: 'player', currentHp: 40, maxHp: 80 } }]
  version.value++
})
describe('combat player vitals presentation', () => {
  it('selects the player by identity and refreshes after an in-place battle mutation', () => {
    const first = useCombatPlayerVitals()
    const second = useCombatPlayerVitals()
    expect(first.hpPercent.value).toBe(50)
    expect(first.entity.value?.id).toBe('player')
    fixture.players[1]!.entity.currentHp = 20
    version.value++
    expect(first.hpPercent.value).toBe(25)
    expect(second.hpPercent.value).toBe(25)
  })
  it('clamps visual fill and clears it when the player is absent', () => {
    const view = useCombatPlayerVitals()
    fixture.players[1]!.entity.currentHp = -10
    version.value++
    expect(view.hpPercent.value).toBe(0)
    fixture.players[1]!.entity.currentHp = 160
    version.value++
    expect(view.hpPercent.value).toBe(100)
    fixture.players = []
    version.value++
    expect(view.entity.value).toBeUndefined()
    expect(view.hpPercent.value).toBe(0)
  })
})
