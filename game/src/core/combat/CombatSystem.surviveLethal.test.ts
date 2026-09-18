import { describe, expect, it } from 'vitest'
import { CombatSystem, type SurviveEffectsPolicy, type SurviveLethalSource } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { SurviveLethalGuard } from '../talent/SurviveLethalGuard'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'
import type { EntityVitalsChangedEvent } from './EntityVitalsSystem'
// buff2 M4 — the survive-lethal session binds the battle's buff
// authority through SurviveEffectsPolicy.apply (mid-settlement ctx or
// quiescent op mint). The v4 describe block below exercises that lane
// through a shared TurnRuntimeFixture.
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'
import { buffs as LIVE_BUFFS } from '../../data/buff/buffs'
import type { BuffDefinition } from '../buff2/BuffDefinition'
import type { BuffDefinitionId, CombatEntityId, CombatOperationId } from '../battle/contracts/ids'
import type { CombatAuthorityExecutionContext } from '../battle/contracts/context'
import type { ResolvedCombatOperation } from '../battle/contracts/operations'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import {
  makeTestBuffRegistry,
  makeTurnRuntime,
  type TurnRuntimeFixture,
} from '../battle/turn/testing/TurnRuntimeFixtures'

// Thiên phú Bất Tử Thể (talent-direction-choice-plan §6) — hook tại
// CombatSystem.killIfDead(), điểm DUY NHẤT tuyên bố chết của mọi đường
// damage. Entity pattern mirror CombatSystem.manaShield.test.ts.
function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

interface SessionShape {
  guard: SurviveLethalGuard
  playerEntityId: string
  surviveEffects?: SurviveEffectsPolicy
  extraSources?: SurviveLethalSource[]
}

function createSession(talentIds: string[]): SessionShape {
  const guard = new SurviveLethalGuard()

  guard.beginBattle(talentIds)

  return { guard, playerEntityId: 'player' }
}

describe('CombatSystem — Bất Tử Thể (survive_lethal)', () => {
  it('đòn lẽ ra chết còn lượt — sống sót HP = 1, giữ alive, emit event', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    combat.setSurviveLethalSession(createSession(['bat_tu_the']))

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })

    const events: unknown[] = []
    eventBus.on('talent_survive_lethal', (event) => events.push(event))

    combat.applyDirectDamage(player, 9999, 'enemy_1')

    expect(player.currentHp).toBe(1)
    expect(player.alive).toBe(true)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ entityId: 'player', sourceId: 'enemy_1' })
  })

  it('đòn chí mạng thứ hai cùng trận — hết lượt, chết thật', () => {
    const combat = new CombatSystem(new EventBus())

    combat.setSurviveLethalSession(createSession(['bat_tu_the']))

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })

    combat.applyDirectDamage(player, 9999, 'enemy_1')
    expect(player.alive).toBe(true)

    combat.applyDirectDamage(player, 9999, 'enemy_1')

    expect(player.currentHp).toBe(0)
    expect(player.alive).toBe(false)
  })

  it('không có session — hành vi mặc định, chết ngay', () => {
    const combat = new CombatSystem(new EventBus())

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })

    combat.applyDirectDamage(player, 9999, 'enemy_1')

    expect(player.currentHp).toBe(0)
    expect(player.alive).toBe(false)
  })

  it('entity KHÔNG phải player của session — không được bảo vệ', () => {
    const combat = new CombatSystem(new EventBus())

    combat.setSurviveLethalSession(createSession(['bat_tu_the']))

    const enemy = createCombatant({ id: 'enemy_x', currentHp: 10, maxHp: 1000 })

    combat.applyDirectDamage(enemy, 9999, 'player')

    expect(enemy.currentHp).toBe(0)
    expect(enemy.alive).toBe(false)
  })

  it('trận Độ Kiếp — KHÔNG kích hoạt dù player có Bất Tử Thể (khoá theo plan §6)', () => {
    const combat = new CombatSystem(new EventBus())

    // Mirror GameManager.startTribulation(): session null — tribulation
    // never attaches a guard, so the lethal hit stands.
    combat.setSurviveLethalSession(null)

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })

    combat.applyDirectDamage(player, 9999, 'heavenly_tribulation')

    expect(player.currentHp).toBe(0)
    expect(player.alive).toBe(false)
  })

  it('đòn không chết — không tiêu lượt', () => {
    const combat = new CombatSystem(new EventBus())

    const session = createSession(['bat_tu_the'])

    combat.setSurviveLethalSession(session)

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 500, maxHp: 1000 })

    combat.applyDirectDamage(player, 100, 'enemy_1')

    expect(player.currentHp).toBe(400)
    expect(player.alive).toBe(true)
    expect(session.guard.getRemainingUses()).toBe(1)
  })

  it('guard cứu sống — event vitals CUỐI cùng phải là killed=false (hiệu chỉnh sau guard)', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    combat.setSurviveLethalSession(createSession(['bat_tu_the']))

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })

    const vitalsEvents: EntityVitalsChangedEvent[] = []
    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => vitalsEvents.push(event))

    combat.applyDirectDamage(player, 9999, 'enemy_1')

    // Event damage ban đầu mang killed=true (HP chạm 0), event hiệu chỉnh
    // 'survive_lethal' phát SAU guard phải là trạng thái cuối: còn sống.
    expect(vitalsEvents.length).toBeGreaterThanOrEqual(2)
    expect(vitalsEvents[0]?.killed).toBe(true)

    const last = vitalsEvents[vitalsEvents.length - 1]
    expect(last).toMatchObject({ entityId: 'player', reason: 'survive_lethal', killed: false, hpAfter: 1 })
  })
})

