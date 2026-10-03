import type { BuffDefinition } from '../buff2/BuffDefinition'
import type { EnemyArchetype } from './EnemyArchetype'

/**
 * Do Kiep (muc 11/12 spec `breakthrough`) - primitive multi-phase NHE
 * cho quai Kiep: khi HP tut xuong duoi `hpThresholdPercent` (0-1), ap
 * `buff` MOT LAN len chinh quai do qua BuffSystem (buff KHONG co
 * `duration` = ton tai vinh vien suot tran, xem BuffSystem.update()) -
 * tai dung nguyen co che Buff/BuffManager hien co, khong can them
 * state-machine phase rieng. Nhieu phase check theo thu tu khai bao
 * (mang phai sap XUONG DAN theo hpThresholdPercent).
 *
 * buff2 M5 note: the realtime `BattleSystem.updateTribulationPhases` lane
 * retired with the legacy buff package; `buff` is now typed on the
 * canonical buff2 BuffDefinition and the phase/enrage fields remain
 * dormant data pending the turn-side port.
 *
 * Combat Rework Phase 4 (Boss Mechanics) - GENERIC HOA: primitive nay
 * gio dung chung cho CA quai Kiep lan Boss thuong (Stage.bossEnemyId)
 * - bat ky Enemy nao khai `tribulationPhases` deu duoc. Khong tao
 * BossPhaseSystem rieng, chi mo rong them 2 field optional ben duoi.
 */
export interface TribulationPhase {
  hpThresholdPercent: number

  buff: BuffDefinition

  message?: string

  // Boss Mechanics - doi han archetype hanh vi (melee/ranged/caster)
  // cua quai khi vao phase nay, ap TRUC TIEP len entity (khong qua
  // Buff/StatModifier vi archetype khong phai stat) - xem
  // BattleSystem.updateTribulationPhases().
  archetypeOverride?: EnemyArchetype

  // Boss Mechanics - summons extra enemies into the RUNNING battle when
  // this phase is entered. Legacy drain path (Battle.pendingSummons +
  // GameManager.updateBossSummons) retired with the grid BattleSystem -
  // no current consumer; kept as content data for the turn-side port.
  summonEnemyIds?: string[]
}

/**
 * Boss Mechanics - DPS check: tran keo dai qua `afterSeconds` (tinh
 * tu Battle.start(), xem BattleSystem.updateEnrage()) thi ap `buff`
 * MOT LAN len chinh boss (cung co che permanent buff nhu
 * TribulationPhase, tai dung BuffSystem). `buff` thuong la +damage%
 * manh - khong gioi han field nao bat buoc, data tu quyet theo boss.
 */
export interface BossEnrage {
  afterSeconds: number

  buff: BuffDefinition
}
