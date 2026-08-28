import { describe, expect, it, vi } from 'vitest'
import { TribulationSystem } from './TribulationSystem'
import type { Battle } from '../battle/Battle'
import type { BattleSystem } from '../battle/BattleSystem'
import type { CombatSystem } from '../combat/CombatSystem'
import type { EventBus } from '../events/EventBus'
import type { CombatEntity } from '../combat/CombatEntity'
import type { PlayerData } from '../player/Player'
import type { Stats } from '../stats/StatBlock'

function createSetup() {
  const battle = {
    mode: 'tribulation',
    state: 'fighting',
    player: { id: 'player', currentHp: 1000, maxHp: 1000, stats: { defense: 0 } },
  } as unknown as Battle

  const applyDirectDamage = vi.fn(() => 0)

  const tribulation = new TribulationSystem({
    eventBus: { emit: vi.fn() } as unknown as EventBus,
    battleSystem: {
      startTribulation: vi.fn(),
      getBattle: () => battle,
    } as unknown as BattleSystem,
    combatSystem: { applyDirectDamage } as unknown as CombatSystem,
    buildPlayerSnapshot: vi.fn(() => ({}) as CombatEntity),
  })

  return { tribulation, battle, applyDirectDamage }
}

describe('TribulationSystem — vòng lặp lôi kích', () => {
  it('start() + update(5s) — catch-up đúng 2 lôi kích (interval 2s)', () => {
    const { tribulation, applyDirectDamage } = createSetup()

    const started = tribulation.start({} as PlayerData, {} as Stats, 'qi_refining')
    expect(started).toBe(true)

    tribulation.update(5)

    expect(applyDirectDamage).toHaveBeenCalledTimes(2)
  })

  it('strikeIntervalSeconds = 0 — không vòng lặp vô hạn, không lôi kích', () => {
    const { tribulation, applyDirectDamage } = createSetup()

    tribulation.start({} as PlayerData, {} as Stats, 'qi_refining')

    // Giả lập cấu hình lỗi interval = 0 — trước guard, nextStrikeInSeconds
    // không bao giờ tăng lại nên while catch-up lặp vô hạn. getActive()
    // trả tham chiếu tới state thật nên mutate trực tiếp được.
    const active = tribulation.getActive()
    expect(active).not.toBeNull()
    active!.strikeIntervalSeconds = 0
    active!.nextStrikeInSeconds = 0

    tribulation.update(20)

    expect(applyDirectDamage).not.toHaveBeenCalled()
    expect(tribulation.getActive()?.secondsRemaining).toBe(0)
  })
})
