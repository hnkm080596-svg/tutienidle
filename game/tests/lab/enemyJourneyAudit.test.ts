/**
 * Enemy-balance audit sweep (2026-10-04) - two instruments feeding
 * docs/balance/enemies-review.md:
 *
 *  A. JOURNEY - a real-player playthrough via EarlyGameSession across
 *     all 30 thanh_van floors with a BattleMetricsCollector attached to
 *     every stage attempt (TTK proxy = fightingSteps, player HP lost,
 *     rounds, outcome, live enemy roster incl. elite/boss spawn stats).
 *     Between defeats the loop does what a player does: re-farm the
 *     best cleared floor, equip drops, invest refinement, allocate
 *     attributes, cultivate to the next level gate. Realm transitions
 *     ride the real tribulation/ritual seams.
 *  B. FLOOR SWEEP - the B2 fixed-build comparison (NAKED / GEARED at
 *     the unlock gate) with the same metrics, so each floor's pressure
 *     is readable independent of journey pacing.
 *
 * Analysis artifact, not a CI assertion - writes JSON to
 * game/.audit-out/ (gitignored scratch) and prints a compact table.
 */
import { describe, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createLab, type Lab } from './harness'
import { usePlayerStore } from '@/stores/player'
import { EarlyGameSession } from '@/core/simulation/earlygame/EarlyGameSession'
import type { TribulationRunResult } from '@/core/simulation/earlygame/EarlyGameSession'
import { BattleMetricsCollector } from '@/core/simulation/BattleMetrics'
import { getRequiredCultivation } from '@/core/realm/realmSystem'
import { getBreakthroughRequirements } from '@/core/realm/BreakthroughGate'
import { calculateStats } from '@/core/stats/StatCalculator'
import { STAGES } from '@/data/stage/Stages'
import { ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'
import type { Stage } from '@/core/stage/Stage'
import type { GameManager } from '@/core/game/GameManager'

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
const OUT_DIR = path.join(process.cwd(), '.audit-out')

interface EnemySeen {
  templateId: string | undefined
  name: string
  isBoss: boolean
  isElite: boolean
  maxHp: number
  might: number
  defense: number
  speed: number
  died: boolean
}

interface AttemptRecord {
  stageId: string
  attempt: number
  result: string
  rounds: number | null
  fightingSteps: number
  kills: number
  playerHpLost: number
  playerEndHpPct: number | null
  playerRealm: string
  playerStats: { hp: number; might: number; def: number; spd: number }
  enemies: EnemySeen[]
  eliteSeen: number
  bossSeen: number
  note?: string
}

interface FloorSweepRecord {
  stageId: string
  floor: number
  model: 'NAKED' | 'GEARED'
  state: string
  rounds: number | string
  fightingSteps: number
  kills: number
  playerHpLost: number
  playerEndHpPct: number | null
  playerLine: string
  enemySummary: string
  enemies: EnemySeen[]
}

function enemyRoster(gameManager: GameManager): EnemySeen[] {
  const battle = gameManager.getTurnBattle()
  if (!battle) return []
  return battle.enemies.map((e) => ({
    templateId: e.entity.templateId,
    name: e.entity.name,
    isBoss: e.entity.isBoss === true,
    isElite: e.entity.isElite === true,
    maxHp: Math.round(e.entity.baseStats.maxHp),
    might: Math.round(e.entity.baseStats.might * 10) / 10,
    defense: Math.round(e.entity.baseStats.defense * 10) / 10,
    speed: Math.round(e.entity.baseStats.speed * 10) / 10,
    died: !e.entity.alive,
  }))
}

function stageMeta(stage: Stage) {
  return {
    id: stage.id,
    floor: stage.requiredRealmLevel ?? stage.floor ?? 0,
    realm: stage.requiredRealmId ?? 'mortal',
    totalEnemyCount: stage.totalEnemyCount ?? 0,
    eliteChance: stage.enemyPool[0]?.eliteChance ?? 0,
    perfectClearLimit: stage.perfectClearTurnLimit ?? 0,
  }
}

function writeJson(name: string, data: unknown): void {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2))
}

/* ---------------- A. journey ---------------- */

