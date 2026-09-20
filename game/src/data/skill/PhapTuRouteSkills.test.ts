import { describe, expect, it } from 'vitest'

import type { BuffDefinitionId, CombatEntityId } from '../../core/battle/contracts/ids'
import type { EffectiveSkill } from '../../core/skill/SkillSystem'
import type { Skill } from '../../core/skill/Skill'

import { SKILLS, PHAP_TU_KIT_IDS, PHAP_TU_ROUTE_SKILL_IDS } from './Skills'
import { PHAP_TU_ROUTE_SKILLS } from './PhapTuRouteSkills'
import {
  adaptSkill,
  adaptTurnSkillDefinition,
  toTurnSkillDefinition,
} from '../../core/skilldef/LegacySkillAdapter'
import type { AuthoredSkillOperation } from '../../core/skilldef/AuthoredOperation'
import {
  NEUTRAL_ROUTE_PROFILE,
  PHAP_TU_ROUTES,
  applyRouteToEffectiveSkill,
  applyRouteToTurnSkill,
} from '../../core/phap-tu/PhapTuRoutes'
import {
  ENEMY_A,
  PLAYER,
  makeHarness,
  makeInput,
  seedBuff,
  spawn,
} from '../../core/skilldef/SkillExecutor.testkit'

const byId = new Map(PHAP_TU_ROUTE_SKILLS.map((s) => [s.id, s]))
const skill = (id: string): Skill => byId.get(id)!
const effectiveOf = (s: Skill): EffectiveSkill => ({ effects: s.effects })
const turnDefOf = (id: string) => toTurnSkillDefinition(skill(id), effectiveOf(skill(id)))
const rootOf = (id: string) => adaptTurnSkillDefinition(turnDefOf(id)).root
const opsOf = (root: { operations: readonly AuthoredSkillOperation[] }) => root.operations

const dealDamage = (ops: readonly AuthoredSkillOperation[]) =>
  ops.find((op) => op.type === 'deal_damage')!

describe('PhapTuRouteSkills -- catalog membership', () => {
  it('registers exactly the four Hoa seal skills in SKILLS + route ids', () => {
    const ids = PHAP_TU_ROUTE_SKILLS.map((s) => s.id)
    expect(ids).toEqual([
      'dan_hoa_quyet',
      'xich_viem_xuyen_tam',
      'phan_thien_hoa_vuc',
      'cuu_tieu_viem_bao',
    ])
    for (const id of ids) {
      expect(SKILLS.find((s) => s.id === id)).toBeDefined()
    }
    expect(PHAP_TU_ROUTE_SKILL_IDS.fire).toEqual(ids)
    // the [basic, special, ultimate] kit slots stay untouched.
    expect(PHAP_TU_KIT_IDS.fire).toEqual([
      'hoa_cau_thuat',
      'tam_muoi_chan_hoa',
      'hoa_ha_cuu_thien',
    ])
  })

  it('every skill adapts with zero unsupported semantics (no escape hatch)', () => {
    for (const s of PHAP_TU_ROUTE_SKILLS) {
      const catalog = adaptSkill(s, effectiveOf(s))
      expect(catalog.unsupported, `${s.id} unsupported`).toEqual([])
      expect(catalog.root.adapterUnsupportedMetadata ?? [], s.id).toEqual([])
    }
  })
})

