import type { Talisman } from './Talisman'

export class TalismanRegistry {
  private readonly talismans = new Map<string, Talisman>()

  register(talisman: Talisman): void {
    if (this.talismans.has(talisman.id)) {
      throw new Error(`Talisman already registered: ${talisman.id}`)
    }

    this.talismans.set(talisman.id, talisman)
  }

  get(talismanId: string): Talisman {
    const talisman = this.talismans.get(talismanId)

    if (!talisman) {
      throw new Error(`Talisman not found: ${talismanId}`)
    }

    return talisman
  }

  has(talismanId: string): boolean {
    return this.talismans.has(talismanId)
  }

  getAll(): Talisman[] {
    return Array.from(this.talismans.values())
  }
}
