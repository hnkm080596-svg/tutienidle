import type { Technique } from './Technique'
import { TechniqueManager } from './TechniqueManager'

export class TechniqueSystem {
  constructor(private readonly manager: TechniqueManager) {}

  learn(technique: Technique): boolean {
    if (this.manager.has(technique.id)) {
      return false
    }

    this.manager.add({
      ...technique,
      unlocked: true,
      equipped: false,
    })

    return true
  }

  equip(techniqueId: string): boolean {
    const technique = this.manager.get(techniqueId)

    if (!technique) {
      return false
    }

    if (!technique.unlocked) {
      return false
    }

    // Tâm Pháp hợp nhất (2026-08-15) — CHỈ 1 tâm pháp trang bị cho
    // toàn hệ thống, không còn phân theo type/slot — tự unequip tâm
    // pháp cũ (nếu có) trước khi equip, giống pattern SkillSystem.equip().
    const current = this.manager.getEquipped()

    if (current && current.id !== technique.id) {
      current.equipped = false
    }

    technique.equipped = true

    return true
  }

  unequip(techniqueId: string): boolean {
    const technique = this.manager.get(techniqueId)

    if (!technique) {
      return false
    }

    technique.equipped = false

    return true
  }

}
