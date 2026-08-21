import type { Enemy } from './Enemy'

import {
  EnemyManager,
} from './EnemyManager'

export class EnemySystem {
  constructor(
    private readonly manager: EnemyManager,
  ) {}

  spawn(template: Enemy): Enemy {
    const enemy: Enemy = {
      ...template,

      // id riêng cho từng instance — template.id (vd 'wild_wolf') dùng
      // chung cho MỌI lần spawn cùng loại, nếu giữ nguyên thì nhiều
      // quái cùng loại sống đồng thời (wave) sẽ trùng id, khiến
      // EnemyManager.get()/.find() luôn trả về SAI instance.
      id: `${template.id}_${crypto.randomUUID()}`,

      currentHp:
        template.maxHp,

      alive: true,
    }

    this.manager.add(enemy)

    return enemy
  }

  despawn(enemyId: string) {
    this.manager.remove(enemyId)
  }

  getAliveEnemies() {
    return this.manager
      .getAll()
      .filter(enemy => enemy.alive)
  }

  get(enemyId: string) {
    return this.manager.get(enemyId)
  }
}