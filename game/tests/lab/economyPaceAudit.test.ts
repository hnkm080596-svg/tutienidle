/**
 * Economy pace audit (2026-10-05) - measurement instrument for the
 * currency/material retune wave feeding docs/balance/<date>-economy-pace.md.
 *
 *  A. INCOME - per-realm Linh Thach / essence / material flow per hour:
 *       - manual stage farming: real TurnBattle clear on floors 1/5/9
 *         per chapter with a GEARED honest-entry player (same build as
 *         balanceSweep), timed on the combat clock - loot read off the
 *         real MaterialBag delta.
 *       - auto-farm: authored rule = full stage loot per cycle at
 *         (perfectClearSeconds, post-retune) - projected from the measured
 *         clear seconds (idle channel keeps currency + pool rolls).
 *       - Linh Mach (gathering_outpost): getSpiritSpringRatePerSecond
 *         at building levels 1..3 (realm tier caps the level).
 *       - production sites: analytic yield/worker-hour from
 *         PRODUCTION_RATE_TABLE + SITE_SPEED_MULTIPLIERS.
 *       - quest rewards: one-shot totals from data/quest.
 *  B. COSTS - the upgrade-path basket the stage walls demand per realm:
 *       enhance 6-slot set to a reference level (expected attempts
 *       under pity-10), wash/refine ops, building + site upgrades,
 *       alchemy (per-realm recipes + thong_mach/truc_co dan), meridian
 *       Bat Mach pills, Zhou Tian steps, tribulation retries,
 *       Tu Linh Tran, technique grade-up.
 *  C. TIME-TO-AFFORD - cumulative cost / income-per-hour.
 *
 * Analysis artifact, not a CI assertion - writes JSON to
 * game/.audit-out/ (gitignored scratch) and prints a compact table.
 */
import { describe, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createLab, type Lab } from './harness'
import { STAGES } from '@/data/stage/Stages'
import { STAGE_DROP_TABLES } from '@/data/drop/StageDropTables'
import { ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'
import { getRealmRewardMultiplier } from '@/core/reward/RealmRewardScale'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  SITE_SPEED_MULTIPLIERS,
  MATERIAL_AGE_AMOUNTS,
  MATERIAL_AGE_WEIGHTS,
  HERB_AGE_WEIGHTS,
  GROTTO_HERB_AMOUNT,
  TIER_WEIGHT_PROFILES,
  PRODUCTION_OFFLINE_CAP_SECONDS,
} from '@/core/production/ProductionBalance'
import { HERB_AGES } from '@/core/production/ProductionTypes'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import { buildings } from '@/data/building/buildings'
import { THANH_VAN_PRODUCTION_SITES } from '@/core/production/ProductionCatalog'
import { MERIDIANS } from '@/data/realm/Meridians'
import { BODY_REFINEMENT_TIERS } from '@/data/realm/BodyRefinement'
import { ZHOU_TIAN_TOTAL_STEPS, zhouTianStepCost } from '@/data/realm/ZhouTian'
import { enhanceSuccessRate } from '@/core/equipment/EnhanceCurve'
import {
  WASH_TINH_HOA_COST_BY_QUALITY,
  WASH_SPIRIT_STONE_COST_BY_QUALITY,
  REFINE_TINH_HOA_COST_BY_QUALITY,
  REFINE_SPIRIT_STONE_PER_UNIT_BY_QUALITY,
} from '@/core/equipment/RefinementBalance'
import { createDefaultEquipmentOperationCostCatalog } from '@/core/equipment/EquipmentOperationCostCatalog'
import {
  TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM,
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM,
} from '@/data/tribulation/TribulationChapters'
import { getTuLinhTranCost } from '@/core/economy/TuLinhTranBalance'
import { getTechniqueGradeUpgradeCost } from '@/core/technique/TechniqueProgression'
import { getUnitSellPrice } from '@/core/economy/VendorBalance'
import { materials } from '@/data/materials/materials'
import { QUESTS } from '@/data/quest/quests'
import { DEFAULT_MAX_OFFLINE_SECONDS } from '@/core/idle/GameClock'
import type { Stage } from '@/core/stage/Stage'

