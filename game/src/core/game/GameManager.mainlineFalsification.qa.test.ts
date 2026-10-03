// Adopted reviewer probe (QA-2026-10-03 mainline scoped QA,
// falsification section) - adversarial checks on the chain's lifecycle
// contracts for carried, re-run, and fabricated states.
//
// Falsification C5 verdict: NO production path re-runs
// initializeCharacter over a live profile - bootGame's onNewCharacter
// fires once per boot on an empty quest slice and the create_character
// RPC rejects CHARACTER_EXISTS, so "double-admit main_01" has no real
// producer (ensureActive dedupes regardless) and no reset is wanted.
// The durable guards are dedupe at the reconcile seam plus id-slice
// normalization at restore() - the only dirty-data entry point. These
// tests pin the resulting invariants.
// Written to PASS against the fixed behavior.
import { describe, expect, it, vi } from 'vitest'

import { GameManager } from './GameManager'
import { withMortalCreationPick } from '../../services/save/GameSave.fixture'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { initializeCharacter } from '../../services/character/initializeCharacter'
import type { GameSave } from '../../services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import { materials } from '../../data/materials/materials'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { ENEMIES } from '../../data/enemy/Enemies'
import { STAGES } from '../../data/stage/Stages'
import { zones } from '../../data/stage/Zones'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { pills } from '../../data/pill/pills'
import { talismans } from '../../data/talisman/talismans'
import { buffs } from '../../data/buff/buffs'
import { buildings } from '../../data/building/buildings'
import { QUESTS } from '../../data/quest/quests'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { QuestManager } from '../quest/QuestManager'

const WOLF_QUEST = 'kill_wild_wolf_10'
const HEAD = 'main_01_da_san_dau_tien'

function makeWiredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerEnemyTemplates(ENEMIES)
  manager.catalogOps.registerStages(STAGES)
  manager.catalogOps.registerZones(zones)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerTalismans(talismans)
  manager.catalogOps.registerBuffs(buffs)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  manager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  manager.catalogOps.registerQuests(QUESTS)
  return manager
}

function buildSave(player: PlayerData, quests: GameSave['quests']): GameSave {
  return withMortalCreationPick({
    version: CURRENT_SAVE_VERSION,
    player: { ...player, lastSavedAt: Date.now() },
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    quests,
    productionSites: [],
  })
}

