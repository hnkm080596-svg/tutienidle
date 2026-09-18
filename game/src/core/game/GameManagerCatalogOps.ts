import type { AlchemyRecipe, AlchemySystem } from '../alchemy/AlchemySystem'
import type { Affix } from '../equipment/Affix'
import type { AffixRegistry } from '../equipment/AffixRegistry'
import { assertValidEquipmentMainStats } from '../equipment/EquipmentStatPolicy'
import type { Equipment } from '../equipment/Equipment'
import type { EquipmentRegistry } from '../equipment/EquipmentRegistry'
import type { BuffDefinition } from '../buff2/BuffDefinition'
import type { BuffRegistry } from '../buff2/BuffRegistry'
import type { Building } from '../building/Building'
import type { BuildingRegistry } from '../building/BuildingRegistry'
import type { Enemy } from '../enemy/Enemy'
import type { Formation } from '../formation/Formation'
import type { FormationRegistry } from '../formation/FormationRegistry'
import type { Material } from '../material/Material'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { Pill } from '../pill/Pill'
import type { PillRegistry } from '../pill/PillRegistry'
import type { PlayerData } from '../player/Player'
import type { NodeRegistry } from '../progression/NodeRegistry'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { validateProfessionMaterialEntry } from '../profession/ProfessionValidators'
import type { Quest } from '../quest/Quest'
import type { QuestRegistry } from '../quest/QuestRegistry'
import { getRealmIndex } from '../realm/realmSystem'
import type { Skill } from '../skill/Skill'
import type { Stage } from '../stage/Stage'
import type { Zone } from '../stage/Zone'
import type { ZoneRegistry } from '../stage/ZoneRegistry'
import type { Talisman } from '../talisman/Talisman'
import type { TalismanRegistry } from '../talisman/TalismanRegistry'
import type { Technique } from '../technique/Technique'
import type { TemplateRegistry } from './TemplateRegistry'

/**
 * Static data registration + template/stage/zone catalog lookups.
 * Extracted from GameManager (large-file split, feat/large-file-split):
 * GameManager keeps owning the registries; this Ops owns the register*
 * operation contract (boot-time validation, dedupe, tombstone policy)
 * and the read queries layered on top of the catalogs.
 *
 * Callers go through `gameManager.catalogOps` - there is intentionally
 * no GameManager facade for these methods.
 */
export class GameManagerCatalogOps {
  constructor(
    private readonly deps: {
      materialRegistry: MaterialRegistry
      buffRegistry: BuffRegistry
      buildingRegistry: BuildingRegistry
      questRegistry: QuestRegistry
      alchemyRecipesById: Map<string, AlchemyRecipe>
      alchemySystem: AlchemySystem
      equipmentRegistry: EquipmentRegistry
      affixRegistry: AffixRegistry
      pillRegistry: PillRegistry
      formationRegistry: FormationRegistry
      talismanRegistry: TalismanRegistry
      zoneRegistry: ZoneRegistry
      nodeRegistry: NodeRegistry
      skillTemplates: TemplateRegistry<Skill>
      techniqueTemplates: TemplateRegistry<Technique>
      enemyTemplates: TemplateRegistry<Enemy>
      stageTemplates: TemplateRegistry<Stage>
    },
  ) {}

  registerMaterials(materials: Material[]) {
    // Boot validator (plan §4.1/§10 Phase 1): profession-material authoring
    // errors fail AT registration time instead of silently building a
    // broken economy. Only materials WITH profession metadata are checked
    // (legacy materials untouched); per-entry validation (id convention +
    // realm scope) - whole-catalog completeness (3 rarity per cell) is
    // enforced by ProfessionDataIntegrity.test over the full array.
    for (const material of materials) {
      if (!material.profession) {
        continue
      }

      const error = validateProfessionMaterialEntry(material.id, material.profession)

      if (error) {
        throw new Error(`Profession material invalid: ${error}`)
      }
    }

    for (const material of materials) {
      if (!this.deps.materialRegistry.has(material.id)) {
        this.deps.materialRegistry.register(material)
      }
    }
  }

  registerBuffs(buffs: BuffDefinition[]) {
    // buff2 M4 -- the canonical catalog is the SEALED BUFF_REGISTRY built
    // from the same data array, so registration is structural (a def
    // missing from data cannot exist to be passed). This is now a
    // drift validator preserving the original crash-early contract: any
    // id not in the sealed registry throws at boot, not mid-battle.
    for (const buff of buffs) {
      if (!this.deps.buffRegistry.has(buff.id)) {
        throw new Error(`BuffRegistry: unknown buff definition '${buff.id}'`)
      }
    }
  }

  registerBuildings(items: Building[]) {
    for (const item of items) {
      if (!this.deps.buildingRegistry.has(item.id)) {
        this.deps.buildingRegistry.register(item)
      }
    }
  }

  registerQuests(quests: Quest[]) {
    for (const quest of quests) {
      if (!this.deps.questRegistry.has(quest.id)) {
        this.deps.questRegistry.register(quest)
      }
    }
  }

  /** Registers alchemy recipes (plan §8) - validates unique herb variants. */
  registerAlchemyRecipes(recipes: AlchemyRecipe[]) {
    for (const recipe of recipes) {
      if (this.deps.alchemyRecipesById.has(recipe.id)) {
        throw new Error(`Alchemy recipe already registered: ${recipe.id}`)
      }

      const herbBases = new Set(
        recipe.herbVariants.map((variant) => variant.materialId.split('_')[0]),
      )

      if (
        herbBases.size > 1 &&
        new Set(recipe.herbVariants.map((v) => v.materialId)).size !== recipe.herbVariants.length
      ) {
        throw new Error(`Alchemy recipe ${recipe.id}: herb variants trùng lặp`)
      }

      this.deps.alchemyRecipesById.set(recipe.id, recipe)
    }

    this.deps.alchemySystem.setRecipeLookup((recipeId) => this.deps.alchemyRecipesById.get(recipeId))
  }

