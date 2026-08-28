import type { Quest } from './Quest'

export class QuestRegistry {
  private readonly quests = new Map<string, Quest>()

  register(quest: Quest): void {
    if (this.quests.has(quest.id)) {
      throw new Error(`Quest already registered: ${quest.id}`)
    }

    this.quests.set(quest.id, quest)
  }

  get(questId: string): Quest {
    const quest = this.quests.get(questId)

    if (!quest) {
      throw new Error(`Quest not found: ${questId}`)
    }

    return quest
  }

  has(questId: string): boolean {
    return this.quests.has(questId)
  }

  getAll(): Quest[] {
    return Array.from(this.quests.values())
  }
}
