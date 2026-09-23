// M-F-JOURNEY - TrucCoJourney: the committed end-to-end regression
// contract for the Truc Co (foundation_establishment) chapter and the
// proof vehicle for the mission's integration sweep. Follows the
// MortalChapterJourney committed-fixture convention: tests construct
// EarlyGameSession on a named seed + pinned profile, drive REAL
// production systems headless (TribulationDirector runTribulation ->
// two-phase settle/drain on the player OWNER, realm advance ops, Body
// chapters meridian/body_refinement/zhou_tian, foundation stage clears
// via runStage, real buildGameSave/restoreGameSession checkpoints).
//
// Ordered journey (spec sec.3): A (seeded LQ side + admission) -> B
// (tribulation + two-phase settle/drain) -> E.1 (floor_1 first clear at
// TC L1) -> D.1 + D.2 (refinement completion + meridian 9/9 at TC L1)
// -> C + E.2 interleaved (level ladder + floors 2..10 clearing at each
// level gate, honest Phap farming riding the already-cleared floor_1)
// with G's midpoint checkpoint INSIDE the interleave at TC L9 /
// circulation 180 / floors 1-9 -> continuation on the RESTORED session
// (L10 -> floor_10 boss -> L18 -> 360/Dai) -> F (ceiling) -> I
// (first-class surfaces) -> K (perfection negative leg) -> L
// (hidden-channel deferral). Leg J (determinism) and the grade ladder
// run as seeded per-grade fixtures beside the ordered run.
//
// Leg H is an ownership MAP, not a pass: every rejection executes
// INLINE where its precondition exists on the ordered state:
//   - runTribulation('foundation_establishment') refused below L12 /
//     without the abyssal clear -> Leg A (fresh state + chain-missing).
//   - settle idempotency + drain-held -> Leg B phase (a).
//   - off-pool talent decision -> Leg B phase (a).
//   - investChapter('meridian') while refinement incomplete -> inside
//     D.1 before the final tier commits.
//   - investChapter('zhou_tian') before meridian complete -> the
//     D.1 -> D.2 boundary; capacity-0 arm -> Leg A seeded LQ state.
//   - floor_N locked below level N -> inside the E.2 interleave.
//   - runTribulation('golden_core') at the ceiling -> Leg F.
//   - startAutoFarm without a perfect clear -> Leg I.
//   - incoherent zhou_tian/meridian save rejected at restore preflight
//     -> its own test below (restore preflight is a fresh-state
//     concern, not a journey-state precondition).
//
// SEEDED-INPUT LIST (spec sec.4 two-class split - day-paced inputs
// seeded through the REAL bag APIs/state writes, never a bypass):
//   player.realmLevel = 12 at mortal (pre-ritual) + at qi_refining
//   player.completedStageIds = mortal_dong_* + qi_refining_* chains
//   player.baseStats survival/clearing profile (FIXTURE_LQ_STATS)
//   one equipped weapon instance (equipment resync observability)
//   pills: truc_co_dan x1, thong_mach_dan x133
//   materials: thien_dia_chi_kieu x1, tinh_hoa_pham_the topped up in
//     MAX_STACK_AMOUNT chunks through honest invests
//   body_refinement tiers 1-3 invested at qi_refining before the press
//   grade fixtures: meridian/physique/stat/flag writes per grade row
//     (declared inside each grade test)
// Run-scale inputs NOT seeded: foundation floors 1-10 clears, Phap
// essence (zhou_tian) farmed through floor_1 re-runs, perfect clear +
// auto-farm records, gift records and claims.

import { ARTIFACT_UNLOCK_REALM_ID } from '../../artifact/ArtifactDomain'
import { isArtifactDomainUnlocked } from '../../artifact/ArtifactProgression'
import {
  BODY_PERFECTION_REALM_MATERIALS,
  bodyPerfectionMaterialIds,
} from '../../../data/realm/BodyPerfection'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../../data/realm/BodyRefinement'
import { ENEMIES } from '../../../data/enemy/Enemies'
import { FAMILY_DROP_TABLES } from '../../../data/drop/FamilyDropTables'
import { STAGE_DROP_TABLES } from '../../../data/drop/StageDropTables'
import {
  HIDDEN_MATERIAL_CHANNELS,
  VISIBLE_GRANT_SOURCES,
  channelEmittedMaterialIds,
  hiddenBeastChannels,
} from '../../../data/drop/HiddenMaterialChannels'
import {
  MERIDIANS,
  THIEN_DIA_CHI_KIEU_MATERIAL_ID,
  THONG_MACH_DAN_MATERIAL_ID,
} from '../../../data/realm/Meridians'
import { ZHOU_TIAN_CURRENCY_MATERIAL_ID } from '../../../data/realm/ZhouTian'
import { asBaseStats } from '../../stats/StatBlock'
import { buildGameSave } from '../../../services/save/SaveSystem'
import {
  canPerfectBodyRealm,
  getBodyPerfectionMultiplier,
  getBodyPerfectionRealmProgress,
  isBodyPerfectionRevealed,
} from '../../realm/body/BodyPerfection'
import {
  collectBodyBaseStatDeltas,
  collectEffectiveBodyBaseStatDeltas,
  getBodyRefinementCompletedTiers,
  getOpenedMeridianCount,
} from '../../realm/body/BodyProgressionSystem'
import { createPinia, setActivePinia } from 'pinia'
import { getMainStatCap } from '../../stats/StatCap'
import { MAIN_STAT_KEYS } from '../../stats/StatTypes'
import { getRequiredCultivation } from '../../realm/realmSystem'
import { isCompanionDomainUnlocked } from '../../companion/CompanionAvailability'
import { isCompanionPullPoolEnabled } from '../../realm/ReleasePolicy'
import { makeInstance } from '../../equipment/EquipmentInstance.fixture'
import { usePlayerStore } from '../../../stores/player'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getZhouTianCapacity,
  isDaiChuThienReached,
  isTieuChuThienReached,
} from '../../realm/body/ZhouTianChapter'
import {
  EarlyGameSession,
  type EarlyGameSnapshot,
} from './EarlyGameSession'

