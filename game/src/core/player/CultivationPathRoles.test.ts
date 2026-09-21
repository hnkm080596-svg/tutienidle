import { describe, expect, it } from 'vitest'
import { resolveCombatSkillRoles } from './CultivationPathRoles'
import type { CultivationPathRuntime } from './CultivationPathRuntime'
import { createDefaultPlayer } from './Player'
import { GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'

// P7-M4 sec.4.7 - the single role-composition seam consumed by BOTH
// resolveCombatBuild and the UI accessor. It carries the FULL
// participant-kit shape: a lossy subset would force consumers to
// re-resolve and drift back apart.

function fakeSkill(id: string): TurnSkillDefinition {
  return { id } as unknown as TurnSkillDefinition
}

function makeRuntime(overrides: Partial<CultivationPathRuntime> = {}): CultivationPathRuntime {
  return {
    resolveBasic: () => GENERIC_PHYSICAL_BASIC,
    resolveSpecialUltimate: () => undefined,
    resolveMaxThe: () => 10,
    resolveStatDomains: () => undefined,
    ...overrides,
  }
}

describe('resolveCombatSkillRoles', () => {
  it('mortal shape: nominal basic, not dynamic, no special/ultimate/payloads', () => {
    const roles = resolveCombatSkillRoles(createDefaultPlayer(), makeRuntime())

    expect(roles.basic).toBe(GENERIC_PHYSICAL_BASIC)
    expect(roles.basicIsDynamic).toBe(false)
    expect(roles.special).toBeUndefined()
    expect(roles.ultimate).toBeUndefined()
    expect(roles.reactivePayloads).toBeUndefined()
    expect(roles.maxThe).toBeUndefined()
  })

  it('carries the full resolveSpecialUltimate payload — reactivePayloads and maxThe', () => {
    const special = fakeSkill('kit_special')
    const ultimate = fakeSkill('kit_ultimate')
    const reactive = { counter: fakeSkill('reactive_counter') }

    const roles = resolveCombatSkillRoles(
      createDefaultPlayer(),
      makeRuntime({
        resolveSpecialUltimate: () => ({
          special,
          ultimate,
          reactivePayloads: reactive,
          maxThe: 42,
        }),
      }),
    )

    expect(roles.special).toBe(special)
    expect(roles.ultimate).toBe(ultimate)
    expect(roles.reactivePayloads).toBe(reactive)
    expect(roles.maxThe).toBe(42)
  })

  it('emblem slots override the kit special/ultimate — precedence lives in the seam', () => {
    const emblemSpecial = fakeSkill('emblem_special')
    const emblemUltimate = fakeSkill('emblem_ultimate')

    const roles = resolveCombatSkillRoles(
      createDefaultPlayer(),
      makeRuntime({
        resolveSpecialUltimate: () => ({
          special: fakeSkill('kit_special'),
          ultimate: fakeSkill('kit_ultimate'),
        }),
        emblemSlots: () => ({ special: emblemSpecial, ultimate: emblemUltimate }),
      }),
    )

    expect(roles.special).toBe(emblemSpecial)
    expect(roles.ultimate).toBe(emblemUltimate)
  })

  it('sword shape: the nominal basic is still stamped while the provider owns the real one', () => {
    const nominal = fakeSkill('sword_static_basic')

    const roles = resolveCombatSkillRoles(
      createDefaultPlayer(),
      makeRuntime({
        resolveBasic: () => nominal,
        buildDynamicBasic: () => undefined,
      }),
    )

    expect(roles.basic).toBe(nominal)
    expect(roles.basicIsDynamic).toBe(true)
  })
})