function playerStatsLine(s: EarlyGameSession) {
  const p = s.player
  // StatCalculator on the live player mirrors the battle's own
  // resolution path (baseStats + all modifier lanes).
  const fs2 = calculateStats(p.baseStats, [...p.modifiers, ...p.externalModifiers])
  return { hp: fs2.maxHp, might: fs2.might, def: fs2.defense, spd: fs2.speed }
}

function runStageMeasured(s: EarlyGameSession, stage: Stage, attempt: number): AttemptRecord {
  const p = s.player
  const preStats = playerStatsLine(s)
  const collector = new BattleMetricsCollector(s.gameManager)
  let result: string
  try {
    result = s.runStage(stage.id)
  } finally {
    // finalize reads the terminal battle; dispose must come after.
  }
  const metrics = collector.finalize(s.gameManager)
  const fightingSteps = collector.fightingSteps
  const enemies = enemyRoster(s.gameManager)
  collector.dispose()
  const battle = s.gameManager.getTurnBattle()
  const hpLost = Math.round(metrics.vitalsDamage.byTarget['player'] ?? 0)
  return {
    stageId: stage.id,
    attempt,
    result,
    rounds: battle?.roundsElapsed ?? null,
    fightingSteps,
    kills: s.lastRunStats?.enemiesDefeated ?? 0,
    playerHpLost: hpLost,
    playerEndHpPct:
      metrics.playerEndHpFraction === null
        ? null
        : Math.round(metrics.playerEndHpFraction * 100),
    playerRealm: `${p.realmId}:${p.realmLevel}`,
    playerStats: {
      hp: Math.round(preStats.hp),
      might: Math.round(preStats.might * 10) / 10,
      def: Math.round(preStats.def * 10) / 10,
      spd: Math.round(preStats.spd * 10) / 10,
    },
    enemies,
    eliteSeen: enemies.filter((e) => e.isElite).length,
    bossSeen: enemies.filter((e) => e.isBoss).length,
  }
}

function grindOneLevel(s: EarlyGameSession): boolean {
  const req = getRequiredCultivation(s.player.realmId, s.player.realmLevel)
  const seconds = req / s.player.cultivationPerSecond + 1
  if (!Number.isFinite(seconds) || seconds <= 0) return false
  s.cultivate(seconds)
  return s.breakthroughIfReady()
}

function grindToLevel(s: EarlyGameSession, level: number, cap = 40): boolean {
  let guard = 0
  while (s.player.realmLevel < level && guard++ < cap) {
    if (!grindOneLevel(s)) return false
  }
  return s.player.realmLevel >= level
}

function growth(s: EarlyGameSession, bestStageId: string | null): void {
  if (bestStageId) s.runStage(bestStageId)
  s.equipAll()
  s.investRefinement()
  while (s.player.attributePoints > 0 && s.allocateAttribute('strength')) {
    /* spend until dry - the canonical loop's strength-first policy */
  }
}

function settleAfterVictory(s: EarlyGameSession): void {
  const receipt = s.settleTribulationOutcome()
  const ent = s.player.pendingTalentEntitlement
  if (receipt?.kind === 'victory' && ent) {
    const offered = ent.offeredTalentIds
    s.resolveTalentEntitlement({ kind: 'new', talentId: offered[0]! })
  }
  s.drainTribulationOutcome()
}