const PINNED_PROFILE = {
  name: 'journey',
  talentIds: ['hap_linh'],
  attributes: { strength: 2, vitality: 3 },
}

const FOUNDATION_STAGE_IDS = Array.from(
  { length: 10 },
  (_, i) => `foundation_floor_${i + 1}`,
)

// The committed LQ-side survival fixture (TribulationOutcomeSettlement
// convention): survives every tribulation grade incl. great_dao's
// multiplier, clears every wave up the ladder.
const FIXTURE_LQ_STATS = {
  maxHp: 5_000_000,
  defense: 50_000,
  hpRegenPerTurn: 0,
  might: 20_000,
  speed: 200,
  maxMp: 5_000,
  mpRegenPerTurn: 500,
  accuracyRating: 100,
} as const

// The persisted player-side ids below are seeded fields (see header):
// the day-paced acquisition economies (alchemy recipes, hidden-beast
// 5% drops) cannot produce them in suite time, so bags/state carry
// them through the real hold APIs instead.
const TRUC_CO_DAN_ID = 'truc_co_dan'

function makeJourneySession(seed = 11): EarlyGameSession {
  const owner = usePlayerStore()
  return new EarlyGameSession({
    seed,
    profile: PINNED_PROFILE,
    playerOwner: owner,
  })
}

function seedLqSideState(s: EarlyGameSession): void {
  // One equipped item so the settle's unequip + modifier resync is
  // observable on real state. Mortal-grade gear equips ONLY while
  // realmId is still 'mortal' (grade gate) - before the ritual.
  const owner = usePlayerStore()
  const instance = makeInstance({
    instanceId: 'journey-kiem-1',
    itemId: 'base_kiem',
    slot: 'weapon',
  })
  s.gameManager.equipmentBag.add(instance)
  expect(
    s.gameManager.equipmentOps.equipItem(instance.instanceId, s.player).ok,
  ).toBe(true)
  owner.setEquipmentModifiers(
    s.gameManager.equipmentOps.getEquipmentModifiers(),
  )

  // Honest ritual commit at the seeded mortal-L12 gate (spec fixture
  // driver): promotion + path/way writes + the canonical technique
  // grant all ride real seams - only the grind itself is seeded.
  s.player.realmLevel = 12
  expect(s.performRitual('spell', 'spell_pathway')).toBe(true)
  expect(s.player.realmId).toBe('qi_refining')
  expect(s.player.cultivationWay).toBe('spell_pathway')

  s.player.realmLevel = 12
  s.player.completedStageIds = [...MORTAL_STAGE_IDS, ...QI_STAGE_IDS]
  s.player.baseStats = asBaseStats({
    ...s.player.baseStats,
    ...FIXTURE_LQ_STATS,
  })

  // Seeded day-paced inputs through the real bag seams.
  expect(s.holdPill(TRUC_CO_DAN_ID, 1)).toBe(1)
  // Tiers 1-3 ride the real invest seam (the earth-grade input and the
  // persisted pre-TC progression slice).
  feedRefinementTo(s, 3)
  s.holdPill(THONG_MACH_DAN_MATERIAL_ID, 133)
  s.holdMaterial(THIEN_DIA_CHI_KIEU_MATERIAL_ID, 1)
}

/** Pumps essence into the refinement chapter until `tiers` complete.
 * MAX_STACK_AMOUNT=1000 clamps every hold, so the seeded ladder goes
 * through repeated hold + invest calls (the only seedable scale on the
 * material economy). */
function feedRefinementTo(s: EarlyGameSession, tiers: number): void {
  let guard = 0
  while (getBodyRefinementCompletedTiers(s.player) < tiers && guard++ < 200) {
    s.holdMaterial(TINH_HOA_PHAM_THE_MATERIAL_ID, 1000)
    expect(s.investChapter('body_refinement')).toBeGreaterThan(0)
  }
  expect(getBodyRefinementCompletedTiers(s.player)).toBe(tiers)
}

function stripTribulationState(
  snapshot: EarlyGameSnapshot,
): Omit<EarlyGameSnapshot, 'tribulationState'> {
  const { tribulationState: _excluded, ...rest } = snapshot
  return rest
}

