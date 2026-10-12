import type { GameManager } from './GameManager'
import type { PlayerData } from '../player/Player'
import type { Building } from '../building/Building'
import type { BuildingInstance } from '../building/BuildingInstance'
import { alchemyRoomSpeedMultiplier } from '../alchemy/AlchemySystem'
import { getRealmTier } from '../realm/RealmTierMap'

export interface ArchitectureEffect {
  key: 'spiritRate' | 'spiritStorage' | 'equipmentDiscount' | 'alchemySpeed' | 'queueSlots'
  value: number
  unit: 'percent' | 'count' | 'multiplier' | 'perMinute'
}
export interface ArchitectureCost {
  id: string
  name: string
  icon?: string
  required: number
  owned: number
}
export interface ArchitectureBuildingModel {
  id: string
  instanceId: string | null
  name: string
  description: string
  level: number
  maxLevel: number
  artOnly: boolean
  maxed: boolean
  canUpgrade: boolean
  reason: 'missingBuilding' | 'maxLevel' | 'realmGate' | 'missingMaterials' | null
  requiredRealmId: string | null
  currentEffects: ArchitectureEffect[]
  nextEffects: ArchitectureEffect[]
  costs: ArchitectureCost[]
}

function costModel(manager: GameManager, id: string, required: number): ArchitectureCost {
  const material = manager.materialRegistry.has(id) ? manager.materialRegistry.get(id) : undefined
  return { id, name: material?.name ?? '', icon: material?.icon, required, owned: manager.materialBag.getAmount(id) }
}

function effects(manager: GameManager, template: Building, instance: BuildingInstance, realmId: string): ArchitectureEffect[] {
  const modifiers = manager.buildingSystem.getCraftModifiers(instance, template)
  if (template.producesMaterialId) {
    return [
      { key: 'spiritRate', value: manager.buildingSystem.getRatePerMinute(instance, template, realmId), unit: 'perMinute' },
      { key: 'spiritStorage', value: manager.buildingSystem.getCapacity(instance, template, realmId), unit: 'count' },
    ]
  }
  if (template.functionType === 'equipment_hall') {
    return [{ key: 'equipmentDiscount', value: modifiers.equipmentCostDiscountPercent, unit: 'percent' }]
  }
  if (template.functionType === 'pill_room') {
    return [
      { key: 'alchemySpeed', value: alchemyRoomSpeedMultiplier(instance.level), unit: 'multiplier' },
      { key: 'queueSlots', value: modifiers.alchemyQueueSlots, unit: 'count' },
    ]
  }
  return []
}

// Observational projection of owner rules. Level previews use detached instances.
export function getArchitectureBuildingModels(manager: GameManager, player: PlayerData): ArchitectureBuildingModel[] {
  return manager.buildingRegistry.getAll().map(template => {
    const instance = manager.buildingManager.getByBuildingId(template.id)
    const artOnly = template.functionType === undefined
    const quote = instance ? manager.buildingSystem.quoteUpgrade(instance.instanceId, manager.buildingRegistry,
      manager.buildingManager, manager.materialBag, player.realmId) : null
    const maxed = artOnly || !quote?.hasNextLevel
    const reason = !instance ? 'missingBuilding' : maxed ? 'maxLevel'
      : !quote?.meetsRealmRequirement ? 'realmGate' : !quote.canAfford ? 'missingMaterials' : null
    return {
      id: template.id, instanceId: instance?.instanceId ?? null, name: template.name,
      description: template.description ?? '', level: Math.min(instance?.level ?? 1, template.maxLevel), maxLevel: template.maxLevel,
      artOnly, maxed, canUpgrade: reason === null, reason,
      requiredRealmId: quote?.requiredRealmId ?? null,
      currentEffects: instance ? effects(manager, template, instance, player.realmId) : [],
      nextEffects: instance && !maxed ? effects(manager, template, { ...instance, level: instance.level + 1 }, player.realmId) : [],
      costs: !maxed ? (quote?.nextUpgradeCost ?? []).map(cost => costModel(manager, cost.materialId, cost.amount)) : [],
    }
  })
}

export function getArchitectureProductionModels(manager: GameManager, player: PlayerData) {
  return manager.buildingOps.getProductionViews().map(view => {
    const quote = manager.productionSystem.quoteSiteUpgrade(view.definition.siteId, manager.materialBag, getRealmTier(player.realmId))
    return {
      id: view.definition.siteId, name: view.definition.name, description: view.definition.description,
      level: view.state.level, maxLevel: view.definition.maxLevel, kind: view.definition.kind,
      currentSpeed: view.productionSpeedMultiplier, nextSpeed: view.nextProductionSpeedMultiplier ?? null,
      canUpgrade: quote.upgradable, reasons: quote.reasons,
      costs: quote.cost ? [costModel(manager, quote.cost.woodMaterialId, quote.cost.woodAmount),
        costModel(manager, quote.cost.spiritStoneId, quote.cost.spiritStone)] : [],
    }
  })
}

// Resource counts are grouped by category; individual upgrade quotes retain exact grades/ages.
export function getArchitectureResourceModels(manager: GameManager) {
  const categories = ['spirit_stone', 'wood', 'ore', 'herb'] as const
  return categories.map(category => {
    const stacks = manager.materialBag.getAll().filter(stack => stack.material.category === category)
    return { category, amount: stacks.reduce((sum, stack) => sum + stack.amount, 0), icon: stacks[0]?.material.icon }
  })
}