describe('PhapTuRouteSkills -- conversion (Skill -> TurnSkillDefinition)', () => {
  it('dan_hoa_quyet: fire damage + hoa_an application at 0.7', () => {
    const turnSkill = turnDefOf('dan_hoa_quyet')
    expect(turnSkill.damage).toMatchObject({ kind: 'elemental', multiplier: 1.1 })
    expect(turnSkill.appliesAilments).toEqual([
      { buffDefinitionId: 'hoa_an', chance: 0.7 },
    ])
  })

  it('xich_viem_xuyen_tam: same-source scale + DoT-gated next-tick interaction', () => {
    const turnSkill = turnDefOf('xich_viem_xuyen_tam')
    expect(turnSkill.scalesWithAilmentStacks).toEqual({
      ailmentId: 'hoa_an',
      damagePerStack: 0.15,
    })
    expect(turnSkill.ailmentInteractions).toEqual([
      {
        kind: 'add_modifier',
        buffId: 'hoa_an',
        routes: ['dot'],
        modifier: {
          id: 'xich_viem_next_tick',
          channel: 'next_periodic_damage',
          operation: 'multiply',
          value: 1.5,
          reapply: 'replace',
          priority: 0,
          lifetime: { type: 'uses', remaining: 1 },
        },
      },
    ])
  })

  it('phan_thien_hoa_vuc: authored interaction order tick -> potency -> extend', () => {
    const turnSkill = turnDefOf('phan_thien_hoa_vuc')
    expect(turnSkill.ailmentInteractions?.map((i) => i.kind)).toEqual([
      'trigger_periodic',
      'add_modifier',
      'extend_duration',
    ])
    expect(turnSkill.appliesAilments).toEqual([
      { buffDefinitionId: 'hoa_an', chance: 0.7 },
    ])
    expect(turnSkill.targeting).toEqual({ shape: 'square', laneRadius: 1 })
  })

  it('cuu_tieu_viem_bao: same-source consume', () => {
    const turnSkill = turnDefOf('cuu_tieu_viem_bao')
    expect(turnSkill.consumesAilmentId).toBe('hoa_an')
    expect(turnSkill.damagePerStack).toBe(35)
    expect(turnSkill.consumesAilmentScope).toBe('own')
  })
})

describe('PhapTuRouteSkills -- adapted authored ops', () => {
  it('dan_hoa_quyet: deal_damage with eligible hoa_an apply inside onLanded', () => {
    const hit = dealDamage(opsOf(rootOf('dan_hoa_quyet')))
    expect(hit).toMatchObject({
      type: 'deal_damage',
      coefficient: 1.1,
      components: [{ kind: 'element', element: 'fire', ratio: 1 }],
      onLanded: [
        {
          type: 'apply_buff',
          target: 'loop_target',
          definitionId: 'hoa_an',
          reactionEligibility: 'eligible',
          chance: 0.7,
        },
      ],
    })
  })

  it('xich_viem_xuyen_tam: scaleBuff own + next-tick modifier on identity selector', () => {
    const hit = dealDamage(opsOf(rootOf('xich_viem_xuyen_tam')))
    expect(hit).toMatchObject({
      scaleBuff: { definitionId: 'hoa_an', damagePerStack: 0.15, scope: 'own' },
      onLanded: [
        {
          type: 'add_buff_modifier',
          selector: {
            kind: 'identity',
            definitionId: 'hoa_an',
            source: 'self',
            target: 'loop_target',
          },
          modifier: {
            id: 'xich_viem_next_tick',
            channel: 'next_periodic_damage',
            operation: 'multiply',
            value: 1.5,
            lifetime: { type: 'uses', remaining: 1 },
          },
        },
      ],
    })
    // Nổ lane consumes nothing, modifies nothing.
    expect('consumeBuff' in hit).toBe(false)
  })

  it('phan_thien_hoa_vuc: apply -> tick -> potency -> extend inside one landed gate', () => {
    const hit = dealDamage(opsOf(rootOf('phan_thien_hoa_vuc')))
    const onLanded = (hit as { onLanded?: AuthoredSkillOperation[] }).onLanded!
    expect(onLanded.map((op) => op.type)).toEqual([
      'apply_buff',
      'trigger_buff_periodic',
      'add_buff_modifier',
      'extend_buff_duration',
    ])
    expect(onLanded[0]).toMatchObject({
      definitionId: 'hoa_an',
      reactionEligibility: 'eligible',
      chance: 0.7,
    })
    // every buff-targeting op binds the caster's OWN instance AND is
    // result-gated on the apply (spec sec.11/36): a resisted reapply
    // must not tick/modify/extend the stale instance.
    for (const op of onLanded.slice(1)) {
      expect((op as { selector: object }).selector).toEqual({
        kind: 'identity',
        definitionId: 'hoa_an',
        source: 'self',
        target: 'loop_target',
      })
      expect((op as { gateOnApplyResult?: boolean }).gateOnApplyResult).toBe(true)
    }
    expect(onLanded[2]).toMatchObject({
      modifier: {
        id: 'phan_thien_potency',
        channel: 'potency',
        operation: 'multiply',
        value: 1.5,
        lifetime: { type: 'holder_turns', remaining: 2 },
      },
    })
    expect(onLanded[3]).toMatchObject({ turns: 2 })
  })

  it('cuu_tieu_viem_bao: consumeBuff scoped own', () => {
    const hit = dealDamage(opsOf(rootOf('cuu_tieu_viem_bao')))
    expect(hit).toMatchObject({
      consumeBuff: { definitionId: 'hoa_an', damagePerStack: 35, scope: 'own' },
    })
  })
})