const MORTAL_STAGE_IDS = Array.from(
  { length: 10 },
  (_, i) => `mortal_dong_${i + 1}`,
)
const QI_STAGE_IDS = [
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

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('TrucCoJourney - ordered journey', () => {
  it(
    'drives the pinned leg order A->B->E.1->D.1+D.2->C/E.2->G->F->I->K->L on real seams',
    { timeout: 300_000 },
    () => {
      vi.useFakeTimers()

      // ===== Leg A - seeded LQ fixture + admission =====
      let s = makeJourneySession()
      expect(s.player.realmId).toBe('mortal')

      // Leg H (inline): refused below admission.
      expect(s.runTribulation('foundation_establishment')).toBe('refused')
      expect(
        s.gameManager.tribulationDirector.getCommittedOutcome(),
      ).toBeNull()

      // One equipped mortal-grade weapon so the settle's unequip +
      // modifier resync is observable (grade gate: cuu_pham equips
      // only while realmId is 'mortal' - before the ritual).
      {
        const owner = usePlayerStore()
        const instance = makeInstance({
          instanceId: 'journey-kiem-1',
          itemId: 'base_kiem',
          slot: 'weapon',
        })
        s.gameManager.equipmentBag.add(instance)
        expect(
          s.gameManager.equipmentOps.equipItem(instance.instanceId, s.player)
            .ok,
        ).toBe(true)
        owner.setEquipmentModifiers(
          s.gameManager.equipmentOps.getEquipmentModifiers(),
        )
      }

      // The honest ritual commit inside the fixture driver.
      s.player.realmLevel = 12
      expect(s.performRitual('spell', 'spell_pathway')).toBe(true)
      expect(s.player.realmId).toBe('qi_refining')

      // Leg H (inline): refused with the abyssal clear missing - level
      // alone does not admit. Seed level first, observe the
      // chapterClear row, then land the chain.
      s.player.realmLevel = 12
      const missingClearReqs =
        s.gameManager.realmAdvanceOps.getBreakthroughRequirements(s.player)
      expect(missingClearReqs).toEqual([
        { key: 'level', met: true },
        { key: 'chapterClear', met: false },
      ])
      expect(s.runTribulation('foundation_establishment')).toBe('refused')
      expect(
        s.gameManager.tribulationDirector.getCommittedOutcome(),
      ).toBeNull()

      // Seed the remaining LQ-side state (chain + stats + bags +
      // tiers 1-3).
      s.player.completedStageIds = [...MORTAL_STAGE_IDS, ...QI_STAGE_IDS]
      s.player.baseStats = asBaseStats({
        ...s.player.baseStats,
        ...FIXTURE_LQ_STATS,
      })
      expect(s.holdPill(TRUC_CO_DAN_ID, 1)).toBe(1)
      feedRefinementTo(s, 3)
      s.holdPill(THONG_MACH_DAN_MATERIAL_ID, 133)
      s.holdMaterial(THIEN_DIA_CHI_KIEU_MATERIAL_ID, 1)

      // Leg H (inline): capacity-0 zhou_tian arm at the seeded pre-TC
      // state (realmId qi_refining - circulation does not exist below
      // TC; the chain lock also applies).
      expect(getZhouTianCapacity(s.player)).toBe(0)
      const phapAtLq = s.materialAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)
      expect(s.investChapter('zhou_tian')).toBe(0)
      expect(s.materialAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)).toBe(phapAtLq)

      // Admission: the real requirements rows, all met.
      expect(
        s.gameManager.realmAdvanceOps.getBreakthroughRequirements(s.player),
      ).toEqual([
        { key: 'level', met: true },
        { key: 'chapterClear', met: true },
      ])
      expect(
        s.gameManager.realmAdvanceOps.canTriggerBreakthrough(s.player),
      ).toBe(true)

      // ===== Leg B - tribulation + two-phase settle/drain =====
      // Seeded grade inputs: truc_co_dan held + 3/6 refinement tiers +
      // <6 meridians -> earth.
      expect(s.runTribulation('foundation_establishment')).toBe('victory')
      const committed =
        s.gameManager.tribulationDirector.getCommittedOutcome()
      expect(committed?.outcome).toBe('victory')
      expect(committed?.grade).toBe('earth')
      expect(committed?.targetRealmId).toBe('foundation_establishment')

      // Phase (a): settle binds/applies ONCE; the drain holds while the
      // entitlement is unresolved.
      expect(
        s.player.modifiers.filter((m) => m.sourceType === 'equipment')
          .length,
      ).toBeGreaterThan(0)

      const receipt = s.settleTribulationOutcome()
      expect(receipt?.kind).toBe('victory')
      if (receipt?.kind === 'victory') {
        expect(receipt.realmEntered).toBe('foundation_establishment')
        expect(receipt.foundationGrade).toBe('earth')
      }

      // The TC initiation bundle on real state.
      expect(s.player.realmId).toBe('foundation_establishment')
      expect(s.player.realmLevel).toBe(1)
      expect(s.player.cultivation).toBe(0)
      expect(s.player.highestFoundationAchieved).toBe('earth')
      expect(s.gameManager.skillManager.has('passive_truc_co_y_chi')).toBe(
        true,
      )
      const tech = s.gameManager.techniqueManager.getActive()
      expect(tech?.id).toBe('five_elements_art')
      // The lagging grade-1 cycle froze into gradeHistory at the
      // transition (M-F-TECHNIQUE seam).
      expect(tech?.gradeHistory[1]).toBeDefined()
      expect(s.giftRecords().map((g) => g.id)).toContain(
        'gift_than_nong_foundation_entry',
      )
      expect(
        s.giftRecords().find(
          (g) => g.id === 'gift_than_nong_foundation_entry',
        )?.claimed,
      ).toBe(false)
      const entitlement = s.player.pendingTalentEntitlement
      expect(entitlement?.realmId).toBe('foundation_establishment')
      expect(entitlement?.offeredTalentIds.length).toBeGreaterThan(0)

      // Unequip + modifier resync landed through the writer owner.
      expect(
        s.gameManager.equipmentBag.getAll().every((i) => !i.equipped),
      ).toBe(true)
      expect(
        s.player.modifiers.every((m) => m.sourceType !== 'equipment'),
      ).toBe(true)

      // Idempotency: a repeated pre-resolution settle returns the SAME
      // bound receipt object and re-applies nothing.
      const giftsBefore = s.giftRecords().length
      const talentsBefore = [...s.player.selectedTalentIds]
      const modifiersBefore = s.player.modifiers.length
      expect(s.settleTribulationOutcome()).toBe(receipt)
      expect(s.giftRecords().length).toBe(giftsBefore)
      expect(s.player.selectedTalentIds).toEqual(talentsBefore)
      expect(s.player.modifiers.length).toBe(modifiersBefore)
      expect(s.player.realmLevel).toBe(1)

      // Leg H (inline): off-pool / illegal talent decision rejected,
      // record retained (uncancellable by construction).
      expect(
        s.resolveTalentEntitlement({
          kind: 'new',
          talentId: 'not_a_pool_member',
        }),
      ).toBe(false)
      expect(s.player.pendingTalentEntitlement).toBeDefined()

      // The drain HOLDS while the entitlement is unresolved.
      expect(s.drainTribulationOutcome()).toBe(false)
      expect(
        s.gameManager.tribulationDirector.getCommittedOutcome(),
      ).not.toBeNull()

      // Phase (b): a legal decision resolves -> drain executes ->
      // director clears exactly once.
      const offered = entitlement!.offeredTalentIds
      expect(
        s.resolveTalentEntitlement({ kind: 'new', talentId: offered[0]! }),
      ).toBe(true)
      expect(s.player.pendingTalentEntitlement).toBeUndefined()
      expect(s.player.selectedTalentIds).toContain(offered[0])
      expect(s.player.talentLevels[offered[0]!]).toBe(1)
      expect(s.drainTribulationOutcome()).toBe(true)
      expect(
        s.gameManager.tribulationDirector.getCommittedOutcome(),
      ).toBeNull()
      expect(s.gameManager.tribulationDirector.getState()).toBeNull()

      // The realm_entered gift claims through the real op.
      const entryClaim = s.claimGift('gift_than_nong_foundation_entry')
      expect(entryClaim.ok).toBe(true)
      if (entryClaim.ok && !entryClaim.alreadyClaimed) {
        expect(entryClaim.kind).toBe('new')
        expect(entryClaim.definition.id).toBe('than_nong')
      }
      expect(
        s.player.companions.some((c) => c.definitionId === 'than_nong'),
      ).toBe(true)

      // ===== Leg E.1 - floor_1 first clear at TC L1 =====
      expect(s.player.realmLevel).toBe(1)
      // floor_2's remaining gate at L1 is requiredRealmLevel (the
      // sequential floor_1 gate is about to lift).
      expect(s.runStage('foundation_floor_2')).toBe('locked')
      expect(s.runStage('foundation_floor_1')).toBe('victory')
      expect(s.player.completedStageIds.at(-1)).toBe('foundation_floor_1')

      // ===== Legs D.1 + D.2 - body prerequisites at TC L1 =====
      const intrinsicBaseStats = { ...s.player.baseStats }

      // (a) refinement to 5/6 - the meridian reject's precondition
      // (refinement incomplete) exists only before tier 6 commits.
      feedRefinementTo(s, 5)

      // (b) Leg H (inline): meridian invest rejects at 5/6 - nothing
      // debits, no page-lock half-state.
      const pillsAtReject = s.pillAmount(THONG_MACH_DAN_MATERIAL_ID)
      const auxAtReject = s.materialAmount(THIEN_DIA_CHI_KIEU_MATERIAL_ID)
      expect(s.investChapter('meridian')).toBe(0)
      expect(s.pillAmount(THONG_MACH_DAN_MATERIAL_ID)).toBe(pillsAtReject)
      expect(s.materialAmount(THIEN_DIA_CHI_KIEU_MATERIAL_ID)).toBe(
        auxAtReject,
      )
      expect(s.player.bodyProgression.meridian.openedIds).toEqual([])

      // Substitution probe inside D.1: drain the pham stack, hold ONLY
      // phap, and let the real phap->bao->pham plan carry the chapter.
      let drainGuard = 0
      while (
        s.materialAmount(TINH_HOA_PHAM_THE_MATERIAL_ID) > 0 &&
        drainGuard++ < 100
      ) {
        expect(s.investChapter('body_refinement')).toBeGreaterThan(0)
      }
      s.holdMaterial(ZHOU_TIAN_CURRENCY_MATERIAL_ID, 200)
      const phapBeforeProbe = s.materialAmount(
        ZHOU_TIAN_CURRENCY_MATERIAL_ID,
      )
      expect(s.investChapter('body_refinement')).toBeGreaterThan(0)
      expect(s.materialAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)).toBeLessThan(
        phapBeforeProbe,
      )
      expect(s.materialAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(0)

      // Tier 6 commits via pham top-up -> physique flips pham -> bao.
      feedRefinementTo(s, 6)
      expect(s.player.physiqueGrade).toBe('bao')

      // Authority split (r81-M1): authored flat deltas ride the
      // collector channel; intrinsic baseStats stay byte-unchanged.
      expect(s.player.baseStats).toEqual(intrinsicBaseStats)
      const authoredDeltas = collectBodyBaseStatDeltas(s.player)
      expect(authoredDeltas.defense).toBe(4)
      expect(authoredDeltas.might).toBe(5)
      expect(authoredDeltas.maxHp).toBe(100)
      expect(authoredDeltas.hpRegenPerTurn).toBe(3.5)
      expect(authoredDeltas.vitality).toBe(2)
      expect(collectEffectiveBodyBaseStatDeltas(s.player)).toEqual(
        authoredDeltas,
      )

      // (c) Leg H (inline): zhou_tian rejects after refinement commits
      // but before the first meridian opens - no Phap debit.
      const phapAtZhouReject = s.materialAmount(
        ZHOU_TIAN_CURRENCY_MATERIAL_ID,
      )
      expect(s.investChapter('zhou_tian')).toBe(0)
      expect(s.materialAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)).toBe(
        phapAtZhouReject,
      )
      expect(s.player.bodyProgression.zhou_tian.circulation).toBe(0)

      // (d) Meridian strict-prefix 9/9 - pace gates lifted at TC,
      // sequential constraint + the aux gate remain.
      const expectedOpened: string[] = []
      for (const meridian of MERIDIANS) {
        expect(s.investChapter('meridian')).toBe(meridian.thongMachDanCost)
        expectedOpened.push(meridian.id)
        expect([...s.player.bodyProgression.meridian.openedIds]).toEqual(
          expectedOpened,
        )
      }
      expect(getOpenedMeridianCount(s.player)).toBe(9)
      // All 133 pills debited; the aux material GATES ky_kinh - held,
      // not consumed.
      expect(s.pillAmount(THONG_MACH_DAN_MATERIAL_ID)).toBe(0)
      expect(s.materialAmount(THIEN_DIA_CHI_KIEU_MATERIAL_ID)).toBe(1)

      // bat-mach:* emissions live on the meridian modifier channel
      // ONLY; intrinsic baseStats remain untouched.
      const meridianStatCount = MERIDIANS.reduce(
        (sum, m) => sum + m.stats.length,
        0,
      )
      expect(
        s.player.modifiers.filter((m) => m.id.startsWith('bat-mach:'))
          .length,
      ).toBe(meridianStatCount)
      expect(s.player.baseStats).toEqual(intrinsicBaseStats)

      // ===== Legs C + E.2 interleaved =====
      // G's midpoint checkpoint lands INSIDE this interleave at TC L9 /
      // circulation 180 / floors 1-9 cleared; the journey continues on
      // the restored session.
      const phapHeld = (): number =>
        s.materialAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)
      const farmPhap = (target: number): void => {
        let guard = 0
        while (
          s.materialAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID) < target &&
          guard++ < 200
        ) {
          expect(s.runStage('foundation_floor_1')).toBe('victory')
        }
        expect(
          s.materialAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID),
        ).toBeGreaterThanOrEqual(target)
      }
      const investZhouToCapacity = (): void => {
        const capacity = getZhouTianCapacity(s.player)
        let guard = 0
        while (
          s.player.bodyProgression.zhou_tian.circulation < capacity &&
          guard++ < 500
        ) {
          expect(s.investChapter('zhou_tian')).toBeGreaterThan(0)
        }
        expect(s.player.bodyProgression.zhou_tian.circulation).toBe(
          capacity,
        )
      }
      const grindToBreakthrough = (): void => {
        const req = getRequiredCultivation(
          s.player.realmId,
          s.player.realmLevel,
        )
        s.cultivate(Math.ceil(req / s.player.cultivationPerSecond) + 1)
      }

      // Leg C pinned observation 1 - the below-cap clamp at L1
      // (capacity 20): circulation reached the cap, then a further
      // invest leaves circulation AT the cap and debits NOTHING.
      farmPhap(20)
      investZhouToCapacity()
      expect(s.player.bodyProgression.zhou_tian.circulation).toBe(20)
      const heldAtCap = phapHeld()
      expect(s.investChapter('zhou_tian')).toBe(0)
      expect(phapHeld()).toBe(heldAtCap)
      expect(s.player.bodyProgression.zhou_tian.circulation).toBe(20)

      let resumed: EarlyGameSession | undefined
      let parityBefore:
        | Omit<EarlyGameSnapshot, 'tribulationState'>
        | undefined
      let parityAfter:
        | Omit<EarlyGameSnapshot, 'tribulationState'>
        | undefined

      for (let level = 1; level < 18; level++) {
        const pointsBefore = s.player.attributePoints
        grindToBreakthrough()
        expect(s.breakthroughIfReady()).toBe(true)
        expect(s.player.realmLevel).toBe(level + 1)
        // The level attribute-point feed lands every breakthrough.
        expect(s.player.attributePoints).toBeGreaterThan(pointsBefore)

        const newLevel = s.player.realmLevel
        expect(getZhouTianCapacity(s.player)).toBe(
          Math.min(360, 20 * newLevel),
        )
        // E.2: floor N clears as realmLevel reaches N; floor N+1 stays
        // locked below its level gate.
        if (newLevel >= 2 && newLevel <= 9) {
          expect(
            s.runStage(`foundation_floor_${newLevel + 1}`),
          ).toBe('locked')
          expect(s.runStage(`foundation_floor_${newLevel}`)).toBe(
            'victory',
          )
          // Growth cycle: equip drops + spend the earned pool.
          s.equipAll()
          while (s.allocateAttribute('strength')) {}
        }

        // Honest Phap farming rides the already-cleared floor_1, then
        // the real invest seam tops circulation to the new capacity.
        if (newLevel < 18) {
          farmPhap(Math.min(360, 20 * newLevel))
          investZhouToCapacity()
          expect(s.player.bodyProgression.zhou_tian.circulation).toBe(
            Math.min(360, 20 * newLevel),
          )
        }

        // ===== Leg G - the pinned midpoint, INSIDE the interleave =====
        // TC L9 / circulation 180 (Tieu reached, 180 remaining) /
        // floors 1-9 cleared - everything L9's gates permit; floor_10
        // unlocks at L10 so the boss is not yet attempted; gift claimed,
        // entitlement resolved.
        if (newLevel === 9) {
          // Leg C pinned observation 2 - the L8->L9 boundary: capacity
          // 160 -> 180 lands Tieu at exactly the threshold, and a
          // second clamp observation at cap debits nothing.
          const heldAt180 = phapHeld()
          expect(s.investChapter('zhou_tian')).toBe(0)
          expect(phapHeld()).toBe(heldAt180)
          expect(s.player.bodyProgression.zhou_tian.circulation).toBe(180)
          expect(isTieuChuThienReached(s.player)).toBe(true)
          expect(isDaiChuThienReached(s.player)).toBe(false)
          expect(s.runStage('foundation_floor_10')).toBe('locked')
          for (const floorId of FOUNDATION_STAGE_IDS.slice(0, 9)) {
            expect(s.player.completedStageIds).toContain(floorId)
          }

          parityBefore = stripTribulationState(s.snapshot())
          vi.setSystemTime(Date.now())
          const save = buildGameSave(s.player, s.gameManager)
          // Restore onto an independent store - the app-store-after-
          // reload model, not the live journey's store.
          setActivePinia(createPinia())
          resumed = new EarlyGameSession({
            seed: 77,
            profile: PINNED_PROFILE,
          })
          const owner = usePlayerStore()
          expect(resumed.restoreCheckpoint(save, owner).status).toBe('ok')
          expect(resumed.player).toBe(owner.$state)
          parityAfter = stripTribulationState(resumed.snapshot())
        }
      }

      // Parity: pre/post-checkpoint snapshots agree modulo the
      // documented tribulationState exclusion.
      expect(parityBefore).toBeDefined()
      expect(parityBefore).toEqual(parityAfter)

      // The ordered journey CONTINUES on the restored session.
      expect(resumed).toBeDefined()
      s = resumed!
      expect(s.player.realmId).toBe('foundation_establishment')
      expect(s.player.realmLevel).toBe(9)
      expect(s.player.bodyProgression.zhou_tian.circulation).toBe(180)

      // Post-restore continuation runs manager-backed actions, not
      // only ticks: a real stage run AND a real invest.
      expect(s.runStage('foundation_floor_1')).toBe('victory')

      // L9 -> L10 -> floor_10 boss -> ladder to L18 -> 360/Dai.
      grindToBreakthrough()
      expect(s.breakthroughIfReady()).toBe(true)
      expect(s.player.realmLevel).toBe(10)
      expect(getZhouTianCapacity(s.player)).toBe(200)
      expect(s.runStage('foundation_floor_10')).toBe('victory')
      expect(s.player.completedStageIds.at(-1)).toBe(
        'foundation_floor_10',
      )
      farmPhap(200)
      investZhouToCapacity()

      for (let level = 10; level < 18; level++) {
        const pointsBefore = s.player.attributePoints
        grindToBreakthrough()
        expect(s.breakthroughIfReady()).toBe(true)
        expect(s.player.realmLevel).toBe(level + 1)
        expect(s.player.attributePoints).toBeGreaterThan(pointsBefore)
        if (s.player.realmLevel < 18) {
          farmPhap(Math.min(360, 20 * s.player.realmLevel))
          investZhouToCapacity()
        }
      }

      // L17->L18 boundary: capacity 340 -> 360, Dai completes at 360.
      expect(s.player.realmLevel).toBe(18)
      farmPhap(360)
      investZhouToCapacity()
      expect(s.player.bodyProgression.zhou_tian.circulation).toBe(360)
      expect(isDaiChuThienReached(s.player)).toBe(true)

      // Exact-Phap debit (spec leg C pin): holding ONLY the lower-band
      // essence never fills the top rung - substitution is downward
      // only, so pham cannot stand in for phap.
      {
        const heldPhap = s.materialAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)
        if (heldPhap > 0) {
          s.gameManager.materialBag.remove(
            ZHOU_TIAN_CURRENCY_MATERIAL_ID,
            heldPhap,
          )
        }
        s.holdMaterial(TINH_HOA_PHAM_THE_MATERIAL_ID, 1000)
        expect(s.investChapter('zhou_tian')).toBe(0)
        expect(s.player.bodyProgression.zhou_tian.circulation).toBe(360)
      }

      // ===== Leg F - ceiling =====
      expect(
        s.gameManager.realmAdvanceOps.getBreakthroughRequirements(s.player),
      ).toEqual([])
      expect(
        s.gameManager.realmAdvanceOps.canTriggerBreakthrough(s.player),
      ).toBe(false)
      const ceilingState = {
        realmId: s.player.realmId,
        realmLevel: s.player.realmLevel,
        cultivation: s.player.cultivation,
        completedStageIds: [...s.player.completedStageIds],
        giftCount: s.giftRecords().length,
      }
      expect(s.runTribulation('golden_core')).toBe('refused')
      expect(
        s.gameManager.tribulationDirector.getCommittedOutcome(),
      ).toBeNull()
      expect(s.player.realmId).toBe(ceilingState.realmId)
      expect(s.player.realmLevel).toBe(ceilingState.realmLevel)
      expect(s.player.cultivation).toBe(ceilingState.cultivation)
      expect([...s.player.completedStageIds]).toEqual(
        ceilingState.completedStageIds,
      )
      expect(s.giftRecords().length).toBe(ceilingState.giftCount)

      // ARTIFACT-DEFER (landed shape): the artifact domain unlocks at
      // ARTIFACT_UNLOCK_REALM_ID ('golden_core'); spell way's reward is
      // keyed to that constant, so player.artifact is legitimately
      // absent at the TC ceiling.
      expect(ARTIFACT_UNLOCK_REALM_ID).toBe('golden_core')
      expect(isArtifactDomainUnlocked('foundation_establishment')).toBe(
        false,
      )
      expect(s.player.artifact).toBeUndefined()

      // COMPANION-GIFT (landed shape): the pull pool stays closed; the
      // domain itself is unlocked at TC and gift mail is the only
      // acquisition channel.
      expect(isCompanionPullPoolEnabled()).toBe(false)
      expect(isCompanionDomainUnlocked('foundation_establishment')).toBe(
        true,
      )

      // ===== Leg I - first-class surfaces on the terminal state =====
      // The floor_10 boss clear issued the stage_completed gift.
      const bossClaim = s.claimGift(
        'gift_khai_minh_foundation_floor_10',
      )
      expect(bossClaim.ok).toBe(true)
      if (bossClaim.ok && !bossClaim.alreadyClaimed) {
        expect(bossClaim.definition.id).toBe('khai_minh')
      }
      expect(
        s.player.companions.some((c) => c.definitionId === 'khai_minh'),
      ).toBe(true)

      // Perfect clear recorded EXACTLY ONCE on the dominated floor_1
      // re-runs (wall-clock seconds are normalized out of snapshots).
      const perfect = s.perfectClearOf('foundation_floor_1')
      expect(perfect.recorded).toBe(true)
      expect(
        s.player.perfectClearStageIds.filter(
          (id) => id === 'foundation_floor_1',
        ).length,
      ).toBe(1)

      // perfectClearSeconds is a volatile wall-clock measurement -
      // deterministic headless runs record 0 while the auto-farm gate
      // (and restore reconcile) require a positive cycle time. Seed the
      // measured value honestly; it is snapshot-normalized everywhere.
      s.player.perfectClearSeconds['foundation_floor_1'] = 30
      expect(s.startAutoFarm('foundation_floor_1')).toBe(true)
      expect(s.player.autoFarmStage?.stageId).toBe('foundation_floor_1')
      // Leg H (inline): a non-perfect stage refuses.
      expect(s.startAutoFarm('mortal_dong_5')).toBe(false)
      expect(s.player.autoFarmStage?.stageId).toBe('foundation_floor_1')

      // autoFarmStage persists through a second checkpoint restore.
      {
        const beforeSecond = stripTribulationState(s.snapshot())
        vi.setSystemTime(Date.now())
        const save2 = buildGameSave(s.player, s.gameManager)
        setActivePinia(createPinia())
        const resumed2 = new EarlyGameSession({
          seed: 99,
          profile: PINNED_PROFILE,
        })
        const owner2 = usePlayerStore()
        expect(resumed2.restoreCheckpoint(save2, owner2).status).toBe('ok')
        expect(
          stripTribulationState(resumed2.snapshot()),
        ).toEqual(beforeSecond)
        expect(resumed2.player.autoFarmStage?.stageId).toBe(
          'foundation_floor_1',
        )
        s = resumed2
      }

      // ===== Leg K - Body-Perfection negative leg (A14) =====
      // The registry is the designed empty state of this wave: the
      // pipeline exists, produces NO false perfection, and the
      // persisted slice round-trips untouched (parity proven above -
      // bodyPerfection fields ride the same checkpoint). The positive
      // discovery -> perfection -> commit flow is the named expected
      // deferral (notes doc) until >=1 authored material is reachable.
      for (const realmId of Object.keys(BODY_PERFECTION_REALM_MATERIALS)) {
        expect(bodyPerfectionMaterialIds(realmId)).toEqual([])
        expect(
          canPerfectBodyRealm(s.player, realmId, (materialId) =>
            s.gameManager.materialBag.getAmount(materialId),
          ),
        ).toBe(false)
        expect(
          s.gameManager.realmAdvanceOps.perfectBodyRealm(
            s.player,
            realmId,
          ),
        ).toBe(false)
      }
      expect(s.player.bodyPerfection.discoveredMaterials).toEqual([])
      expect(s.player.bodyPerfection.perfectedRealmIds).toEqual([])
      expect(isBodyPerfectionRevealed(s.player)).toBe(false)
      expect(getBodyPerfectionRealmProgress(s.player)).toEqual([])
      expect(getBodyPerfectionMultiplier(s.player)).toBe(1)

      // ===== Leg L - hidden-channel deferral (A13 resolution) =====
      // BODY-HIDDEN landed shape: exactly one qi_refining-band
      // hidden_beast channel (killThreshold 1000, spawnChance 0.05), no
      // TC-band channel, no visible-grant rows. The journey earns zero
      // hidden kills - the chain is seeded past the LQ band and TC has
      // no authored channel - so persisted-counter parity ({} == {})
      // held through both checkpoints.
      expect(HIDDEN_MATERIAL_CHANNELS).toHaveLength(1)
      const channel = HIDDEN_MATERIAL_CHANNELS[0]!
      expect(channel.kind).toBe('hidden_beast')
      expect(channel.bandRealmId).toBe('qi_refining')
      if (channel.kind === 'hidden_beast') {
        expect(channel.enemyId).toBe('huyet_mong')
        expect(channel.killThreshold).toBe(1000)
        expect(channel.spawnChancePerSpawn).toBe(0.05)
      }
      expect(VISIBLE_GRANT_SOURCES).toEqual([])
      expect(s.player.hiddenBeastKills).toEqual({})
      // v81's second persisted slice (per-site grotto settle counters)
      // is untouched too - the TC journey runs no grotto channel, so
      // no site carries a recorded cycle.
      expect(s.snapshot().hiddenChannelCycles).toEqual([])

      vi.useRealTimers()
    },
  )
})

