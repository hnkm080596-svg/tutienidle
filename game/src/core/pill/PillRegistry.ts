import type { Pill } from './Pill'

export class PillRegistry {
  private readonly pills = new Map<string, Pill>()

  register(pill: Pill): void {
    if (this.pills.has(pill.id)) {
      throw new Error(`Pill already registered: ${pill.id}`)
    }

    this.pills.set(pill.id, pill)
  }

  get(pillId: string): Pill {
    const pill = this.pills.get(pillId)

    if (!pill) {
      throw new Error(`Pill not found: ${pillId}`)
    }

    return pill
  }

  has(pillId: string): boolean {
    return this.pills.has(pillId)
  }

  getAll(): Pill[] {
    return Array.from(this.pills.values())
  }
}
