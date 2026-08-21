import type { Formation } from './Formation'

export class FormationRegistry {
  private readonly formations = new Map<string, Formation>()

  register(formation: Formation): void {
    if (this.formations.has(formation.id)) {
      throw new Error(`Formation already registered: ${formation.id}`)
    }

    this.formations.set(formation.id, formation)
  }

  get(formationId: string): Formation {
    const formation = this.formations.get(formationId)

    if (!formation) {
      throw new Error(`Formation not found: ${formationId}`)
    }

    return formation
  }

  has(formationId: string): boolean {
    return this.formations.has(formationId)
  }

  getAll(): Formation[] {
    return Array.from(this.formations.values())
  }
}