const OUT_DIR = path.join(process.cwd(), '.audit-out')

const REALM_ORDER: Record<string, number> = {
  mortal: 0,
  qi_refining: 1,
  foundation_establishment: 2,
}
const REALM_PRIOR_MIN_LEVELS: Record<string, number> = {
  mortal: 0,
  qi_refining: 12,
  foundation_establishment: 24,
}
const SLOT_TEMPLATES: Record<string, string> = {
  weapon: 'base_kiem',
  helmet: 'base_quan',
  armor: 'base_bao',
  boots: 'base_hai',
  ring: 'base_gioi',
  necklace: 'base_truy',
}
const COMBAT_CAP_SECONDS = 900
const GEAR_ROLLS_PER_SLOT = 20
const SAMPLED_FLOORS = [1, 5, 9]

/* ---------------- analytic expectations ---------------- */

function weightedMean<T>(entries: readonly { weight: number; mean: number }[]): number {
  const total = entries.reduce((sum, e) => sum + e.weight, 0)
  return entries.reduce((sum, e) => sum + (e.weight / total) * e.mean, 0)
}

function rangeMean(range?: { min: number; max: number }): number {
  return range ? (range.min + range.max) / 2 : 1
}

/** Expected per-kill yield for a realm's floor-1..9 drop band. */
function expectedKillYield(realmId: string) {
  const table = STAGE_DROP_TABLES.find((t) => t.realmId === realmId)
  const mult = getRealmRewardMultiplier(realmId)
  const stoneMean = table ? rangeMean(table.currency?.spiritStone) * mult : 0
  const masteryMean = table ? rangeMean(table.currency?.techniqueMastery) * mult : 0
  // guaranteed: essence band drop (chance x mean)
  const essence =
    (table?.guaranteed ?? [])
      .filter((g) => g.itemId?.startsWith('tinh_hoa'))
      .reduce((sum, g) => sum + g.chance * rangeMean(g.amount), 0)
  // pool: one weighted draw per kill
  const pool = table?.pool ?? []
  const poolTotal = pool.reduce((s, e) => s + e.weight, 0)
  const poolExpectation = pool.map((entry) => ({
    itemId: entry.itemId ?? entry.kind,
    mean: (entry.weight / poolTotal) * rangeMean(entry.amount),
  }))
  const equipment = poolExpectation
    .filter((e) => e.itemId === 'equipment_any')
    .reduce((s, e) => s + e.mean, 0)
  const materialsById = poolExpectation.filter((e) => e.itemId !== 'equipment_any')
  return { stoneMean, masteryMean, essence, equipment, materialsById }
}

/** Expected production yield per worker-hour for a site kind at realm/level. */
function siteYieldPerHour(kind: 'forest' | 'mine' | 'grotto', realmId: string, siteLevel: number): number {
  const base = CYCLE_BASE_SECONDS_BY_REALM[realmId] ?? 0
  const speed = SITE_SPEED_MULTIPLIERS[siteLevel - 1] ?? 1
  const cyclesPerHour = 3600 / Math.ceil(base / speed)
  if (kind === 'grotto') return GROTTO_HERB_AMOUNT * cyclesPerHour
  const weights = MATERIAL_AGE_WEIGHTS
  const total = HERB_AGES.reduce((s, a) => s + weights[a], 0)
  const meanAmount = HERB_AGES.reduce((s, a) => s + (weights[a] / total) * MATERIAL_AGE_AMOUNTS[a], 0)
  return meanAmount * cyclesPerHour
}

