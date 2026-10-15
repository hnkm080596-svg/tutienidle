import { GameManager } from '@/core/game/GameManager'
import { createDefaultPlayer } from '@/core/player/Player'
import { initializeCharacter } from '../character/initializeCharacter'
import { CORE_REALM_LEVEL } from '@/core/realm/realmSystem'
import { CAST_LEVELING_THRESHOLDS } from '@/core/skill/CastLeveling'
import { SKILLS } from '@/data/skill/Skills'
import { TECHNIQUES } from '@/data/technique/Techniques'
import { ALL_PROGRESSION_NODES } from '@/data/progression/ProgressionNodeCatalog'
import { materials } from '@/data/materials/materials'
import { buildings } from '@/data/building/buildings'
import { QUESTS } from '@/data/quest/quests'
import { buildGameSave, type GameSave } from '../save/SaveSystem'
import { isSandboxPresetAvailable, type SandboxPreset } from './sandboxPresetCatalog'

export type { SandboxPreset } from './sandboxPresetCatalog'

// Build in an isolated headless session. The live player and all live
// inventory/quest/production state remain untouched until a durable save.
export function buildSandboxPreset(preset: SandboxPreset): GameSave {
  if (!isSandboxPresetAvailable(preset)) throw new Error('Sandbox preset is outside the release scope')
  const manager = new GameManager()
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerProgressionNodes(ALL_PROGRESSION_NODES)
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerQuests(QUESTS)
  const player = createDefaultPlayer()
  player.hasSeenTutorial = true
  initializeCharacter({ name: 'Sandbox', talentIds: [] }, {
    gameManager: manager, player, nowSeconds: () => manager.time.nowSeconds(),
  })
  if (preset !== 'mortal') {
    player.realmLevel = CORE_REALM_LEVEL
    if (preset === 'spell') {
      const counts = (player.skillCastCounts ??= {})
      counts.linh_bao = CAST_LEVELING_THRESHOLDS.linh_bao?.lv3 ?? 0
      const result = manager.realmAdvanceOps.commitFiveElementInitiation('fire', player)
      if (!result.ok) throw new Error(`Sandbox initiation: ${result.reason}`)
    } else if (!manager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)) {
      throw new Error('Sandbox body initiation refused')
    }
  }
  player.lastSavedAt = manager.time.now()
  return buildGameSave(player, manager)
}
