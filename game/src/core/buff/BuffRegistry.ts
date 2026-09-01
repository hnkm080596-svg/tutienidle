import type { BuffDefinition } from './BuffDefinition'

export class BuffRegistry {
  private readonly buffs = new Map<string, BuffDefinition>()

  register(buff: BuffDefinition): void {
    if (this.buffs.has(buff.id)) {
      throw new Error(`Buff already registered: ${buff.id}`)
    }

    this.buffs.set(buff.id, buff)
  }

  get(buffId: string): BuffDefinition {
    const buff = this.buffs.get(buffId)

    if (!buff) {
      throw new Error(`Buff not found: ${buffId}`)
    }

    return buff
  }

  has(buffId: string): boolean {
    return this.buffs.has(buffId)
  }

  getAll(): BuffDefinition[] {
    return Array.from(this.buffs.values())
  }
}
