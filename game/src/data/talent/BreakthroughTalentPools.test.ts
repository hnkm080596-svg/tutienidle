// M-F-TALENT - catalog integrity for the realm-scoped breakthrough NEW
// pools. "Deduped, realm-pooled" means: unique ids everywhere (within a
// pool, across pools, and against every pre-existing catalog), every def
// resolvable through getTalentDefinition, and enough draw-eligible
// entries per live pool for the 3-card offer. Balance is deferred - the
// checks pin structure, not magnitudes.
import { describe, expect, it } from 'vitest'
import { BREAKTHROUGH_TALENT_POOLS } from './BreakthroughTalentPools'
import {
  CHARACTER_CREATION_TALENTS,
  GREAT_DAO_REWARD_TALENTS,
  PARKED_TALENTS,
  getTalentDefinition,
} from './Talents'
import { getTalentMaxLevel } from '@/core/talent/TalentEntitlement'
import { REALMS } from '../realms/realm'

const REALM_IDS = new Set(REALMS.map((realm) => realm.id))
const PRE_EXISTING_IDS = new Set(
  [...CHARACTER_CREATION_TALENTS, ...PARKED_TALENTS, ...GREAT_DAO_REWARD_TALENTS].map(
    (def) => def.id,
  ),
)

/** Pools a Beta-window breakthrough can actually draw from. */
const LIVE_POOL_REALMS = ['qi_refining', 'foundation_establishment']

describe('BREAKTHROUGH_TALENT_POOLS — catalog integrity', () => {
  it('pools are keyed by real realm ids', () => {
    for (const realmId of Object.keys(BREAKTHROUGH_TALENT_POOLS)) {
      expect(REALM_IDS.has(realmId), `pool key ${realmId} must be an authored realm`).toBe(true)
    }
  })

  it('live pools exist for the Beta-window breakthrough realms', () => {
    for (const realmId of LIVE_POOL_REALMS) {
      expect(BREAKTHROUGH_TALENT_POOLS[realmId]?.length ?? 0).toBeGreaterThanOrEqual(3)
    }
  })

  it('ids are unique within and across pools, and never collide with prior catalogs', () => {
    const seen = new Set<string>()

    for (const [realmId, pool] of Object.entries(BREAKTHROUGH_TALENT_POOLS)) {
      for (const def of pool) {
        expect(seen.has(def.id), `duplicate breakthrough talent id ${def.id} (pool ${realmId})`).toBe(false)
        expect(PRE_EXISTING_IDS.has(def.id), `breakthrough talent ${def.id} collides with a prior catalog`).toBe(false)
        seen.add(def.id)
      }
    }
  })

  it('every pool talent resolves through getTalentDefinition (registered in BY_ID)', () => {
    for (const pool of Object.values(BREAKTHROUGH_TALENT_POOLS)) {
      for (const def of pool) {
        expect(getTalentDefinition(def.id)?.id).toBe(def.id)
      }
    }
  })

  it('every pool talent is draw-eligible (weight > 0) — ReleasePolicy, not weight, gates dormant realms', () => {
    for (const pool of Object.values(BREAKTHROUGH_TALENT_POOLS)) {
      for (const def of pool) {
        expect(def.weight, `talent ${def.id} has weight ${def.weight}`).toBeGreaterThan(0)
      }
    }
  })

  it('every pool talent carries an authored next-level model (maxLevel > 1, non-empty level tables)', () => {
    for (const pool of Object.values(BREAKTHROUGH_TALENT_POOLS)) {
      for (const def of pool) {
        expect(getTalentMaxLevel(def), `talent ${def.id} needs a legal next level for UPGRADE`).toBeGreaterThan(1)
        for (const [index, table] of (def.levels ?? []).entries()) {
          expect(table.length, `talent ${def.id} level ${index + 2} table must declare effects`).toBeGreaterThan(0)
        }
      }
    }
  })
})
