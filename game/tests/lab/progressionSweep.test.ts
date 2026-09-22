/**
 * B3 progression sweep (2026-09-14) - for each of the 30 chapter floors,
 * finds the minimum realmLevel at which the INTENDED-power player
 * clears, through the real engine. Output feeds the beta gate: if a
 * floor needs gate+N levels, N is the grind the floor demands.
 *
 * Intended build (documented, deterministic where possible):
 *  - realm/realmLevel swept from the stage gate to 18.
 *  - cultivationPath 'spell' for qi_refining+ (Quan Khi at mortal 12
 *    is the breakthrough, so qi/foundation players always have it).
 *  - technique dai_ngu_hanh_chan_quyet learned+equipped (the kit grant),
 *    dai_ngu_hanh_quyet_truc_co at foundation (realm reward upgrade).
 *  - realm passive synced via syncRealmPassive (real breakthrough path).
 *  - talent 'tat_phong' (kill-stacking speed - a reasonable combat pick).
 *  - attribute points: 5 creation + 12/realm prior (min breakthrough
 *    path) + (L-1) this realm, split 50/50 vitality/strength.
 *  - body refinement (mortal): every tier whose requiredRealmLevel <= L
 *    completed via investBodyChapter with enough Tinh Hoa.
 *  - gear: 6 slots, best quality of 30 real rolls/slot at that level.
 *  - enhancement: every equipped slot pushed to +ENHANCE_TARGET via
 *    enhanceSlot with real spirit-stone spend.
 *  - pills: 3 of each permanent-stat pill family via usePill (models a
 *    player who did some farming, not infinite grind).
 *  - skill: hoa_cau_thuat in slot 0 for qi_refining+, upgraded to L10;
 *    all fire/lap_dao/thuan_fire nodes purchasable at the realm bought.
 *  - technique at Vien Man insight (60% of its requirement).
 *  - companions: ho_ly_tinh + khai_son_luc_si + linh_hac pulled/fed to
 *    the realm cap, fielded through a committed ngu_hanh_tran loadout.
 *  - enhancement: +30 per slot (a deep-grind bound, not early-game).
 */
