// TurnBattleSystem.camCong.test.ts -- megaplan M4 step 4 (spec sec.81
// / contract sec.101): Cấm Công as an action-tag restriction inside the
// live turn-selection path. The seal forbids 'attack'-tagged actions
// only -- heal/buff/cleanse actions stay legal, a fully-sealed actor
// declares an EMPTY turn (action null, skillId '', NOT ccBlocked).

import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { Buff, BuffDefinition, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { BuffPool } from '../../buff/BuffPool'

const CAM_CONG: BuffDefinition = {
  id: 'test_cam_cong',
  name: 'Cam Cong',
  polarity: 'debuff',
  duration: 2,
  stackMode: 'refresh',
  effects: [],
  forbiddenActionTags: ['attack'],
}

const CATALOG = new (class implements BuffDefinitionCatalog {
  get(id: string): BuffDefinition {
    if (id === CAM_CONG.id) return CAM_CONG
    throw new Error(`unknown buff id "${id}"`)
  }
})()

function createCombatant(id: string): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 10 })
  return {
    id,
    name: id,
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: 1_000,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  } as CombatEntity
}

function makeParticipant(id: string): TurnBattleParticipant {
  const entity = createCombatant(id)
  return {
    id,
    entity,
    speed: 10,
    priority: 0,
    actionGauge: 0,
    alive: true,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

function seal(participant: TurnBattleParticipant): void {
  const instance: Buff = {
    id: CAM_CONG.id,
    sourceId: 'source',
    targetId: participant.id,
    polarity: 'debuff',
    duration: 2,
    remainingTurns: 2,
    stacks: 1,
    stackMode: 'refresh',
    effects: [],
  }
  participant.buffs.add(instance)
}

function attackSkill(id: string): TurnSkillDefinition {
  return {
    id,
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }
}

function healSkill(id: string): TurnSkillDefinition {
  return {
    id,
    cooldownTurns: 0,
    targeting: { shape: 'single' },
    targetScope: 'self',
    actionTags: ['heal'],
  }
}

function makeBattle(actor: TurnBattleParticipant): TurnBattle {
  const victim = makeParticipant('victim')
  victim.basic = attackSkill('noop')
  return { players: [actor], enemies: [victim], state: 'fighting' }
}

function system(): TurnBattleSystem {
  return new TurnBattleSystem(new CombatSystem(new EventBus()), 10, CATALOG)
}

describe('Cam Cong -- forbiddenActionTags restriction (spec sec.81)', () => {
  it("forced 'basic' pick is rejected and falls back to the legal special", () => {
    const actor = makeParticipant('sealed')
    actor.basic = attackSkill('basic_hit')
    actor.special = { skill: healSkill('self_heal'), remainingCooldownTurns: 0 }
    seal(actor)

    const declared = system().declareActorAction(
      makeBattle(actor),
      actor,
      'basic',
    )
    expect(declared.action?.skillId).toBe('self_heal')
    expect(declared.ccBlocked).toBe(false)
  })

  it('sealed actor with only attacks yields an empty turn (R-E)', () => {
    const actor = makeParticipant('sealed')
    actor.basic = attackSkill('only_attack')
    seal(actor)

    const declared = system().declareActorAction(makeBattle(actor), actor)
    expect(declared.action).toBeNull()
    expect(declared.skillId).toBe('')
    expect(declared.ccBlocked).toBe(false) // restriction, not a stun
    expect(declared.affected).toEqual([])
    expect(declared.scaledDamage).toBeNull()
    expect(declared.execution).toBeUndefined()
    // Cadence preserved: the actor still consumed a normal declare.
  })

  it('heal/buff/cleanse-tagged actions remain legal under the seal', () => {
    for (const tag of ['heal', 'buff', 'cleanse']) {
      const actor = makeParticipant(`sealed_${tag}`)
      actor.basic = attackSkill('basic_hit')
      actor.special = {
        skill: {
          id: `tagged_${tag}`,
          cooldownTurns: 0,
          targeting: { shape: 'single' },
          targetScope: 'self',
          actionTags: [tag],
        },
        remainingCooldownTurns: 0,
      }
      seal(actor)

      const declared = system().declareActorAction(makeBattle(actor), actor)
      expect(declared.action?.skillId).toBe(`tagged_${tag}`)
    }
  })

  it('an untagged damageless action is also legal (no inferred attack)', () => {
    const actor = makeParticipant('sealed')
    actor.basic = attackSkill('basic_hit')
    actor.special = {
      skill: {
        id: 'ward',
        cooldownTurns: 0,
        targeting: { shape: 'single' },
        targetScope: 'self',
        // no damage, no actionTags -> inferred [] -> always legal
      },
      remainingCooldownTurns: 0,
    }
    seal(actor)

    const declared = system().declareActorAction(makeBattle(actor), actor)
    expect(declared.action?.skillId).toBe('ward')
  })

  it('unsealed actor selection is unchanged (regression guard)', () => {
    const actor = makeParticipant('free')
    actor.basic = attackSkill('basic_hit')
    actor.ultimate = {
      skill: attackSkill('the_ult'),
      remainingCooldownTurns: 0,
    }
    // No seal -- priority order still picks the ultimate.
    const declared = system().declareActorAction(makeBattle(actor), actor)
    expect(declared.action?.skillId).toBe('the_ult')
  })

  it('empowered payload swaps cannot launder an attack through a legal root', () => {
    // Adversarial seam (M4 QA): the seal is checked at selection on the
    // ROOT def's tags -- an empowerment swap resolving to an attack
    // payload would bypass it unless the resolved payload is checked
    // too. Root carries ['buff'] tags; the empowered form deals damage.
    const actor = makeParticipant('sealed')
    actor.entity.currentThe = 100
    actor.ultimate = {
      skill: {
        id: 'ward_ult',
        cooldownTurns: 0,
        targeting: { shape: 'single' },
        targetScope: 'self',
        actionTags: ['buff'],
        empowerment: {
          theThreshold: 50,
          empowered: attackSkill('empowered_nuke'),
        },
      },
      remainingCooldownTurns: 0,
    }
    actor.basic = attackSkill('basic_hit')
    seal(actor)

    const declared = system().declareActorAction(makeBattle(actor), actor)
    // The resolved payload IS an attack -- the whole action collapses
    // to the sealed empty turn; nothing falls back to a hidden swing.
    expect(declared.action).toBeNull()
    expect(declared.skillId).toBe('')
    expect(declared.affected).toEqual([])
  })

  it('seal expires with the buff instance (fresh declare re-allows)', () => {
    const actor = makeParticipant('sealed')
    actor.basic = attackSkill('basic_hit')
    seal(actor)
    // The instance decays: simulate expiry by clearing the pool entry.
    actor.buffs.clear()

    const declared = system().declareActorAction(makeBattle(actor), actor)
    expect(declared.action?.skillId).toBe('basic_hit')
  })
})
