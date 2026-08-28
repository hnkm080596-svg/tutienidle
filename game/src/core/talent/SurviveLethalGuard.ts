import { getSurviveLethalUsesPerBattle } from './TalentEffects'

/**
 * Thiên phú Bất Tử Thể (talent-direction-choice-plan §6) — counter lượt
 * sống sót qua đòn chí mạng, battle-scoped:
 * - beginBattle() reset lượt từ thiên phú của player mỗi trận MỚI.
 * - beginTribulation() reset về 0 — trận Độ Kiếp là nghi lễ thật, KHÔNG
 *   được phép kích hoạt (quyết định khi implement, khoá bằng test).
 *
 * Tiêu thụ tại CombatSystem.killIfDead() — điểm DUY NHẤT tuyên bố chết
 * (HP <= 0 → alive = false) của mọi đường damage.
 */
export class SurviveLethalGuard {
  private remainingUses = 0

  beginBattle(selectedTalentIds: readonly string[] | undefined): void {
    this.remainingUses = getSurviveLethalUsesPerBattle(selectedTalentIds)
  }

  beginTribulation(): void {
    this.remainingUses = 0
  }

  getRemainingUses(): number {
    return this.remainingUses
  }

  /** Trừ 1 lượt nếu còn — true nếu đòn chí mạng lần này được sống sót. */
  tryConsumeUse(): boolean {
    if (this.remainingUses <= 0) {
      return false
    }

    this.remainingUses -= 1

    return true
  }
}
