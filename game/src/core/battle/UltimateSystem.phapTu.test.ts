import { describe, expect, it } from 'vitest'
import {
  autoPhapTuUltimateDecision,
  canUsePhapTuUltimate,
  PHAP_TU_ULTIMATE_IDS,
  triggerPhapTuUltimate,
} from './UltimateSystem'
import { MAX_THE } from '../combat/CombatTypes'
import type { Battle } from './Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import { createBaseStats } from '../stats/StatBlock'

// Spec 2026-08-30-phap-tu-dao-sac §2.4 — ult Thuần hệ mở khi Thế đầy
// 100, auto-AI bắn khi boss active + Thế đầy, KHÔNG chiếm loadout slot.
// Fixture theo pattern UltimateSystem.test.ts hiện có.
function makeEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), attack: 10, evasionRate: 0, dexterity: 0 }

  return {
    id: 'entity',
    name: 'entity',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeBattle(opts: { the?: number; boss?: boolean; state?: Battle['state'] } = {}): Battle {
  const player = makeEntity({ id: 'player', type: 'player', currentThe: opts.the })
  const enemy = makeEntity({
    id: 'enemy',
    isBoss: opts.boss === true,
  })

  return {
    state: opts.state ?? 'fighting',
    player,
    enemies: [{ entity: enemy } as Battle['enemies'][number]],
  } as unknown as Battle
}

describe('Pháp Tu ult theo Thế (spec §2.4)', () => {
  it('PHAP_TU_ULTIMATE_IDS đủ 5 hành đúng id', () => {
    expect(PHAP_TU_ULTIMATE_IDS).toEqual({
      fire: 'tat_phuong',
      water: 'bat_thu',
      wood: 'kien_moc',
      metal: 'kim_phat',
      earth: 'thanh_luy',
    })
  })

  it('canUsePhapTuUltimate: Thế < MAX_THE → false; = MAX_THE → true', () => {
    expect(canUsePhapTuUltimate(makeBattle({ the: MAX_THE - 1 }))).toBe(false)
    expect(canUsePhapTuUltimate(makeBattle({ the: MAX_THE }))).toBe(true)
  })

  it('auto: boss active + Thế đầy → element; thiếu 1 trong 2 → null', () => {
    expect(autoPhapTuUltimateDecision(makeBattle({ the: MAX_THE, boss: true }), 'fire')).toBe('fire')
    expect(autoPhapTuUltimateDecision(makeBattle({ the: MAX_THE, boss: false }), 'fire')).toBeNull()
    expect(autoPhapTuUltimateDecision(makeBattle({ the: 50, boss: true }), 'fire')).toBeNull()
    expect(autoPhapTuUltimateDecision(makeBattle({ the: 50, boss: false }), 'fire')).toBeNull()
  })

  it('auto: không bắn khi trận không fighting hoặc player chết', () => {
    expect(
      autoPhapTuUltimateDecision(makeBattle({ the: MAX_THE, boss: true, state: 'countdown' }), 'fire'),
    ).toBeNull()

    const deadPlayerBattle = makeBattle({ the: MAX_THE, boss: true })
    deadPlayerBattle.player.alive = false
    expect(autoPhapTuUltimateDecision(deadPlayerBattle, 'fire')).toBeNull()
  })

  it('triggerPhapTuUltimate: đầy → tiêu Thế về 0 + nuke mọi địch sống; chưa đầy → false giữ nguyên', () => {
    const notFull = makeBattle({ the: 50 })
    expect(triggerPhapTuUltimate(notFull, { resolveNuke: () => 100 })).toBe(false)
    expect(notFull.player.currentThe).toBe(50)

    const full = makeBattle({ the: MAX_THE })
    let nukeCount = 0
    expect(
      triggerPhapTuUltimate(full, {
        resolveNuke: () => {
          nukeCount += 1
          return 100
        },
      }),
    ).toBe(true)
    expect(full.player.currentThe).toBe(0)
    expect(nukeCount).toBe(1)
  })

  it('trigger bỏ qua địch đã chết', () => {
    const battle = makeBattle({ the: MAX_THE })
    const dead = makeEntity({ id: 'dead', alive: false })
    battle.enemies.push({ entity: dead } as Battle['enemies'][number])

    let nukeCount = 0
    triggerPhapTuUltimate(battle, {
      resolveNuke: () => {
        nukeCount += 1
        return 100
      },
    })

    expect(nukeCount).toBe(1)
  })
})
