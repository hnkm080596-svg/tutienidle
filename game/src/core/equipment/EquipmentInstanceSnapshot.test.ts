// M2 (ARCH-011) - unit contract for the detached issued-at snapshot.
// Commit-path coverage (wash/refine pending previews rejecting mutated
// items field by field) lives in EquipmentSystem.test.ts and
// EquipmentWash.pending.test.ts. This file covers the value semantics
// those paths cannot reach: reference detachment, pure-value matching,
// and the field boundary of what the snapshot observes.
import { describe, expect, it } from 'vitest'
import {
  captureEquipmentInstanceSnapshot,
  equipmentInstanceMatchesSnapshot,
} from './EquipmentInstanceSnapshot'
import { makeInstance } from './EquipmentInstance.fixture'

describe('captureEquipmentInstanceSnapshot', () => {
  it('returns a detached copy - no shared references for mainStat or affixes', () => {
    const instance = makeInstance({
      affixes: [
        { affixId: 'affix-a', tier: 1, value: 5 },
        { affixId: 'affix-b', tier: 2, value: 9 },
      ],
    })

    const snapshot = captureEquipmentInstanceSnapshot(instance)

    expect(snapshot.mainStat).not.toBe(instance.mainStat)
    expect(snapshot.affixes).not.toBe(instance.affixes)
    expect(snapshot.affixes).toHaveLength(instance.affixes.length)
    for (let index = 0; index < instance.affixes.length; index += 1) {
      expect(snapshot.affixes[index]).not.toBe(instance.affixes[index])
    }
  })

  it('keeps issued-at values when the source is mutated after capture', () => {
    const instance = makeInstance({
      affixes: [{ affixId: 'affix-a', tier: 1, value: 5 }],
    })
    const snapshot = captureEquipmentInstanceSnapshot(instance)

    instance.mainStat.flat = 99
    instance.affixes[0]!.value = 99
    instance.affixes.push({ affixId: 'affix-b', tier: 3, value: 1 })
    instance.grade = 'that_pham'

    expect(snapshot.mainStat.flat).toBe(1)
    expect(snapshot.affixes).toEqual([{ affixId: 'affix-a', tier: 1, value: 5 }])
    expect(snapshot.grade).toBe('cuu_pham')
  })

  it('mutating the snapshot does not leak back into the live instance', () => {
    const instance = makeInstance({
      affixes: [{ affixId: 'affix-a', tier: 1, value: 5 }],
    })
    const snapshot = captureEquipmentInstanceSnapshot(instance)

    snapshot.mainStat.flat = 42
    snapshot.affixes[0]!.value = 42
    snapshot.affixes.push({ affixId: 'affix-b', tier: 1, value: 1 })
    snapshot.forgeUsesRemaining = 0

    expect(instance.mainStat.flat).toBe(1)
    expect(instance.affixes).toEqual([{ affixId: 'affix-a', tier: 1, value: 5 }])
    expect(instance.forgeUsesRemaining).toBe(instance.forgeUsesTotal)
  })

  it('preserves optional fields exactly - defined stays defined, absent stays undefined', () => {
    const withOptionals = makeInstance({
      realmLevel: 4,
      zoneId: 'zone-1',
      icon: '/icons/sword.png',
      locked: true,
      favorite: false,
    })
    const withoutOptionals = makeInstance()

    expect(captureEquipmentInstanceSnapshot(withOptionals)).toMatchObject({
      realmLevel: 4,
      zoneId: 'zone-1',
      icon: '/icons/sword.png',
      locked: true,
      favorite: false,
    })

    const bare = captureEquipmentInstanceSnapshot(withoutOptionals)
    expect(bare.realmLevel).toBeUndefined()
    expect(bare.zoneId).toBeUndefined()
    expect(bare.icon).toBeUndefined()
    expect(bare.locked).toBeUndefined()
    expect(bare.favorite).toBeUndefined()
  })
})

