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

      // id rieng cho tung instance - template.id (vd 'wild_wolf') dung
      // chung cho MOI lan spawn cung loai, neu giu nguyen thi nhieu
      // quai cung loai song dong thoi (wave) se trung id, khien
      // EnemyManager.get()/.find() luon tra ve SAI instance.
      id: `${template.id}_${crypto.randomUUID()}`,

      // Mission E Task 1 (audit T3-16): stamp the template id so kill
      // consumers match on template identity, not the instance id.
      templateId: template.id,

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