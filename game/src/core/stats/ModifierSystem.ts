import type { StatModifier } from './StatCalculator'

export class ModifierSystem {
  private modifiers: StatModifier[] = []

  add(modifier: StatModifier) {
    this.modifiers.push(modifier)
  }

  remove(modifierId: string) {
    this.modifiers =
      this.modifiers.filter(
        modifier =>
          modifier.id !== modifierId,
      )
  }

  removeBySource(sourceId: string) {
    this.modifiers =
      this.modifiers.filter(
        modifier =>
          modifier.sourceId !== sourceId,
      )
  }

  find(modifierId: string) {
    return this.modifiers.find(
      modifier =>
        modifier.id === modifierId,
    )
  }

  addStack(
    modifierId: string,
    amount = 1,
  ) {
    const modifier =
      this.find(modifierId)

    if (!modifier) {
      return
    }

    const current =
      modifier.stacks ?? 0

    let next =
      current + amount

    if (
      modifier.maxStacks !== undefined
    ) {
      next = Math.min(
        next,
        modifier.maxStacks,
      )
    }

    modifier.stacks = next
  }

  getAll(): StatModifier[] {
    return [...this.modifiers]
  }

  clear() {
    this.modifiers = []
  }
}