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

  get(missileId: string) {
    return this.missiles.find(missile => missile.id === missileId)
  }

  clear() {
    this.missiles = []
  }
}
