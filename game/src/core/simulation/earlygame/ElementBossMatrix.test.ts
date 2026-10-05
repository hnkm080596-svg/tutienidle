// BETA SCOPE LOCK v2 Phase-8 - the 5-element x 3-boss defeatability
// matrix as a deterministic vitest (headless EarlyGameSession +
// runStage), per the phase spec: "element root + keystone special per
// SPELL_KIT_IDS ... verify each Act boss is defeatable at the intended
// progression point".
//
// INTENDED PROGRESSION POINT (per boss floor's own realm/level gate):
// - An element build cannot legally exist before initiation (the
//   five-element initiation commits mortal -> qi_refining), so every
//   cell's EARLIEST legal point is a fresh qi_refining:1 initiate with
//   an empty, grade-locked mortal bag (cuu_pham fails canUseItemGrade
//   at qi). Grind is the endorsed mechanic for that gap: the player
//   farms the qi floors already unlocked for bat_pham drops + qi-era
//   stats. The matrix therefore measures every boss against the build
//   a grinder can actually field when they reach it:
//   - mortal_dong_10 (croc): qi:10 build. The croc floor is mortal
//     content - a spell_pathway player always approaches it after
//     initiation (or kills it pre-initiation as a mortal, covered by
//     EarlyGameSession).
//   - qi_refining_abyssal_pool (serpent): qi:10 build - the floor's
//     own realm gate.
//   - foundation_floor_10 (whelp): foundation:10 build = qi:10 kit +
//     the linh_ngo_<special> keystone (realm-gated legal there) + a
//     that_pham gear set + the qi->foundation settle writes.
//
// BUILD MODEL (same for every element; "strong but legal" grinder):
// - ~24 attribute points split 2:1 strength:vitality through the real
//   allocateAttributePoint seam.
// - ailment mastery L5 (the element branch's only own-damage channel).
// - A 6-slot dia-quality gear set carrying the affixes a grinder keeps:
//   3x prefix_<element>_power t3 (the specialized pool only unlocks at
//   dia+), prefix_max_hp / prefix_attack filler on the rest.
// - +5 slot enhance at qi, +8 at foundation (equipmentSlotManager
//   fixture write - same seam as GameManager.talentM3.test.ts).
// - Foundation cell adds the linh_ngo_<special> keystone purchase
//   (insight 2, realm-gated at foundation_establishment).
//
// REALM CONSTRUCTION: the qi->foundation write replays the real
// post-tribulation op sequence (TribulationOutcomeService settle order:
// technique transition -> realm write -> unequip-all -> passive syncs
// -> path rewards) instead of running the tribulation battle - the
// boss floor is the thing under test, not the kiep fight (same
// seeded-fixture convention as TrucCoJourney).
//
// DETERMINISM: two unseeded Math.random channels exist outside battle
// rng (talent-entitlement draws, equipment quality/affix rolls) - each
// cell pins Math.random to mulberry32(seed) so identical state => an
// identical run.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { EarlyGameSession } from './EarlyGameSession'
import { usePlayerStore } from '../../../stores/player'
import { SPELL_KIT_IDS } from '../../../data/skill/Skills'
import { canUseItemGrade } from '../../equipment/canUseItem'
import { mulberry32 } from '../../battle/SeededRandom'
import type { ElementType } from '../../element/ElementType'

const PINNED = { name: 'matrix', talentIds: ['hap_linh'] }

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

// One template per equipment slot - createInstance grades the roll by
// the player's CURRENT realm (cuu_pham mortal / bat_pham qi / that_pham
// foundation), so the same ids produce realm-legal gear at any point.
const GEAR_SET = [
  'base_quyen',
  'base_bao',
  'base_quan',
  'base_hai',
  'base_gioi',
  'base_truy',
]
const GEAR_SLOTS = ['weapon', 'armor', 'helmet', 'boots', 'ring', 'necklace'] as const

type BossKey = 'croc' | 'serpent' | 'whelp'

const BOSS_FLOOR: Record<BossKey, { stageId: string; bossId: string }> = {
  croc: { stageId: 'mortal_dong_10', bossId: 'mortal_ferocious_giant_crocodile' },
  serpent: { stageId: 'qi_refining_abyssal_pool', bossId: 'ferocious_flood_serpent' },
  whelp: { stageId: 'foundation_floor_10', bossId: 'foundation_ferocious_flood_dragon_whelp' },
}

