import { describe, it, expect } from 'vitest'
import type { BuffEffect, BuffEffectTemplate } from './BuffTypes'

describe('BuffTypes', () => {
  it('StatModifierEffect/CcEffect/OnHitProcEffect are structurally identical between template and runtime', () => {
    const template: BuffEffectTemplate = { type: 'cc', ccEffect: 'stun' }
    const runtime: BuffEffect = template

    expect(runtime.type).toBe('cc')
  })

  it('DotEffectTemplate carries dpsRatio, runtime DotEffect carries damagePerSecond', () => {
    const template: BuffEffectTemplate = { type: 'dot', dpsRatio: 0.5, element: 'fire' }
    const runtime: BuffEffect = { type: 'dot', damagePerSecond: 12.5, element: 'fire' }

    expect(template.type).toBe('dot')
    expect(runtime.type).toBe('dot')
  })
})
