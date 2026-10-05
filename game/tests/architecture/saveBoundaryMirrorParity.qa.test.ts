/**
 * W4-AUT mirror-parity pin - _check_save_payload (rewritten by
 * 202610050002_beta_save_boundary_mirror.sql) mirrors client boundary
 * rules by hardcoding literal catalogs in SQL. W3-AUT-4 flagged the
 * hand-copied literals as un-pinned drift bombs; the wave-3 mirror
 * doubled that surface (realms, roots, kits, catalogs, charset).
 *
 * This pin finds the LAST `create or replace function` redefinition in
 * migration order for each RPC - a clause-dropping rewrite must still be
 * selected so the pin fails on it - then asserts every literal set equals
 * the TS catalog it copies. Drift on EITHER side fails here.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { GameManager } from '@/core/game/GameManager'
import { createDefaultPlayer } from '@/core/player/Player'
import { lockBetaElementsForTests } from '@/core/game/__fixtures__/betaElementsUnlock'
import {
  BETA_CREATION_TALENT_IDS,
  BETA_MORTAL_STARTER_SKILL_ID,
  BETA_PLAYABLE_ELEMENTS,
} from '@/core/betaScope'
import { getRealmIndex } from '@/core/realm/realmSystem'
import { progressionCeilingRealmId } from '@/core/realm/ReleasePolicy'
import { FOUNDATION_LABELS } from '@/core/breakthrough/FoundationType'
import type { ElementType } from '@/core/element/ElementType'
import { REALMS } from '@/data/realms/realm'
import { PHAP_TU_ELEMENT_ROOT_IDS } from '@/data/progression/PhapTuNodes.builders'
import { BREAKTHROUGH_TALENT_POOLS } from '@/data/talent/BreakthroughTalentPools'
import { GREAT_DAO_REWARD_TALENTS, PARKED_TALENTS } from '@/data/talent/Talents'
import { SPELL_KIT_IDS } from '@/data/skill/Skills'
import { buildGameSave } from '@/services/save/SaveSystem'

const MIGRATIONS_DIR = 'supabase/migrations'

// Global setup unlocks beta rosters; relock elements so the root parity
// check sees production scope.
lockBetaElementsForTests()

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort()

/** Every redefinition body of `name` across migrations, in apply order.
 *  Body text runs from the create-function keyword to the closing `$$;`. */