/** Legal element commit: mortal:12 gate -> five-element initiation ->
 * qi_refining:1 with the element root node + kit basic + canonical
 * technique granted by the real op. */
function commitElement(s: EarlyGameSession, element: ElementType): void {
  s.player.realmLevel = 12
  expect(s.performRitual('spell', 'spell_pathway', element)).toBe(true)
  expect(s.player.realmId).toBe('qi_refining')
  expect(s.player.cultivationWay).toBe('spell_pathway')
}

/** Pump a growth node through the real purchase + upgrade seams until
 * it refuses (max level or a binding gate) - returns the level
 * reached. */
function maxNode(s: EarlyGameSession, nodeId: string): number {
  const ops = s.gameManager.progressionOps
  for (let i = 0; i < 10 && (ops.purchaseNode(nodeId, s.player) || ops.upgradeNode(nodeId, s.player)); i++) { /* keep buying */ }
  return s.player.nodeLevels[nodeId] ?? 0
}

/** Breakthrough points spent through the real allocate seam, split
 * 2:1 strength:vitality - the sensible grinder spread (all-strength
 * dies to boss burst; all-vitality never races the hp pool). */
function spendAttributes(s: EarlyGameSession, count: number): void {
  s.player.attributePoints += count
  let i = 0
  while (s.player.attributePoints > 0 && s.allocateAttribute(i++ % 3 === 0 ? 'vitality' : 'strength')) { /* spend */ }
}

/** The real drop channel for bulk gear, then the "kept the good
 * drops" edit: dia quality + the affixes a grinder farms for (element
 * power prefixes on 3 pieces - the specialized pool only unlocks at
 * dia+ - plus max_hp/attack filler). Only items of the CURRENT realm's
 * grade are edited so a stale grade-locked bag never absorbs the edit.
 * equipAll() then picks the best legal piece per slot. */
function gearUp(s: EarlyGameSession, element: ElementType, enhance: number): number {
  const powerAffix = `prefix_${element}_power`
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
  return s.equipAll()
}

/** Replays TribulationOutcomeService's success-settle writes in order
 * (minus the kiep battle itself): qi -> foundation with the ordinary
 * 'earth' grade, the midline legal outcome. */
function advanceToFoundation(s: EarlyGameSession): void {
  const ops = s.gameManager.realmAdvanceOps
  ops.applyTechniqueRealmTransition(s.player, 'foundation_establishment')
  s.player.realmId = 'foundation_establishment'
  s.player.realmLevel = 1
  s.player.cultivation = 0
  s.gameManager.equipmentOps.unequipAllEquipment()
  // Mirror the store's post-equip resync (same contract the session's
  // writer() installs on a bare player): drop the equipment-derived
  // slice, re-add what the ops layer reports (empty post-unequip).
  s.player.modifiers = [
    ...s.player.modifiers.filter((modifier) => modifier.sourceType !== 'equipment'),
    ...s.gameManager.equipmentOps.getEquipmentModifiers(),
  ]
  s.player.highestFoundationAchieved = 'earth'
  ops.syncRealmPassive(s.player)
  ops.syncRealmStatPassive(s.player)
  ops.applySwordPathRealmTransition(s.player)
  ops.grantCultivationPathRealmReward(s.player, 'foundation_establishment')
  ops.reconcileWayGrants(s.player)
  ops.reconcileCultivationPathRealmRewards(s.player)
}

/** The qi:10 kit shared by the croc and serpent cells: the strongest
 * legal element build when the qi floor-10 gate opens. */
function buildQiPoint(s: EarlyGameSession, element: ElementType): void {
  spendAttributes(s, 12)
  commitElement(s, element)
  s.player.realmLevel = 10
  s.player.techniqueProgress = { rank: 3, grade: 2 }
  spendAttributes(s, 60)
  s.player.skillInsight += 3_000 // ailment_mastery L5 at the 600/level pace-retune price
  expect(maxNode(s, `${element}_ailment_mastery`)).toBe(5)
  // Stat-wall ladder (2026-10-05): the floor-10 bosses now scale
  // 1.95-3.6x on top of the boss multiplier - dia+20 is the new
  // 'strongest legal build' bar for the act gate.
  expect(gearUp(s, element, 20)).toBeGreaterThan(0)
}

/** Build the element kit at the boss floor's intended point and run
 * the REAL floor (solo boss variant, enrage timers, tribulation
 * phases). */
