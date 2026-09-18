import { describe, expect, it } from 'vitest'
import { BUFF_REGISTRY } from '../buff/BuffRegistry'
import { KIEM_PHO_ORBS, ORB_UNLOCK_REALM, unlockedOrbs, type OrbId } from './KiemPhoOrbs'

// Kiem Tu Reimagined Task 3 — five Kiem Pho orb defs + realm unlock
// table (spec 2026-09-15 §3). Orb ids are canonical in KiemTuState.ts
// and re-exported here.

describe('KIEM_PHO_ORBS', () => {
  it('defines exactly the five canonical orbs', () => {
    expect(Object.keys(KIEM_PHO_ORBS).sort()).toEqual(
      ['orb_bo', 'orb_chem', 'orb_dam', 'orb_hat', 'orb_quet'].sort(),
    )
  })

  it('every orb is a no-cooldown, no-resource physical basic', () => {
    for (const def of Object.values(KIEM_PHO_ORBS)) {
      expect(def.cooldownTurns).toBe(0)
      expect(def.resourceType).toBeUndefined()
      expect(def.damage?.kind).toBe('physical')
      expect(def.presetId).toBeDefined()
    }
  })

  it('orb_dam is the plain x1.0 strike', () => {
    expect(KIEM_PHO_ORBS.orb_dam.damage?.multiplier).toBe(1)
    expect(KIEM_PHO_ORBS.orb_dam.appliesAilments).toBeUndefined()
    expect(KIEM_PHO_ORBS.orb_dam.targeting.shape).toBe('single')
  })

  it('orb_chem applies kiem_thuong bleed stacks', () => {
    const ailments = KIEM_PHO_ORBS.orb_chem.appliesAilments ?? []
    expect(ailments.some(a => a.buffDefinitionId === 'kiem_thuong')).toBe(true)
    expect(KIEM_PHO_ORBS.orb_chem.damage?.multiplier).toBe(1.2)
  })

  it('orb_bo applies the defense-down debuff (suy_nhuoc reuse)', () => {
    const ailments = KIEM_PHO_ORBS.orb_bo.appliesAilments ?? []
    expect(ailments.some(a => a.buffDefinitionId === 'suy_nhuoc')).toBe(true)
    expect(KIEM_PHO_ORBS.orb_bo.damage?.multiplier).toBe(1.8)
  })

  it('orb_hat rolls a low-chance stun (choang)', () => {
    const ailments = KIEM_PHO_ORBS.orb_hat.appliesAilments ?? []
    const stun = ailments.find(a => a.buffDefinitionId === 'choang')
    expect(stun).toBeDefined()
    expect(stun!.chance).toBeGreaterThan(0)
    expect(stun!.chance).toBeLessThanOrEqual(0.5)
    expect(KIEM_PHO_ORBS.orb_hat.damage?.multiplier).toBe(0.6)
  })

  it('orb_quet hits the whole enemy formation per-target', () => {
    expect(KIEM_PHO_ORBS.orb_quet.damage?.multiplier).toBe(0.8)
    expect(KIEM_PHO_ORBS.orb_quet.targeting.shape).not.toBe('single')
  })

  it('kiem_thuong exists as a physical DoT capped at 3 stacks', () => {
    const def = BUFF_REGISTRY.get('kiem_thuong')
    expect(def.stacking.maxStacks).toBe(3)
    const dot = def.periodic?.find((p) => p.type === 'damage')
    expect(dot).toBeDefined()
    expect(dot?.type === 'damage' && dot.element).toBe('physical')
  })
})

describe('ORB_UNLOCK_REALM / unlockedOrbs', () => {
  it('orb_dam unlocks at qi_refining (realmIndex 1), one new orb per realm through 5', () => {
    expect(ORB_UNLOCK_REALM.orb_dam).toBe(1)
    expect(ORB_UNLOCK_REALM.orb_chem).toBe(2)
    expect(ORB_UNLOCK_REALM.orb_bo).toBe(3)
    expect(ORB_UNLOCK_REALM.orb_hat).toBe(4)
    expect(ORB_UNLOCK_REALM.orb_quet).toBe(5)
  })

  it('unlockedOrbs(1) returns only orb_dam', () => {
    expect(unlockedOrbs(1)).toEqual(['orb_dam'])
  })

  it('unlockedOrbs(5) returns all five in unlock order', () => {
    expect(unlockedOrbs(5)).toEqual(['orb_dam', 'orb_chem', 'orb_bo', 'orb_hat', 'orb_quet'])
  })

  it('mortal (0) unlocks nothing; higher realms keep the full set', () => {
    expect(unlockedOrbs(0)).toEqual([])
    expect(unlockedOrbs(9)).toHaveLength(5)
  })
})