describe('enemy journey audit - real playthrough', () => {
  it('plays all 30 floors with metrics per attempt', () => {
    setActivePinia(createPinia())
    const seeds = [7, 13]
    for (const seed of seeds) {
      setActivePinia(createPinia())
      const s = new EarlyGameSession({
        seed,
        profile: { name: 'audit', talentIds: ['hap_linh'] },
        playerOwner: usePlayerStore(),
      })

      const ordered = STAGES.slice().sort(
        (a, b) =>
          (REALM_ORDER[a.requiredRealmId ?? 'mortal'] ?? 0) -
            (REALM_ORDER[b.requiredRealmId ?? 'mortal'] ?? 0) ||
          (a.requiredRealmLevel ?? a.floor ?? 0) -
            (b.requiredRealmLevel ?? b.floor ?? 0),
      )

      const attempts: AttemptRecord[] = []
      const meta = ordered.map(stageMeta)
      const realmTransitions: string[] = []
      const stageSummaries: {
        stageId: string
        attempts: number
        defeats: number
        timeouts: number
        clearedAt: string | null
      }[] = []

      for (const stage of ordered) {
        const needRealm = stage.requiredRealmId ?? 'mortal'
        const needLevel = stage.requiredRealmLevel ?? stage.floor ?? 1

        // Realm transition when the gate requires a higher realm.
        if (
          (REALM_ORDER[s.player.realmId] ?? 0) < (REALM_ORDER[needRealm] ?? 0)
        ) {
          grindToLevel(s, 12)
          // Poke: the tribulation cooldown is 5 wall-clock minutes; the
          // headless journey compresses hours of idle time into seconds,
          // so a second transition in one run would always be refused.
          ;(
            s.gameManager.tribulationDirector as unknown as {
              cooldownUntil: number
            }
          ).cooldownUntil = 0
          let tr = ''
          const qiPath = needRealm === 'qi_refining'
          for (let t = 0; t < 3; t++) {
            tr = s.runTribulation(needRealm)
            if (tr === 'victory' || tr === 'defeat') {
              // Every committed outcome must drain exactly like the
              // outcome modal does, or the director stays 'active'
              // and the next attempt is refused. The qi_victory
              // outcome is NOT settled before the ritual: settle
              // writes realmId and chooseCultivationPath gates on
              // 'mortal'.
              if (!(tr === 'victory' && qiPath)) s.settleTribulationOutcome()
              const ent = s.player.pendingTalentEntitlement
              if (ent) {
                s.resolveTalentEntitlement({
                  kind: 'new',
                  talentId: ent.offeredTalentIds[0]!,
                })
              }
              s.drainTribulationOutcome()
            }
            if (tr === 'victory') break
            growth(s, s.player.completedStageIds.at(-1) ?? null)
            ;(
              s.gameManager.tribulationDirector as unknown as {
                cooldownUntil: number
              }
            ).cooldownUntil = 0
          }
          if (tr === 'victory' && qiPath) {
            // mortal->qi: the ritual is the promotion seam
            // (chooseCultivationPath gates on realmId 'mortal').
            s.performRitual('spell', 'spell_pathway')
            s.purchaseNode('fire_ailment_mastery')
          }
          s.equipAll()
          s.investRefinement()
          const reqRows = getBreakthroughRequirements(s.player)
            .map((row) => `${row.key}=${row.met}`)
            .join(',')
          const dirState = s.gameManager.tribulationDirector.getState()
            ?.state
          realmTransitions.push(
            `${s.player.realmId}@${s.player.realmLevel} trib=${tr} for ${needRealm} req=[${reqRows}] stages=${s.player.completedStageIds.length} dirState=${dirState} committed=${!!s.gameManager.tribulationDirector.getCommittedOutcome()} cooldown=${s.gameManager.tribulationDirector.getCooldownSeconds()}`,
          )
        }

        const summary = {
          stageId: stage.id,
          attempts: 0,
          defeats: 0,
          timeouts: 0,
          clearedAt: null as string | null,
        }
        let cleared = false
        for (let attempt = 1; attempt <= 10 && !cleared; attempt++) {
          // Level gate: floor N needs realmLevel N - grind up first,
          // like a player answering the lock reason.
          if (s.player.realmLevel < needLevel) {
            grindToLevel(s, needLevel)
            while (
              s.player.attributePoints > 0 &&
              s.allocateAttribute('strength')
            ) {
              /* dry */
            }
          }
          const rec = runStageMeasured(s, stage, attempt)
          attempts.push(rec)
          summary.attempts++
          if (rec.result === 'victory') {
            cleared = true
            summary.clearedAt = rec.playerRealm
          } else if (rec.result === 'defeat') {
            summary.defeats++
            growth(s, s.player.completedStageIds.at(-1) ?? null)
            grindOneLevel(s)
          } else if (rec.result === 'timeout') {
            summary.timeouts++
            growth(s, s.player.completedStageIds.at(-1) ?? null)
          } else {
            // locked / refused / missing - try the level gate once more
            grindOneLevel(s)
            growth(s, s.player.completedStageIds.at(-1) ?? null)
          }
        }
        stageSummaries.push(summary)
        if (!cleared) {
          // Stuck floor = stop the journey here, keep the evidence.
          break
        }
        // Periodic growth like a real player between floors.
        const floorNum = stage.requiredRealmLevel ?? stage.floor ?? 1
        if (floorNum === 3 || floorNum === 5 || floorNum === 7 || floorNum === 9) {
          for (let i = 0; i < 5; i++) {
            const best = s.player.completedStageIds.at(-1)
            if (best) s.runStage(best)
          }
          s.equipAll()
          s.investRefinement()
          while (
            s.player.attributePoints > 0 &&
            s.allocateAttribute('strength')
          ) {
            /* dry */
          }
        }
      }

      writeJson(`journey-seed${seed}.json`, {
        seed,
        meta,
        realmTransitions,
        attempts,
        stageSummaries,
        final: s.snapshot(),
        totals: { ...s.simRunTotals },
      })
      console.log(
        `JOURNEY seed=${seed} floors cleared=${stageSummaries.filter((x) => x.clearedAt).length}/30 attempts=${attempts.length} defeats=${attempts.filter((a) => a.result === 'defeat').length}`,
      )
    }
  }, 600_000)
})