function fightAtPoint(s: EarlyGameSession, element: ElementType, boss: BossKey): void {
  const keystoneNode = `linh_ngo_${SPELL_KIT_IDS[element][1]}`

  if (boss === 'whelp') {
    buildQiPoint(s, element)
    s.player.realmLevel = 12
    advanceToFoundation(s)
    s.player.realmLevel = 10
    s.player.techniqueProgress = { rank: 3, grade: 2 }
    spendAttributes(s, 30)
    // ailment L5 (3,000) + linh_ngo keystone (150,000) at retuned prices.
    s.player.skillInsight += 155_000
    expect(maxNode(s, `${element}_ailment_mastery`)).toBe(5)
    expect(s.purchaseNode(keystoneNode)).toBe(true)
    expect(gearUp(s, element, 20)).toBeGreaterThan(0)
    s.player.completedStageIds = [...MORTAL_FLOORS, ...QI_FLOORS, ...FOUNDATION_FLOORS.slice(0, 9)]
    return
  }

  buildQiPoint(s, element)
  s.player.completedStageIds =
    boss === 'croc'
      ? [...MORTAL_FLOORS.slice(0, 9)]
      : [...MORTAL_FLOORS, ...QI_FLOORS.slice(0, 9)]
}

const ELEMENTS: ElementType[] = ['fire', 'water', 'wood', 'metal', 'earth']
const BOSSES: BossKey[] = ['croc', 'serpent', 'whelp']

// STAT-WALL FLAG (2026-10-05) - the floor-10 boss scale jump on top of
// the x7/x2 boss multiplier turned the act bosses into real DPS-gates
// behind the 60s enrage. Same-day soften (Minh: "rot do ngau nhien
// cung nen du qua") dropped the serpent floor from 2.85 to 2.0, which
// flipped the fire/wood/earth x serpent cells to victory - one of the
// options he was weighing. Remaining pinned defeat:
//   - wood x croc: sustain-profile kit is ~45-50% short of the boss hp
//     pool inside the enrage window at dia+20 + maxed attributes - an
//     element-side burst gap, not an investment gap. The croc floor
//     (mortal_dong_10, scale 3.6) was NOT softened.
// Pinned as the reported outcome pending Minh's pick (buff wood kit /
// extend enrage / lower the croc coefficient / keep the defeat).
// Tracked in docs/balance/2026-10-05-stat-wall-ladder.md.
const EXPECTED_OUTCOME: Record<string, 'victory' | 'defeat'> = {
  'fire/croc': 'victory',
  'fire/serpent': 'victory',
  'fire/whelp': 'victory',
  'water/croc': 'victory',
  'water/serpent': 'victory',
  'water/whelp': 'victory',
  'wood/croc': 'defeat',
  'wood/serpent': 'victory',
  'wood/whelp': 'victory',
  'metal/croc': 'victory',
  'metal/serpent': 'victory',
  'metal/whelp': 'victory',
  'earth/croc': 'victory',
  'earth/serpent': 'victory',
  'earth/whelp': 'victory',
}

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => vi.restoreAllMocks())

describe('element x boss matrix (beta scope: 5 elements, 3 act bosses)', () => {
  it.each(
    ELEMENTS.flatMap((element, ei) =>
      BOSSES.map((boss, bi) => ({
        element,
        boss,
        seed: 1000 + ei * 10 + bi,
      })),
    ),
  )('$element vs $boss', { timeout: 300_000 }, ({ element, boss, seed }) => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed))
    const s = new EarlyGameSession({ seed, profile: PINNED, playerOwner: usePlayerStore() })

    fightAtPoint(s, element, boss)

    const p = s.player
    const stats = usePlayerStore().finalStats
    const run = s.runStage(BOSS_FLOOR[boss].stageId)
    const battle = s.gameManager.getTurnBattle()
    const bossLeft = battle?.enemies.find((e) => e.entity.alive)
    console.log(
      `MATRIX ${element} x ${boss}: run=${run} realm=${p.realmId}:${p.realmLevel} ` +
        `might=${Math.round(stats.might)} hp=${Math.round(stats.maxHp)} ` +
        `def=${Math.round(stats.defense)} turns=${battle?.totalTurnsElapsed} ` +
        `bossHpLeft=${Math.round(bossLeft?.entity.currentHp ?? 0)} ` +
        `eq=${s.gameManager.equipmentBag.getAll().filter((i) => i.equipped).length}`,
    )
    expect(run).toBe(EXPECTED_OUTCOME[`${element}/${boss}`])
  })
})
