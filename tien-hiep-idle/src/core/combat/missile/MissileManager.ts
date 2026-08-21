import type { Missile } from './Missile'

export class MissileManager {
  private missiles: Missile[] = []

  add(missile: Missile) {
    this.missiles.push(missile)
  }

  remove(missileId: string) {
    this.missiles = this.missiles.filter(missile => missile.id !== missileId)
  }

  getAll() {
    return [...this.missiles]
  }

  clear() {
    this.missiles = []
  }
}
