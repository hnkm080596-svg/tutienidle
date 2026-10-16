import { describe, expect, it } from 'vitest'
import {
  buildBreakthroughGrowthSnapshot,
  computeRealmFoundationTotals,
  getRealmFoundationModifiers,
} from './RealmFoundationGrowth'

describe('RealmFoundationGrowth', () => {
  it('returns zero foundation bonuses at mortal floor 1', () => {
    const totals = computeRealmFoundationTotals('mortal', 1)
    expect(totals).toEqual({
      maxHp: 0,
      might: 0,
      defense: 0,
      hpRegenPerTurn: 0,
      speed: 0,
      cultivationPercent: 0,
      productionSpeedMultiplier: 0,
      affixDeltaPercent: 0,
      realmPassivePercent: 0,
    })
    expect(getRealmFoundationModifiers({ realmId: 'mortal', realmLevel: 1 })).toEqual([])
  })

  it('increases non-primary foundation stats on every minor floor advance', () => {
    const snapshot = buildBreakthroughGrowthSnapshot({
      fromRealmId: 'mortal',
      fromLevel: 1,
      fromAttributePoints: 0,
      toRealmId: 'mortal',
      toLevel: 2,
      toAttributePoints: 1,
    })
    expect(snapshot.isMajorRealm).toBe(false)
    expect(snapshot.attributePointsGained).toBe(1)
    const byKey = Object.fromEntries(snapshot.statRows.map((d) => [d.stat, d.delta]))
    expect(byKey.maxHp).toBeGreaterThan(0)
    expect(byKey.might).toBeGreaterThan(0)
    expect(byKey.defense).toBeGreaterThan(0)
    expect(byKey.hpRegenPerTurn).toBeGreaterThan(0)
    expect(byKey.cultivationPercent).toBeGreaterThan(0)
    expect(byKey.productionSpeedMultiplier).toBeGreaterThan(0)
    const mods = getRealmFoundationModifiers({ realmId: 'mortal', realmLevel: 2 })
    expect(mods.length).toBeGreaterThan(0)
  })

  it('grants a major realm foundation leap including speed when crossing realms', () => {
    const snapshot = buildBreakthroughGrowthSnapshot({
      fromRealmId: 'mortal',
      fromLevel: 12,
      fromAttributePoints: 11,
      toRealmId: 'qi_refining',
      toLevel: 1,
      toAttributePoints: 12,
    })
    expect(snapshot.isMajorRealm).toBe(true)
    const byKey = Object.fromEntries(snapshot.statRows.map((d) => [d.stat, d.delta]))
    expect(byKey.maxHp).toBeGreaterThanOrEqual(50)
    expect(byKey.might).toBeGreaterThanOrEqual(6)
    expect(byKey.defense).toBeGreaterThanOrEqual(4)
    expect(byKey.speed).toBeGreaterThan(0)
    expect(byKey.cultivationPercent).toBeGreaterThan(0)
  })
})