// ===== Leg J - determinism =====
describe('TrucCoJourney - determinism', () => {
  const driveJourneyCore = (): Omit<
    EarlyGameSnapshot,
    'tribulationState'
  > => {
    vi.useFakeTimers()
    // Each run owns an independent store - otherwise run two's seeded
    // driver would inherit run one's persisted state.
    setActivePinia(createPinia())
    const s = makeJourneySession()
    seedLqSideState(s)

    expect(s.runTribulation('foundation_establishment')).toBe('victory')
    const receipt = s.settleTribulationOutcome()
    expect(receipt?.kind).toBe('victory')
    const offered = s.player.pendingTalentEntitlement!.offeredTalentIds
    expect(
      s.resolveTalentEntitlement({ kind: 'new', talentId: offered[0]! }),
    ).toBe(true)
    expect(s.drainTribulationOutcome()).toBe(true)
    expect(s.runStage('foundation_floor_1')).toBe('victory')
    feedRefinementTo(s, 6)
    for (const meridian of MERIDIANS.slice(0, 3)) {
      expect(s.investChapter('meridian')).toBe(meridian.thongMachDanCost)
    }
    const snapshot = stripTribulationState(s.snapshot())
    vi.useRealTimers()
    return snapshot
  }

  it('same-seed runs snapshot identically under volatile normalization', () => {
    const first = driveJourneyCore()
    const second = driveJourneyCore()
    expect(second).toEqual(first)
  })
})