/** Weight-profile adjusted realm-material split (Lam/Quang roll tier first). */
function tieredYieldPerHour(realmId: string, realmIndex: number): { decadeEquivPerHour: number } {
  const base = CYCLE_BASE_SECONDS_BY_REALM[realmId] ?? 0
  const cyclesPerHour = 3600 / base // level 1
  const profile = TIER_WEIGHT_PROFILES[realmIndex <= 0 ? 'low' : realmIndex === 1 ? 'middle' : 'high']
  const probs = profile.map((w) => w / profile.reduce((s, x) => s + x, 0))
  const amounts = [3, 2, 1]
  const meanPerCycle = probs.reduce((s, p, i) => s + p * amounts[i]!, 0)
  return { decadeEquivPerHour: meanPerCycle * cyclesPerHour }
}

/** Expected ops to gain one enhance level under geometric + pity-10. */
function expectedAttemptsPerLevel(level: number): number {
  const rate = enhanceSuccessRate(level + 1) / 100
  const pFail = 1 - Math.min(1, Math.max(0.01, rate))
  let expected = 0
  for (let k = 1; k <= 10; k++) {
    expected += k * rate * Math.pow(pFail, k - 1)
  }
  expected += 11 * Math.pow(pFail, 10)
  return expected
}

interface EnhanceToLevel {
  level: number
  attempts: number
  ore: number
  stones: number
}

function enhanceCostToLevel(realmId: string, targetLevel: number, slots = 6): EnhanceToLevel {
  const catalog = createDefaultEquipmentOperationCostCatalog()
  const catalogEntry = catalog.resolve('enhance', realmId)
  const orePerAttempt = catalogEntry?.materials?.[0]?.amount ?? 2
  const stonePerAttempt = catalogEntry?.spiritStone ?? 50
  let attempts = 0
  let ore = 0
  let stones = 0
  for (let l = 0; l < targetLevel; l++) {
    const att = expectedAttemptsPerLevel(l)
    attempts += att
    ore += att * orePerAttempt * (l + 1)
    stones += att * stonePerAttempt
  }
  return { level: targetLevel, attempts: attempts * slots, ore: ore * slots, stones: stones * slots }
}

/* ---------------- measured clear times ---------------- */

function buildGearedPlayer(lab: Lab, realmId: string, floor: number, stageList: Stage[], stageIndex: number) {
  lab.cheat.setRealm(realmId, floor)
  lab.player.cultivationPath = 'spell'
  lab.player.cultivationWay = 'spell_pathway'
  lab.player.attributePoints = (REALM_PRIOR_MIN_LEVELS[realmId] ?? 0) + Math.max(0, floor - 1)
  lab.player.completedStageIds.push(...stageList.slice(0, stageIndex).map((s) => s.id))

  let wantVit = true
  while (lab.player.attributePoints > 0) {
    const primary = wantVit ? 'vitality' : 'strength'
    if (!lab.manager.progressionOps.allocateAttributePoint(lab.player, primary)) {
      if (!lab.manager.progressionOps.allocateAttributePoint(lab.player, wantVit ? 'strength' : 'vitality')) break
    }
    wantVit = !wantVit
  }
  if (realmId !== 'mortal') {
    lab.manager.progressionOps.learnSkill('hoa_cau_thuat', lab.player)
  }
  for (const templateId of Object.values(SLOT_TEMPLATES)) {
    let bestId: string | null = null
    let bestQuality = -1
    for (let i = 0; i < GEAR_ROLLS_PER_SLOT; i++) {
      const grant = lab.cheat.addEquipment(templateId)
      const qi = ITEM_QUALITY_ORDER.indexOf(grant.instance.quality)
      if (qi > bestQuality) {
        bestQuality = qi
        bestId = grant.instance.instanceId
      }
    }
    if (bestId) lab.manager.equipmentOps.equipItem(bestId, lab.player)
  }
  lab.player.modifiers = lab.manager.equipmentOps.getEquipmentModifiers()
}

