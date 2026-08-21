import type { Buff } from '../buff/Buff'
import type { EnemyArchetype } from './EnemyArchetype'

/**
 * Độ Kiếp (mục 11/12 spec `breakthrough`) — primitive multi-phase NHẸ
 * cho quái Kiếp: khi HP tụt xuống dưới `hpThresholdPercent` (0-1), áp
 * `buff` MỘT LẦN lên chính quái đó qua BuffSystem (buff KHÔNG có
 * `duration` = tồn tại vĩnh viễn suốt trận, xem BuffSystem.update()) —
 * tái dùng nguyên cơ chế Buff/BuffManager hiện có, không cần thêm
 * state-machine phase riêng. Nhiều phase check theo thứ tự khai báo
 * (mảng phải sắp XUỐNG DẦN theo hpThresholdPercent), xem
 * BattleSystem.updateTribulationPhases().
 *
 * Combat Rework Phase 4 (Boss Mechanics) — GENERIC HOÁ: primitive này
 * giờ dùng chung cho CẢ quái Kiếp lẫn Boss thường (Stage.bossEnemyId)
 * — bất kỳ Enemy nào khai `tribulationPhases` đều được. Không tạo
 * BossPhaseSystem riêng, chỉ mở rộng thêm 2 field optional bên dưới.
 */
export interface TribulationPhase {
  hpThresholdPercent: number

  buff: Buff

  message?: string

  // Boss Mechanics — đổi hẳn archetype hành vi (melee/ranged/caster)
  // của quái khi vào phase này, áp TRỰC TIẾP lên entity (không qua
  // Buff/StatModifier vì archetype không phải stat) — xem
  // BattleSystem.updateTribulationPhases().
  archetypeOverride?: EnemyArchetype

  // Boss Mechanics — triệu hồi thêm quái vào TRẬN ĐANG DIỄN RA khi
  // vào phase này. BattleSystem không biết cách tra Enemy template
  // theo id (đó là việc của GameManager) nên chỉ ĐẨY id vào
  // Battle.pendingSummons, GameManager tự rút ra và spawn thật (cùng
  // pattern drainNotifications()) — xem GameManager.updateBossSummons().
  summonEnemyIds?: string[]
}

/**
 * Boss Mechanics — DPS check: trận kéo dài quá `afterSeconds` (tính
 * từ Battle.start(), xem BattleSystem.updateEnrage()) thì áp `buff`
 * MỘT LẦN lên chính boss (cùng cơ chế permanent buff như
 * TribulationPhase, tái dùng BuffSystem). `buff` thường là +damage%
 * mạnh — không giới hạn field nào bắt buộc, data tự quyết theo boss.
 */
export interface BossEnrage {
  afterSeconds: number

  buff: Buff
}
