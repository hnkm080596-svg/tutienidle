import type { Buff } from './Buff'
import { BuffManager } from './BuffManager'
import type { StatModifier } from '../stats/StatCalculator'

export class BuffSystem {
  constructor(private readonly manager: BuffManager) {}

  apply(buff: Buff) {
    const existing = this.manager.get(buff.id)

    if (!existing) {
      const newBuff = {
        ...buff,

        remainingTime: buff.duration,

        stacks: buff.stacks || 1,
      }

      this.manager.add(newBuff)

      return
    }

    this.handleExistingBuff(existing, buff)
  }

  private handleExistingBuff(existing: Buff, incoming: Buff) {
    switch (incoming.stackMode) {
      case 'stack':
        this.addStack(existing, incoming)
        break

      case 'refresh':
        this.refresh(existing, incoming)
        break

      case 'replace':
        this.manager.remove(existing.id)

        this.manager.add({
          ...incoming,

          remainingTime: incoming.duration,
        })

        break
    }
  }
  getActiveModifiers(): StatModifier[] {
    const modifiers: StatModifier[] = []

    for (const buff of this.manager.getAll()) {
      for (const modifier of buff.modifiers) {
        modifiers.push({
          ...modifier,

          stacks: buff.stacks,
        })
      }
    }

    return modifiers
  }
  private addStack(existing: Buff, _incoming: Buff) {
    const current = existing.stacks

    let next = current + 1

    if (existing.maxStacks !== undefined) {
      next = Math.min(next, existing.maxStacks)
    }

    existing.stacks = next

    existing.remainingTime = existing.duration
  }

  private refresh(existing: Buff, incoming: Buff) {
    existing.remainingTime = incoming.duration
  }

  update(deltaSeconds: number) {
    const expired: string[] = []

    for (const buff of this.manager.getAll()) {
      if (buff.remainingTime === undefined) {
        continue
      }

      buff.remainingTime -= deltaSeconds

      if (buff.remainingTime <= 0) {
        expired.push(buff.id)
      }
    }

    for (const buffId of expired) {
      this.manager.remove(buffId)
    }
  }
}
