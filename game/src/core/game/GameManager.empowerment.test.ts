import { describe, expect, it } from 'vitest'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS, SPELL_KIT_IDS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { SPELL_PATH_MAX_THE } from '../phap-tu/PhapTuPath'
import {
  KIM_LIET_PENETRATION_PER_STACK,
  KIM_PHAP_THE_PENETRATION_BONUS,
  PHAP_TU_TRANG_COST_PERCENT_OF_MAX,
  THUY_PHAP_THE_SECONDARY_COEFFICIENT,
  THO_PHAP_THE_SHOCKWAVE_COEFFICIENT,
} from '../../data/skill/PhapTuSkills'
import { hasResourceFor } from '../battle/turn/TurnSkillAction'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import type { ElementType } from '../element/ElementType'

// Phap Tu Reimagined (spec D1-D7) - the empowerment channel IS Phap
// The: the committed element basic carries
// `empowerment{theThreshold:5, empowered:<element rider variant>}` at
// battle build. The declare-time swap is engine machinery (checked
// before cast, no consume, no decay). The legacy empower@100 god-ult
// machinery is retired.

function makeManager() {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

function buildParticipant(element: ElementType | undefined, opts?: { learnSpecial?: boolean }) {
  const { gameManager, player } = makeManager()

  if (element !== undefined) {
    expect(gameManager.progressionOps.selectSpellPathElement(element, player)).toBe(true)
    if (opts?.learnSpecial === true) {
      // The special is learned via the Truc Co linh_ngo node; the test
      // shortcuts the node click and learns the template directly.
      const specialId = SPELL_KIT_IDS[element][1]
      const template = SKILLS.find((s) => s.id === specialId)
      expect(template).toBeDefined()
      gameManager.skillSystem.learn(template!)
    }
  }

  const enemy = defineEnemy({
    id: 'phap_the_dummy',
    name: 'Phap The Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1_000_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
      evasionRate: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })

  gameManager.startBattleWithPlayer(player, enemy)

  return gameManager.getTurnBattle()!.players[0]!
}

function buildWith(element: ElementType | undefined) {
  return buildParticipant(element).basic!
}

describe('Phap The empowerment attach (spec D1-D7)', () => {
  it('pre-commit basic carries the +1 The gain but NO rider (no element, no Phap The)', () => {
    const basic = buildWith(undefined)

    expect(basic.theGainOnLandedCast).toBe(1)
    expect(basic.empowerment).toBeUndefined()
  })

  it('committed element basic carries empowerment at the flat cap of 5', () => {
    const basic = buildWith('fire')

    expect(basic.empowerment?.theThreshold).toBe(SPELL_PATH_MAX_THE)
    expect(SPELL_PATH_MAX_THE).toBe(5)
    expect(basic.empowerment?.empowered.id).toBe(basic.id)
    // The variant burns nothing: no consumesAllThe pool drain.
    expect(basic.empowerment?.empowered.consumesAllThe).toBeUndefined()
  })

  it('fire variant pulses a pre-existing own-source ailment once (no consume)', () => {
    const empowered = buildWith('fire').empowerment!.empowered
    const pulse = empowered.landedConsequences?.find(
      (op) => op.type === 'trigger_buff_periodic',
    )

    expect(pulse).toBeDefined()
    expect(pulse!.type === 'trigger_buff_periodic' && pulse!.selector.kind === 'identity').toBe(true)
    if (pulse!.type === 'trigger_buff_periodic' && pulse!.selector.kind === 'identity') {
      expect(pulse!.selector.source).toBe('self')
      expect(pulse!.selector.target).toBe('loop_target')
    }
  })

  it('water variant fires one secondary hit on a DIFFERENT enemy carrying the base ailment', () => {
    const empowered = buildWith('water').empowerment!.empowered
    // The authored rider nests the secondary hit inside a
    // target_hit_landed gate (data-owned payload).
    const gate = empowered.landedConsequences?.find((op) => op.type === 'if')

    expect(gate).toBeDefined()
    if (gate!.type === 'if') {
      expect(gate!.condition.kind).toBe('target_hit_landed')
      const secondary = gate!.then.find((op) => op.type === 'deal_damage')
      expect(secondary).toBeDefined()
      if (secondary!.type === 'deal_damage') {
        expect(secondary!.target).toBe('other_enemy')
        expect(secondary!.coefficient).toBe(THUY_PHAP_THE_SECONDARY_COEFFICIENT)
        expect(secondary!.components).toEqual([{ kind: 'element', element: 'water', ratio: 1 }])
        // The secondary re-applies the element ailment on its own target.
        expect(secondary!.onLanded?.every((op) => op.type === 'apply_buff')).toBe(true)
        expect(secondary!.onLanded?.length).toBeGreaterThan(0)
      }
    }
  })

  it('earth variant fires one non-recursive shockwave on every other enemy', () => {
    const empowered = buildWith('earth').empowerment!.empowered
    const shockwave = empowered.landedConsequences?.find(
      (op) => op.type === 'deal_damage',
    )

    expect(shockwave).toBeDefined()
    if (shockwave!.type === 'deal_damage') {
      expect(shockwave!.target).toBe('other_enemies')
      expect(shockwave!.coefficient).toBe(THO_PHAP_THE_SHOCKWAVE_COEFFICIENT)
      // Non-recursive by construction: no landed children.
      expect(shockwave!.onLanded).toBeUndefined()
    }
  })

  it('wood variant applies the base ailment with +1 stack', () => {
    const basic = buildWith('wood')
    const empowered = basic.empowerment!.empowered

    const baseStacks = basic.appliesAilments?.[0]?.stacks ?? 1
    expect(empowered.appliesAilments?.[0]?.stacks).toBe(baseStacks + 1)
  })

  it('metal variant carries the skill-local penetration bonus', () => {
    const empowered = buildWith('metal').empowerment!.empowered

    expect(empowered.elementalPenetrationBonus).toBe(KIM_PHAP_THE_PENETRATION_BONUS)
  })
})

// Resolve-seam attaches (spec D8/D10/D11) - the constants in
// PhapTuSkills are dead data until the spell-pathway resolve seam
// stamps them on the converted defs. These pins hold the attach sites.
describe('resolve-seam attaches (window lane / Kim Liet pierce / Trang cost)', () => {
  it('kit basic carries the element WINDOW landed lane; the empowered variant inherits it', () => {
    const basic = buildWith('earth')
    const trongGate = basic.landedConsequences?.find(
      (op) => op.type === 'if' && op.condition.kind === 'stacks_at_least',
    )
    expect(trongGate).toBeDefined()

    const empowered = basic.empowerment!.empowered
    // Rider ops prepend; the window lane must still be present after them.
    expect(
      empowered.landedConsequences?.some(
        (op) => op.type === 'if' && op.condition.kind === 'stacks_at_least',
      ),
    ).toBe(true)
  })

  it('wood kit basic carries the sinh_co window lane (latch + plant ops present)', () => {
    const basic = buildWith('wood')
    const vanMocGate = basic.landedConsequences?.find(
      (op) =>
        op.type === 'if' &&
        op.condition.kind === 'stacks_at_least' &&
        op.condition.definitionId === 'van_moc',
    )
    expect(vanMocGate).toBeDefined()
    if (vanMocGate!.type === 'if') {
      const latch = vanMocGate.then.find((op) => op.type === 'if')
      expect(latch?.type === 'if' && latch.condition.kind === 'stacks_below').toBe(true)
    }
  })

  it('metal kit basic + empowered carry the Kim Liet per-stack pierce', () => {
    const basic = buildWith('metal')
    expect(basic.penetrationFromStacks).toEqual({
      ailmentId: 'kim_liet',
      perStack: KIM_LIET_PENETRATION_PER_STACK,
    })
    expect(basic.empowerment!.empowered.penetrationFromStacks).toEqual({
      ailmentId: 'kim_liet',
      perStack: KIM_LIET_PENETRATION_PER_STACK,
    })
  })

  it('empowered variant still mints +1 The (theGainOnLandedCast inherited)', () => {
    const empowered = buildWith('fire').empowerment!.empowered
    expect(empowered.theGainOnLandedCast).toBe(1)
  })

  it('special carries the live 30%-of-max Linh Luc cost and gates on it', () => {
    const participant = buildParticipant('water', { learnSpecial: true })
    const special = participant.special?.skill
    expect(special).toBeDefined()
    expect(special?.resourceCostPercentOfMax).toBe(PHAP_TU_TRANG_COST_PERCENT_OF_MAX)

    const entity = participant.entity
    entity.currentMp = entity.stats.maxMp
    expect(hasResourceFor(entity, special!)).toBe(true)
    entity.currentMp = 0
    expect(hasResourceFor(entity, special!)).toBe(false)
  })

  it('starter-fallback basic (pre-commit) carries no window lane', () => {
    const basic = buildWith(undefined)
    expect(
      (basic.landedConsequences ?? []).every(
        (op) => !(op.type === 'if' && op.condition.kind === 'stacks_at_least'),
      ),
    ).toBe(true)
    expect(basic.penetrationFromStacks).toBeUndefined()
  })
})
