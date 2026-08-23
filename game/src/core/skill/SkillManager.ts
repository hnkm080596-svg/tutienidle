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

  // PLAN HOÀN CHỈNH mục 6/8 — thay getEquippedInCategory() cũ. Đòn
  // đánh cơ bản đọc qua đây (KHÔNG phân biệt slot nào, kể cả chưa gắn
  // slot — Phàm Nhân equip thẳng không qua Loadout UI, xem
  // SkillSystem.equipWithoutSlot()).
  getBasicAttackSkill(): Skill | undefined {
    return this.skills.find(
      skill => skill.equipped && skill.isBasicAttack,
    )
  }

  getEquippedInSlot(slotIndex: number): Skill | undefined {
    return this.skills.find(
      skill => skill.equipped && (skill.loadoutSlots?.includes(slotIndex) || skill.loadoutSlot === slotIndex),
    )
  }

  getLoadoutEntries(): { slotIndex: number; skill: Skill }[] {
    return this.skills
      .filter(skill => skill.equipped && !skill.isBasicAttack)
      .flatMap(skill => (skill.loadoutSlots ?? (skill.loadoutSlot === undefined ? [] : [skill.loadoutSlot]))
        .map(slotIndex => ({ slotIndex, skill })))
      .sort((a, b) => a.slotIndex - b.slotIndex)
  }

  // Danh sách skill ĐANG trong Skill Loadout, sắp theo đúng thứ tự
  // slot 0→4 — dùng cho BattleSystem.updateAutoCast() (thử theo thứ
  // tự slot thay vì theo category cố định như trước) và UI hiện dải 5
  // ô. Loại bỏ isBasicAttack — skill đó chạy theo attackSpeed timer
  // riêng (getBasicAttackSkill()), không tham gia vòng lặp auto-cast
  // dù có đang chiếm 1 slot.
  getLoadoutSkills(): Skill[] {
    return this.getLoadoutEntries().map(entry => entry.skill)
  }

  has(skillId: string) {
    return this.skills.some(
      skill => skill.id === skillId,
    )
  }
}
