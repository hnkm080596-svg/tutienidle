// Mainline (chinh tuyen) chain admission - GameManager-level wiring.
// Drives the REAL manager (no betaScope mock): the chain is beta
// content, so real isBetaQuestEnabled gating applies. Covers the three
// admission surfaces: creation (initializeCharacter -> reconcile),
// same-gesture claim (claimQuest -> reconcile), realm transition tick.
import { describe, expect, it, vi } from 'vitest'

import { GameManager } from './GameManager'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { initializeCharacter } from '../../services/character/initializeCharacter'
import { QUEST_FLAG_ALCHEMY_CRAFTED } from '../quest/Quest'
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

function complete(manager: GameManager, questId: string) {
  // Same durable witness claimQuest writes - exercised directly so the
  // chain walk under test does not depend on combat/collect drivers.
  manager.questManager.markCompletedOnce(questId)
}

describe('GameManager mainline chain admission', () => {
  it('a fresh character emerges from creation with main_01 active and nothing ahead of it', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    initializeCharacter(
      { name: 'Vo Danh', talentIds: [] },
      { gameManager: manager, player, nowSeconds: () => 0 },
    )

    const ids = manager.questManager.getActive().map((a) => a.questId)

    expect(ids).toContain(HEAD)
    expect(ids).not.toContain('main_02_lam_chi_san')
    // Realm-gated members stay dark for a mortal, chain gate or not.
    expect(ids).not.toContain('main_07_ngu_hanh_nhap_mon')
    expect(ids).not.toContain('main_14_do_kiep_truc_co')
    // Exactly one mainline member admitted - the chain head.
    const mainlineIds = QUESTS.filter((q) => q.chainId === 'mainline').map((q) => q.id)
    expect(ids.filter((id) => mainlineIds.includes(id))).toEqual([HEAD])
  })

  it('claiming a chain member activates its successor in the same gesture', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    manager.tickOps.reconcileQuestLifecycle()

    // Drive main_01 through the real kill event.
    for (let i = 0; i < 3; i++) {
      manager.questSystem.onEnemyDefeated(
        manager.questRegistry,
        manager.questManager,
        'mortal_wild_boar',
        undefined,
      )
    }

    expect(manager.questOps.claimQuest(HEAD)).toBe(true)
    expect(manager.questManager.isCompletedOnce(HEAD)).toBe(true)
    // Successor admitted by the post-claim reconcile - no tick needed.
    expect(manager.questManager.getProgress('main_02_lam_chi_san')).toBeDefined()
    // And the member after that is still gated.
    expect(manager.questManager.getProgress('main_03_ho_khieu_lam_trung')).toBeUndefined()
  })

  it('realm-gated members stay locked until the realm transition tick lands', () => {
    const manager = makeWiredManager()
    const player: PlayerData = createDefaultPlayer()
    manager.setActivePlayer(player)

    // Complete the mortal act through the durable witness.
    for (const id of [
      'main_01_da_san_dau_tien',
      'main_02_lam_chi_san',
      'main_03_ho_khieu_lam_trung',
      'main_04_quang_chi_nguyen',
      'main_05_thuy_lang_dam',
      'main_06_vuong_gia_da_de',
    ]) {
      complete(manager, id)
    }
    manager.tickOps.reconcileQuestLifecycle()

    // Chain satisfied but realm is still mortal: main_07 stays locked.
    expect(manager.questManager.getProgress('main_07_ngu_hanh_nhap_mon')).toBeUndefined()

    player.realmId = 'qi_refining'
    manager.tickOps.markQuestRealmTransition()
    manager.tickOps.update(1)

    expect(manager.questManager.getProgress('main_07_ngu_hanh_nhap_mon')).toBeDefined()
  })

  it('the craft-pill beat counts an alchemy.crafted flag landing through the tick drain', () => {
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
      complete(manager, id)
    }
    manager.tickOps.reconcileQuestLifecycle()

    const quest = 'main_10_dan_lo_so_khai'
    expect(manager.questManager.getProgress(quest)).toBeDefined()

    // Wire-level check: a successful settle event drained by the tick
    // emits the witness flag and lands progress on the active quest.
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

    expect(manager.questManager.getProgress(quest)!.progress).toBe(1)
    expect(manager.questManager.hasQuestFlag(QUEST_FLAG_ALCHEMY_CRAFTED)).toBe(true)

    expect(manager.questOps.claimQuest(quest)).toBe(true)
    // The witness survives the claim - the flag records a witnessed fact,
    // not quest progress, so later flag quests never recount a past craft.
    expect(manager.questManager.hasQuestFlag(QUEST_FLAG_ALCHEMY_CRAFTED)).toBe(true)
  })

  it('dedup holds: reconcile never double-activates and claim never double-grants', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    manager.tickOps.reconcileQuestLifecycle()
    manager.tickOps.reconcileQuestLifecycle()

    const actives = manager.questManager.getActive().map((a) => a.questId)
    expect(new Set(actives).size).toBe(actives.length)
    expect(actives).toContain(HEAD)

    for (let i = 0; i < 3; i++) {
      manager.questSystem.onEnemyDefeated(
        manager.questRegistry,
        manager.questManager,
        'mortal_wild_boar',
        undefined,
      )
    }
    expect(manager.questOps.claimQuest(HEAD)).toBe(true)
    // Second claim is rejected; successor stays active exactly once.
    expect(manager.questOps.claimQuest(HEAD)).toBe(false)
    const after = manager.questManager.getActive().map((a) => a.questId)
    expect(new Set(after).size).toBe(after.length)
    expect(after.filter((id) => id === 'main_02_lam_chi_san')).toHaveLength(1)
  })
})