/* ---------------- B. floor sweep ---------------- */

function buildPlayer(
  lab: Lab,
  realmId: string,
  floor: number,
  geared: boolean,
  stageList: Stage[],
  stageIndex: number,
): void {
  lab.cheat.setRealm(realmId, floor)
  lab.player.cultivationPath = 'spell'
  lab.player.cultivationWay = 'spell_pathway'
  lab.player.attributePoints =
    (REALM_PRIOR_MIN_LEVELS[realmId] ?? 0) + Math.max(0, floor - 1)
  lab.player.completedStageIds.push(
    ...stageList.slice(0, stageIndex).map((s) => s.id),
  )

  let wantVit = true
  while (lab.player.attributePoints > 0) {
    const primary = wantVit ? 'vitality' : 'strength'
    if (!lab.manager.progressionOps.allocateAttributePoint(lab.player, primary)) {
      if (
        !lab.manager.progressionOps.allocateAttributePoint(
          lab.player,
          wantVit ? 'strength' : 'vitality',
        )
      )
        break
    }
    wantVit = !wantVit
  }

  if (realmId !== 'mortal') {
    lab.manager.progressionOps.learnSkill('hoa_cau_thuat', lab.player)
  }

  if (!geared) return

  for (const templateId of Object.values(SLOT_TEMPLATES)) {
    let bestId: string | null = null
    let bestQuality = -1
    for (let i = 0; i < GEAR_ROLLS_PER_SLOT; i++) {
      const grant = lab.cheat.addEquipment(templateId)
      const qualityIndex = ITEM_QUALITY_ORDER.indexOf(grant.instance.quality)
      if (qualityIndex > bestQuality) {
        bestQuality = qualityIndex
        bestId = grant.instance.instanceId
      }
    }
    if (bestId) {
      lab.manager.equipmentOps.equipItem(bestId, lab.player)
    }
  }
  lab.player.modifiers = lab.manager.equipmentOps.getEquipmentModifiers()
}

