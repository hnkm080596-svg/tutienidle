import type { Skill } from './Skill'

export class SkillManager {
  private skills: Skill[] = []

  add(skill: Skill) {
    this.skills.push(skill)
  }

  remove(skillId: string) {
    this.skills =
      this.skills.filter(
        skill => skill.id !== skillId,
      )
  }

  get(skillId: string) {
    return this.skills.find(
      skill => skill.id === skillId,
    )
  }

  getAll() {
    return [...this.skills]
  }

  /**
   * M1 (ARCH-001) - session-restore boundary: replace the whole learned
   * set with a DETACHED copy of the payload. The input is a value -
   * mutating it afterwards must not leak into live state (A3).
   */
  restore(skills: Skill[]) {
    this.skills = skills.map((skill) => structuredClone(skill))
  }

  // P7-M4 - learned passives ALWAYS apply: membership is the learned
  // authority; the equip switch is retired (no passive ever carries an
  // off state).
  getPassiveSkills() {
    return this.skills.filter(
      skill => skill.type === 'passive',
    )
  }

  has(skillId: string) {
    return this.skills.some(
      skill => skill.id === skillId,
    )
  }
}
