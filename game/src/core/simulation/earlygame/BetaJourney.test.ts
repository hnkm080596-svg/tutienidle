/**
 * BETA CANONICAL JOURNEY (spec sec.9 / frontend-contract.md) - drives the
 * complete beta player path through the production seams, asserting at
 * every phase that no scope-hidden surface ever appears:
 *
 *   fresh install -> Character Creation (name + talent only)
 *   -> Mortal with Linh Bao (the pinned beta starter)
 *   -> the mortal cast grind (linh_bao Lv3 is the spell_pathway
 *      offerGate - the authored initiation pre-condition)
 *   -> normal breakthrough gate (mortal realmLevel 12) -> Quan Khi
 *   -> Five Element Initiation: exactly one element, atomic commit
 *   -> Act I (mortal_dong_1..10) -> Act II (qi_refining floors)
 *   -> elemental Basic progression + Special unlock at its authored
 *      gate (the linh_ngo_<special> keystone, realm-gated at
 *      foundation_establishment)
 *   -> Foundation tribulation (two-phase settle/drain + entitlement)
 *   -> Act III (foundation_floor_1..10) -> final boss ->
 *      betaCompletionFor() beats true.
 *
 * Method: EarlyGameSession is the repo's canonical headless journey
 * driver - it registers the SAME production catalogs as App.vue, so
 * gating/unlock/commit calls go through the real ops layer. Assertions
 * on player-facing surfaces read the SAME read-models the Vue layer is
 * contractually bound to (betaCombatRolesFor, betaSkillTreeFor,
 * betaWheelSlots, getStageSurfaceModels, getWorkerLodgeSurfaceModel,
 * getBetaQuestSurfaceModels, betaRealmLadderNodes,
 * betaNextRealmSurfaceFor, betaCompletionFor) - a scope-hidden surface
 * that the read-model marks anything but 'scope-hidden' is a leak.
 *
 * Suite conventions reused from the sibling journey suites
 * (ElementBossMatrix / TrucCoJourney): seeded RNG, the FIXTURE_LQ_STATS
 * survival profile for tribulation legs, the "grinder spread" attribute
 * split, and realm-legal dia-grade gear edits at the authored boss
 * points. The only seeded progression state is day-paced pacing
 * (attribute top-ups, gear rolls, tribulation survival) - every GATE
 * (levels, cast threshold, chapter clears, keystone prereqs) is reached
 * through the real production seam.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { EarlyGameSession } from '@/core/simulation/earlygame/EarlyGameSession'
import { usePlayerStore } from '@/stores/player'
import { mulberry32 } from '@/core/battle/SeededRandom'
import { asBaseStats } from '@/core/stats/StatBlock'
import { canUseItemGrade } from '@/core/equipment/canUseItem'
import { CAST_LEVELING_THRESHOLDS, getCastLeveledSkillLevel } from '@/core/skill/CastLeveling'
import { SPELL_KIT_IDS } from '@/data/skill/Skills'
import { STAGES } from '@/data/stage/Stages'
import {
  BETA_ENEMY_ROSTER,
  BETA_EQUIPMENT_TABS,
  BETA_MORTAL_STARTER_SKILL_ID,
  BETA_PLAYABLE_ELEMENTS,
  isBetaEquipmentTab,
} from '@/core/betaScope'
import {
  BETA_FINAL_BOSS_ENEMY_ID,
  betaCompletionFor,
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
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { restoreAuthoredFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { REALM_TIERS } from '@/core/realm/RealmTierMap'
import type { ElementType } from '@/core/element/ElementType'

// The global test setup unlocks every catalog way + feature for suites
// written pre-lock; the canonical beta journey runs under the shipped
// feature table (wash/refine live, everything else still locked).
lockBetaWaysForTests()
restoreAuthoredFeaturesForTests()

const SEED = 20260930
const COMMIT_ELEMENT: ElementType = 'fire'
const KIT = SPELL_KIT_IDS[COMMIT_ELEMENT]
const KEYSTONE = `linh_ngo_${KIT[1]}`

const MORTAL_FLOORS = Array.from({ length: 10 }, (_, i) => `mortal_dong_${i + 1}`)
const QI_FLOORS = [
  'qi_refining_forest',
  'qi_refining_deep_forest',
  'qi_refining_ember_canyon',
  'qi_refining_scorched_ridge',
  'qi_refining_sand_plain',
  'qi_refining_stone_range',
  'qi_refining_blade_peak',
  'qi_refining_mineral_pit',
  'qi_refining_mystic_marsh',
  'qi_refining_abyssal_pool',
]
const FOUNDATION_FLOORS = Array.from(
  { length: 10 },
  (_, i) => `foundation_floor_${i + 1}`,
)

const SCOPE_HIDDEN_WHEEL_SLOTS = [
  'phap_bao',
  'formation_slot',
  'companion_roster',
  'chi_hien_quan',
] as const
const SCOPE_HIDDEN_BUILDINGS = ['chi_hien_quan'] as const
const SCOPE_HIDDEN_STANDALONE_PANELS = ['artifact', 'tran_phap', 'companion'] as const
const SCOPE_HIDDEN_LEFT_MODES = ['worker_lodge'] as const
const SCOPE_HIDDEN_EQUIPMENT_TABS = ['decompose', 'ore_decompose'] as const
// Every tier above the beta ceiling (foundation_establishment) is a
// scope-hidden realm: derived from the authoritative tier list, so a
// realm added post-ceiling is covered without touching this test.
const BETA_WINDOW_REALMS = ['mortal', 'qi_refining', 'foundation_establishment'] as const
const SCOPE_HIDDEN_REALMS = REALM_TIERS.filter(
  (tier) => !(BETA_WINDOW_REALMS as readonly string[]).includes(tier),
)
// Dormant progression ids that must never resolve 'available' on a beta
// surface: hidden ways, sword/body ways, and the ultimate precursor
// emblems all live behind feature flags the frontend never reads.
const SCOPE_HIDDEN_REALM_NODE_HINTS = ['golden', 'kim_dan'] as const

/** Committed LQ-side survival fixture (TrucCoJourney convention):
 * tribulation damage is seeded-input survival math, not the gate under
 * test - every GATE around it is still reached through the real op. */
