import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../player/Player'
import { freshSwordPathState } from './KiemTuState'
import {
  CASCADE_CRIT_CHANCE,
  CASCADE_PIERCE_CHANCE,
  EXECUTE_MULT,
  PIERCE_FRACTION,
  forgeCost,
} from './NguKiemDao'
import { buildNguKiemDaoProvider } from './NguKiemDaoProvider'
import {
  KIEM_DAO_CASCADE_EMBLEM,
  NGU_KIEM_THUAT,
  TU_KIEM_Y_EMBLEM,
} from '../../data/skill/NguKiemDaoSkills'
import { selectAction, selectForcedAction } from '../battle/turn/TurnSkillAction'
import type { CombatEntity } from '../combat/CombatEntity'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'

// Kiem Tu Reimagined Task 9 (spec §5.2) — the ngu provider contract:
// kiemDaoCount independent swords, guaranteedHit always, live Roll
// Cascade per instance (a=execute threshold, e=crit roll, d=armor roll),
// +1 Kiem Y per resolved cast via onCastResolved.

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

describe('NguKiemDaoProvider — resolveBasic', () => {
  it('resolves ngu_kiem_thuat with instances.count = kiemDaoCount and base multiplier', () => {
    const player = makeNguPlayer()
    player.swordPath!.kiemDaoCount = 4
    player.swordPath!.kiemDaoBase = 2.2

    const provider = buildNguKiemDaoProvider(player, { a: false, e: false, d: false })
    const def = provider.resolveBasic({} as TurnBattleParticipant)

    expect(def.id).toBe('ngu_kiem_thuat')
    // M-QI-05 - the provider spreads authored damage metadata and only
    // overrides the live multiplier; levelScaling rides through.
    expect(def.damage).toEqual({ kind: 'physical', multiplier: 2.2, levelScaling: 0.05 })
    expect(def.instances?.count).toBe(4)
  })

  it('live-reads kiemDaoCount — mid-battle forge increases the next cast', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, { a: false, e: false, d: false })

    player.swordPath!.kiemDaoCount = 3

    expect(provider.resolveBasic({} as TurnBattleParticipant).instances?.count).toBe(3)
  })
})