interface FarmMeasurement {
  stageId: string
  realmId: string
  floor: number
  result?: string
  kills: number
  clearSeconds: number
  stonesGained: number
  essenceGained: number
  materialsGained: Record<string, number>
  stonesPerHourManual: number
  stonesPerHourAutoFarm: number
}

function measureStage(lab: Lab, stage: Stage, realmId: string): FarmMeasurement {
  const bag = lab.manager.materialBag
  const stoneBefore = bag.getAmount('spirit_stone_ha_pham')
  const before = new Map<string, number>()
  for (const s of bag.getAll()) before.set(s.material.id, s.amount)

  const started = lab.manager.turnBattleOps.startStage(lab.player, stage, false)
  if (!started) {
    return {
      stageId: stage.id, realmId, floor: stage.floor ?? 0, result: 'refused', kills: 0, clearSeconds: 0,
      stonesGained: 0, essenceGained: 0, materialsGained: {},
      stonesPerHourManual: 0, stonesPerHourAutoFarm: 0,
    }
  }
  let elapsed = 0
  const step = 0.5
  while (elapsed < COMBAT_CAP_SECONDS) {
    lab.combat(step)
    elapsed += step
    const b = lab.manager.getTurnBattle()
    if (!b || b.state === 'victory' || b.state === 'defeat') break
  }
  const battle = lab.manager.getTurnBattle()
  const kills = battle ? battle.enemies.filter((e) => !e.entity.alive).length : 0
  const result = battle?.state ?? 'none'

  const materialsGained: Record<string, number> = {}
  for (const s of bag.getAll()) {
    const delta = s.amount - (before.get(s.material.id) ?? 0)
    if (delta > 0 && s.material.id !== 'spirit_stone_ha_pham') materialsGained[s.material.id] = delta
  }
  const stonesGained = bag.getAmount('spirit_stone_ha_pham') - stoneBefore
  const essenceGained = Object.entries(materialsGained)
    .filter(([id]) => id.startsWith('tinh_hoa'))
    .reduce((s, [, v]) => s + v, 0)
  const clear = Math.max(1, elapsed)
  return {
    stageId: stage.id,
    realmId,
    floor: stage.floor ?? 0,
    result,
    kills,
    clearSeconds: Math.round(clear * 10) / 10,
    stonesGained,
    essenceGained,
    materialsGained,
    // manual: one clear per (clear + ~20s overhead); auto-farm cycle = clear/2
    stonesPerHourManual: Math.round(stonesGained * (3600 / (clear + 20))),
    stonesPerHourAutoFarm: Math.round(stonesGained * (3600 / clear)),
  }
}

/* ---------------- cost baskets ---------------- */

interface CostBasket {
  label: string
  spiritStones: number
  essenceTinhHoa: number
  materials: Record<string, number>
  herbUnits: number
}

