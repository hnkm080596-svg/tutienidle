/**
 * B2 balance sweep (2026-09-14) — real-engine feasibility check for all
 * 30 chapter floors. For each stage, builds a player the unlock gate
 * allows and runs the real TurnBattleSystem. Prints a per-floor table:
 * outcome, rounds, player HP remaining, player/enemy stat lines.
 * Analysis artifact, not a CI assertion — numbers feed
 * docs/qa/2026-09-14-beta-b2-balance.md.
 *
 * Two player models per floor:
 *  - NAKED: min-path attribute points (12+12 prior realms, floor-1 in
 *    realm), 50/50 vit/str, starter skill only. The floor of what a
 *    gate-legal player can be.
 *  - GEARED: same + full 6-slot equipment, each slot = best quality of
 *    20 real rolls (a player who farmed the floor a handful of times),
 *    unenhanced. The intended-power sanity bar.
 */
import { describe, it } from 'vitest'
import { createLab, type Lab } from './harness'
import { STAGES } from '@/data/stage/Stages'
import { ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'
import type { Stage } from '@/core/stage/Stage'

const REALM_PRIOR_MIN_LEVELS: Record<string, number> = {
  mortal: 0,
  qi_refining: 12,
  foundation_establishment: 24,
}

const REALM_ORDER: Record<string, number> = { mortal: 0, qi_refining: 1, foundation_establishment: 2 }

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

interface SimResult {
  state: string
  rounds: number | string
  hpPct: number
  playerLine: string
  enemyLine: string
}

function runFloor(lab: Lab, stage: Stage): SimResult {
  const stats = lab.stats()
  // ARCH-002 (M7): startStage resolves stats internally from the player —
  // the lab.stats() snapshot is report-only, not a call argument.
  const started = lab.manager.turnBattleOps.startStage(lab.player, stage, false)
  if (!started) {
    return { state: 'START-FAILED', rounds: '?', hpPct: 0, playerLine: '', enemyLine: '' }
  }

  lab.combat(COMBAT_CAP_SECONDS)
  const battle = lab.manager.getTurnBattle()
  const me = battle?.players[0]
  const foe = battle?.enemies[0]
  return {
    state: battle?.state ?? '?',
    rounds: battle?.roundsElapsed ?? '?',
    hpPct: me ? Math.round((me.entity.currentHp / me.entity.maxHp) * 100) : 0,
    playerLine: `hp=${stats.maxHp} atk=${stats.might.toFixed(1)} def=${stats.defense.toFixed(1)} spd=${stats.speed.toFixed(1)}`,
    enemyLine: `hp=${foe?.entity.maxHp ?? '?'} atk=${foe?.entity.stats.might ?? '?'} def=${foe?.entity.stats.defense ?? '?'} spd=${foe?.entity.stats.speed ?? '?'}`,
  }
}

function buildPlayer(lab: Lab, realmId: string, floor: number, geared: boolean, stageList: Stage[], stageIndex: number): void {
  lab.cheat.setRealm(realmId, floor)
  lab.player.cultivationPath = 'phap_tu'
  lab.player.cultivationWay = 'ngu_hanh'
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
    lab.manager.progressionOps.learnSkill('hoa_cau_thuat')
    lab.manager.skillSystem.equipToSlot('hoa_cau_thuat', 0)
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

  // Equipment modifiers are static — the store layer mirrors
  // equipmentOps.getEquipmentModifiers() into player.modifiers after
  // each equip; the lab has no store so we do the same sync here.
  lab.player.modifiers = lab.manager.equipmentOps.getEquipmentModifiers()
}

describe('balance sweep — all chapter floors vs player models', () => {
  it('prints the per-floor feasibility table', () => {
    const stageList: Stage[] = STAGES.slice().sort(
      (a, b) =>
        (REALM_ORDER[a.requiredRealmId ?? 'mortal'] ?? 0) -
          (REALM_ORDER[b.requiredRealmId ?? 'mortal'] ?? 0) || a.floor - b.floor,
    )

    const rows: string[] = []

    for (const stage of stageList) {
      const realmId = stage.requiredRealmId ?? 'mortal'
      const floor = stage.requiredRealmLevel ?? stage.floor ?? 1
      const stageIndex = stageList.indexOf(stage)

      for (const geared of [false, true]) {
        const lab = createLab()
        lab.useRealData()
        buildPlayer(lab, realmId, floor, geared, stageList, stageIndex)
        const r = runFloor(lab, stage)
        rows.push(
          `${stage.id}\tF${floor}\t${geared ? 'GEARED' : 'NAKED '}\t${r.state}\trounds=${r.rounds}\thp=${r.hpPct}%` +
            `\t| P ${r.playerLine}\t| E ${r.enemyLine}`,
        )
      }
    }

    console.log('\n=== BALANCE SWEEP ===\n' + rows.join('\n'))
  }, 600_000)
})
