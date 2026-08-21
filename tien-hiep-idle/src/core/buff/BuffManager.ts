import type { Buff } from './Buff'

export class BuffManager {
  private buffs: Buff[] = []

  getAll(): Buff[] {
    return [...this.buffs]
  }

  get(buffId: string) {
    return this.buffs.find(
      buff => buff.id === buffId,
    )
  }

  has(buffId: string): boolean {
    return this.buffs.some(
      buff => buff.id === buffId,
    )
  }

  add(buff: Buff) {
    this.buffs.push(buff)
  }

  remove(buffId: string) {
    this.buffs =
      this.buffs.filter(
        buff => buff.id !== buffId,
      )
  }

  clear() {
    this.buffs = []
  }
}