function redefinitionBodies(name: string): string[] {
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+(?:[\\w]+\\s*\\.\\s*)?${name}\\s*\\(`,
    'gi',
  )
  return migrationFiles.flatMap((file) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    return [...sql.matchAll(pattern)].map((match) => {
      const start = match.index!
      const end = sql.indexOf('$$;', start)
      return sql.slice(start, end < 0 ? undefined : end)
    })
  })
}

/** Quoted members of the first `array['a','b',...]` after `marker`. */
function arrayAfter(body: string, marker: string): string[] {
  const at = body.indexOf(marker)
  if (at < 0) {
    throw new Error(`marker not found in RPC body: ${marker}`)
  }
  const open = body.indexOf('array[', at)
  const close = body.indexOf(']', open)
  if (open < 0 || close < 0) {
    throw new Error(`array literal not found after marker: ${marker}`)
  }
  return [...body.slice(open, close).matchAll(/'([^']+)'/g)].map(
    (m) => m[1]!,
  )
}

/** Quoted members of the LAST `= any(array['a','b',...])` before `marker`
 *  (the nearest preceding leg's literal). */
function anyArrayBefore(body: string, marker: string): string[] {
  const at = body.indexOf(marker)
  if (at < 0) {
    throw new Error(`marker not found in RPC body: ${marker}`)
  }
  const matches = [
    ...body.slice(0, at).matchAll(/=\s*any\(\s*array\[([^\]]+)\]\s*\)/g),
  ]
  const last = matches[matches.length - 1]
  if (!last) {
    throw new Error(`any(array[...]) literal not found before: ${marker}`)
  }
  return [...last[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!)
}

const sort = (xs: readonly string[]) => [...xs].sort()

const checkBody = redefinitionBodies('_check_save_payload').at(-1)
const createCharacterBody = redefinitionBodies('create_character').at(-1)

describe('save boundary mirror parity: SQL literals vs TS catalogs', () => {
  it('the live bodies exist', () => {
    expect(checkBody).toBeDefined()
    expect(createCharacterBody).toBeDefined()
  })

  it('realm CASE order == REALMS order, indices == getRealmIndex', () => {
    const cases = [...checkBody!.matchAll(/when '(\w+)' then (\d+)/g)].map(
      (m) => [m[1]!, Number(m[2])] as const,
    )
    expect(cases.length).toBe(REALMS.length)
    expect(cases.map(([id]) => id)).toEqual(REALMS.map((realm) => realm.id))
    for (const [id, idx] of cases) {
      expect(getRealmIndex(id)).toBe(idx)
    }
  })

  it('release ceiling index == getRealmIndex(progressionCeilingRealmId)', () => {
    const m = checkBody!.match(/v_realm_index > (\d+)/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBe(getRealmIndex(progressionCeilingRealmId))
    expect(progressionCeilingRealmId).toBe('foundation_establishment')
  })

  it('v_creation_catalog == BETA_CREATION_TALENT_IDS', () => {
    expect(sort(arrayAfter(checkBody!, 'v_creation_catalog'))).toEqual(
      sort(BETA_CREATION_TALENT_IDS),
    )
  })

  it('v_parked_talents == PARKED_TALENTS ids', () => {
    expect(sort(arrayAfter(checkBody!, 'v_parked_talents'))).toEqual(
      sort(PARKED_TALENTS.map((talent) => talent.id)),
    )
  })

  it('v_pool_min_realm == pool realm index per BREAKTHROUGH_TALENT_POOLS', () => {
    const at = checkBody!.indexOf('v_pool_min_realm')
    const open = checkBody!.indexOf('{', at)
    const close = checkBody!.indexOf('}', open)
    const sqlMap = JSON.parse(checkBody!.slice(open, close + 1)) as Record<
      string,
      number
    >
    const clientMap: Record<string, number> = {}
    for (const [realmId, talents] of Object.entries(BREAKTHROUGH_TALENT_POOLS)) {
      for (const talent of talents) {
        clientMap[talent.id] = getRealmIndex(realmId)
      }
    }
    expect(sqlMap).toEqual(clientMap)
  })

  it('pham_nhan_chi_cot literal == GREAT_DAO_REWARD_TALENTS ids', () => {
    const rewardIds = GREAT_DAO_REWARD_TALENTS.map((talent) => talent.id)
    for (const id of rewardIds) {
      expect(checkBody!).toContain(`'${id}'`)
    }
    // today exactly one reward id exists; a new one silently bypasses the
    // SQL witness leg until this pin is updated.
    expect(rewardIds).toEqual(['pham_nhan_chi_cot'])
  })

  it('great_dao literal is a real FoundationType key', () => {
    expect(Object.keys(FOUNDATION_LABELS)).toContain('great_dao')
    expect(checkBody!).toContain("'great_dao'")
  })

  it('pham_cot literal is in the creation catalog', () => {
    expect(BETA_CREATION_TALENT_IDS).toContain('pham_cot')
    expect(checkBody!).toContain("'pham_cot'")
  })

  it('non-beta element root literals == PHAP_TU_ELEMENT_ROOT_IDS minus playable elements', () => {
    const sqlRoots = anyArrayBefore(checkBody!, 'non-beta element root claim')
    const expected = Object.entries(PHAP_TU_ELEMENT_ROOT_IDS)
      .filter(
        ([element]) => !BETA_PLAYABLE_ELEMENTS.has(element as ElementType),
      )
      .map(([, rootId]) => rootId)
    expect(sort(sqlRoots)).toEqual(sort(expected))
  })

  it('fire root literal == PHAP_TU_ELEMENT_ROOT_IDS.fire', () => {
    expect(checkBody!).toContain(`'${PHAP_TU_ELEMENT_ROOT_IDS.fire}'`)
    expect(PHAP_TU_ELEMENT_ROOT_IDS.fire).toBe('hoa_linh_ngo')
  })

  it('committed-element legs == beta element + spell kit tuple', () => {
    expect(checkBody!).toContain(`'${SPELL_KIT_IDS.fire[0]}'`)
    expect(SPELL_KIT_IDS.fire[0]).toBe('hoa_cau_thuat')
    for (const element of BETA_PLAYABLE_ELEMENTS) {
      expect(checkBody!).toContain(`'${element}'`)
    }
    expect(checkBody!).toContain("'spell_pathway'")
  })

  it('linh_bao literal in create_character == BETA_MORTAL_STARTER_SKILL_ID', () => {
    // _check_save_payload binds to the recorded pick column, not the
    // literal; only create_character hardcodes the starter id.
    expect(BETA_MORTAL_STARTER_SKILL_ID).toBe('linh_bao')
    expect(createCharacterBody!).toContain(`'${BETA_MORTAL_STARTER_SKILL_ID}'`)
  })

  it('pendingTalentEntitlement realm array == REALMS ids', () => {
    const realms = anyArrayBefore(
      checkBody!,
      'pendingTalentEntitlement.realmId unknown',
    )
    expect(sort(realms)).toEqual(sort(REALMS.map((realm) => realm.id)))
  })

  it('v_required_arrays keys are all writer-emitted arrays (overshoot pin)', () => {
    const required = arrayAfter(checkBody!, 'v_required_arrays')
    const save = buildGameSave(createDefaultPlayer(), new GameManager()) as unknown as Record<
      string,
      unknown
    >
    for (const key of required) {
      expect(
        Array.isArray(save[key]),
        `SQL requires '${key}' array but the writer does not emit one`,
      ).toBe(true)
    }
  })

  it('create_character keeps a charset leg (documented divergence: see fixpoint-codex-w4-AUT.md W4-AUT-3)', () => {
    expect(createCharacterBody!).toMatch(/!~\s*'\^\[\[:alnum:\]/)
  })

  it('characters.realm_id default tracks REALMS[0] (mortal) in the latest DDL', () => {
    const defaults = migrationFiles.flatMap((file) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      return [
        ...sql.matchAll(/alter\s+column\s+realm_id\s+set\s+default\s+'(\w+)'/gi),
      ].map((m) => m[1]!)
    })
    expect(defaults.length).toBeGreaterThan(0)
    expect(defaults.at(-1)).toBe(REALMS[0]!.id)
    expect(REALMS[0]!.id).toBe('mortal')
  })
})