describe('PhapTuRouteSkills -- route seam', () => {
  it('dot route keeps the routes:[dot] interaction; no route and neutral strip it', () => {
    const turnSkill = turnDefOf('xich_viem_xuyen_tam')

    const dot = applyRouteToTurnSkill(turnSkill, PHAP_TU_ROUTES.dot)
    expect(dot.ailmentInteractions).toHaveLength(1)

    const no = applyRouteToTurnSkill(turnSkill, PHAP_TU_ROUTES.no)
    expect(no.ailmentInteractions).toEqual([])

    const neutral = applyRouteToTurnSkill(turnSkill, NEUTRAL_ROUTE_PROFILE)
    expect(neutral.ailmentInteractions).toEqual([])

    // the stripped 'no' payload adapts to a pure scaleBuff hit -- the
    // modifier never reaches a Nổ player's plan.
    const noHit = dealDamage(opsOf(adaptTurnSkillDefinition(no).root))
    expect((noHit as { onLanded?: unknown[] }).onLanded ?? []).toEqual([])
  })

  it('non-gated interactions (phan_thien) survive every route', () => {
    const turnSkill = turnDefOf('phan_thien_hoa_vuc')
    for (const profile of [PHAP_TU_ROUTES.dot, PHAP_TU_ROUTES.no, NEUTRAL_ROUTE_PROFILE]) {
      expect(applyRouteToTurnSkill(turnSkill, profile).ailmentInteractions).toHaveLength(3)
    }
  })

  it('dot route adds +1 stack to seal applications; no route does not', () => {
    const turnSkill = turnDefOf('dan_hoa_quyet')
    const dot = applyRouteToTurnSkill(turnSkill, PHAP_TU_ROUTES.dot)
    expect(dot.appliesAilments).toEqual([{ buffDefinitionId: 'hoa_an', chance: 0.7, stacks: 2 }])
    const no = applyRouteToTurnSkill(turnSkill, PHAP_TU_ROUTES.no)
    expect(no.appliesAilments).toEqual([{ buffDefinitionId: 'hoa_an', chance: 0.7 }])
  })

  it('effective seam scales ailment chance and direct damage per route', () => {
    const eff = effectiveOf(skill('dan_hoa_quyet'))
    const dot = applyRouteToEffectiveSkill(eff, PHAP_TU_ROUTES.dot)
    expect(dot.effects[0]).toMatchObject({ type: 'damage', value: 1.1 * 0.85 })
    expect(dot.effects[1]).toMatchObject({ type: 'debuff', ailmentChance: 0.7 * 1.25 })
    const no = applyRouteToEffectiveSkill(eff, PHAP_TU_ROUTES.no)
    expect(no.effects[0]).toMatchObject({ value: 1.1 * 1.15 })
    expect(no.effects[1]).toMatchObject({ ailmentChance: 0.7 * 0.5 })
  })
})

