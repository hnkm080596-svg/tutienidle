import type { EquipmentInstance } from './EquipmentInstance'
import type { EquipmentSlot } from './EquipmentTypes'

export class EquipmentBag {
  private instances: EquipmentInstance[] = []

  add(instance: EquipmentInstance) {
    this.instances.push(instance)
  }

  remove(instanceId: string) {
    this.instances = this.instances.filter(instance => instance.instanceId !== instanceId)
  }

  get(instanceId: string) {
    return this.instances.find(instance => instance.instanceId === instanceId)
  }

  getAll(): EquipmentInstance[] {
    return [...this.instances]
  }

  getEquipped(): EquipmentInstance[] {
    return this.instances.filter(instance => instance.equipped)
  }

  getEquippedInSlot(slot: EquipmentSlot) {
    return this.instances.find(instance => instance.equipped && instance.slot === slot)
  }

  has(instanceId: string): boolean {
    return this.instances.some(instance => instance.instanceId === instanceId)
  }
}
