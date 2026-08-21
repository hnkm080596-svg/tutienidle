import type { Enemy } from './Enemy'

export class EnemyManager {
  private enemies: Enemy[] = []

  add(enemy: Enemy) {
    this.enemies.push(enemy)
  }

  get(enemyId: string) {
    return this.enemies.find(
      enemy => enemy.id === enemyId,
    )
  }

  getAll() {
    return [...this.enemies]
  }

  remove(enemyId: string) {
    this.enemies =
      this.enemies.filter(
        enemy => enemy.id !== enemyId,
      )
  }

  clear() {
    this.enemies = []
  }
}