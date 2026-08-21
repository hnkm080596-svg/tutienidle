import type { Ailment } from './Ailment'
import type { AilmentId } from './AilmentTypes'

// 1:1 pattern với BuffManager.ts — pool phẳng theo 1 entity (Battle.
// playerAilments / BattleEnemy.ailments), không dùng chung giữa nhiều
// entity.
export class AilmentManager {
  private ailments: Ailment[] = []

  getAll(): Ailment[] {
    return [...this.ailments]
  }

  get(ailmentId: AilmentId) {
    return this.ailments.find(
      ailment => ailment.id === ailmentId,
    )
  }

  has(ailmentId: AilmentId): boolean {
    return this.ailments.some(
      ailment => ailment.id === ailmentId,
    )
  }

  add(ailment: Ailment) {
    this.ailments.push(ailment)
  }

  remove(ailmentId: AilmentId) {
    this.ailments =
      this.ailments.filter(
        ailment => ailment.id !== ailmentId,
      )
  }

  clear() {
    this.ailments = []
  }
}