describe('enemy floor sweep - fixed builds with metrics', () => {
  it('records rounds/TTK/hp-loss per floor per build', () => {
    const stageList = STAGES.slice().sort(
      (a, b) =>
        (REALM_ORDER[a.requiredRealmId ?? 'mortal'] ?? 0) -
          (REALM_ORDER[b.requiredRealmId ?? 'mortal'] ?? 0) ||
        (a.requiredRealmLevel ?? a.floor ?? 0) -
          (b.requiredRealmLevel ?? b.floor ?? 0),
    )

    const rows: FloorSweepRecord[] = []
    for (const [stageIndex, stage] of stageList.entries()) {
      const realmId = stage.requiredRealmId ?? 'mortal'
      const floor = stage.requiredRealmLevel ?? stage.floor ?? 1
      for (const geared of [false, true]) {
        const lab = createLab()
        lab.useRealData()
        buildPlayer(lab, realmId, floor, geared, stageList, stageIndex)
        const stats = lab.stats()
        const collector = new BattleMetricsCollector(lab.manager)
        let state = 'START-FAILED'
        if (lab.manager.turnBattleOps.startStage(lab.player, stage, false)) {
          lab.combat(COMBAT_CAP_SECONDS)
          state = lab.battle?.state ?? '?'
        }
        const metrics = collector.finalize(lab.manager)
        const fightingSteps = collector.fightingSteps
        const enemies = enemyRoster(lab.manager)
        collector.dispose()
        const me = lab.battle?.players[0]
        const kills = enemies.filter((e) => e.died).length
        const hpLost = Math.round(metrics.vitalsDamage.byTarget['player'] ?? 0)
        const boss = enemies.find((e) => e.isBoss)
        const normal = enemies.find((e) => !e.isBoss && !e.isElite)
        const elite = enemies.find((e) => e.isElite)
        rows.push({
          stageId: stage.id,
          floor,
          model: geared ? 'GEARED' : 'NAKED',
          state,
          rounds: lab.battle?.roundsElapsed ?? '?',
          fightingSteps,
          kills,
          playerHpLost: hpLost,
          playerEndHpPct:
            metrics.playerEndHpFraction === null
              ? me
                ? Math.round((me.entity.currentHp / me.entity.maxHp) * 100)
                : null
              : Math.round(metrics.playerEndHpFraction * 100),
          playerLine: `hp=${stats.maxHp} atk=${stats.might.toFixed(1)} def=${stats.defense.toFixed(1)} spd=${stats.speed.toFixed(1)}`,
          enemySummary:
            `normal:${normal ? `${normal.name} hp${normal.maxHp} atk${normal.might} def${normal.defense} spd${normal.speed}` : 'none'}` +
            ` | elite:${elite ? `hp${elite.maxHp} atk${elite.might} def${elite.defense}` : 'none'}` +
            ` | boss:${boss ? `${boss.name} hp${boss.maxHp} atk${boss.might} def${boss.defense}` : 'none'}`,
          enemies,
        })
      }
    }

    writeJson('floor-sweep.json', {
      meta: stageList.map(stageMeta),
      rows,
    })
    console.log('\n=== ENEMY FLOOR SWEEP ===')
    for (const r of rows) {
      console.log(
        `${r.stageId}\t${r.model}\t${r.state}\trounds=${r.rounds}\tkills=${r.kills}\thpLost=${r.playerHpLost}\tend=${r.playerEndHpPct}%\t| P ${r.playerLine}\t| E ${r.enemySummary}`,
      )
    }
  }, 600_000)
})

/* ------------- C. foundation-entry reality ------------- */