describe('perInstanceOptions — spec §5.2 Roll Cascade', () => {
  it('guaranteedHit always; locked a/e/d → no scale, no forced crit, no armor policy', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, { a: false, e: false, d: false })
    const def = provider.resolveBasic({} as TurnBattleParticipant)
    const target = makeTarget({ currentHp: 10, maxHp: 100 }) // 10% — under any threshold

    const opts = def.instances!.perInstanceOptions!(0, target)

    expect(opts.guaranteedHit).toBe(true)
    expect(opts.damageMultiplier).toBeUndefined()
    expect(opts.critical).toBeUndefined()
    expect(opts.armorBypass).toBeUndefined()
    expect(opts.armorPierceFraction).toBeUndefined()
  })

  it('a unlocked: execute fires when target hp% < min(0.5, 0.1*realmIndex)', () => {
    const player = makeNguPlayer('golden_core') // realmIndex 3 → threshold 0.3
    const provider = buildNguKiemDaoProvider(player, { a: true, e: false, d: false })
    const def = provider.resolveBasic({} as TurnBattleParticipant)

    const under = def.instances!.perInstanceOptions!(0, makeTarget({ currentHp: 29, maxHp: 100 }))
    expect(under.damageMultiplier).toBe(EXECUTE_MULT)

    const over = def.instances!.perInstanceOptions!(1, makeTarget({ currentHp: 31, maxHp: 100 }))
    expect(over.damageMultiplier).toBeUndefined()
  })

  it('execute threshold reads LIVE hp — an earlier sword that digs the target below threshold enables the next', () => {
    const player = makeNguPlayer('golden_core')
    const provider = buildNguKiemDaoProvider(player, { a: true, e: false, d: false })
    const def = provider.resolveBasic({} as TurnBattleParticipant)
    const target = makeTarget({ currentHp: 31, maxHp: 100 })

    expect(def.instances!.perInstanceOptions!(0, target).damageMultiplier).toBeUndefined()

    target.currentHp = 29 // the first sword's damage landed

    expect(def.instances!.perInstanceOptions!(1, target).damageMultiplier).toBe(EXECUTE_MULT)
  })

  it('e unlocked: crit roll through injected rng — success forces critical', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(
      player,
      { a: false, e: true, d: false },
      () => CASCADE_CRIT_CHANCE - 0.001,
    )
    const def = provider.resolveBasic({} as TurnBattleParticipant)

    expect(def.instances!.perInstanceOptions!(0, makeTarget()).critical).toBe(true)

    const failing = buildNguKiemDaoProvider(
      player,
      { a: false, e: true, d: false },
      () => CASCADE_CRIT_CHANCE + 0.001,
    )
    const failDef = failing.resolveBasic({} as TurnBattleParticipant)
    expect(failDef.instances!.perInstanceOptions!(0, makeTarget()).critical).toBeUndefined()
  })

  it('d unlocked: success bypasses armor fully, fail pierces PIERCE_FRACTION', () => {
    const player = makeNguPlayer()
    const success = buildNguKiemDaoProvider(
      player,
      { a: false, e: false, d: true },
      () => CASCADE_PIERCE_CHANCE - 0.001,
    )
    const successDef = success.resolveBasic({} as TurnBattleParticipant)
    expect(successDef.instances!.perInstanceOptions!(0, makeTarget()).armorBypass).toBe(true)

    const fail = buildNguKiemDaoProvider(
      player,
      { a: false, e: false, d: true },
      () => CASCADE_PIERCE_CHANCE + 0.001,
    )
    const failDef = fail.resolveBasic({} as TurnBattleParticipant)
    const opts = failDef.instances!.perInstanceOptions!(0, makeTarget())
    expect(opts.armorBypass).toBeUndefined()
    expect(opts.armorPierceFraction).toBe(PIERCE_FRACTION)
  })
})

describe('manual + cast hooks', () => {
  it('manualOptions is exactly [ngu_kiem_thuat]; resolveManualPick round-trips it', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, { a: false, e: false, d: false })

    expect(provider.manualOptions?.().map(d => d.id)).toEqual(['ngu_kiem_thuat'])
    expect(provider.resolveManualPick?.('ngu_kiem_thuat')?.id).toBe('ngu_kiem_thuat')
    expect(provider.resolveManualPick?.('orb_dam')).toBeNull()
  })

  it('onCastResolved grants +1 Kiem Y per resolved cast (domain owner)', () => {
    const player = makeNguPlayer('qi_refining')
    const provider = buildNguKiemDaoProvider(player, { a: false, e: false, d: false })
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

  it('onCastResolved returns no extra impacts (ngu has no combos)', () => {
    const player = makeNguPlayer()
    const provider = buildNguKiemDaoProvider(player, { a: false, e: false, d: false })

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
})

describe('emblem defs', () => {
  it('emblems carry emblemOnly and are never selected as actions', () => {
    expect(TU_KIEM_Y_EMBLEM.emblemOnly).toBe(true)
    expect(KIEM_DAO_CASCADE_EMBLEM.emblemOnly).toBe(true)

    const participant = {
      entity: makeTarget(),
      basic: { id: 'basic_x', cooldownTurns: 0, targeting: { shape: 'single' as const } },
      special: { skill: TU_KIEM_Y_EMBLEM, remainingCooldownTurns: 0 },
      ultimate: { skill: KIEM_DAO_CASCADE_EMBLEM, remainingCooldownTurns: 0 },
    } as unknown as TurnBattleParticipant

    // selectAction must fall through to basic — emblem slots are display markers.
    expect(selectAction(participant).skillId).toBe('basic_x')
    expect(selectForcedAction(participant, 'special').skillId).toBe('basic_x')
    expect(selectForcedAction(participant, 'ultimate').skillId).toBe('basic_x')
  })
})
