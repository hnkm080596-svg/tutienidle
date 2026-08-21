import type { Affix } from './Affix'

export class AffixRegistry {
  private readonly affixes = new Map<string, Affix>()

  register(affix: Affix): void {
    if (this.affixes.has(affix.id)) {
      throw new Error(`Affix already registered: ${affix.id}`)
    }

    this.affixes.set(affix.id, affix)
  }

  get(affixId: string): Affix {
    const affix = this.affixes.get(affixId)

    if (!affix) {
      throw new Error(`Affix not found: ${affixId}`)
    }

    return affix
  }

  has(affixId: string): boolean {
    return this.affixes.has(affixId)
  }

  getAll(): Affix[] {
    return Array.from(this.affixes.values())
  }

  getByKind(kind: Affix['kind']): Affix[] {
    return this.getAll().filter(affix => affix.kind === kind)
  }
}