// ===== Grade ladder (Leg I, committed seeded-fixture pattern) =====
describe('TrucCoJourney - grade ladder', () => {
  const runGradedTribulation = (
    seed: (s: EarlyGameSession) => void,
    realmLevel: number,
  ): string | undefined => {
    vi.useFakeTimers()
    const s = makeJourneySession()
    s.player.realmLevel = 12
    expect(s.performRitual('spell', 'spell_pathway')).toBe(true)
    s.player.realmLevel = realmLevel
    s.player.completedStageIds = [...MORTAL_STAGE_IDS, ...QI_STAGE_IDS]
    s.player.baseStats = asBaseStats({
      ...s.player.baseStats,
      ...FIXTURE_LQ_STATS,
    })
    seed(s)
    expect(
      s.gameManager.realmAdvanceOps.canTriggerBreakthrough(s.player),
    ).toBe(true)
    expect(s.runTribulation('foundation_establishment')).toBe('victory')
    const grade =
      s.gameManager.tribulationDirector.getCommittedOutcome()?.grade
    vi.useRealTimers()
    return grade
  }

  const openMeridians = (s: EarlyGameSession, count: number): void => {
    s.holdPill(THONG_MACH_DAN_MATERIAL_ID, 133)
    s.holdMaterial(THIEN_DIA_CHI_KIEU_MATERIAL_ID, 1)
    feedRefinementTo(s, 6)
    for (const meridian of MERIDIANS.slice(0, count)) {
      expect(s.investChapter('meridian')).toBe(meridian.thongMachDanCost)
    }
    expect(getOpenedMeridianCount(s.player)).toBe(count)
  }

  it('human grade: uninvested side -> human', () => {
    expect(runGradedTribulation(() => {}, 12)).toBe('human')
  })

  it('earth grade: truc_co_dan + >=3 refinement tiers', () => {
    expect(
      runGradedTribulation((s) => {
        s.holdPill(TRUC_CO_DAN_ID, 1)
        feedRefinementTo(s, 3)
      }, 12),
    ).toBe('earth')
  })

  it('heaven grade: truc_co_dan + 6/6 refinement + 6 meridians', () => {
    expect(
      runGradedTribulation((s) => {
        s.holdPill(TRUC_CO_DAN_ID, 1)
        openMeridians(s, 6)
      }, 12),
    ).toBe('heaven')
  })

  it('great_dao grade: full great-dao input set', () => {
    expect(
      runGradedTribulation((s) => {
        s.holdPill(TRUC_CO_DAN_ID, 1)
        openMeridians(s, 9)
        s.player.mortalPerfectionAchieved = true
        s.player.selectedTalentIds = ['pham_cot']
        const cap = getMainStatCap('qi_refining')
        for (const key of MAIN_STAT_KEYS) {
          s.player.baseStats[key] = cap
        }
      }, 18),
    ).toBe('great_dao')
  })

  it('capped grade: heaven inputs + lost great_dao opportunity -> heaven', () => {
    expect(
      runGradedTribulation((s) => {
        s.holdPill(TRUC_CO_DAN_ID, 1)
        openMeridians(s, 6)
        s.player.greatDaoOpportunityLost = true
      }, 12),
    ).toBe('heaven')
  })
})