const FIXTURE_SURVIVAL_STATS = {
  maxHp: 5_000_000,
  defense: 50_000,
  hpRegenPerTurn: 0,
  might: 20_000,
  speed: 200,
  maxMp: 5_000,
  accuracyRating: 100,
} as const

/** Realm-legal gear roll at the authored boss-fight point - the same
 * fixture the ElementBossMatrix suites use (dia quality + element power
 * prefix + max_hp/attack filler on the CURRENT realm's grade). */
const GEAR_SET = [
  'base_quyen',
  'base_bao',
  'base_quan',
  'base_hai',
  'base_gioi',
  'base_truy',
] as const
const GEAR_SLOTS = ['weapon', 'armor', 'helmet', 'boots', 'ring', 'necklace'] as const

let s: EarlyGameSession

function seedSurvivalFixture(): void {
  s.player.baseStats = asBaseStats({ ...s.player.baseStats, ...FIXTURE_SURVIVAL_STATS })
}

function gearUp(enhance: number): void {
  const powerAffix = `prefix_${COMMIT_ELEMENT}_power`
  for (const itemId of GEAR_SET) {
    expect(s.gameManager.equipmentOps.obtainEquipment(itemId, s.player)).not.toBeNull()
  }
  const plan: string[][] = [
    [powerAffix],
    [powerAffix],
    [powerAffix, 'prefix_max_hp'],
    ['prefix_max_hp', 'prefix_attack'],
    ['prefix_max_hp'],
    ['prefix_attack'],
  ]
  let edited = 0
  for (const item of s.gameManager.equipmentBag.getAll()) {
    if (!canUseItemGrade(item.grade, s.player.realmId)) continue
    item.quality = 'dia'
    const ids = plan[Math.min(edited, plan.length - 1)]!
    item.affixes = ids.map((affixId) => ({
      affixId,
      tier: 3,
      value: affixId === 'prefix_max_hp' ? 55 : affixId === 'prefix_attack' ? 16 : 20,
    }))
    edited++
  }
  for (const slot of GEAR_SLOTS) {
    s.gameManager.equipmentSlotManager.get(slot).enhanceLevel = enhance
  }
  expect(s.equipAll()).toBeGreaterThan(0)
}

