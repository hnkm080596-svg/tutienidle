// Design 2026-09-23 sec.17 cap pins: the 0..3-body effective-cap
// ladder under the ONE canonical rounding rule (floor of the exact
// product), and "raises the cap only - never fills".
import { describe, expect, it } from 'vitest'
import {
  getEffectiveMainStatCap,
  getMainStatCap,
  HIDDEN_BODY_CAP_BONUS_PER_REALM,
} from './StatCap'
import { createDefaultHiddenPerfection } from '../realm/hidden/HiddenPerfection'
import type { HiddenPerfectionState } from '../realm/hidden/HiddenPerfection'

function capWith(realmId: string, completedBodies: number): number {
  const hiddenPerfection: HiddenPerfectionState = {
    ...createDefaultHiddenPerfection(),
    completedHiddenBodyRealmIds: ['mortal', 'qi_refining', 'foundation_establishment'].slice(
      0,
      completedBodies,
    ),
  }
  return getEffectiveMainStatCap({ realmId, hiddenPerfection })
}

describe('getEffectiveMainStatCap (design sec.7)', () => {
  it('0 -> x1.0, 1 -> x1.1, 2 -> x1.2, 3 -> x1.3 duoi canonical rounding', () => {
    // mortal base 10: floor(10*1.x) = 10/11/12/13
    expect(capWith('mortal', 0)).toBe(10)
    expect(capWith('mortal', 1)).toBe(11)
    expect(capWith('mortal', 2)).toBe(12)
    expect(capWith('mortal', 3)).toBe(13)

    // qi_refining base 30: floor(30*1.x) = 30/33/36/39
    expect(capWith('qi_refining', 0)).toBe(30)
    expect(capWith('qi_refining', 1)).toBe(33)
    expect(capWith('qi_refining', 2)).toBe(36)
    expect(capWith('qi_refining', 3)).toBe(39)

    // foundation base 100: 100/110/120/130
    expect(capWith('foundation_establishment', 0)).toBe(100)
    expect(capWith('foundation_establishment', 3)).toBe(130)
  })

  it('canonical rounding = Math.floor cua exact product - khong he thong nao round khac', () => {
    for (const realmId of ['mortal', 'qi_refining', 'foundation_establishment']) {
      for (const bodies of [0, 1, 2, 3]) {
        expect(capWith(realmId, bodies)).toBe(
          Math.floor(getMainStatCap(realmId) * (1 + bodies * HIDDEN_BODY_CAP_BONUS_PER_REALM)),
        )
      }
    }
  })

  it('bonus additive on CURRENT realm cap - khong phai percent cua realm cu', () => {
    // a player with 1 completed body entering qi_refining gets
    // floor(30*1.1)=33 - not 11 carried over
    expect(capWith('qi_refining', 1)).toBe(33)
  })

  it('completion chi nang cap - khong cap diem stat hien tai', () => {
    const hiddenPerfection: HiddenPerfectionState = {
      ...createDefaultHiddenPerfection(),
      completedHiddenBodyRealmIds: ['mortal'],
    }
    const player = {
      realmId: 'mortal',
      hiddenPerfection,
      baseStats: { strength: 10 },
    }
    const before = player.baseStats.strength
    const cap = getEffectiveMainStatCap(player)
    expect(cap).toBe(11)
    expect(player.baseStats.strength).toBe(before) // cap read never mutates stats
  })

  it('khong co hiddenPerfection -> cap base realm', () => {
    expect(getEffectiveMainStatCap({ realmId: 'mortal' })).toBe(10)
    expect(getEffectiveMainStatCap({ realmId: 'qi_refining' })).toBe(30)
  })

  it('realm khong author trong completed list van dem count (integrity la noi chan)', () => {
    // callers never build this shape themselves - completed ids are
    // written solely by completeHiddenBody under strict prefix; the
    // cap read stays a pure length-product either way
    const hiddenPerfection: HiddenPerfectionState = {
      ...createDefaultHiddenPerfection(),
      completedHiddenBodyRealmIds: ['mortal', 'nascent_soul'],
    }
    expect(getEffectiveMainStatCap({ realmId: 'mortal', hiddenPerfection })).toBe(12)
  })
})