describe('mainline falsification (adopted probes)', () => {
  it('C5 - repeated lifecycle reconcile over a carried state never duplicates actives and never resurrects completed-once', () => {
    const manager = makeWiredManager()
    manager.setActivePlayer(createDefaultPlayer())

    const save = buildSave(createDefaultPlayer(), {
      active: [{ questId: 'collect_tu_linh_thao_1', progress: 3, claimed: false }],
      completedOnceIds: [HEAD],
      lastDailyResetAtMs: Date.now(),
    })
    manager.saveOps.restoreFromSave(save)

    // The same seam every writer uses: restore, tick flag, explicit.
    manager.tickOps.update(1)
    manager.tickOps.reconcileQuestLifecycle()
    manager.tickOps.reconcileQuestLifecycle()

    const ids = manager.questManager.getActive().map((entry) => entry.questId)
    expect(new Set(ids).size).toBe(ids.length)
    // Completed-once head never re-activates; the fold-in stays in-flight.
    expect(ids).not.toContain(HEAD)
    expect(manager.questManager.getProgress('collect_tu_linh_thao_1')!.progress).toBe(3)
  })

  it('kill_wild_wolf_10 is not admitted at mortal creation but a carried mortal row stays finishable at Luyen Khi (F2)', () => {
    // Admission gate: a fresh mortal character no longer gets the dead
    // 0/10 row - wild_wolf only spawns in the qi_refining Quat stages.
    const fresh = makeWiredManager()
    const freshPlayer = createDefaultPlayer()
    initializeCharacter(
      { name: 'Vo Danh', talentIds: [] },
      { gameManager: fresh, player: freshPlayer, nowSeconds: () => 0 },
    )
    const freshIds = fresh.questManager.getActive().map((entry) => entry.questId)
    expect(freshIds).toContain(HEAD)
    expect(freshIds).not.toContain(WOLF_QUEST)

    // Retention: a pre-fix mortal save that already carries the row
    // keeps it - progression gates never evict in-flight work.
    const carried = makeWiredManager()
    const carriedPlayer = createDefaultPlayer()
    carried.setActivePlayer(carriedPlayer)
    const save = buildSave(carriedPlayer, {
      active: [{ questId: WOLF_QUEST, progress: 0, claimed: false }],
      completedOnceIds: [],
      lastDailyResetAtMs: Date.now(),
    })
    carried.saveOps.restoreFromSave(save)

    expect(carried.questManager.getProgress(WOLF_QUEST)).toBeDefined()
    expect(carried.questManager.getProgress(WOLF_QUEST)!.claimed).toBe(false)

    // ...and once the player reaches qi_refining the same row finishes
    // through the normal kill funnel - no re-arm, no lost seat.
    carriedPlayer.realmId = 'qi_refining'
    carried.tickOps.reconcileQuestLifecycle()
    carried.questSystem.onEnemyDefeated(
      carried.questRegistry,
      carried.questManager,
      'wild_wolf',
      undefined,
    )
    expect(carried.questManager.getProgress(WOLF_QUEST)!.progress).toBe(1)
  })

  it('main_10 claim lands the authored tu_linh_dan_qi_refining pill through the real claim seam (F3)', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)

    for (const id of [
      'main_01_da_san_dau_tien',
      'main_02_lam_chi_san',
      'main_03_ho_khieu_lam_trung',
      'main_04_quang_chi_nguyen',
      'main_05_thuy_lang_dam',
      'main_06_vuong_gia_da_de',
      'main_07_ngu_hanh_nhap_mon',
      'main_08_viem_ho_coc',
      'collect_tu_linh_thao_1',
    ]) {
      manager.questManager.markCompletedOnce(id)
    }
    manager.tickOps.reconcileQuestLifecycle()
    expect(manager.questManager.getProgress('main_10_dan_lo_so_khai')).toBeDefined()

    vi.spyOn(manager.alchemySystem, 'drainSettlementEvents').mockReturnValue([
      {
        jobId: 'job-1',
        pillId: 'tu_linh_dan_qi_refining',
        pills: 1,
        success: true,
        delivered: 1,
        overflow: 0,
      },
    ])
    manager.tickOps.update(1)

    expect(manager.questOps.claimQuest('main_10_dan_lo_so_khai')).toBe(true)
    expect(manager.pillBag.getAmount('tu_linh_dan_qi_refining')).toBe(1)
  })

  it('chain admission reads the immediate predecessor witness only (adjudicated: no transitive check)', () => {
    // A non-contiguous completedOnceIds is what veteran-skip relies on:
    // each member admits on ITS predecessor, not on chain contiguity.
    const manager = makeWiredManager()
    manager.setActivePlayer(createDefaultPlayer())
    const save = buildSave(createDefaultPlayer(), {
      active: [],
      completedOnceIds: [HEAD, 'main_03_ho_khieu_lam_trung'],
      lastDailyResetAtMs: Date.now(),
    })
    manager.saveOps.restoreFromSave(save)

    expect(manager.questManager.getProgress('main_02_lam_chi_san')).toBeDefined()
    expect(manager.questManager.getProgress('main_04_quang_chi_nguyen')).toBeDefined()
    // The witnessed member never re-activates; the member after the gap
    // stays gated on its own incomplete predecessor.
    expect(manager.questManager.getProgress('main_03_ho_khieu_lam_trung')).toBeUndefined()
    expect(manager.questManager.getProgress('main_05_thuy_lang_dam')).toBeUndefined()
  })

  it('restore normalizes duplicated id slices - a bypassed payload cannot self-replicate', () => {
    // saveShapeValidation rejects duplicated ids outright; restore() is
    // the defense-in-depth layer for payloads that bypassed the
    // validator, and normalizes to the writer's deduped contract.
    const manager = new QuestManager()
    manager.restore({
      active: [],
      completedOnceIds: ['a_done', 'a_done', 'b_done'],
      lastDailyResetAtMs: 0,
      questFlags: ['flag.x', 'flag.x'],
    })

    expect(manager.getState().completedOnceIds).toEqual(['a_done', 'b_done'])
    expect(manager.getState().questFlags).toEqual(['flag.x'])
    expect(manager.isCompletedOnce('a_done')).toBe(true)
  })
})
