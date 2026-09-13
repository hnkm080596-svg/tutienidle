/**
 * Real-catalog registration for lab experiments.
 *
 * MIRRORS the boot block in src/App.vue (catalogOps.register* calls) - if a
 * new data table is added there, add it here too. Kept in a separate module
 * so experiments that don't need real content never pay the import cost.
 *
 * Registering an already-registered catalog throws (e.g. alchemy recipes),
 * so call this once per createLab() instance.
 */
import type { GameManager } from '@/core/game/GameManager'

import { materials } from '@/data/materials/materials'
import { SKILLS } from '@/data/skill/Skills'
import { TECHNIQUES } from '@/data/technique/Techniques'
import { ENEMIES } from '@/data/enemy/Enemies'
import { STAGES } from '@/data/stage/Stages'
import { zones } from '@/data/stage/Zones'
import { equipment } from '@/data/equipment/equipment'
import { affixes } from '@/data/equipment/affixes'
import { pills } from '@/data/pill/pills'
import { talismans } from '@/data/talisman/talismans'
import { buffs } from '@/data/buff/buffs'
import { formations } from '@/data/formation/formations'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import { buildings } from '@/data/building/buildings'
import { PHAP_TU_NODES } from '@/data/progression/PhapTuNodes'
import { KIEM_TU_NODES } from '@/data/progression/KiemTuNodes'
import { QUESTS } from '@/data/quest/quests'

export function registerRealCatalogs(manager: GameManager): void {
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerEnemyTemplates(ENEMIES)
  manager.catalogOps.registerStages(STAGES)
  manager.catalogOps.registerZones(zones)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerBuffs(buffs)
  manager.catalogOps.registerTalismans(talismans)
  manager.catalogOps.registerFormations(formations)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  manager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  manager.catalogOps.registerQuests(QUESTS)
}
