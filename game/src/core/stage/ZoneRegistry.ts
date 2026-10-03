import type { Zone } from './Zone'

export class ZoneRegistry {
  private readonly zones = new Map<string, Zone>()

  register(zone: Zone): void {
    if (this.zones.has(zone.id)) {
      throw new Error(`Zone already registered: ${zone.id}`)
    }

    this.zones.set(zone.id, zone)
  }

  get(zoneId: string): Zone {
    const zone = this.zones.get(zoneId)

    if (!zone) {
      throw new Error(`Zone not found: ${zoneId}`)
    }

    return zone
  }

  has(zoneId: string): boolean {
    return this.zones.has(zoneId)
  }

  getAll(): Zone[] {
    return Array.from(this.zones.values())
  }

  // Reverse lookup Stage -> Zone (2026-08-15, tien to "Dia Gioi" trong
  // ten vat pham ghep dong, xem EquipmentNaming.ts) - undefined neu
  // stageId khong thuoc Zone nao da dang ky.
  getZoneForStage(stageId: string): Zone | undefined {
    return this.getAll().find(zone => zone.stageIds.includes(stageId))
  }
}
