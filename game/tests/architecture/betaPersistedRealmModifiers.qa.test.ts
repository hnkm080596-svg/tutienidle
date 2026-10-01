/**
 * QA FIXPOINT probe (run qa-fixpoint-master) - persisted realm-sourced
 * modifier channels must reconcile against the CURRENT scope verdict:
 * a flagged save's enhanced (hidden-breakthrough) realm passives, body
 * chapter modifiers, and forged realm-passive payloads never emit into
 * live beta stats (frontend-contract.md sec.H).
 *
 * Beta flags are pinned by lockBetaFeaturesForTests().
 */
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, resolvePlayerStatAssembly, type PlayerData } from '@/core/player/Player'
import { grantRealmPassive } from '@/core/realm/RealmPassiveSystem'
import { collectBodyBaseStatDeltas } from '@/core/realm/body/BodyProgressionSystem'
import { MERIDIANS } from '@/data/realm/Meridians'
import { validateGameSaveShape } from '@/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '@/services/save/saveVersion'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'
import type { StatModifier } from '@/core/stats/StatCalculator'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    ...createDefaultPlayer(),
    ...overrides,
  }
}

describe('persisted realm modifiers under the beta lock', () => {
  it('a hidden-breakthrough realm passive carried on a flagged save emits nothing', () => {
    const control = player({ breakthroughGrade: 2, realmId: 'qi_refining' })

    const carried = player({ breakthroughGrade: 2, realmId: 'qi_refining' })
    carried.hiddenPerfection = {
      lineageActive: true,
      realms: {},
      completedHiddenBodyRealmIds: [],
      hiddenBreakthroughRealmIds: ['qi_refining'],
    }
    carried.grantedRealmPassiveIds.push('qi_refining')
    // The enhanced (hidden) nhap_dao set a real pre-beta save carries.
    for (const stat of ['maxHp', 'hpRegenPerTurn'] as const) {
      carried.modifiers.push({
        id: `realm-passive:nhap_dao:${stat}`,
        sourceId: 'nhap_dao',
        sourceType: 'realm',
        stat,
        percent: 0.3,
      })
    }
    for (const stat of ['maxMp', 'manaRegenPerTurn'] as const) {
      carried.modifiers.push({
        id: `realm-passive:nhap_dao:${stat}`,
        sourceId: 'nhap_dao',
        sourceType: 'realm',
        stat,
        percent: 0.3,
        domain: 'spell',
      })
    }

    const controlStats = resolvePlayerStatAssembly(control, []).stats
    const carriedStats = resolvePlayerStatAssembly(carried, []).stats

    expect(carriedStats.maxHp).toBe(controlStats.maxHp)
    expect(carriedStats.maxMp).toBe(controlStats.maxMp)
    expect(carriedStats.hpRegenPerTurn).toBe(controlStats.hpRegenPerTurn)
    expect(carriedStats.manaRegenPerTurn).toBe(controlStats.manaRegenPerTurn)
  })

  it('a hidden-breakthrough kien_co enhanced passive carried on a flagged save emits nothing', () => {
    const control = player({ realmId: 'foundation_establishment' })

    const carried = player({ realmId: 'foundation_establishment' })
    carried.hiddenPerfection = {
      lineageActive: true,
      realms: {},
      completedHiddenBodyRealmIds: [],
      hiddenBreakthroughRealmIds: ['foundation_establishment'],
    }
    carried.grantedRealmPassiveIds.push('foundation_establishment')
    for (const stat of ['strength', 'dexterity', 'intelligence', 'attunement', 'vitality'] as const) {
      carried.modifiers.push({
        id: `realm-passive:kien_co:${stat}`,
        sourceId: 'kien_co',
        sourceType: 'realm',
        stat,
        percent: 0.2,
      })
    }

    const controlStats = resolvePlayerStatAssembly(control, []).stats
    const carriedStats = resolvePlayerStatAssembly(carried, []).stats

    expect(carriedStats.strength).toBe(controlStats.strength)
    expect(carriedStats.vitality).toBe(controlStats.vitality)
    expect(carriedStats.intelligence).toBe(controlStats.intelligence)
  })

  it('a normal realm passive still emits (control)', () => {
    const p = player({ breakthroughGrade: 2, realmId: 'qi_refining' })
    grantRealmPassive(p, 'qi_refining')

    const stats = resolvePlayerStatAssembly(p, []).stats
    const base = resolvePlayerStatAssembly(player({ breakthroughGrade: 2, realmId: 'qi_refining' }), []).stats

    expect(stats.maxHp).toBeGreaterThan(base.maxHp)
  })

  it('a forged realm-passive payload mints no stats and is flagged at acceptance', () => {
    const p = player()
    const forged: StatModifier = {
      id: 'realm-passive:forged',
      sourceId: 'nhap_dao',
      sourceType: 'realm',
      stat: 'strength',
      percent: 9,
    }
    p.modifiers.push(forged)

    const stats = resolvePlayerStatAssembly(p, []).stats
    const base = resolvePlayerStatAssembly(player(), []).stats
    expect(stats.strength).toBe(base.strength)
  })

  it('a payload carrying the authored passive id but no grant marker still mints nothing', () => {
    // Isolates the marker gate: rebuild-don't-trust alone would let an
    // authored-id claim through without the ownership witness.
    const p = player()
    const forged: StatModifier = {
      id: 'realm-passive:nhap_dao:maxHp',
      sourceId: 'nhap_dao',
      sourceType: 'realm',
      stat: 'maxHp',
      percent: 9,
    }
    p.modifiers.push(forged)

    const stats = resolvePlayerStatAssembly(p, []).stats
    const base = resolvePlayerStatAssembly(player(), []).stats
    expect(stats.maxHp).toBe(base.maxHp)
  })

  it('a persisted phap tu/spell-channel claim is fabricated - real phap tu channels emit via way facets, not player.modifiers (F-A7-1)', () => {
    // Writer inventory for persisted player.modifiers: realm passives
    // (marker-gated), meridian chapter (bat-mach:*), loi kiep grant,
    // and the rebuilt equipment slice. The playable phap tu path emits
    // its 'spell'-channel modifiers as derived way facets - a PERSISTED
    // claim of the same source is a forged entry and must emit nothing.
    const p = player()
    p.modifiers.push({
      id: 'phap_tu_linh_luc',
      sourceId: 'spell',
      sourceType: 'realm',
      stat: 'maxMp',
      flat: 100,
      domain: 'spell',
    })

    const stats = resolvePlayerStatAssembly(p, []).stats
    const base = resolvePlayerStatAssembly(player(), []).stats

    expect(stats.maxMp).toBe(base.maxMp)
  })

  it('carried body-chapter realm modifiers (meridian) emit nothing under the lock', () => {
    const carried = player()
    carried.bodyProgression.meridian.openedIds = ['nham_mach']
    const meridian = MERIDIANS.find((m) => m.id === 'nham_mach')
    expect(meridian).toBeDefined()
    for (const stat of meridian!.stats) {
      carried.modifiers.push({
        id: `bat-mach:nham_mach:${stat}`,
        sourceId: 'nham_mach',
        sourceType: 'realm',
        stat,
        percent: meridian!.percentAtFullTier,
      })
    }

    const stats = resolvePlayerStatAssembly(carried, []).stats
    const base = resolvePlayerStatAssembly(player(), []).stats

    for (const stat of meridian!.stats) {
      expect(stats[stat as keyof typeof stats]).toBe(base[stat as keyof typeof base])
    }
  })

  it('carried bodyProgression base-stat deltas emit nothing under the lock', () => {
    const carried = player()
    carried.bodyProgression.body_refinement.completedTiers = 3
    carried.bodyProgression.zhou_tian.completed = 12

    const carriedStats = resolvePlayerStatAssembly(carried, []).stats
    const base = resolvePlayerStatAssembly(player(), []).stats

    expect(carriedStats.maxHp).toBe(base.maxHp)
    expect(carriedStats.strength).toBe(base.strength)
    expect(collectBodyBaseStatDeltas(carried)).toEqual({})
  })

  it('acceptance flags a realm-passive payload whose marker was never granted', () => {
    const p = player()
    p.modifiers.push({
      id: 'realm-passive:forged',
      sourceId: 'nhap_dao',
      sourceType: 'realm',
      stat: 'strength',
      percent: 9,
    })

    const save = {
      version: CURRENT_SAVE_VERSION,
      player: p,
      techniques: [],
      skills: [],
      materials: [],
      equipment: [],
      pills: [],
      talismans: [],
      formations: [],
      buildings: [],
      equipmentSlots: [],
    }
    const result = validateGameSaveShape(save as never)

    expect(
      result.issues.some((issue) => issue.path.startsWith('player.modifiers')),
    ).toBe(true)
  })
})
