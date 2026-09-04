// TurnBuffPool — song song với BuffPool.ts (real-time) nhưng cho buff
// ĐO BẰNG LƯỢT. Port verbatim logic, đổi remainingTime → remainingTurns
// (spec 2026-09-04-turn-buff-system §3). KHÔNG import từ file sống.
import type { TurnBuff } from './TurnBuffTypes'

export class TurnBuffPool {
  private buffs: TurnBuff[] = []

  getAllById(id: string): TurnBuff[] {
    return this.buffs.filter((buff) => buff.id === id)
  }

  getFromSource(id: string, sourceId: string): TurnBuff | undefined {
    return this.buffs.find((buff) => buff.id === id && buff.sourceId === sourceId)
  }

  getAll(): TurnBuff[] {
    return [...this.buffs]
  }

  hasAny(id: string): boolean {
    return this.buffs.some((buff) => buff.id === id)
  }

  add(buff: TurnBuff): void {
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