function realmCostBasket(realmId: string): CostBasket[] {
  const basket: CostBasket[] = []
  // Buildings this realm can raise (tier N -> level N): level-N-1 row of each.
  const realmIndex = REALM_ORDER[realmId] ?? 0
  const tier = realmIndex + 1
  const buildingMats: Record<string, number> = {}
  for (const b of buildings) {
    if (b.maxLevel < tier) continue
    const row = b.upgradeCost[tier - 2]
    if (!row) continue
    for (const c of row) buildingMats[c.materialId] = (buildingMats[c.materialId] ?? 0) + c.amount
  }
  basket.push({ label: `buildings->L${tier}`, spiritStones: 0, essenceTinhHoa: 0, materials: buildingMats, herbUnits: 0 })

  // Site upgrades to level = tier
  const siteMats: Record<string, number> = {}
  let siteStones = 0
  for (const s of THANH_VAN_PRODUCTION_SITES) {
    const row = s.upgradeCosts[tier - 2]
    if (!row) continue
    siteMats[row.woodMaterialId] = (siteMats[row.woodMaterialId] ?? 0) + row.woodAmount
    siteStones += row.spiritStone
  }
  basket.push({ label: `sites->L${tier}`, spiritStones: siteStones, essenceTinhHoa: 0, materials: siteMats, herbUnits: 0 })

  // Alchemy recipes live at this realm (non-retired): cost x1 each + fuel
  const recipes = alchemyRecipes.filter((r) => r.realmId === realmId && !r.retired)
  let alchStones = 0
  const alchMats: Record<string, number> = {}
  let herbUnits = 0
  for (const r of recipes) {
    alchStones += r.spiritStoneCost
    alchMats[`${r.fuelWoodRealmId}_wood_decade`] = (alchMats[`${r.fuelWoodRealmId}_wood_decade`] ?? 0) + r.fuelWoodAmount
    herbUnits += r.herbAmount
    for (const ing of r.specialIngredients ?? []) {
      alchMats[ing.materialId] = (alchMats[ing.materialId] ?? 0) + ing.amount
    }
  }
  basket.push({ label: 'alchemy-x1-each', spiritStones: alchStones, essenceTinhHoa: 0, materials: alchMats, herbUnits })

  // Meridian pills (qi page only - realm LK+). Progressive Khai Mach:
  // each invest consumes exactly 1 pill and rolls a uniform gain in
  // investGainRange, so the expected pill total to complete a meridian
  // is 100 / mean-gain invests.
  if (realmIndex >= 1) {
    const pills = Math.ceil(
      MERIDIANS.reduce(
        (s, m) => s + 100 / ((m.investGainRange.min + m.investGainRange.max) / 2),
        0,
      ),
    )
    const recipe = alchemyRecipes.find((r) => r.pillId === 'thong_mach_dan')
    basket.push({
      label: `bat-mach pills x${pills}`,
      spiritStones: (recipe?.spiritStoneCost ?? 0) * pills,
      essenceTinhHoa: 0,
      materials: {
        yeu_dan_hung_giao: pills,
        [`qi_refining_wood_decade`]: (recipe?.fuelWoodAmount ?? 0) * pills,
      },
      herbUnits: (recipe?.herbAmount ?? 0) * pills,
    })
  }
  // Zhou Tian (TC only): essence phap
  if (realmId === 'foundation_establishment') {
    let essence = 0
    for (let s = 0; s < ZHOU_TIAN_TOTAL_STEPS; s++) essence += zhouTianStepCost(s)
    basket.push({ label: 'zhou-tian 36 steps', spiritStones: 0, essenceTinhHoa: essence, materials: {}, herbUnits: 0 })
  }
  // Body refinement (mortal): pham essence total caps
  if (realmId === 'mortal') {
    const total = BODY_REFINEMENT_TIERS.reduce((s, t) => s + t.cap, 0)
    basket.push({ label: 'luyen-the 6 tiers', spiritStones: 0, essenceTinhHoa: total, materials: {}, herbUnits: 0 })
  }
  // Tribulation retry x3
  const retryStones = TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM[realmId] ?? 2000
  basket.push({
    label: `tribulation retry x3 (+tu vi -${Math.round((TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM[realmId] ?? 0.3) * 100)}%/fail)`,
    spiritStones: retryStones * 3,
    essenceTinhHoa: 0,
    materials: {},
    herbUnits: 0,
  })
  // Tu Linh Tran x3 stacks
  let tlt = 0
  for (let s = 0; s < 3; s++) tlt += getTuLinhTranCost(realmId, s).amount
  basket.push({ label: 'tu-linh-tran 3 stacks', spiritStones: tlt, essenceTinhHoa: 0, materials: {}, herbUnits: 0 })
  // Technique grade-up to tier
  const tech = getTechniqueGradeUpgradeCost(tier, realmId)
  basket.push({ label: `technique grade ${tier}`, spiritStones: tech.amount, essenceTinhHoa: 0, materials: {}, herbUnits: 0 })
  // Wash/refine 5 ops per slot x 6 slots, at the era-typical quality
  const eraQuality =
    realmId === 'foundation_establishment' ? 'dia' : realmId === 'qi_refining' ? 'huyen' : 'hoang'
  const wash = WASH_TINH_HOA_COST_BY_QUALITY[eraQuality]
  const refineUnits = REFINE_TINH_HOA_COST_BY_QUALITY[eraQuality]
  basket.push({
    label: `wash x30 + refine x30 (${eraQuality})`,
    spiritStones:
      30 * WASH_SPIRIT_STONE_COST_BY_QUALITY[eraQuality] +
      30 * refineUnits * REFINE_SPIRIT_STONE_PER_UNIT_BY_QUALITY[eraQuality],
    essenceTinhHoa: 30 * wash + 30 * refineUnits,
    materials: {},
    herbUnits: 0,
  })
  return basket
}