// ===== Leg G boundary case - incoherent save rejection =====
// assertBodyProgressionIntegrity fails closed at restore preflight:
// progressed zhou_tian with an incomplete meridian chapter is an
// incoherent persisted state (C2C-64 coherence path, real validator).
describe('TrucCoJourney - save integrity', () => {
  it('rejects a save whose zhou_tian progressed past the meridian gate', () => {
    vi.useFakeTimers()
    const s = makeJourneySession()
    vi.setSystemTime(Date.now())
    const save = buildGameSave(s.player, s.gameManager)
    save.player.realmId = 'foundation_establishment'
    save.player.bodyProgression.zhou_tian.circulation = 50
    setActivePinia(createPinia())
    const resumed = new EarlyGameSession({
      seed: 5,
      profile: PINNED_PROFILE,
    })
    const owner = usePlayerStore()
    expect(resumed.restoreCheckpoint(save, owner).status).toBe('rejected')
    vi.useRealTimers()
  })
})

// ===== Integration sweep - perfection-material channel census =====
// Step 3's testable census: every authored perfection material is
// enumerated against the full acquisition lattice (perfection registry
// -> hidden-beast/grotto emitted sets -> visible-grant exemptions ->
// exclusion from normal stage/family/non-channel-signature routes incl.
// guaranteed/pool equivalents). Clean results are reported, not
// skipped.
describe('TrucCoJourney - integration sweep census', () => {
  const signatureMaterialIdsOf = (enemyId: string): readonly string[] => {
    const enemy = ENEMIES.find((e) => e.id === enemyId)
    return (
      enemy?.signatureDrops
        ?.filter((d) => d.kind === 'material' && d.itemId !== undefined)
        .map((d) => d.itemId!) ?? []
    )
  }

  const channelEnemyIds = new Set(
    hiddenBeastChannels().map((c) => c.enemyId),
  )

  // The leak oracle is wider than the emitted-set oracle: a perfection
  // material id under ANY drop kind on a non-channel route is a
  // bypass (a kind-mismatched row would still leak the id).
  const nonChannelSignatureItemIds = (): Set<string> => {
    const ids = new Set<string>()
    for (const enemy of ENEMIES) {
      if (channelEnemyIds.has(enemy.id)) continue
      for (const drop of enemy.signatureDrops ?? []) {
        if (drop.itemId !== undefined) ids.add(drop.itemId)
      }
    }
    return ids
  }

  const channelEmittedIds = (): Set<string> => {
    const ids = new Set<string>()
    for (const channel of HIDDEN_MATERIAL_CHANNELS) {
      for (const id of channelEmittedMaterialIds(
        channel,
        signatureMaterialIdsOf,
      )) {
        ids.add(id)
      }
    }
    return ids
  }

  const tableItemIds = (): Set<string> => {
    const ids = new Set<string>()
    for (const table of [...STAGE_DROP_TABLES, ...FAMILY_DROP_TABLES]) {
      for (const entry of [...table.guaranteed, ...table.pool]) {
        if (entry.itemId !== undefined) {
          ids.add(entry.itemId)
        }
      }
    }
    return ids
  }

  it('every authored perfection material resolves to exactly one acquisition authority', () => {
    const authored = Object.values(BODY_PERFECTION_REALM_MATERIALS).flat()
    const emitted = channelEmittedIds()
    const granted = new Set(VISIBLE_GRANT_SOURCES.map((g) => g.materialId))
    const signature = nonChannelSignatureItemIds()
    const tables = tableItemIds()

    // Route-less requirements: authored but unreachable via channel or
    // visible grant.
    const routeLess = authored.filter(
      (id) => !emitted.has(id) && !granted.has(id),
    )
    // Duplicate authorities: reachable through both a channel AND a
    // visible grant, or emitted by TWO hidden channels (beast/grotto
    // each count as an acquisition authority of their own).
    const channelEmissionCount = new Map<string, number>()
    for (const channel of HIDDEN_MATERIAL_CHANNELS) {
      for (const id of channelEmittedMaterialIds(
        channel,
        signatureMaterialIdsOf,
      )) {
        channelEmissionCount.set(id, (channelEmissionCount.get(id) ?? 0) + 1)
      }
    }
    const duplicated = authored.filter(
      (id) =>
        (emitted.has(id) && granted.has(id)) ||
        (channelEmissionCount.get(id) ?? 0) > 1,
    )
    // Loot bypasses: a perfection material on a normal stage/family
    // table or a NON-channel enemy's signatureDrops (incl.
    // guaranteed/pool equivalents those authorities represent).
    const bypass = authored.filter(
      (id) => tables.has(id) || signature.has(id),
    )

    // The registry is empty on this wave -> the census reports clean;
    // the enumeration still ran over every landed channel + table.
    // Guard the enumeration itself: an empty input set would let the
    // three result asserts pass vacuously (a table/channel refactor
    // reading nothing reports a false-clean census).
    expect(tables.size).toBeGreaterThan(0)
    expect(emitted.size).toBeGreaterThan(0)
    expect(signature.size).toBeGreaterThan(0)

    expect(routeLess).toEqual([])
    expect(duplicated).toEqual([])
    expect(bypass).toEqual([])
  })
})
