/**
 * BETA SCOPE LOCK v2 Phase-6 - pins the canonical global-surface
 * read-models in src/core/betaScopeSurface.ts plus the fail-closed
 * domain gates this phase adds (spec sec.7/20-27, work-order
 * sec.19/38):
 *
 *   - the command wheel / building hotspots / panel identities resolve
 *     through allow-lists - an id not declared beta-visible is
 *     scope-hidden (no button, hotspot, tooltip or deep-link can reach
 *     it);
 *   - the realm ladder read-model emits only in-window realms - no
 *     post-Truc-Co teaser node, no Kim Dan CTA;
 *   - hidden progression (lineage / body tier / ancient trial / Nghich
 *     Chu Thien / hidden beasts / companion gifts / hidden channels /
 *     daily reset) fails closed at the domain seam, not at each caller;
 *   - betaCompletionFor reports the act-3 final boss defeat (the
 *     deliberate Beta Complete beat);
 *   - unsupportedReleaseReason flags legacy saves carrying non-beta
 *     state instead of auto-converting them (fields persist untouched).
 */
import { describe, expect, it } from 'vitest'
import {
  BETA_FINAL_BOSS_ENEMY_ID,
  betaCompletionFor,
  betaHiddenRealmRecordFor,
  betaNextRealmSurfaceFor,
  betaRealmLadderNodes,
  betaSupportedFor,
  betaWheelSlots,
  isBetaBuildingSurface,
  isBetaLeftPanelMode,
  isBetaStandalonePanel,
  isBetaWheelSlot,
  unsupportedReleaseReason,
} from '@/core/betaScopeSurface'
import { BETA_ENEMY_ROSTER, isBetaEquipmentTab } from '@/core/betaScope'
import { COMMAND_WHEEL_SLOTS } from '@/data/ui/commandWheelCatalog'
import { REALM_PASSIVE_NODES } from '@/data/realm/RealmPassiveNodes'
import { STAGES } from '@/data/stage/Stages'
import { isRealmAvailable } from '@/core/realm/ReleasePolicy'
import { createDefaultPlayer, type FormationLoadout, type PlayerData } from '@/core/player/Player'
import { canProgressHiddenBody, isHiddenBreakthroughEligible } from '@/core/realm/hidden/HiddenLineage'
import { isNghichChuTianRevealed } from '@/core/realm/hidden/NghichChuTian'
import { HiddenBeastSystem } from '@/core/game/HiddenBeastSystem'
import { issueCompanionGifts } from '@/core/companion/CompanionGifts'
import type { CompanionInstance } from '@/data/companion/Companions'
import type { ArtifactProgress } from '@/core/artifact/Artifact'
import type { RealmHiddenState } from '@/core/realm/hidden/HiddenPerfection'
import { createBaseStats } from '@/core/stats/StatBlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'

// The global test setup unlocks every catalog way + feature for
// suites written pre-lock; this suite asserts the canonical beta
// allow-lists and the fail-closed domain gates, so re-pin them.
lockBetaWaysForTests()
lockBetaFeaturesForTests()

const discoveredRecord: RealmHiddenState = {
  discovered: true,
  bodyCompleted: true,
  frozen: false,
}

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    ...createDefaultPlayer(),
    ...overrides,
  }
}

const SCOPE_HIDDEN_SLOT_IDS = [
  'phap_bao',
  'formation_slot',
  'companion_roster',
  'chi_hien_quan',
] as const