function grindToLevel(level: number): void {
  let guard = 0
  while (s.player.realmLevel < level && guard++ < 2000) {
    // 1-hour chunks - the pace floor retune (2026-10-05) prices Luyen Khi
    // at ~1 day and Truc Co at ~1 week of base-rate cultivation; 120s
    // slices no longer reach the target inside the guard.
    s.cultivate(3600)
    s.breakthroughIfReady()
  }
  expect(
    s.player.realmLevel,
    `realm never reached level ${level}`,
  ).toBeGreaterThanOrEqual(level)
}

/** 2:1 strength:vitality - the grinder spread from ElementBossMatrix. */
function spendAttributes(count: number): void {
  s.player.attributePoints += count
  let i = 0
  while (s.player.attributePoints > 0 && s.allocateAttribute(i++ % 3 === 0 ? 'vitality' : 'strength')) {
    /* drain */
  }
}

/**
 * The scope sweep: at ANY journey point, every forbidden surface class
 * must resolve scope-hidden / fail closed on the read-models the UI is
 * bound to. A scope-hidden feature rendering 'locked' is a leak the
 * same as rendering it available (spec sec.9 / contract sec.C-I).
 */
function assertScopeSanity(label: string): void {
  const gm = s.gameManager
  const player = s.player

  // Combat rail - the ultimate role exists in the model only so the UI
  // knows it is ABSENT; it must stay 'scope-hidden' forever.
  const roles = gm.progressionOps.betaCombatRolesFor(player)
  const ultimate = roles.find((role) => role.role === 'ultimate')
  expect(ultimate?.state, `${label}: ultimate rail must be scope-hidden`).toBe('scope-hidden')
  expect(roles.find((role) => role.role === 'basic')).toBeDefined()
  expect(roles.find((role) => role.role === 'special')).toBeDefined()

  // Suppressed legacy combat surfaces (sword orb picker + an emblem).
  for (const surface of gm.progressionOps.betaCombatSurfacesFor(player)) {
    expect(surface.state, `${label}: ${surface.surface} must be scope-hidden`).toBe('scope-hidden')
  }

  // Navigation chrome: wheel, buildings, standalone panels, left modes.
  for (const slotId of SCOPE_HIDDEN_WHEEL_SLOTS) {
    expect(isBetaWheelSlot(slotId), `${label}: wheel slot ${slotId}`).toBe(false)
  }
  for (const slot of betaWheelSlots()) {
    expect(
      SCOPE_HIDDEN_WHEEL_SLOTS,
      `${label}: rendered wheel must not contain ${slot.id}`,
    ).not.toContain(slot.id)
  }
  for (const buildingId of SCOPE_HIDDEN_BUILDINGS) {
    expect(isBetaBuildingSurface(buildingId), `${label}: building ${buildingId}`).toBe(false)
  }
  for (const panel of SCOPE_HIDDEN_STANDALONE_PANELS) {
    expect(isBetaStandalonePanel(panel), `${label}: panel ${panel}`).toBe(false)
  }
  for (const mode of SCOPE_HIDDEN_LEFT_MODES) {
    expect(isBetaLeftPanelMode(mode), `${label}: left mode ${mode}`).toBe(false)
  }

  // Economy surfaces: equipment hall admits enhance/wash/refine/
  // dissolve; decompose stays scope_hidden at the domain seam.
  for (const tab of SCOPE_HIDDEN_EQUIPMENT_TABS) {
    expect(isBetaEquipmentTab(tab), `${label}: equipment tab ${tab}`).toBe(false)
  }
  expect([...BETA_EQUIPMENT_TABS].sort(), `${label}: beta equipment tabs`).toEqual([
    'dissolve',
    'enhance',
    'refine',
    'wash',
  ])

  // Worker Lodge FINAL POLICY: every authored tab scope-hidden,
  // nhan_cong included - manual workforce has no UI.
  const lodge = gm.buildingOps.getWorkerLodgeSurfaceModel(player)
  expect(lodge.tabs.length, `${label}: worker lodge tab census`).toBeGreaterThan(0)
  for (const tab of lodge.tabs) {
    expect(tab.verdict, `${label}: worker lodge tab ${tab.id}`).toBe('scope-hidden')
    if (tab.id === 'nhan_cong') {
      expect(tab.manualAssignOffered, `${label}: nhan_cong manual assign`).not.toBe(true)
    }
  }

  // Quests: once-cadence only; no daily cadence exists in beta.
  for (const quest of gm.questOps.getBetaQuestSurfaceModels()) {
    expect(quest.cadence, `${label}: quest ${quest.id} cadence`).toBe('once')
  }

  // Realm ladder: only in-window realms (mortal/qi_refining/
  // foundation_establishment) - no post-ceiling teaser.
  for (const node of betaRealmLadderNodes()) {
    expect(
      SCOPE_HIDDEN_REALMS,
      `${label}: realm ladder must not list ${node.realmId}`,
    ).not.toContain(node.realmId)
    for (const hint of SCOPE_HIDDEN_REALM_NODE_HINTS) {
      expect(
        node.label.toLowerCase().includes(hint) || node.realmId.includes(hint),
        `${label}: realm ladder node ${node.realmId}/${node.label} looks like a Kim Dan teaser`,
      ).toBe(false)
    }
    // A ladder entry may never render as a coming-soon teaser for a
    // scope-hidden realm (Kim Dan has no node to sit on).
    expect(node.comingSoon, `${label}: realm ladder teaser on ${node.realmId}`).toBe(false)
  }

  // Save safety: a clean beta save never carries an unsupported reason.
  expect(betaSupportedFor(player), `${label}: betaSupportedFor`).toBe(true)
  expect(unsupportedReleaseReason(player), `${label}: unsupportedReleaseReason`).toBeNull()
}

