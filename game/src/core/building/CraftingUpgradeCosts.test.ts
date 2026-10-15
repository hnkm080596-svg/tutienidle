import { describe, expect, it } from 'vitest'
import { buildings } from '@/data/building/buildings'
import { BuildingSystem } from './BuildingSystem'
import { BuildingRegistry } from './BuildingRegistry'
import { BuildingManager } from './BuildingManager'
import { MaterialBag } from '../material/MaterialBag'
import { SPIRIT_STONE_MATERIAL, SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'

describe('live crafting upgrade material costs',()=>{
  it.each(['equipment_hall','pill_room'])('%s requires stones and debits the complete quote atomically',(id)=>{
    const template=buildings.find(building=>building.id===id)!
    const registry=new BuildingRegistry()
    registry.register(template)
    const manager=new BuildingManager()
    manager.add({instanceId:'craft',buildingId:id,level:1,lastCollectedAt:0})
    const bag=new MaterialBag()
    const costs=template.upgradeCost[1]!
    for(const cost of costs.filter(cost=>cost.materialId!==SPIRIT_STONE_MATERIAL_ID)) {
      bag.add({id:cost.materialId,name:cost.materialId,category:cost.materialId.includes('_ore_')?'ore':'wood',sourceType:'building'},cost.amount)
    }
    const system=new BuildingSystem()
    expect(system.quoteUpgrade('craft',registry,manager,bag,'qi_refining')?.canAfford).toBe(false)
    expect(system.upgrade('craft',registry,manager,bag,'qi_refining')).toBe(false)
    expect(manager.get('craft')?.level).toBe(1)
    for(const cost of costs.filter(cost=>cost.materialId!==SPIRIT_STONE_MATERIAL_ID)) expect(bag.getAmount(cost.materialId)).toBe(cost.amount)
    const stones=costs.find(cost=>cost.materialId===SPIRIT_STONE_MATERIAL_ID)!
    expect(stones.amount).toBe(800)
    bag.add(SPIRIT_STONE_MATERIAL,stones.amount)
    expect(system.upgrade('craft',registry,manager,bag,'qi_refining')).toBe(true)
    expect(manager.get('craft')?.level).toBe(2)
    for(const cost of costs) expect(bag.getAmount(cost.materialId)).toBe(0)
  })
  it('pill room includes ore in both previously missing live upgrade quotes',()=>{
    const room=buildings.find(building=>building.id==='pill_room')!
    expect(room.upgradeCost[1]?.find(cost=>cost.materialId==='material_spirit_ore_decade')?.amount).toBe(3)
    expect(room.upgradeCost[2]?.find(cost=>cost.materialId==='material_spirit_ore_decade')?.amount).toBe(5)
    expect(room.upgradeCost[0]?.find(cost=>cost.materialId==='material_spirit_ore_decade')?.amount).toBe(2)
  })
})