// Bất Tử Th thể v4 (spec 2026-09-03-talent-catalog-v4-design.md §4.1
// hàng 11) — guard cứu sống ngoài ra: tẩy TOÀN BỘ debuff trên player +
// áp Tử Sinh Ngộ 10s (+30% sát thương cuối, +20% né chí mạng). Session
// mở rộng trường surviveEffects — GameManager wiring set từ battle.
// buff2 M4 — surviveEffects.apply is the composition-root-bound lane:
// mid-settlement reuses the frame ctx; quiescent mints authored ops
// (same shape GameManagerTurnBattleOps binds).
describe('CombatSystem — Bất Tử Th thể v4 (survive + cleanse + Tử Sinh Ngộ)', () => {
  const participantOf = (entity: CombatEntity): TurnBattleParticipant => ({
    id: entity.id,
    entity,
    speed: 0,
    priority: 0,
    actionGauge: 0,
    alive: entity.alive,
    consecutiveHardCcTurns: 0,
  })

  function world(
    combat: CombatSystem,
    participants: TurnBattleParticipant[],
    registry: ReturnType<typeof makeTestBuffRegistry> | typeof BUFF_REGISTRY = BUFF_REGISTRY,
  ): TurnRuntimeFixture {
    return makeTurnRuntime({
      registry,
      participants: () => participants,
      combatSystem: combat,
    })
  }

  /** The composition-root-bound survive lane (mirrors
      GameManagerTurnBattleOps): mid-settlement reuses the frame ctx;
      quiescent mints authored ops and settles. */
  function bindSurviveEffects(
    runtime: TurnRuntimeFixture,
    opts: { grantBuffId?: string; cleanseDebuffs?: boolean } = {},
  ): SurviveEffectsPolicy {
    return {
      grantBuffId: opts.grantBuffId as BuffDefinitionId | undefined,
      cleanseDebuffs: opts.cleanseDebuffs,
      apply: (entity, resolved, execCtx: CombatAuthorityExecutionContext | undefined) => {
        const entityId = entity.id as CombatEntityId
        if (execCtx !== undefined) {
          if (resolved.cleanseDebuffs) {
            runtime.buffs.cleanse(entityId, { polarity: 'debuff' }, execCtx)
          }
          if (resolved.grantBuffId !== undefined) {
            runtime.buffs.apply(
              {
                definitionId: resolved.grantBuffId,
                sourceId: entityId,
                targetId: entityId,
                stacks: 1,
                baseChance: 1,
                durationOverride: resolved.grantBuffDurationOverride,
                reactionEligibility: 'eligible',
                origin: execCtx.origin,
              },
              execCtx,
            )
          }
          return
        }
        const root = `survive.test.${entity.id}`
        const origin = {
          kind: 'proc' as const,
          originId: 'survive_effects',
          sourceId: entityId,
          rootActionId: root,
        }
        const ops: ResolvedCombatOperation[] = []
        if (resolved.cleanseDebuffs) {
          ops.push({
            type: 'cleanse_buff',
            operationId: `${root}.cleanse` as CombatOperationId,
            payload: { targetId: entityId, query: { polarity: 'debuff' } },
            origin,
          })
        }
        if (resolved.grantBuffId !== undefined) {
          ops.push({
            type: 'apply_buff',
            operationId: `${root}.grant` as CombatOperationId,
            payload: {
              definitionId: resolved.grantBuffId,
              targetId: entityId,
              stacks: 1,
              baseChance: 1,
              durationOverride: resolved.grantBuffDurationOverride,
              reactionEligibility: 'eligible',
            },
            origin,
          })
        }
        runtime.scheduler.enqueueAuthored(ops)
        runtime.scheduler.runIfQuiescent()
      },
    }
  }

  const buffsOn = (runtime: TurnRuntimeFixture, entityId: string, definitionId: string) =>
    runtime.buffs.getForTarget(entityId as CombatEntityId)
      .filter((instance) => instance.definitionId === definitionId)

  it('guard cứu sống — mọi debuff bị tẩy, Tử Sinh Ngộ active trên player', () => {
    const combat = new CombatSystem(new EventBus())

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })
    const enemy = createCombatant({ id: 'enemy_1', currentHp: 100, maxHp: 100 })
    const playerP = participantOf(player)
    const enemyP = participantOf(enemy)
    const runtime = world(combat, [playerP, enemyP])

    const session = createSession(['bat_tu_the'])
    session.surviveEffects = bindSurviveEffects(runtime, {
      grantBuffId: 'tu_sinh_ngo',
      cleanseDebuffs: true,
    })
    combat.setSurviveLethalSession(session)

    // Player mang 2 debuff trước đòn chí mạng (ailment + debuff kinds —
    // the cleanse lane filters on polarity, not literal kind).
    runtime.applyBuff('trung_doc', playerP, enemyP)
    runtime.applyBuff('kiep_thuong', playerP, enemyP)
    expect(buffsOn(runtime, 'player', 'trung_doc')).toHaveLength(1)
    expect(buffsOn(runtime, 'player', 'kiep_thuong')).toHaveLength(1)

    combat.applyDirectDamage(player, 9999, 'enemy_1')

    expect(player.alive).toBe(true)
    expect(player.currentHp).toBe(1)

    // Debuff sạch, Tử Sinh Ngộ active (stacks 1).
    expect(buffsOn(runtime, 'player', 'trung_doc')).toHaveLength(0)
    expect(buffsOn(runtime, 'player', 'kiep_thuong')).toHaveLength(0)
    const granted = buffsOn(runtime, 'player', 'tu_sinh_ngo')
    expect(granted).toHaveLength(1)
    expect(granted[0]!.stacks).toBe(1)
    expect(granted[0]!.sourceId).toBe('player')
  })

  it('session KHÔNG có surviveEffects (wiring cũ/Độ Kiếp) — guard vẫn cứu, không tẩy không áp gì', () => {
    const combat = new CombatSystem(new EventBus())

    combat.setSurviveLethalSession(createSession(['bat_tu_the']))

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })

    combat.applyDirectDamage(player, 9999, 'enemy_1')

    expect(player.alive).toBe(true)
    expect(player.currentHp).toBe(1)
  })

  it('chết thật (hết lượt) — KHÔNG tẩy debuff (session có effects nhưng guard hết use)', () => {
    const combat = new CombatSystem(new EventBus())

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })
    const enemy = createCombatant({ id: 'enemy_1', currentHp: 100, maxHp: 100 })
    const playerP = participantOf(player)
    const enemyP = participantOf(enemy)
    const runtime = world(combat, [playerP, enemyP])

    const session = createSession(['bat_tu_the'])
    session.surviveEffects = bindSurviveEffects(runtime)
    combat.setSurviveLethalSession(session)

    runtime.applyBuff('trung_doc', playerP, enemyP)

    // Lần 1: guard cứu (tẩy debuff).
    combat.applyDirectDamage(player, 9999, 'enemy_1')
    expect(player.alive).toBe(true)

    // Gây lại debuff + HP về 1 lần nữa → chết thật, debuff GIỮ NGUYÊN.
    runtime.applyBuff('trung_doc', playerP, enemyP)
    player.currentHp = 10
    combat.applyDirectDamage(player, 9999, 'enemy_1')

    expect(player.alive).toBe(false)
    expect(buffsOn(runtime, 'player', 'trung_doc')).toHaveLength(1)
  })

  it('AR-18: applies custom grantBuffId and respects cleanseDebuffs policy', () => {
    const customBuff: BuffDefinition = {
      id: 'custom_phoenix_buff',
      name: 'Custom Phoenix',
      kind: 'buff',
      polarity: 'buff',
      instanceScope: 'per_source',
      stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
      lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
      statModifiers: [{ stat: 'might', percent: 0.5 }],
      dispellable: false,
    }
    const trungDoc = LIVE_BUFFS.find((def) => def.id === 'trung_doc')!
    const registry = makeTestBuffRegistry([customBuff, trungDoc])
    const combat = new CombatSystem(new EventBus())

    const player = createCombatant({ id: 'player', type: 'player', currentHp: 10, maxHp: 1000 })
    const enemy = createCombatant({ id: 'enemy_1', currentHp: 100, maxHp: 100 })
    const playerP = participantOf(player)
    const enemyP = participantOf(enemy)
    const runtime = world(combat, [playerP, enemyP], registry)

    const session: SessionShape = {
      ...createSession(['bat_tu_the']),
      surviveEffects: bindSurviveEffects(runtime, {
        grantBuffId: 'custom_phoenix_buff',
        cleanseDebuffs: false,
      }),
    }
    combat.setSurviveLethalSession(session)

    runtime.applyBuff('trung_doc', playerP, enemyP)

    combat.applyDirectDamage(player, 9999, 'enemy_1')

    expect(player.alive).toBe(true)
    expect(player.currentHp).toBe(1)
    // cleanseDebuffs: false -> debuff must NOT be cleansed
    expect(buffsOn(runtime, 'player', 'trung_doc')).toHaveLength(1)
    // custom buff applied instead of tu_sinh_ngo
    expect(buffsOn(runtime, 'player', 'custom_phoenix_buff')).toHaveLength(1)
  })
})
