import { describe, expect, it } from 'vitest'

import { createCapabilityValidatorRegistry } from './CapabilityValidatorRegistry'
import { StaticCapabilityQuery } from './StaticCapabilityQuery'

describe('CapabilityValidatorRegistry (contract v7.2 / spec sec.47/56)', () => {
  it('registered validators receive the grant payload', () => {
    const registry = createCapabilityValidatorRegistry()
    const seen: unknown[] = []
    registry.register('reaction_slot', (payload) => {
      seen.push(payload)
    })

    registry.validate('reaction_slot', { maxConcurrent: 1 })
    expect(seen).toEqual([{ maxConcurrent: 1 }])
  })

  it('unknown capability type throws -- no silent pass', () => {
    const registry = createCapabilityValidatorRegistry()
    expect(() => registry.validate('nope', {})).toThrow(/unknown capability/)
  })

  it('duplicate validator registration throws', () => {
    const registry = createCapabilityValidatorRegistry()
    registry.register('x', () => undefined)
    expect(() => registry.register('x', () => undefined)).toThrow(/duplicate/)
  })

  it('a validator rejection propagates -- invalid payloads fault at load', () => {
    const registry = createCapabilityValidatorRegistry()
    registry.register('typed', (payload) => {
      if (typeof payload !== 'object' || payload === null) {
        throw new Error('payload must be an object')
      }
    })
    expect(() => registry.validate('typed', 42)).toThrow(/object/)
  })
})

describe('StaticCapabilityQuery', () => {
  it('has() reflects the construction-time flags', () => {
    const query = new StaticCapabilityQuery(
      new Map([['entity.a', new Set(['elemental_reaction_enabled'])]]),
    )
    expect(query.has('entity.a', 'elemental_reaction_enabled')).toBe(true)
    expect(query.has('entity.a', 'other')).toBe(false)
    expect(query.has('entity.b', 'elemental_reaction_enabled')).toBe(false)
  })

  it('defensive copy -- mutating the source map/sets cannot rewrite the snapshot', () => {
    const flags = new Set(['elemental_reaction_enabled'])
    const source = new Map([['entity.a', flags]])
    const query = new StaticCapabilityQuery(source)

    flags.delete('elemental_reaction_enabled')
    flags.add('injected')
    source.set('entity.b', new Set(['elemental_reaction_enabled']))

    expect(query.has('entity.a', 'elemental_reaction_enabled')).toBe(true)
    expect(query.has('entity.a', 'injected')).toBe(false)
    expect(query.has('entity.b', 'elemental_reaction_enabled')).toBe(false)
  })
})
