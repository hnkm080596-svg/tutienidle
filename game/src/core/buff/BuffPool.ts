import type { Buff } from './Buff'

export class BuffPool {
  private buffs: Buff[] = []

  getAllById(id: string): Buff[] {
    return this.buffs.filter((buff) => buff.id === id)
  }

  getFromSource(id: string, sourceId: string): Buff | undefined {
    return this.buffs.find((buff) => buff.id === id && buff.sourceId === sourceId)
  }

  getAll(): Buff[] {
    return [...this.buffs]
  }

  hasAny(id: string): boolean {
    return this.buffs.some((buff) => buff.id === id)
  }

  add(buff: Buff): void {
    this.buffs.push(buff)
  }

  removeInstance(id: string, sourceId: string): void {
    this.buffs = this.buffs.filter((buff) => !(buff.id === id && buff.sourceId === sourceId))
  }

  removeAllById(id: string): void {
    this.buffs = this.buffs.filter((buff) => buff.id !== id)
  }

  clear(): void {
    this.buffs = []
  }
}
