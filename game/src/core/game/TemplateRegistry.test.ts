import { describe, expect, it } from 'vitest'
import { TemplateRegistry } from './TemplateRegistry'

interface Fake {
  id: string
}

describe('TemplateRegistry', () => {
  it('register/get tra theo id', () => {
    const registry = new TemplateRegistry<Fake>()
    const template: Fake = { id: 'a' }

    registry.register('a', template)

    expect(registry.get('a')).toBe(template)
    expect(registry.has('a')).toBe(true)
  })

  it('get() trả undefined khi thiếu — KHÔNG throw (khác Registry instance)', () => {
    const registry = new TemplateRegistry<Fake>()

    expect(registry.get('missing')).toBeUndefined()
    expect(registry.has('missing')).toBe(false)
  })

  it('register cùng id thì ghi đè (data tĩnh re-register an toàn)', () => {
    const registry = new TemplateRegistry<Fake>()

    registry.register('a', { id: 'first' })
    const second: Fake = { id: 'second' }
    registry.register('a', second)

    expect(registry.get('a')).toBe(second)
  })
})
