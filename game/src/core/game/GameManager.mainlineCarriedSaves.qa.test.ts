// Adopted reviewer probe (QA-2026-10-03 mainline scoped QA) - carried
// pre-fold saves. Before the mainline chain existed, the two fold-ins
// were ungated once-quests, so a real save can hold them ACTIVE with
// partial progress while their new chain predecessor is incomplete.
// The fixed contract pinned here: progression gates (unlocksAfterQuestId
// and requiredRealmId alike) gate NEW ADMISSION only - the reconcile
// inverse pass never evicts an in-flight row; only product-level
// retirement (scope-hidden / suppressed token faucet) still drops rows.
// Written to PASS against the fixed behavior.
import { describe, expect, it } from 'vitest'

import { GameManager } from './GameManager'
import { withMortalCreationPick } from '../../services/save/GameSave.fixture'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import type { GameSave } from '../../services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import { getRealmIndex } from '../realm/realmSystem'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import type { Technique } from '../technique/Technique'
import { QUESTS } from '../../data/quest/quests'
import { PHAP_TU_SKILLS } from '../../data/skill/PhapTuSkills'
import { SPELL_KIT_IDS } from '../../data/skill/Skills'

const HERB_QUEST = 'collect_tu_linh_thao_1'
const ORE_QUEST = 'collect_qi_refining_ore_decade_1'
const HERB_MATERIAL = 'tu_linh_thao_qi_refining_decade'

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerQuests(QUESTS)
  manager.setActivePlayer(createDefaultPlayer())
  return manager
}

// A committed (non-mortal) save must hold exactly the way technique - same
// fixture shape as tc6's committedSave.
function wayTechnique(realmIndex: number): Technique {
  const entry = structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)
  entry.grade = Math.max(1, Math.min(entry.grade, realmIndex))
  entry.gradeHistory = {}
  for (let g = 1; g < entry.grade; g += 1) {
    entry.gradeHistory[g] = { finalRank: 18, completionState: 'vien_man' }
  }
  if (entry.grade < realmIndex) {
    entry.gradeHistory[entry.grade] = { finalRank: 18, completionState: 'vien_man' }
  }
  return entry
}

function buildSave(player: PlayerData, quests: GameSave['quests']): GameSave {
  const mortal = player.realmId === 'mortal'
  return withMortalCreationPick({
    version: CURRENT_SAVE_VERSION,
    player: { ...player, lastSavedAt: Date.now() },
    techniques: mortal ? [] : [wayTechnique(getRealmIndex(player.realmId))],
    skills: mortal
      ? []
      : [
          structuredClone(
            PHAP_TU_SKILLS.find((skill) => skill.id === SPELL_KIT_IDS.fire[0])!,
          ),
        ],
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

function qiRefiningPlayer(): PlayerData {
  // Minimal legal committed beta shape (same contract as tc6's
  // committedPlayer): a non-mortal save must carry the cultivation
  // path + stamped initiation grade and must not keep the mortal
  // starter field - the saveAcceptance boundary check rejects it
  // otherwise.
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  // F-SCOPE-1 (fixpoint W2-3): a committed element-axis pair always
  // carries the beta-scope element and its atomically minted root.
  player.spellPath = { element: 'fire' }
  player.nodeLevels = { hoa_linh_ngo: 1, core_hoa_cau_thuat: 1 }
  player.purchasedNodeIds = ['hoa_linh_ngo', 'core_hoa_cau_thuat']
  player.realmId = 'qi_refining'
  player.breakthroughGrade = 1
  delete player.mortalBasicSkillId
  return player
}

describe('carried pre-fold saves - in-flight fold-ins are never evicted (F1)', () => {
  it('collect_tu_linh_thao_1 active 3/5 with main_08 unclaimed stays active with progress intact', () => {
    const save = buildSave(qiRefiningPlayer(), {
      active: [{ questId: HERB_QUEST, progress: 3, claimed: false }],
      completedOnceIds: [],
      lastDailyResetAtMs: 0,
    })

    const manager = makeManager()
    manager.saveOps.restoreFromSave(save)

    const progress = manager.questManager.getProgress(HERB_QUEST)
    expect(progress).toBeDefined()
    expect(progress!.progress).toBe(3)
    expect(progress!.claimed).toBe(false)
  })

  it('collect_qi_refining_ore_decade_1 active 2/3 with main_10 unclaimed stays active with progress intact', () => {
    const save = buildSave(qiRefiningPlayer(), {
      active: [{ questId: ORE_QUEST, progress: 2, claimed: false }],
      completedOnceIds: [],
      lastDailyResetAtMs: 0,
    })

    const manager = makeManager()
    manager.saveOps.restoreFromSave(save)

    const progress = manager.questManager.getProgress(ORE_QUEST)
    expect(progress).toBeDefined()
    expect(progress!.progress).toBe(2)
    expect(progress!.claimed).toBe(false)
  })

  it('once the chain reaches the fold-in, progress resumes and the turn-in claims normally', () => {
    // The same carried row, now with its predecessor witnessed complete:
    // admission is a no-op on the in-flight row, then the normal
    // collect/claim seam finishes it.
    const save = buildSave(qiRefiningPlayer(), {
      active: [{ questId: HERB_QUEST, progress: 3, claimed: false }],
      completedOnceIds: ['main_08_viem_ho_coc'],
      lastDailyResetAtMs: 0,
    })

    const manager = makeManager()
    manager.saveOps.restoreFromSave(save)
    expect(manager.questManager.getProgress(HERB_QUEST)!.progress).toBe(3)

    // Two more herb landings reach the requirement through the real
    // material funnel.
    manager.questOps.notifyMaterialGained(HERB_MATERIAL, 2)
    expect(manager.questManager.getProgress(HERB_QUEST)!.progress).toBe(5)

    manager.materialBag.add(manager.materialRegistry.get(HERB_MATERIAL), 5)
    expect(manager.questOps.claimQuest(HERB_QUEST)).toBe(true)
    expect(manager.questManager.isCompletedOnce(HERB_QUEST)).toBe(true)

    // The post-claim reconcile resumes the chain at main_10.
    expect(manager.questManager.getProgress('main_10_dan_lo_so_khai')).toBeDefined()
  })

  it('veteran-skip holds: a completed fold-in still admits its successor early', () => {
    // A carried save whose fold-in was already claimed before the chain
    // existed: main_10's admission gate is the fold-in itself, so it
    // admits even though the chain's mid section was never run.
    const save = buildSave(qiRefiningPlayer(), {
      active: [],
      completedOnceIds: [HERB_QUEST],
      lastDailyResetAtMs: 0,
    })

    const manager = makeManager()
    manager.saveOps.restoreFromSave(save)

    expect(manager.questManager.getProgress('main_10_dan_lo_so_khai')).toBeDefined()
    // The skipped mid-chain members stay gated on their own
    // predecessors; the completed fold-in never re-activates.
    expect(manager.questManager.getProgress('main_08_viem_ho_coc')).toBeUndefined()
    expect(manager.questManager.getProgress(HERB_QUEST)).toBeUndefined()
  })
})
