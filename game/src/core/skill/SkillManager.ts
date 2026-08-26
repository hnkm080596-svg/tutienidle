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

  getActiveSkills() {
    return this.skills.filter(
      skill =>
        skill.type === 'active' &&
        skill.equipped,
    )
  }

  getPassiveSkills() {
    return this.skills.filter(
      skill =>
        skill.type === 'passive' &&
        skill.equipped,
    )
  }

  // Execution policy rework (plan §8.6) — KHÔNG còn khái niệm đòn đánh
  // cơ bản tách riêng: mọi active skill auto-cast đều đi qua loadout
  // scheduler của BattleSystem theo đúng thứ tự slot.
  getEquippedInSlot(slotIndex: number): Skill | undefined {
    return this.skills.find(
      skill => skill.equipped && (skill.loadoutSlots?.includes(slotIndex) || skill.loadoutSlot === slotIndex),
    )
  }

  getLoadoutEntries(): { slotIndex: number; skill: Skill }[] {
    return this.skills
      .filter(skill => skill.equipped)
      .flatMap(skill => (skill.loadoutSlots ?? (skill.loadoutSlot === undefined ? [] : [skill.loadoutSlot]))
        .map(slotIndex => ({ slotIndex, skill })))
      .sort((a, b) => a.slotIndex - b.slotIndex)
  }

  // Danh sách skill ĐANG trong Skill Loadout, sắp theo đúng thứ tự
  // slot 0→4 — dùng cho scheduler auto-cast thống nhất (plan §8.4) và UI
  // hiện dải ô loadout.
  getLoadoutSkills(): Skill[] {
    return this.getLoadoutEntries().map(entry => entry.skill)
  }

  has(skillId: string) {
    return this.skills.some(
      skill => skill.id === skillId,
    )
  }
}