describe('betaScopeSurface - navigation allow-lists', () => {
  it('betaWheelSlots emits every catalog slot minus the scope-hidden ids', () => {
    const emitted = betaWheelSlots().map((slot) => slot.id)

    expect(emitted).toEqual(
      COMMAND_WHEEL_SLOTS
        .map((slot) => slot.id)
        .filter((id) => !(SCOPE_HIDDEN_SLOT_IDS as readonly string[]).includes(id)),
    )

    // The surviving ring-3 buildings stay - only chi_hien_quan drops.
    for (const id of ['teleport_array', 'pill_room', 'equipment_hall']) {
      expect(emitted, `expected wheel slot ${id}`).toContain(id)
    }
  })

  it.each([...SCOPE_HIDDEN_SLOT_IDS])('isBetaWheelSlot fails closed on %s', (id) => {
    expect(isBetaWheelSlot(id)).toBe(false)
  })

  it('talisman_slot stays scope-admitted (its own available() keeps it hidden)', () => {
    // Scope admission and slot availability are separate axes: the
    // NEVER_AVAILABLE future slot is in-scope yet still never renders.
    expect(isBetaWheelSlot('talisman_slot')).toBe(true)
    const catalog = COMMAND_WHEEL_SLOTS.find((slot) => slot.id === 'talisman_slot')
    expect(catalog?.available()).toBe(false)
  })

  it('isBetaWheelSlot fails closed on an id with no scope decision', () => {
    // Same allow-list law as the building/panel maps: a slot id absent
    // from BETA_WHEEL_SLOT_FEATURES resolves scope-hidden, so a slot
    // authored later without a scope decision can never leak.
    expect(isBetaWheelSlot('made_up_slot')).toBe(false)
  })

  it('isBetaBuildingSurface admits the beta set and fails closed otherwise', () => {
    for (const id of [
      'teleport_array',
      'pill_room',
      'gathering_outpost',
      'equipment_hall',
      'vendor',
    ]) {
      expect(isBetaBuildingSurface(id), `expected ${id} beta-visible`).toBe(true)
    }

    expect(isBetaBuildingSurface('chi_hien_quan')).toBe(false)
    expect(isBetaBuildingSurface('made_up_building')).toBe(false)
  })

  it('isBetaStandalonePanel fails closed on dormant panels', () => {
    for (const panel of ['skill', 'realm', 'quan_khi', 'quest']) {
      expect(isBetaStandalonePanel(panel), `expected ${panel}`).toBe(true)
    }
    for (const panel of ['artifact', 'tran_phap', 'companion', 'made_up_panel']) {
      expect(isBetaStandalonePanel(panel), `expected ${panel} hidden`).toBe(false)
    }
  })

  it('isBetaEquipmentTab admits only enhance + dissolve under the lock', () => {
    expect(isBetaEquipmentTab('enhance')).toBe(true)
    expect(isBetaEquipmentTab('dissolve')).toBe(true)
    for (const tab of ['wash', 'refine', 'decompose', 'made_up_tab']) {
      expect(isBetaEquipmentTab(tab), `expected ${tab} hidden`).toBe(false)
    }
  })

  it('isBetaLeftPanelMode hides only worker_lodge', () => {
    for (const mode of [
      'character',
      'inventory',
      'exploration',
      'settings',
      'equipment_hall',
      'pill_room',
      'scripture_pavilion',
      'stage_select',
      'vendor',
    ]) {
      expect(isBetaLeftPanelMode(mode), `expected ${mode}`).toBe(true)
    }
    expect(isBetaLeftPanelMode('worker_lodge')).toBe(false)
    expect(isBetaLeftPanelMode('made_up_mode')).toBe(false)
  })
})

describe('betaScopeSurface - realm ladder + next-realm surface', () => {
  it('betaRealmLadderNodes emits the mortal rung plus in-window nodes only', () => {
    const ids = betaRealmLadderNodes().map((node) => node.realmId)

    expect(ids).toEqual(['mortal', 'qi_refining', 'foundation_establishment'])

    // Every emitted node is realm-available - no comingSoon teaser can
    // appear (authored post-ceiling nodes never reach the rail).
    for (const node of betaRealmLadderNodes()) {
      expect(isRealmAvailable(node.realmId)).toBe(true)
      expect(node.comingSoon).toBe(false)
    }

    // The authored list is untouched (non-destructive filtering).
    expect(REALM_PASSIVE_NODES.length).toBeGreaterThan(betaRealmLadderNodes().length - 1)
  })

  it('betaNextRealmSurfaceFor names the next realm inside the window', () => {
    expect(betaNextRealmSurfaceFor(player({ realmId: 'mortal' }))).toEqual({
      nextRealmId: 'qi_refining',
      nextRealmName: 'Luyện Khí',
    })
    expect(betaNextRealmSurfaceFor(player({ realmId: 'qi_refining' }))).toEqual({
      nextRealmId: 'foundation_establishment',
      nextRealmName: 'Trúc Cơ',
    })
  })

  it('betaNextRealmSurfaceFor fails closed at and beyond the ceiling', () => {
    expect(betaNextRealmSurfaceFor(player({ realmId: 'foundation_establishment' }))).toBeNull()
    expect(betaNextRealmSurfaceFor(player({ realmId: 'golden_core' }))).toBeNull()
    expect(betaNextRealmSurfaceFor(player({ realmId: 'made_up_realm' }))).toBeNull()
  })
})