import { describe, it } from 'vitest'
import { createLab, type Lab } from './harness'
import { STAGES } from '@/data/stage/Stages'
import { ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import { PHAP_TU_NODES } from '@/data/progression/PhapTuNodes'

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
const GEAR_ROLLS_PER_SLOT = 30
const ENHANCE_TARGET = 30
const PILL_USES_PER_FAMILY = 3
const STAT_PILL_FAMILIES = ['phi_van_dan', 'to_cot_dan', 'thoi_the_dan', 'khai_linh_dan']

function buildIntended(lab: Lab, realmId: string, level: number, stageList: Stage[], stageIndex: number): void {
  lab.cheat.setRealm(realmId, level)
  lab.player.completedStageIds.push(...stageList.slice(0, stageIndex).map((s) => s.id))

  if (realmId !== 'mortal') {
    lab.player.cultivationPath = 'spell'
    lab.player.cultivationWay = 'spell_pathway'
    lab.manager.realmAdvanceOps.grantCanonicalTechnique('five_elements_art', lab.player)
    // P7-M3 - the Truc Co variant folded into gradeEffects[2]: a
    // foundation player runs grade 2 (rank in the vien_man band to
    // mirror the old "insight 60% -> Vien Man" probe intent).
    const equipped = lab.manager.techniqueManager.getActive()
    if (equipped) {
      equipped.rank = 6
      if (realmId === 'foundation_establishment') {
        equipped.grade = 2
      }
    }
    lab.manager.progressionOps.learnSkill('hoa_cau_thuat', lab.player)
    lab.manager.realmAdvanceOps.syncRealmPassive(lab.player)

    // Skill leveling + node tree - the intended qi/foundation power
    // stack. Buy every fire-branch node (element tree + lap_dao +
    // thuan_fire; never da_phap - it excludes thuan) until the insight
    // budget is exhausted; max the root skill.
    lab.cheat.grantSkillInsight(50_000)
    const wantedTags = new Set(['fire', 'lap_dao', 'thuan_fire'])
    const wantedNodes = PHAP_TU_NODES.filter((node) => wantedTags.has(node.branchTag ?? ''))
    for (let pass = 0; pass < 12; pass++) {
      let bought = false
      for (const node of wantedNodes) {
        if (lab.manager.progressionOps.purchaseNode(node.id, lab.player)) bought = true
        for (let up = 0; up < 10; up++) {
          if (!lab.manager.progressionOps.upgradeNode(node.id, lab.player)) break
          bought = true
        }
      }
      if (!bought) break
    }
    for (let i = 0; i < 10; i++) {
      if (!lab.manager.progressionOps.levelUpSkill('hoa_cau_thuat', lab.player)) break
    }
  }

  lab.player.selectedTalentIds = ['tat_phong']
  lab.manager.progressionOps.syncTalentCombatPassive(lab.player)

  lab.player.attributePoints = 5 + (REALM_PRIOR_MIN_LEVELS[realmId] ?? 0) + Math.max(0, level - 1)
  let wantVit = true
  while (lab.player.attributePoints > 0) {
    const primary = wantVit ? 'vitality' : 'strength'
    const fallback = wantVit ? 'strength' : 'vitality'
    if (!lab.manager.progressionOps.allocateAttributePoint(lab.player, primary)) {
      if (!lab.manager.progressionOps.allocateAttributePoint(lab.player, fallback)) break
    }
    wantVit = !wantVit
  }

  for (const templateId of Object.values(SLOT_TEMPLATES)) {
    let bestId: string | null = null
    let bestQuality = -1
    for (let i = 0; i < GEAR_ROLLS_PER_SLOT; i++) {
      const grant = lab.cheat.addEquipment(templateId)
      const q = ITEM_QUALITY_ORDER.indexOf(grant.instance.quality)
      if (q > bestQuality) {
        bestQuality = q
        bestId = grant.instance.instanceId
      }
    }
    if (bestId) lab.manager.equipmentOps.equipItem(bestId, lab.player)
  }
  lab.player.modifiers = lab.manager.equipmentOps.getEquipmentModifiers()

  // Body refinement - mortal-only tiers gated by requiredRealmLevel.
  // The material bag caps Tinh Hoa at 1000/stack, so feed batches.
  for (let batch = 0; batch < 80; batch++) {
    lab.cheat.addMaterial('tinh_hoa_pham_the', 1_000)
    if (lab.manager.realmAdvanceOps.investBodyChapter(lab.player, 'body_refinement') <= 0) break
  }

  // Enhancement - real spend; enhance can fail so retry until target.
  // Cost is realm ore + spirit stones, resolved per level.
  for (const slot of EQUIPMENT_SLOTS) {
    for (let attempt = 0; attempt < 80; attempt++) {
      if (lab.manager.equipmentOps.getSlotState(slot).enhanceLevel >= ENHANCE_TARGET) break
      const materials = lab.manager.equipmentOps.getEnhanceCost(slot, realmId)
      for (const entry of materials) {
        lab.cheat.addMaterial(entry.materialId, Math.min(entry.amount * 4, 1_000))
      }
      lab.cheat.addSpiritStones(50_000)
      lab.manager.equipmentOps.enhanceSlot(slot, lab.player)
    }
  }
  lab.player.modifiers = lab.manager.equipmentOps.getEquipmentModifiers()

  // Permanent-stat pills - a few of each family.
  const noopTarget = { addCultivation: () => {}, heal: () => {}, applyBuff: () => {} }
  for (const familyId of STAT_PILL_FAMILIES) {
    const pillId = `${familyId}_${realmId}`
    lab.cheat.addPill(pillId, PILL_USES_PER_FAMILY)
    for (let i = 0; i < PILL_USES_PER_FAMILY; i++) {
      lab.manager.pillOps.usePill(pillId, noopTarget, lab.player)
    }
  }

  // Companions - the party lever. Pull with real tokens until we own
  // the three hoang picks, then feed them up to the realm cap and field
  // them through a committed Ngu Hanh Tran loadout (5 cells).
  lab.cheat.addMaterial('chieu_hien_lenh', 200)
  for (let pulls = 0; pulls < 200; pulls++) {
    const owned = new Set(lab.player.companions.map((c) => c.definitionId))
    if (['ho_ly_tinh', 'khai_son_luc_si', 'linh_hac'].every((id) => owned.has(id))) break
    if (!lab.manager.companionOps.pullCompanion().ok) break
  }
  for (const companion of lab.player.companions) {
    for (let batch = 0; batch < 40; batch++) {
      lab.cheat.addMaterial('tinh_hoa_pham_the', 1_000)
      const fed = lab.manager.companionOps.feedCompanion(companion.instanceId, 'tinh_hoa_pham_the', 1_000)
      if (!fed.ok || fed.levelsGained === 0) break
    }
  }
  lab.manager.turnBattleOps.setFormationLoadout(lab.player, {
    formationId: 'ngu_hanh_tran',
    assignments: [
      { combatantId: 'player', row: 1, column: 1 },
      { combatantId: 'ho_ly_tinh', row: 0, column: 0 },
      { combatantId: 'khai_son_luc_si', row: 0, column: 2 },
      { combatantId: 'linh_hac', row: 2, column: 0 },
    ],
  })
}

function attempt(lab: Lab, stage: Stage): { state: string; rounds: number | string; hpPct: number } {
  // ARCH-002 (M7): startStage resolves stats internally from the player.
  if (!lab.manager.turnBattleOps.startStage(lab.player, stage, false)) {
    return { state: 'START-FAILED', rounds: '?', hpPct: 0 }
  }
  lab.combat(COMBAT_CAP_SECONDS)
  const battle = lab.manager.getTurnBattle()
  const me = battle?.players[0]
  return {
    state: battle?.state ?? '?',
    rounds: battle?.roundsElapsed ?? '?',
    hpPct: me ? Math.round((me.entity.currentHp / me.entity.maxHp) * 100) : 0,
  }
}

describe('B3 progression sweep - min clearing realmLevel per floor', () => {
  it('prints the clearability table', () => {
    const stageList: Stage[] = STAGES.slice().sort(
      (a, b) =>
        (REALM_ORDER[a.requiredRealmId ?? 'mortal'] ?? 0) -
          (REALM_ORDER[b.requiredRealmId ?? 'mortal'] ?? 0) || (a.floor ?? 0) - (b.floor ?? 0),
    )

    const rows: string[] = []
    for (const stage of stageList) {
      const realmId = stage.requiredRealmId ?? 'mortal'
      const gate = stage.requiredRealmLevel ?? stage.floor ?? 1
      const stageIndex = stageList.indexOf(stage)

      let clearedAt: number | null = null
      let lastResult = ''
      for (let level = gate; level <= 18; level++) {
        const lab = createLab()
        lab.useRealData()
        buildIntended(lab, realmId, level, stageList, stageIndex)
        const r = attempt(lab, stage)
        lastResult = `L${level} ${r.state} rounds=${r.rounds} hp=${r.hpPct}%`
        if (r.state === 'victory') {
          clearedAt = level
          break
        }
      }
      rows.push(`${stage.id}\tF${gate}\t${clearedAt !== null ? `clears@L${clearedAt} (+${clearedAt - gate})` : `NO-CLEAR (last: ${lastResult})`}`)
    }

    console.log('\n=== PROGRESSION SWEEP (intended build) ===\n' + rows.join('\n'))
  }, 900_000)
})
