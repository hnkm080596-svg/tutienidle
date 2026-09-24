import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../player/Player'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { freshSwordPathState } from './KiemTuState'
import { LIEN_MOMENTUM_RATE, forgeCost, kiemDaoCap } from './NguKiemDao'
import {
  buildNguKiemDaoProvider,
  collectOwnedEvolutionIds,
  resolveNguKiemSkillName,
} from './NguKiemDaoProvider'
import { NGU_KIEM_THUAT } from '../../data/skill/NguKiemDaoSkills'
import type { CombatEntity } from '../combat/CombatEntity'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'

// Ngu Kiem Beta (design 2026-09-24) — the hidden way's single evolving
// skill contract: Khoi-only casts carry just `instances.count` through
// the STANDARD pipeline (no guaranteedHit, no execute, no crit/armor
// privilege — Roll Cascade is gone); Lien adds the Kiem The momentum
// layer (`each.momentumPerLandedInstance` for the plan lane +
// `perInstanceOptions` carrying the cast-local landed count for the
// engine-unit lane). +1 Kiem Y per resolved cast, hit-or-miss alike,
// forged greedily at the realm cost.

function makeNguPlayer(realmId = 'golden_core') {
  const player = createDefaultPlayer()
  player.cultivationPath = 'sword'
  player.cultivationWay = 'hidden_sword_pathway'
  player.realmId = realmId
  player.swordPath = freshSwordPathState()
  return player
}

function makeTarget(over: Partial<Pick<CombatEntity, 'currentHp' | 'maxHp'>> = {}): CombatEntity {
  return { currentHp: 1_000, maxHp: 1_000, ...over } as CombatEntity
}

function evolutionNode(id: string, evolutionId?: string): ProgressionNode {
  return {
    id,
    name: `Ngự Kiếm · ${evolutionId ?? '?'}`,
    type: 'major',
    insightCost: 0,
    maxLevel: 1,
    requiredCultivationPath: 'sword',
    requiredWay: 'hidden_sword_pathway',
    effect: evolutionId !== undefined ? { evolutionId } : {},
  }
}

const NO_EVOLUTIONS: ReadonlySet<string> = new Set<string>()
const LIEN: ReadonlySet<string> = new Set<string>(['khoi', 'lien'])

describe('NguKiemDaoProvider — resolveBasic', () => {
  it('resolves ngu_kiem_thuat with instances.count = kiemDaoCount and live base multiplier', () => {
    const player = makeNguPlayer()
    player.swordPath!.kiemDaoCount = 4
    player.swordPath!.kiemDaoBase = 2.2

    const provider = buildNguKiemDaoProvider(player, NO_EVOLUTIONS)
    const def = provider.resolveBasic({} as TurnBattleParticipant)

    expect(def.id).toBe('ngu_kiem_thuat')
    // M-QI-05 - the provider spreads authored damage metadata and only
    // overrides the live multiplier; levelScaling rides through.
    expect(def.damage).toEqual({ kind: 'physical', multiplier: 2.2, levelScaling: 0.05 })
    expect(def.instances?.count).toBe(4)
  })

  it('live-reads kiemDaoCount — a mid-battle forge increases the next cast', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, NO_EVOLUTIONS)

    player.swordPath!.kiemDaoCount = 3

    expect(provider.resolveBasic({} as TurnBattleParticipant).instances?.count).toBe(3)
  })
})

describe('Khoi layer — standard pipeline, no privileges', () => {
  it('a Khoi-only def carries no each-instance block and no perInstanceOptions', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, new Set<string>(['khoi']))
    const def = provider.resolveBasic({} as TurnBattleParticipant)

    expect(def.instances?.perInstanceOptions).toBeUndefined()
    expect(def.instances?.each).toBeUndefined()
    // The authored def must stay bare: no guaranteedHit/execute/crit/
    // armor privilege fields anywhere on the resolved definition.
    const serialized = JSON.stringify(def)
    expect(serialized).not.toContain('guaranteedHit')
    expect(serialized).not.toContain('execute')
    expect(serialized).not.toContain('armorPierce')
    expect(serialized).not.toContain('critChance')
  })
})

describe('Lien layer — Kiem The cast-local momentum', () => {
  it('declares each.momentumPerLandedInstance for the plan lane', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, LIEN)
    const def = provider.resolveBasic({} as TurnBattleParticipant)

    expect(def.instances?.each?.momentumPerLandedInstance).toBe(LIEN_MOMENTUM_RATE)
  })

  it('perInstanceOptions multiplies later swords by (1 + rate * landed prior swords)', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, LIEN)
    const def = provider.resolveBasic({} as TurnBattleParticipant)
    const target = makeTarget()

    // First sword: nothing landed yet -> plain instance.
    expect(def.instances!.perInstanceOptions!(0, target, 0)).toEqual({})
    // Second sword with one landed prior: +rate once.
    expect(def.instances!.perInstanceOptions!(1, target, 1)).toEqual({
      damageMultiplier: 1 + LIEN_MOMENTUM_RATE,
    })
    // Third sword with two landed priors: +rate twice — a miss adds no
    // stack, so only LANDED priors feed the multiplier.
    expect(def.instances!.perInstanceOptions!(2, target, 2)).toEqual({
      damageMultiplier: 1 + 2 * LIEN_MOMENTUM_RATE,
    })
  })

  it('still no privileges under Lien (no guaranteedHit/execute/crit/armor fields)', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, LIEN)
    const def = provider.resolveBasic({} as TurnBattleParticipant)
    const opts = def.instances!.perInstanceOptions!(1, makeTarget(), 2)

    expect(opts.guaranteedHit).toBeUndefined()
    expect(opts.critical).toBeUndefined()
    expect(opts.armorBypass).toBeUndefined()
    expect(opts.armorPierceFraction).toBeUndefined()
  })
})