describe('foundation entry - real initiation power vs wolf floors', () => {
  it('runs a real qi:12->foundation initiation then measures floors', () => {
    setActivePinia(createPinia())
    const s = new EarlyGameSession({
      seed: 7,
      profile: { name: 'audit', talentIds: ['hap_linh'] },
      playerOwner: usePlayerStore(),
    })

    // Honest qi:12 gate state like the TrucCo fixture seeds: 20 stage
    // clears, L12, journey-plausible mid-run stats (measured in the
    // journey run: ~hp 255-280 / might 75-95 / def 50-80 at qi:10-14).
    const mortalIds = STAGES.filter(
      (x) => x.requiredRealmId === 'mortal',
    ).map((x) => x.id)
    const qiIds = STAGES.filter(
      (x) => x.requiredRealmId === 'qi_refining',
    ).map((x) => x.id)
    s.player.realmLevel = 12
    s.performRitual('spell', 'spell_pathway')
    s.player.realmLevel = 12
    s.player.completedStageIds = [...mortalIds, ...qiIds]
    s.purchaseNode('fire_ailment_mastery')
    // Attribute growth like the journey's strength-first policy
    // (~24 points earned across mortal:12 + qi:12 in the real runs).
    s.player.attributePoints = 24
    while (s.player.attributePoints > 0 && s.allocateAttribute('strength')) {
      /* dry */
    }

    // A prepared pre-tribulation build: a real player grinds gear and
    // refinement before kiep (the fixture's feedRefinementTo does the
    // same). Real-pipeline rolls, best-of-6 per slot.
    const rollGear = () => {
      for (const id of Object.values(SLOT_TEMPLATES)) {
        for (let i = 0; i < 6; i++) {
          const template = s.gameManager.equipmentRegistry.get(id)
          const instance = s.gameManager.equipmentSystem.createInstance(
            template,
            s.player,
            s.gameManager.affixRegistry,
          )
          s.gameManager.equipmentBag.add(instance)
        }
      }
      s.equipAll()
    }
    rollGear()
    s.holdPill('truc_co_dan', 1)
    s.investRefinement()

    const preInit = s.gameManager.resolveAmbientPlayerStats(s.player)
    const tribAttempts: Record<string, unknown>[] = []
    let tr: TribulationRunResult = 'refused'
    for (let t = 0; t < 6; t++) {
      const st = s.gameManager.resolveAmbientPlayerStats(s.player)
      ;(
        s.gameManager.tribulationDirector as unknown as {
          cooldownUntil: number
        }
      ).cooldownUntil = 0
      tr = s.runTribulation('foundation_establishment')
      tribAttempts.push({
        result: tr,
        maxHp: st.maxHp,
        might: st.might,
        defense: st.defense,
      })
      if (tr === 'victory') break
      s.settleTribulationOutcome()
      s.drainTribulationOutcome()
      // Growth between attempts: a real player respecs tankward for
      // kiep (vitality) and re-rolls gear.
      s.player.attributePoints += 5
      while (s.player.attributePoints > 0 && s.allocateAttribute('vitality')) {
        /* dry */
      }
      rollGear()
      s.investRefinement()
    }
    if (tr === 'victory') {
      settleAfterVictory(s)
      s.equipAll()
      s.investRefinement()
    }
    const postInit = s.gameManager.resolveAmbientPlayerStats(s.player)

    // If the tribulation itself did not clear, still measure the floors
    // at the same prepared-power build by stepping the realm id over
    // (the measurements below are 'prepared qi:12 power', not a real
    // initiation - the tribulation outcome itself is the finding).
    if (s.player.realmId !== 'foundation_establishment') {
      s.player.realmId = 'foundation_establishment'
      s.player.realmLevel = 1
    }

    // Sweep the 10 foundation floors at entry power.
    const foundationStages = STAGES.filter(
      (x) => x.requiredRealmId === 'foundation_establishment',
    ).sort(
      (a, b) => (a.requiredRealmLevel ?? 0) - (b.requiredRealmLevel ?? 0),
    )
    const floorRows: AttemptRecord[] = []
    let prevId: string | null = null
    for (const stage of foundationStages) {
      const gateLevel = stage.requiredRealmLevel ?? stage.floor ?? 1
      s.player.realmLevel = gateLevel
      // Measurement unlock only: floors gate on the prior floor's
      // completion, so credit the previous floor regardless of outcome.
      if (prevId && !s.player.completedStageIds.includes(prevId)) {
        s.player.completedStageIds.push(prevId)
      }
      let cleared = false
      for (let attempt = 1; attempt <= 8; attempt++) {
        const rec = runStageMeasured(s, stage, attempt)
        floorRows.push(rec)
        if (rec.result === 'victory') {
          cleared = true
          break
        }
        // Grind between defeats like a real stuck player: farm the
        // same floor's kills + re-equip + refinement + spend points.
        growth(s, stage.id)
      }
      prevId = stage.id
      // Light per-floor growth like real leveling inside the realm.
      s.player.attributePoints += 3
      while (s.player.attributePoints > 0 && s.allocateAttribute('strength')) {
        /* dry */
      }
      s.equipAll()
      if (!cleared) floorRows.at(-1)!.note = 'never-cleared-in-8'
    }

    writeJson('foundation-entry.json', {
      tribulation: tr,
      tribAttempts,
      preInit: {
        maxHp: preInit.maxHp,
        might: preInit.might,
        defense: preInit.defense,
        speed: preInit.speed,
      },
      postInit: {
        maxHp: postInit.maxHp,
        might: postInit.might,
        defense: postInit.defense,
        speed: postInit.speed,
      },
      realmAfter: `${s.player.realmId}:${s.player.realmLevel}`,
      rows: floorRows,
    })
  }, 600_000)
})