describe('equipmentInstanceMatchesSnapshot', () => {
  it('matches the issuing instance right after capture (round-trip)', () => {
    const instance = makeInstance({
      realmLevel: 4,
      affixes: [{ affixId: 'affix-a', tier: 1, value: 5 }],
    })

    const snapshot = captureEquipmentInstanceSnapshot(instance)

    expect(equipmentInstanceMatchesSnapshot(instance, snapshot)).toBe(true)
  })

  it('matches a structurally identical clone - the snapshot is a value, not identity', () => {
    const instance = makeInstance({
      affixes: [
        { affixId: 'affix-a', tier: 1, value: 5 },
        { affixId: 'affix-b', tier: 2, value: 9 },
      ],
    })
    const snapshot = captureEquipmentInstanceSnapshot(instance)

    // A detached structural copy of the same item still matches; the
    // exact-object capability is checked by callers, not by this function.
    const clone: typeof instance = structuredClone(instance)
    expect(clone).not.toBe(instance)
    expect(equipmentInstanceMatchesSnapshot(clone, snapshot)).toBe(true)
  })

  it('rejects when only instanceId differs (bag lookup hides this check from commit paths)', () => {
    const instance = makeInstance()
    const snapshot = captureEquipmentInstanceSnapshot(instance)

    const renamed = makeInstance({ instanceId: 'another-instance' })

    expect(equipmentInstanceMatchesSnapshot(renamed, snapshot)).toBe(false)
  })

  it('rejects when the instance lost affixes since capture (snapshot longer than instance)', () => {
    const instance = makeInstance({
      affixes: [
        { affixId: 'affix-a', tier: 1, value: 5 },
        { affixId: 'affix-b', tier: 2, value: 9 },
      ],
    })
    const snapshot = captureEquipmentInstanceSnapshot(instance)

    instance.affixes.pop()

    expect(equipmentInstanceMatchesSnapshot(instance, snapshot)).toBe(false)
  })

  it('rejects when a false flag becomes absent after capture (false !== undefined)', () => {
    const instance = makeInstance({ favorite: false })
    const snapshot = captureEquipmentInstanceSnapshot(instance)

    delete instance.favorite

    expect(equipmentInstanceMatchesSnapshot(instance, snapshot)).toBe(false)
  })

  it('rejects a mutated snapshot even though the instance itself is untouched', () => {
    const instance = makeInstance({
      affixes: [{ affixId: 'affix-a', tier: 1, value: 5 }],
    })
    const snapshot = captureEquipmentInstanceSnapshot(instance)

    snapshot.affixes[0]!.value = 6

    expect(equipmentInstanceMatchesSnapshot(instance, snapshot)).toBe(false)
  })

  it('ignores mainStat fields outside the observed contract (domain is not snapshotted)', () => {
    const instance = makeInstance()
    const snapshot = captureEquipmentInstanceSnapshot(instance)

    // EquipmentStatPolicy keeps domain-gated stats out of equipment pools,
    // so domain is never authored on a real mainStat; the snapshot simply
    // does not observe it.
    instance.mainStat.domain = 'body'

    expect(snapshot.mainStat.domain).toBeUndefined()
    expect(equipmentInstanceMatchesSnapshot(instance, snapshot)).toBe(true)
  })

  it('is pure - repeated calls neither drift nor mutate instance or snapshot', () => {
    const instance = makeInstance({
      affixes: [{ affixId: 'affix-a', tier: 1, value: 5 }],
    })
    const snapshot = captureEquipmentInstanceSnapshot(instance)
    const instanceBefore = structuredClone(instance)
    const snapshotBefore = structuredClone(snapshot)

    expect(equipmentInstanceMatchesSnapshot(instance, snapshot)).toBe(true)
    expect(equipmentInstanceMatchesSnapshot(instance, snapshot)).toBe(true)

    expect(instance).toEqual(instanceBefore)
    expect(snapshot).toEqual(snapshotBefore)
  })
})