/* ---------------- main ---------------- */

describe('economy pace audit', () => {
  it('prints per-realm income vs cost', () => {
    const ordered = STAGES.slice().sort(
      (a, b) =>
        (REALM_ORDER[a.requiredRealmId ?? 'mortal'] ?? 0) -
          (REALM_ORDER[b.requiredRealmId ?? 'mortal'] ?? 0) ||
        (a.requiredRealmLevel ?? a.floor ?? 0) - (b.requiredRealmLevel ?? b.floor ?? 0),
    )
    const byRealm = new Map<string, Stage[]>()
    for (const s of ordered) {
      const r = s.requiredRealmId ?? 'mortal'
      if (REALM_ORDER[r] === undefined) continue
      const list = byRealm.get(r) ?? []
      list.push(s)
      byRealm.set(r, list)
    }

    const measurements: FarmMeasurement[] = []
    for (const [realmId, stages] of byRealm) {
      for (const floor of SAMPLED_FLOORS) {
        const stage = stages.find((s) => (s.floor ?? s.requiredRealmLevel) === floor)
        if (!stage) continue
        const lab = createLab()
        lab.useRealData()
        const idx = ordered.indexOf(stage)
        buildGearedPlayer(lab, realmId, floor, ordered, idx)
        measurements.push(measureStage(lab, stage, realmId))
      }
    }

    // ----- aggregate per realm -----
    const report: Record<string, unknown> = {}
    const lines: string[] = []
    for (const realmId of ['mortal', 'qi_refining', 'foundation_establishment']) {
      const killsYield = expectedKillYield(realmId)
      const allRuns = measurements.filter((m) => m.realmId === realmId)
      const runs = allRuns.filter((m) => m.kills > 0)
      const avgStonesPerHourManual = runs.length
        ? Math.round(runs.reduce((s, m) => s + m.stonesPerHourManual, 0) / runs.length)
        : 0
      const avgStonesPerHourAuto = runs.length
        ? Math.round(runs.reduce((s, m) => s + m.stonesPerHourAutoFarm, 0) / runs.length)
        : 0

      const tier = (REALM_ORDER[realmId] ?? 0) + 1
      const siteLevel = tier
      const woodY = siteYieldPerHour('forest', realmId, siteLevel)
      const oreY = siteYieldPerHour('mine', realmId, siteLevel)
      const herbY = siteYieldPerHour('grotto', realmId, siteLevel)
      const workersMax = tier === 1 ? 3 : 1 + tier * 2 // CHQ L1..tier

      // Linh Tuyen rate at level = tier
      const targetPerMinute = { mortal: 5.5, qi_refining: 31, foundation_establishment: 93 }[realmId]!
      const maxLevelMult = 1 + (9 - 1) * 0.2
      const rateL1 = targetPerMinute / maxLevelMult
      const rateAtTier = rateL1 * (1 + (tier - 1) * 0.2)
      const springPerHour = rateAtTier * 60
      const springOfflineCap = springPerHour * (PRODUCTION_OFFLINE_CAP_SECONDS / 3600)

      // quests one-shot
      const questStones = QUESTS.filter(() => true).reduce((sum, q) => {
        const r = (q as { reward?: { reward?: { spiritStone?: number } } }).reward?.reward?.spiritStone
        return sum + (r ?? 0)
      }, 0)

      // vendor: selling mortal mats at LK+ (wood decade price)
      const woodMat = materials.find((m) => m.id === 'mortal_wood_decade')
      const vendorWoodPrice = woodMat ? getUnitSellPrice(woodMat, realmId) : undefined

      const enhanceLevels = [5, 10, 15, 20]
      const enhance = enhanceLevels.map((l) => enhanceCostToLevel(realmId, l))

      const basket = realmCostBasket(realmId)

      report[realmId] = {
        killYield: killsYield,
        manualStonesPerHour: avgStonesPerHourManual,
        autoFarmStonesPerHour: avgStonesPerHourAuto,
        springPerHour: Math.round(springPerHour),
        springOfflineCap: Math.round(springOfflineCap),
        autoFarmOfflineCap: Math.round(avgStonesPerHourAuto * Math.min(24, DEFAULT_MAX_OFFLINE_SECONDS / 3600)),
        siteYieldPerWorkerHour: { wood: Math.round(woodY), ore: Math.round(oreY), herb: Math.round(herbY) },
        workersMax,
        enhance,
        basket,
        questStonesTotalAllRealms: questStones,
        vendorWoodDecadePrice: vendorWoodPrice,
        runs: allRuns,
      }

      lines.push(`=== ${realmId} (tier ${tier}) ===`)
      lines.push(
        `  kill mean: ${killsYield.stoneMean} stones, essence ${killsYield.essence.toFixed(2)}, equip ${killsYield.equipment.toFixed(2)}, ` +
          `mats ${killsYield.materialsById.map((m) => `${m.itemId}:${m.mean.toFixed(2)}`).join(', ') || '-'}`,
      )
      for (const m of runs) {
        lines.push(
          `  ${m.stageId} [${m.result}]: ${m.kills} kills ${m.clearSeconds}s +${m.stonesGained} stones (manual ${m.stonesPerHourManual}/h, autofarm ${m.stonesPerHourAutoFarm}/h)`,
        )
      }
      lines.push(
        `  LinhMach L${tier}: ${Math.round(springPerHour)}/h stones; offline 10h cap ~${Math.round(springOfflineCap)}`,
      )
      lines.push(
        `  sites L${siteLevel}/worker: wood ${woodY.toFixed(1)}/h, ore ${oreY.toFixed(1)}/h, herb ${herbY.toFixed(1)}/h (workers max ${workersMax})`,
      )
      for (const e of enhance) {
        lines.push(
          `  enhance 6 slots ->+${e.level}: ${e.attempts.toFixed(0)} ops, ${Math.round(e.ore)} realm-ore, ${Math.round(e.stones)} stones`,
        )
      }
      for (const c of basket) {
        lines.push(
          `  cost ${c.label}: ${c.spiritStones} stones${c.essenceTinhHoa ? `, ${c.essenceTinhHoa} essence` : ''}${Object.keys(c.materials).length ? `, mats ${JSON.stringify(c.materials)}` : ''}${c.herbUnits ? `, herbs x${c.herbUnits}` : ''}`,
        )
      }
      // time-to-afford: stones basket total / (manual+spring) and (autofarm)
      const totalStones = basket.reduce((s, c) => s + c.spiritStones, 0)
      lines.push(
        `  BASKET STONES TOTAL: ${totalStones} -> manual+spring ${(totalStones / Math.max(1, avgStonesPerHourManual + springPerHour)).toFixed(1)}h, autofarm ${(totalStones / Math.max(1, avgStonesPerHourAuto)).toFixed(2)}h`,
      )
      lines.push('')
    }

    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(path.join(OUT_DIR, 'economy-pace.json'), JSON.stringify(report, null, 2))
    console.log(lines.join('\n'))
  }, 240_000)
})