describe('betaScopeSurface - hidden realm record read', () => {
  it('betaHiddenRealmRecordFor resolves undefined under beta even with a discovered record', () => {
    const p = player({
      hiddenPerfection: {
        lineageActive: true,
        completedHiddenBodyRealmIds: [],
        hiddenBreakthroughRealmIds: [],
        realms: { mortal: discoveredRecord },
      },
    })

    expect(betaHiddenRealmRecordFor(p, 'mortal')).toBeUndefined()
  })
})

describe('hidden progression domain gates', () => {
  it('canProgressHiddenBody fails closed even on an open lineage', () => {
    const p = player({
      realmId: 'mortal',
      hiddenPerfection: {
        lineageActive: true,
        completedHiddenBodyRealmIds: [],
        hiddenBreakthroughRealmIds: [],
        realms: {},
      },
    })

    expect(canProgressHiddenBody(p, 'mortal')).toBe(false)
  })

  it('isHiddenBreakthroughEligible fails closed on a would-be-eligible mortal', () => {
    const p = player({
      realmId: 'mortal',
      realmLevel: 18,
      baseStats: createBaseStats({
        strength: 99999,
        dexterity: 99999,
        intelligence: 99999,
        attunement: 99999,
        vitality: 99999,
      }),
      hiddenPerfection: {
        lineageActive: true,
        completedHiddenBodyRealmIds: ['mortal'],
        hiddenBreakthroughRealmIds: [],
        realms: {},
      },
    })

    expect(canProgressHiddenBody(p, 'mortal')).toBe(false)
    expect(isHiddenBreakthroughEligible(p)).toBe(false)
  })

  it('isNghichChuTianRevealed fails closed even on a discovered legacy record', () => {
    const p = player({
      realmId: 'foundation_establishment',
      hiddenPerfection: {
        lineageActive: true,
        completedHiddenBodyRealmIds: [],
        hiddenBreakthroughRealmIds: [],
        realms: { foundation_establishment: discoveredRecord },
      },
    })

    expect(isNghichChuTianRevealed(p)).toBe(false)
  })

  it('HiddenBeastSystem never substitutes and never writes counters', () => {
    const system = new HiddenBeastSystem({
      getEnemyTemplate: () => {
        throw new Error('a hidden-beast template lookup must never run under beta')
      },
      channels: [
        {
          kind: 'hidden_beast',
          id: 'fixture_channel',
          enemyId: 'fixture_beast',
          bandRealmId: 'qi_refining',
          killThreshold: 1,
          spawnChancePerSpawn: 1,
        } as const,
      ],
    })
    const p = player({ realmId: 'qi_refining', hiddenBeastKills: {} })

    // Window already "open" (kills >= threshold) - still no substitution.
    p.hiddenBeastKills['fixture_channel'] = 5
    expect(system.maybeReplaceSpawn(p, 'qi_refining', () => 0)).toBeUndefined()

    // Kill accounting stays inert: no increment, no opened channel (the
    // hidden_window_opened cue can never fire from a beta build).
    expect(system.onEnemyDefeated(p, 'ordinary_enemy', 'qi_refining')).toEqual([])
    expect(p.hiddenBeastKills['fixture_channel']).toBe(5)
    expect(p.hiddenBeastKills['fixture_channel_2']).toBeUndefined()
  })

  it('issueCompanionGifts writes no record on either seam', () => {
    const p = player()

    expect(
      issueCompanionGifts(p, { kind: 'realm_entered', realmId: 'foundation_establishment' }),
    ).toEqual([])
    expect(
      issueCompanionGifts(p, { kind: 'stage_completed', stageId: 'foundation_floor_10' }),
    ).toEqual([])
    expect(p.companionGifts).toEqual([])
  })
})