describe('evolution ownership + display name', () => {
  const nodes: ProgressionNode[] = [
    evolutionNode('ngu_kiem_khoi', 'khoi'),
    evolutionNode('ngu_kiem_lien', 'lien'),
    evolutionNode('ngu_kiem_phong'), // sealed: no evolutionId
  ]

  it('collectOwnedEvolutionIds surfaces owned layers only', () => {
    const player = makeNguPlayer()
    player.nodeLevels = { ngu_kiem_khoi: 1 }
    expect([...collectOwnedEvolutionIds(player, nodes)]).toEqual(['khoi'])

    player.nodeLevels = { ngu_kiem_khoi: 1, ngu_kiem_lien: 1 }
    expect([...collectOwnedEvolutionIds(player, nodes)].sort()).toEqual(['khoi', 'lien'])

    // An unowned spine node contributes nothing; a sealed node never
    // contributes even when leveled (no evolutionId).
    player.nodeLevels = { ngu_kiem_phong: 1 }
    expect([...collectOwnedEvolutionIds(player, nodes)]).toEqual([])
  })

  it('resolveNguKiemSkillName returns the NEWEST owned evolution name', () => {
    const player = makeNguPlayer()
    expect(resolveNguKiemSkillName(player, nodes)).toBe('Ngự Kiếm')

    player.nodeLevels = { ngu_kiem_khoi: 1 }
    expect(resolveNguKiemSkillName(player, nodes)).toBe('Ngự Kiếm · khoi')

    player.nodeLevels = { ngu_kiem_khoi: 1, ngu_kiem_lien: 1 }
    expect(resolveNguKiemSkillName(player, nodes)).toBe('Ngự Kiếm · lien')
  })
})

describe('manual + cast hooks', () => {
  it('manualOptions is exactly [ngu_kiem_thuat]; resolveManualPick round-trips it', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, NO_EVOLUTIONS)

    expect(provider.manualOptions?.().map(d => d.id)).toEqual(['ngu_kiem_thuat'])
    expect(provider.resolveManualPick?.('ngu_kiem_thuat')?.id).toBe('ngu_kiem_thuat')
    expect(provider.resolveManualPick?.('orb_dam')).toBeNull()
  })

  it('onCastResolved grants +1 Kiem Y per resolved cast (domain owner)', () => {
    const player = makeNguPlayer('qi_refining')
    const provider = buildNguKiemDaoProvider(player, NO_EVOLUTIONS)
    const ctx = {
      battle: {},
      actor: {},
      resolvedSkillId: 'ngu_kiem_thuat',
      landedTargetIds: [],
      resolveBuff: () => {},
    } as never

    provider.onCastResolved?.(ctx)
    expect(player.swordPath!.kiemY).toBe(1)

    provider.onCastResolved?.(ctx)
    expect(player.swordPath!.kiemY).toBe(2)
  })

  it('casts forge Kiem Dao greedily at the realm cost and stop at the realm cap', () => {
    const player = makeNguPlayer('qi_refining')
    player.swordPath!.kiemY = forgeCost(1) - 2 // 9,997
    const provider = buildNguKiemDaoProvider(player, NO_EVOLUTIONS)
    const ctx = {
      battle: {},
      actor: {},
      resolvedSkillId: 'ngu_kiem_thuat',
      landedTargetIds: [],
      resolveBuff: () => {},
    } as never

    provider.onCastResolved?.(ctx)
    provider.onCastResolved?.(ctx)

    // 9,999 banked -> one sword forged at LQ cap 2, pool drained.
    expect(player.swordPath!.kiemDaoCount).toBe(Math.min(kiemDaoCap(1), 2))
    expect(player.swordPath!.kiemY).toBe(0)

    // At cap the forge is a NO-OP — no Y banks past the cap.
    provider.onCastResolved?.(ctx)
    expect(player.swordPath!.kiemDaoCount).toBe(kiemDaoCap(1))
    expect(player.swordPath!.kiemY).toBe(0)
  })

  it('onCastResolved returns no extra impacts', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, NO_EVOLUTIONS)

    expect(
      provider.onCastResolved?.({
        battle: {},
        actor: {},
        resolvedSkillId: 'ngu_kiem_thuat',
        landedTargetIds: [],
        resolveBuff: () => {},
      } as never),
    ).toEqual([])
  })

  it('resetForBattle exists but is a no-op (nothing battle-scoped to reset)', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, LIEN)
    expect(() => provider.resetForBattle?.()).not.toThrow()
  })
})

describe('authored def', () => {
  it('NGU_KIEM_THUAT carries no privilege fields — swords ride the standard pipeline', () => {
    const serialized = JSON.stringify(NGU_KIEM_THUAT)
    for (const field of ['guaranteedHit', 'execute', 'armorPierce', 'critChance']) {
      expect(serialized).not.toContain(field)
    }
  })
})
