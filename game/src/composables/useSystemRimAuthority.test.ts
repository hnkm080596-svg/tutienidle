import { afterEach, describe, expect, it } from 'vitest'
import { computed, effectScope, ref, type EffectScope } from 'vue'
import { useSystemRimAuthority } from './useSystemRimAuthority'

// The authority is a module-scoped ordered set of ACTIVE claimants (spec 4.1.1):
// claim on activation (promote-to-top), release on deactivation/scope dispose.
// Only the topmost active claimant may render .sys-rim--live.
const scopes: EffectScope[] = []
function activate(id: string, active = ref(true)) {
  const scope = effectScope()
  const out = scope.run(() => useSystemRimAuthority(id, active))
  if (!out) throw new Error('scope.run returned undefined')
  scopes.push(scope)
  return { active, scope, ...out }
}

afterEach(() => {
  scopes.splice(0).forEach(s => s.stop())
})

describe('useSystemRimAuthority', () => {
  it('single active claimant is top', () => {
    const a = activate('a')
    expect(a.isTop.value).toBe(true)
  })

  it('second claim promotes to top; first drops', () => {
    const a = activate('a')
    const b = activate('b')
    expect(b.isTop.value).toBe(true)
    expect(a.isTop.value).toBe(false)
  })

  it('release pops back to the previous claimant', () => {
    const a = activate('a')
    const b = activate('b')
    b.active.value = false
    expect(b.isTop.value).toBe(false)
    expect(a.isTop.value).toBe(true)
  })

  it('re-activation promotes (mounted-but-closed -> open handoff)', () => {
    const a = activate('a')
    const b = activate('b', ref(false))
    // b is mounted but inactive: holds no claim and cannot be top.
    expect(b.isTop.value).toBe(false)
    expect(a.isTop.value).toBe(true)
    b.active.value = true
    expect(b.isTop.value).toBe(true)
    expect(a.isTop.value).toBe(false)
    b.active.value = false
    expect(a.isTop.value).toBe(true)
  })

  it('deactivation while mounted releases (no claim held)', () => {
    const a = activate('a')
    const b = activate('b')
    expect(b.isTop.value).toBe(true)
    b.active.value = false
    expect(b.isTop.value).toBe(false)
    expect(a.isTop.value).toBe(true)
  })

  it('scope dispose releases (unmount drops the claim)', () => {
    const a = activate('a')
    const b = activate('b')
    expect(b.isTop.value).toBe(true)
    b.scope.stop()
    expect(b.isTop.value).toBe(false)
    expect(a.isTop.value).toBe(true)
  })

  it('two independent claimants hold independent claims (useId-style ids)', () => {
    const p1 = activate('sys-panel-1')
    const p2 = activate('sys-panel-2')
    expect(p1.isTop.value).toBe(false)
    expect(p2.isTop.value).toBe(true)
    p2.active.value = false
    expect(p1.isTop.value).toBe(true)
  })

  it('computed active source works', () => {
    const open = ref(false)
    const c = activate('c', computed(() => open.value))
    expect(c.isTop.value).toBe(false)
    open.value = true
    expect(c.isTop.value).toBe(true)
  })
})