describe('betaScopeSurface - Beta Complete beat', () => {
  it('BETA_FINAL_BOSS_ENEMY_ID is the act-3 roster boss', () => {
    expect(BETA_FINAL_BOSS_ENEMY_ID).toBe('foundation_ferocious_flood_dragon_whelp')
    const act3Bosses = BETA_ENEMY_ROSTER.filter(
      (entry) => entry.act === 3 && entry.role === 'boss',
    )
    expect(act3Bosses.map((entry) => entry.id)).toEqual([BETA_FINAL_BOSS_ENEMY_ID])
  })

  it('betaCompletionFor reports the final-boss stage defeat', () => {
    const bossStages = STAGES.filter((stage) => stage.bossEnemyId === BETA_FINAL_BOSS_ENEMY_ID)
    expect(bossStages.length).toBe(1)
    const bossStageId = bossStages[0]!.id

    expect(betaCompletionFor(player())).toEqual({
      act3FinalBossDefeated: false,
      betaComplete: false,
    })
    expect(
      betaCompletionFor(player({ completedStageIds: ['mortal_floor_1', 'qi_refining_floor_3'] })),
    ).toEqual({ act3FinalBossDefeated: false, betaComplete: false })
    expect(betaCompletionFor(player({ completedStageIds: [bossStageId] }))).toEqual({
      act3FinalBossDefeated: true,
      betaComplete: true,
    })
  })
})

describe('betaScopeSurface - save safety read-model', () => {
  it('a fresh beta save is supported (no reason)', () => {
    const p = player()
    expect(betaSupportedFor(p)).toBe(true)
    expect(unsupportedReleaseReason(p)).toBeNull()
  })

  it('the default open lineage alone is not flagged', () => {
    // createDefaultPlayer ships lineageActive:true with empty realms -
    // the read-model must not condemn every fresh beta save.
    expect(unsupportedReleaseReason(player())).toBeNull()
  })

  it('flags a realm beyond the release ceiling', () => {
    expect(unsupportedReleaseReason(player({ realmId: 'golden_core' }))).toBe(
      'realm_beyond_release',
    )
  })

  it('flags a non-beta cultivation way', () => {
    expect(
      unsupportedReleaseReason(
        player({ cultivationPath: 'sword', cultivationWay: 'sword_pathway' }),
      ),
    ).toBe('way_out_of_scope')
    expect(
      unsupportedReleaseReason(
        player({ cultivationPath: 'body', cultivationWay: 'hidden_body_pathway' }),
      ),
    ).toBe('way_out_of_scope')
  })

  it('flags persisted hidden-progression state', () => {
    const withRecord = player({
      hiddenPerfection: {
        lineageActive: true,
        completedHiddenBodyRealmIds: [],
        hiddenBreakthroughRealmIds: [],
        realms: { mortal: discoveredRecord },
      },
    })
    expect(unsupportedReleaseReason(withRecord)).toBe('hidden_progression_state')

    const withKills = player({ hiddenBeastKills: { huyet_mong: 12 } })
    expect(unsupportedReleaseReason(withKills)).toBe('hidden_progression_state')

    // Malformed persisted fields report a reason instead of throwing.
    const malformed = player()
    ;(malformed as { hiddenPerfection?: unknown }).hiddenPerfection = {
      realms: 'not-an-object',
    }
    expect(unsupportedReleaseReason(malformed)).toBe('hidden_progression_state')
  })

  it('flags companion / artifact / formation leftovers', () => {
    const withCompanion = player({
      companions: [{ instanceId: 'c1' } as CompanionInstance],
    })
    expect(unsupportedReleaseReason(withCompanion)).toBe('companion_owned')

    const withArtifact = player({
      artifact: {
        artifactId: 'ngu_hanh_chau',
        realmId: 'mortal',
        realmLevel: 1,
        experience: 0,
        grade: 'pham',
      } as ArtifactProgress,
    })
    expect(unsupportedReleaseReason(withArtifact)).toBe('artifact_owned')

    const withFormation = player({
      formationLoadout: { formationId: 'f1', assignments: [] } as FormationLoadout,
    })
    expect(unsupportedReleaseReason(withFormation)).toBe('formation_loadout')
  })

  it('reports the highest-precedence reason only', () => {
    // Order: realm -> way -> hidden -> companion -> artifact -> formation.
    const goldenWithCompanion = player({
      realmId: 'golden_core',
      companions: [{ instanceId: 'c1' } as CompanionInstance],
    })
    expect(unsupportedReleaseReason(goldenWithCompanion)).toBe('realm_beyond_release')

    const wayWithFormation = player({
      cultivationPath: 'body',
      cultivationWay: 'hidden_body_pathway',
      formationLoadout: { formationId: 'f1', assignments: [] } as FormationLoadout,
    })
    expect(unsupportedReleaseReason(wayWithFormation)).toBe('way_out_of_scope')
  })
})