  registerEquipment(items: Equipment[]) {
    for (const item of items) {
      assertValidEquipmentMainStats(item)

      if (!this.deps.equipmentRegistry.has(item.id)) {
        this.deps.equipmentRegistry.register(item)
      }
    }
  }

  registerAffixes(items: Affix[]) {
    for (const item of items) {
      if (!this.deps.affixRegistry.has(item.id)) {
        this.deps.affixRegistry.register(item)
      }
    }
  }

  registerPills(pills: Pill[]) {
    for (const pill of pills) {
      if (!this.deps.pillRegistry.has(pill.id)) {
        this.deps.pillRegistry.register(pill)
      }
    }
  }

  registerFormations(formations: Formation[]) {
    // Tombstone-only (plan §10.1.4).
    for (const formation of formations) {
      if (!this.deps.formationRegistry.has(formation.id)) {
        this.deps.formationRegistry.register(formation)
      }
    }
  }

  registerTalismans(talismans: Talisman[]) {
    // Tombstone-only (plan §10.1.4) - registered so old saves can load
    // without crashing on registry lookup; does NOT create new sources.
    for (const talisman of talismans) {
      if (!this.deps.talismanRegistry.has(talisman.id)) {
        this.deps.talismanRegistry.register(talisman)
      }
    }
  }

  registerZones(zones: Zone[]) {
    for (const zone of zones) {
      this.deps.zoneRegistry.register(zone)
    }
  }

  registerProgressionNodes(nodes: ProgressionNode[]) {
    for (const node of nodes) {
      if (!this.deps.nodeRegistry.has(node.id)) {
        this.deps.nodeRegistry.register(node)
      }
    }
  }

  // Skill/Technique do not bulk-register their full template lists into a
  // manager - they are only added when the player actually learns them,
  // matching SkillSystem.learn()/TechniqueSystem.learn(). GameManager only
  // provides the template lookup point.
  registerSkillTemplates(skills: Skill[]) {
    for (const skill of skills) {
      this.deps.skillTemplates.register(skill.id, skill)
    }
  }

  registerTechniqueTemplates(techniques: Technique[]) {
    for (const technique of techniques) {
      this.deps.techniqueTemplates.register(technique.id, technique)
    }
  }

  registerEnemyTemplates(enemies: Enemy[]) {
    for (const enemy of enemies) {
      this.deps.enemyTemplates.register(enemy.id, enemy)
    }
  }

  registerStages(stages: Stage[]) {
    for (const stage of stages) {
      this.deps.stageTemplates.register(stage.id, stage)
    }
  }

  getSkillTemplate(skillId: string): Skill | undefined {
    return this.deps.skillTemplates.get(skillId)
  }

  getTechniqueTemplate(techniqueId: string): Technique | undefined {
    return this.deps.techniqueTemplates.get(techniqueId)
  }

  getEnemyTemplate(enemyId: string): Enemy | undefined {
    return this.deps.enemyTemplates.get(enemyId)
  }

  getStage(stageId: string): Stage | undefined {
    return this.deps.stageTemplates.get(stageId)
  }

  /**
   * Auto-explore (mode 'auto', see stores/ui.ts) - the next Stage within the
   * SAME Zone as `currentStageId`, in declared `Zone.stageIds` order. Returns
   * null at the last stage or when currentStageId belongs to no zone - the
   * caller (App.vue's fightStage()) falls back to repeating the current stage
   * (graceful, no need to know the zone's stage count upfront).
   */
  getNextStageInZone(zoneId: string, currentStageId: string): string | null {
    if (!this.deps.zoneRegistry.has(zoneId)) {
      return null
    }

    const zone = this.deps.zoneRegistry.get(zoneId)

    const index = zone.stageIds.indexOf(currentStageId)

    if (index === -1) {
      return null
    }

    return zone.stageIds[index + 1] ?? null
  }

  isStageUnlocked(stageId: string, player: PlayerData): boolean {
    const stage = this.deps.stageTemplates.get(stageId)

    if (stage?.requiredRealmId) {
      const requiredRealmIndex = getRealmIndex(stage.requiredRealmId)
      const playerRealmIndex = getRealmIndex(player.realmId)

      if (playerRealmIndex < requiredRealmIndex) {
        return false
      }

      if (
        playerRealmIndex === requiredRealmIndex &&
        stage.requiredRealmLevel !== undefined &&
        player.realmLevel < stage.requiredRealmLevel
      ) {
        return false
      }
    }

    const zones = this.deps.zoneRegistry.getAll()
    const zoneIndex = zones.findIndex((candidate) => candidate.stageIds.includes(stageId))
    const zone = zones[zoneIndex]

    if (!zone) {
      // Standalone stage (Tribulation/test/debug) outside the explore chain.
      return true
    }

    const index = zone.stageIds.indexOf(stageId)

    if (index > 0) {
      return player.completedStageIds.includes(zone.stageIds[index - 1]!)
    }

    if (zoneIndex === 0) {
      return true
    }

    const previousZone = zones[zoneIndex - 1]!
    const previousFinalStage = previousZone.stageIds.at(-1)
    return Boolean(previousFinalStage && player.completedStageIds.includes(previousFinalStage))
  }
}