describe('PhapTuRouteSkills -- execution (real scheduler, fake authorities)', () => {
  const OTHER = 'entity.other.caster' as CombatEntityId

  it('dan_hoa_quyet applies an own-source hoa_an instance on the hit target', () => {
    const def = rootOf('dan_hoa_quyet')
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    harness.executor.execute(harness.resolver.resolve(makeInput(def)), makeInput(def))

    const seal = harness.state.buffs.find((b) => b.definitionId === 'hoa_an')
    expect(seal).toMatchObject({
      definitionId: 'hoa_an',
      targetId: ENEMY_A,
      sourceId: PLAYER,
      stacks: 1,
    })
    expect(harness.state.executedOps.map((o) => o.type)).toEqual([
      'deal_damage',
      'apply_buff',
    ])
  })

  it('xich_viem_xuyen_tam folds ONLY same-source stacks into the hit coefficient', () => {
    const def = rootOf('xich_viem_xuyen_tam')
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    spawn(harness, OTHER)
    seedBuff(harness, {
      definitionId: 'hoa_an' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 3,
      hasPeriodic: true,
      dispellable: false,
    })
    seedBuff(harness, {
      definitionId: 'hoa_an' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: OTHER,
      kind: 'ailment',
      stacks: 2,
      hasPeriodic: true,
      dispellable: false,
    })

    harness.executor.execute(harness.resolver.resolve(makeInput(def)), makeInput(def))

    // coefficient = 1.3 + 3 x 0.15 = 1.75 (other caster's 2 stacks ignored);
    // fake authority hpDamage = coefficient x 10.
    expect(harness.state.hp.get(ENEMY_A)!.hp).toBeCloseTo(100 - 17.5)
    // the seal is read, never touched.
    expect(harness.state.buffs.map((b) => b.stacks)).toEqual([3, 2])
    expect(harness.state.executedOps.some((o) => o.type === 'consume_buff_stacks')).toBe(false)
  })

  it('xich_viem DoT payload adds xich_viem_next_tick onto the own-source instance', () => {
    const dotTurn = applyRouteToTurnSkill(turnDefOf('xich_viem_xuyen_tam'), PHAP_TU_ROUTES.dot)
    const def = adaptTurnSkillDefinition(dotTurn).root
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    harness.executor.execute(harness.resolver.resolve(makeInput(def)), makeInput(def))

    const modOp = harness.state.executedOps.find((o) => o.type === 'add_buff_modifier')!
    expect(modOp).toMatchObject({
      type: 'add_buff_modifier',
      payload: {
        selector: {
          kind: 'identity',
          definitionId: 'hoa_an',
          sourceId: PLAYER,
          targetId: ENEMY_A,
        },
        modifier: {
          id: 'xich_viem_next_tick',
          channel: 'next_periodic_damage',
          operation: 'multiply',
          value: 1.5,
          lifetime: { type: 'uses', remaining: 1 },
          appliedBy: PLAYER,
        },
      },
    })
  })

  it('phan_thien_hoa_vuc executes apply -> tick -> potency -> extend in order', () => {
    const def = rootOf('phan_thien_hoa_vuc')
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    harness.executor.execute(harness.resolver.resolve(makeInput(def)), makeInput(def))

    expect(harness.state.executedOps.map((o) => o.type)).toEqual([
      'deal_damage',
      'apply_buff',
      'trigger_buff_periodic',
      'add_buff_modifier',
      'extend_buff_duration',
    ])
    const [apply, tick, mod, extend] = harness.state.executedOps.slice(1)
    expect(apply?.payload).toMatchObject({ definitionId: 'hoa_an' })
    // The gated continuations bind the EXACT instance the apply
    // returned -- not an identity re-query (spec sec.36: bind by
    // ApplyBuffResult.instanceId).
    const appliedSeal = harness.state.buffs.find((b) => b.definitionId === 'hoa_an')!
    for (const op of [tick, mod, extend]) {
      expect((op?.payload as { selector: object }).selector).toEqual({
        kind: 'instance',
        instanceId: appliedSeal.instanceId,
      })
    }
    expect(mod?.payload).toMatchObject({
      modifier: { id: 'phan_thien_potency', value: 1.5, appliedBy: PLAYER },
    })
    expect(extend?.payload).toMatchObject({ turns: 2 })
  })

  it('phan_thien_hoa_vuc: a resisted apply produces NO continuation (spec sec.11)', () => {
    const def = rootOf('phan_thien_hoa_vuc')
    const harness = makeHarness({ defs: [def], applyHook: () => 'resist' })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)

    harness.executor.execute(harness.resolver.resolve(makeInput(def)), makeInput(def))

    // apply_buff resolved applied:false -> tick/modifier/extend never
    // materialize; no instance exists to mutate.
    expect(harness.state.executedOps.map((o) => o.type)).toEqual([
      'deal_damage',
      'apply_buff',
    ])
    expect(harness.state.buffs).toHaveLength(0)
  })

  it('phan_thien_hoa_vuc: a resisted reapply leaves the stale instance byte-identical (no tick, no modifier, no extend)', () => {
    const def = rootOf('phan_thien_hoa_vuc')
    const harness = makeHarness({ defs: [def], applyHook: () => 'resist' })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    const stale = seedBuff(harness, {
      definitionId: 'hoa_an' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 3,
      hasPeriodic: true,
      dispellable: false,
      remainingTurns: 4,
    })

    harness.executor.execute(harness.resolver.resolve(makeInput(def)), makeInput(def))

    // The resisted reapply resolves applied:false; the three gated
    // follow-ups never enqueue -- the prior own-source instance is
    // untouched (stacks, duration, no new instance minted).
    expect(harness.state.executedOps.map((o) => o.type)).toEqual([
      'deal_damage',
      'apply_buff',
    ])
    expect(harness.state.buffs).toHaveLength(1)
    expect(harness.state.buffs[0]).toBe(stale)
    expect(stale.stacks).toBe(3)
    expect(stale.remainingTurns).toBe(4)
  })

  it('phan_thien_hoa_vuc: a successful reapply binds the RETURNED instance, not the stale identity match', () => {
    const def = rootOf('phan_thien_hoa_vuc')
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    // A stale same-identity instance exists -- an identity re-query
    // would land on it. The gate must bind the apply's returned id.
    seedBuff(harness, {
      definitionId: 'hoa_an' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 1,
      hasPeriodic: true,
      dispellable: false,
    })

    harness.executor.execute(harness.resolver.resolve(makeInput(def)), makeInput(def))

    const fresh = harness.state.buffs.find(
      (b) => b.definitionId === 'hoa_an' && b.stacks === 1 && b.kind === 'buff',
    )!
    const [tick, mod, extend] = harness.state.executedOps.slice(2)
    for (const op of [tick, mod, extend]) {
      expect((op?.payload as { selector: object }).selector).toEqual({
        kind: 'instance',
        instanceId: fresh.instanceId,
      })
    }
  })

  it('cuu_tieu_viem_bao bursts off and consumes ONLY the caster own instance', () => {
    const def = rootOf('cuu_tieu_viem_bao')
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    spawn(harness, OTHER)
    seedBuff(harness, {
      definitionId: 'hoa_an' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: PLAYER,
      kind: 'ailment',
      stacks: 3,
      hasPeriodic: true,
      dispellable: false,
    })
    seedBuff(harness, {
      definitionId: 'hoa_an' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: OTHER,
      kind: 'ailment',
      stacks: 2,
      hasPeriodic: true,
      dispellable: false,
    })

    harness.executor.execute(harness.resolver.resolve(makeInput(def)), makeInput(def))

    const types = harness.state.executedOps.map((o) => o.type)
    expect(types).toEqual(['deal_damage', 'deal_damage', 'consume_buff_stacks'])
    // burst = 3 stacks x 35 flat (legacy_flat, coefficient x 10 fake authority
    // -> the flat op deals 1050) on top of the missile's 2.4 x 10 = 24.
    const flat = harness.state.executedOps[1]!
    expect(flat.payload).toMatchObject({ damageProfile: 'legacy_flat', coefficient: 105 })
    const consume = harness.state.executedOps[2]!
    expect(consume.payload).toMatchObject({ stacks: 'all', removalReason: 'consumed' })

    // the caster's instance is gone; the other caster's survives intact.
    const survivors = harness.state.buffs.filter((b) => b.definitionId === 'hoa_an')
    expect(survivors).toHaveLength(1)
    expect(survivors[0]).toMatchObject({ sourceId: OTHER, stacks: 2 })
  })

  it('cuu_tieu_viem_bao with no own seal consumes nothing (other seals untouched)', () => {
    const def = rootOf('cuu_tieu_viem_bao')
    const harness = makeHarness({ defs: [def] })
    spawn(harness, PLAYER)
    spawn(harness, ENEMY_A)
    spawn(harness, OTHER)
    seedBuff(harness, {
      definitionId: 'hoa_an' as BuffDefinitionId,
      targetId: ENEMY_A,
      sourceId: OTHER,
      kind: 'ailment',
      stacks: 2,
      hasPeriodic: true,
      dispellable: false,
    })

    harness.executor.execute(harness.resolver.resolve(makeInput(def)), makeInput(def))

    expect(harness.state.executedOps.some((o) => o.type === 'consume_buff_stacks')).toBe(false)
    expect(harness.state.buffs).toHaveLength(1)
    expect(harness.state.buffs[0]).toMatchObject({ sourceId: OTHER, stacks: 2 })
  })
})
