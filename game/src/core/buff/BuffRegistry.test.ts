import { describe, it, expect } from 'vitest'
import { BuffRegistry } from './BuffRegistry'
import type { BuffDefinition } from './BuffDefinition'

describe('BuffRegistry', () => {
  it('registers and retrieves a BuffDefinition by id', () => {
    const registry = new BuffRegistry()
    const definition: BuffDefinition = {
      id: 'x', name: 'X', polarity: 'buff', duration: 5, stackMode: 'refresh', effects: [],
    }

    registry.register(definition)

    expect(registry.get('x')).toBe(definition)
    expect(registry.has('x')).toBe(true)
  })

  it('throws on duplicate register', () => {
    const registry = new BuffRegistry()
    const definition: BuffDefinition = {
      id: 'x', name: 'X', polarity: 'buff', duration: 5, stackMode: 'refresh', effects: [],
    }

    registry.register(definition)
    expect(() => registry.register(definition)).toThrow()
  })

  it('throws on get of a missing id', () => {
    const registry = new BuffRegistry()
    expect(() => registry.get('missing')).toThrow()
  })
})
