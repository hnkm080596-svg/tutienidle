// Event carry vị trí/kết thúc trận — nguồn DUY NHẤT để view (Phaser
// MainScene.ts) biết vị trí player/quái, KHÔNG được cầm tham chiếu
// trực tiếp GameManager/BattleSystem (xem ghi chú kiến trúc trong kế
// hoạch: core ↔ Phaser chỉ giao tiếp qua EventBus).

import type { LaneIndex } from './BattleLane'

export interface BattlePositionsEvent {
  type: 'positions'
  mode?: 'combat' | 'tribulation'

  playerX: number

  playerCurrentHp: number

  playerMaxHp: number

  // Chỉ gồm quái CÒN SỐNG — quái chết tự "biến mất" khỏi payload,
  // MainScene coi đó là tín hiệu ngừng cập nhật vị trí (đóng băng
  // cho tween chết chạy), khỏi cần thêm cờ alive riêng. `lane` chỉ để
  // MainScene tính vị trí Y hiển thị — không ảnh hưởng combat.
  enemies: {
    id: string
    name: string
    x: number
    lane: LaneIndex
    currentHp: number
    maxHp: number
    isBoss: boolean
  }[]
}

export interface BattleEndEvent {
  type: 'battle_end'

  state: 'victory' | 'defeat'
}

export interface BattleRewardParticleEvent {
  sourceId: string
  kind: 'item' | 'insight' | 'currency'
  color: number
}
