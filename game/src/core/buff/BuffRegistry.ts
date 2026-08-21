import type { Buff } from './Buff'

export class BuffRegistry {
  private readonly buffs = new Map<string, Buff>()

  register(buff: Buff): void {
    if (this.buffs.has(buff.id)) {
      throw new Error(`Buff already registered: ${buff.id}`)
    }

    this.buffs.set(buff.id, buff)
  }

  get(buffId: string): Buff {
    const buff = this.buffs.get(buffId)

    if (!buff) {
      throw new Error(`Buff not found: ${buffId}`)
    }

    return buff
  }

  has(buffId: string): boolean {
    return this.buffs.has(buffId)
  }

  getAll(): Buff[] {
    return Array.from(this.buffs.values())
  }
}