/**
 * Every authored stage's player-facing surface stays inside the beta
 * roster: displayEnemy and reward preview can only name roster members.
 * Off-roster enemies on a stage surface = a scope leak into Act content.
 */
function assertStageRosterSanity(label: string): void {
  const rosterIds = new Set(BETA_ENEMY_ROSTER.map((entry) => entry.id))
  const models = s.gameManager.stageOps.getStageSurfaceModels(s.player)
  for (const model of models) {
    if (model.displayEnemy !== undefined && model.displayEnemy !== null) {
      expect(
        rosterIds.has(model.displayEnemy.id),
        `${label}: stage ${model.stageId} shows off-roster enemy ${model.displayEnemy.id}`,
      ).toBe(true)
    }
  }
}

describe('beta canonical journey (spec sec.9) - headless drive of the production ops', () => {
  beforeAll(() => {
    setActivePinia(createPinia())
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(SEED))
    s = new EarlyGameSession({
      seed: SEED,
      profile: { name: 'smoke', talentIds: ['hap_linh'] },
      playerOwner: usePlayerStore(),
    })
    // The real App.vue frame loop cultivates + auto-breaks through
    // during battles - parity ON makes runStage consume the same loop.
    s.combatCultivationParity = true
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('step 1 - fresh install creation writes exactly name + talents; the beta starter is linh_bao', () => {
    const p = s.player
    expect(p.name).toBe('smoke')
    expect(p.selectedTalentIds).toEqual(['hap_linh'])
    // No skill/way/element pick exists on the creation payload - the
    // boot seam pins the beta starter through the ONE role-write op.
    expect(p.realmId).toBe('mortal')
    expect(p.realmLevel).toBe(1)
    expect(p.cultivationPath).toBeUndefined()
    expect(p.cultivationWay).toBeUndefined()
    expect(p.mortalBasicSkillId).toBe(BETA_MORTAL_STARTER_SKILL_ID)
    expect(s.gameManager.skillManager.has('linh_bao')).toBe(true)
    assertScopeSanity('creation')
  })

  it('step 2 - Mortal with Linh Bao: the cast grind feeds the authored offer gate', () => {
    // spell_pathway's offerGate is linh_bao cast-Lv3 - the beta mortal
    // phase IS farming casts on the deepest reachable floor. Mortal
    // floors stay unbeatable pre-initiation by design (the pinned
    // starter is intentionally weak - MortalChapterJourney documents
    // the dong_2+ wall), so the grind rides dong_1 attempts.
    const target = CAST_LEVELING_THRESHOLDS[BETA_MORTAL_STARTER_SKILL_ID]!.lv3
    let runs = 0
    let victories = 0
    const outcomes = new Map<string, number>()
    while (
      (getCastLeveledSkillLevel(BETA_MORTAL_STARTER_SKILL_ID, s.player.skillCastCounts?.[BETA_MORTAL_STARTER_SKILL_ID] ?? 0) ?? 1) < 3 &&
      runs++ < 900
    ) {
      const run = s.runStage('mortal_dong_1')
      outcomes.set(run, (outcomes.get(run) ?? 0) + 1)
      if (run === 'victory') victories++
    }
    const casts = s.player.skillCastCounts?.[BETA_MORTAL_STARTER_SKILL_ID] ?? 0
    console.log(
      `JOURNEY mortal-grind: runs=${runs} victories=${victories} casts=${casts} ` +
        `outcomes=${[...outcomes.entries()].map(([k, v]) => `${k}:${v}`).join(',')}`,
    )
    // The mortal phase is winnable on dong_1 (linh_bao clears it
    // outright - the authored wall is dong_2+).
    expect(victories, `dong_1 not farmable by linh_bao (${outcomes})`).toBeGreaterThan(0)
    expect(
      casts,
      `linh_bao never reached Lv3 after ${runs} dong_1 runs - the offer gate is unreachable`,
    ).toBeGreaterThanOrEqual(target)
    assertScopeSanity('mortal-grind')
  }, 300_000)

  it('step 3 - normal breakthrough gate is a realmLevel requirement, not a content buy', () => {
    grindToLevel(12)
    const reqs = s.gameManager.realmAdvanceOps.getBreakthroughRequirements(s.player)
    expect(reqs).toEqual([{ key: 'level', met: true }])
    expect(s.gameManager.realmAdvanceOps.canTriggerBreakthrough(s.player)).toBe(true)
    assertScopeSanity('mortal-gate')
  })

  it('step 4 - Quan Khi: the normal breakthrough ceremony runs and settles', () => {
    seedSurvivalFixture()
    expect(s.runTribulation('qi_refining')).toBe('victory')
    const committed = s.gameManager.tribulationDirector.getCommittedOutcome()
    expect(committed?.outcome).toBe('victory')
    expect(committed?.targetRealmId).toBe('qi_refining')
    const receipt = s.settleTribulationOutcome()
    expect(receipt?.kind).toBe('victory')
    // Quan Khi is announcement-only: the realm write is the initiation
    // commit's job - settle must NOT move the player off mortal.
    expect(s.player.realmId).toBe('mortal')
    expect(s.player.cultivationWay).toBeUndefined()
    // The mandatory breakthrough talent decision can bind to ANY major
    // victory - resolve a legal offer before the drain releases.
    const entitlement = s.player.pendingTalentEntitlement
    if (entitlement !== undefined) {
      expect(s.drainTribulationOutcome()).toBe(false)
      expect(
        s.resolveTalentEntitlement({ kind: 'new', talentId: entitlement.offeredTalentIds[0]! }),
      ).toBe(true)
    }
    expect(s.drainTribulationOutcome()).toBe(true)
    assertScopeSanity('post-quan-khi')
  })

  it('step 5 - Five Element Initiation commits exactly one element, atomically', () => {
    // A non-beta element can never be committed through the op.
    expect(
      s.gameManager.realmAdvanceOps.commitFiveElementInitiation(
        'not_an_element' as ElementType,
        s.player,
      ).ok,
    ).toBe(false)

    const before = {
      selectedTalents: [...s.player.selectedTalentIds],
      learned: s.gameManager.skillManager.has(KIT[0]),
    }
    expect(s.performRitual('spell', 'spell_pathway', COMMIT_ELEMENT)).toBe(true)

    const p = s.player
    // ONE atomic commit: path + way + element + realm + technique + root
    // node + kit basic all land together (contract sec.B).
    expect(p.cultivationPath).toBe('spell')
    expect(p.cultivationWay).toBe('spell_pathway')
    expect(p.spellPath?.element).toBe(COMMIT_ELEMENT)
    expect(p.realmId).toBe('qi_refining')
    expect(p.realmLevel).toBe(1)
    expect(p.mortalBasicSkillId).toBeUndefined()
    expect(s.gameManager.techniqueManager.getActive()?.id).toBe('five_elements_art')
    expect(s.gameManager.skillManager.has(KIT[0])).toBe(true)
    // Exactly one element: the four others are scope-hidden branches.
    const tree = s.gameManager.progressionOps.betaSkillTreeFor(
      p,
      s.gameManager.nodeRegistry.getAll(),
    )
    expect(tree.element).toBe(COMMIT_ELEMENT)
    expect(p.selectedTalentIds).toEqual(before.selectedTalents)
    expect(before.learned).toBe(false)
    assertScopeSanity('post-initiation')
    assertStageRosterSanity('post-initiation')
  })

  it('step 6 - post-commit rail: element basic live, special realm-gated, ultimate absent', () => {
    const roles = s.gameManager.progressionOps.betaCombatRolesFor(s.player)
    const basic = roles.find((role) => role.role === 'basic')
    const special = roles.find((role) => role.role === 'special')
    const ultimate = roles.find((role) => role.role === 'ultimate')
    expect(basic).toMatchObject({ skillId: KIT[0], state: 'available' })
    // The special's authored gate is the linh_ngo_<special> keystone,
    // realm-gated at foundation_establishment - locked until then.
    expect(special?.state).toBe('progression-locked')
    expect(['realm-gate', 'not-learned']).toContain(special?.reason)
    expect(ultimate?.state).toBe('scope-hidden')

    // The skill tree renders the committed branch only; the other four
    // elements are scope-hidden rows, never locked teasers.
    const tree = s.gameManager.progressionOps.betaSkillTreeFor(
      s.player,
      s.gameManager.nodeRegistry.getAll(),
    )
    const otherElement = tree.nodes.filter(
      (node) => node.state === 'scope-hidden' && node.reason === 'other-element-branch',
    )
    expect(otherElement.length, 'non-committed element branches must be scope-hidden').toBeGreaterThan(0)
  })

  it('step 7 - Act I clears end-to-end on the element kit (mortal_dong_1..10)', () => {
    // Intended point for the act-1 boss (ElementBossMatrix cell):
    // qi:10 build. Non-boss floors trivially clear under the same kit.
    spendAttributes(12)
    grindToLevel(10)
    gearUp(5)
    for (const stageId of MORTAL_FLOORS) {
      const run = s.runStage(stageId)
      expect(run, `Act I floor ${stageId}`).toBe('victory')
      expect(s.player.completedStageIds).toContain(stageId)
    }
    assertScopeSanity('post-act-1')
    assertStageRosterSanity('post-act-1')
  }, 300_000)

  it('step 8 - Act II clears at the realm-gated floors (qi_refining_*..abyssal_pool)', () => {
    // Linear chain + per-floor level gate while the player is in the
    // stage's realm: floor N needs qi_refining level N.
    for (let floor = 1; floor <= QI_FLOORS.length; floor++) {
      const stageId = QI_FLOORS[floor - 1]!
      grindToLevel(Math.min(floor, 10))
      const run = s.runStage(stageId)
      expect(run, `Act II floor ${stageId}`).toBe('victory')
      expect(s.player.completedStageIds).toContain(stageId)
    }
    assertScopeSanity('post-act-2')
    assertStageRosterSanity('post-act-2')
  }, 300_000)

  it('step 9 - Special stays realm-gated through Act II (authored gate = foundation keystone)', () => {
    expect(s.player.realmId).toBe('qi_refining')
    const roles = s.gameManager.progressionOps.betaCombatRolesFor(s.player)
    const special = roles.find((role) => role.role === 'special')
    expect(special?.state).toBe('progression-locked')
    expect(special?.reason).toBe('realm-gate')
  })

  it('step 10 - Foundation gate: qi:12 + chapter clear -> tribulation -> two-phase settle', () => {
    grindToLevel(12)
    expect(
      s.gameManager.realmAdvanceOps.getBreakthroughRequirements(s.player),
    ).toEqual([
      { key: 'level', met: true },
      { key: 'chapterClear', met: true },
    ])
    expect(s.gameManager.realmAdvanceOps.canTriggerBreakthrough(s.player)).toBe(true)

    seedSurvivalFixture()
    expect(s.runTribulation('foundation_establishment')).toBe('victory')
    const committed = s.gameManager.tribulationDirector.getCommittedOutcome()
    expect(committed?.outcome).toBe('victory')
    expect(committed?.targetRealmId).toBe('foundation_establishment')

    const receipt = s.settleTribulationOutcome()
    expect(receipt?.kind).toBe('victory')
    expect(s.player.realmId).toBe('foundation_establishment')
    expect(s.player.realmLevel).toBe(1)

    // The mandatory breakthrough talent decision: resolve through the
    // real entitlement seam before the drain releases the director.
    const entitlement = s.player.pendingTalentEntitlement
    if (entitlement !== undefined) {
      expect(s.drainTribulationOutcome()).toBe(false)
      expect(
        s.resolveTalentEntitlement({ kind: 'new', talentId: entitlement.offeredTalentIds[0]! }),
      ).toBe(true)
    }
    expect(s.drainTribulationOutcome()).toBe(true)
    expect(s.gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
    assertScopeSanity('post-foundation')
  })

  it('step 11 - Special unlocks exactly when its authored gate is met', () => {
    // Realm-gate lifted at foundation - the keystone node is the authored
    // unlock path for the kit special (betaScopeSkillDomain derives the
    // gate from the node, never a literal).
    s.player.skillInsight += 150_000
    expect(s.purchaseNode(KEYSTONE)).toBe(true)
    if (!s.gameManager.skillManager.has(KIT[1])) {
      expect(s.gameManager.progressionOps.learnSkill(KIT[1], s.player)).toBe(true)
    }
    const roles = s.gameManager.progressionOps.betaCombatRolesFor(s.player)
    expect(roles.find((role) => role.role === 'special')).toMatchObject({
      skillId: KIT[1],
      state: 'available',
    })
  })

  it('step 12 - Act III clears to the final boss; betaComplete beats', () => {
    // The whelp cell builds at foundation:10 with the keystone + dia gear.
    spendAttributes(18)
    grindToLevel(10)
    gearUp(8)
    for (const stageId of FOUNDATION_FLOORS) {
      const run = s.runStage(stageId)
      expect(run, `Act III floor ${stageId}`).toBe('victory')
      expect(s.player.completedStageIds).toContain(stageId)
    }
    const completion = betaCompletionFor(s.player)
    expect(completion.act3FinalBossDefeated, 'act-3 final boss flag').toBe(true)
    expect(completion.betaComplete, 'beta completion beat').toBe(true)
    assertScopeSanity('beta-complete')
    assertStageRosterSanity('beta-complete')
  }, 300_000)

  it('step 13 - ceiling: no post-beta realm CTA and the save stays clean', () => {
    // Truc Co -> Kim Dan is closed: the ladder ends, the next-realm
    // surface fails closed, and a completed beta save is supported.
    expect(betaNextRealmSurfaceFor(s.player)).toBeNull()
    for (const node of betaRealmLadderNodes()) {
      expect(SCOPE_HIDDEN_REALMS).not.toContain(node.realmId)
    }
    expect(BETA_FINAL_BOSS_ENEMY_ID).toBe('foundation_ferocious_spirit_wolf')
    expect(betaSupportedFor(s.player)).toBe(true)
    expect(unsupportedReleaseReason(s.player)).toBeNull()
    // The journey consumed only roster content: no authored stage can
    // pool or boss-spawn an enemy outside BETA_ENEMY_ROSTER.
    const rosterIds = new Set(BETA_ENEMY_ROSTER.map((entry) => entry.id))
    for (const stage of STAGES) {
      for (const entry of stage.enemyPool) {
        expect(
          rosterIds.has(entry.enemyId),
          `stage ${stage.id} pools off-roster enemy ${entry.enemyId}`,
        ).toBe(true)
      }
      if (stage.bossEnemyId !== undefined) {
        expect(
          rosterIds.has(stage.bossEnemyId),
          `stage ${stage.id} bosses off-roster enemy ${stage.bossEnemyId}`,
        ).toBe(true)
      }
    }
  })
})
