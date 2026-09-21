import type { Technique } from './Technique'

// P7-M3 - 0-or-1 canonical technique holder. A committed Way owns
// exactly one canonical Technique (D9); the retired list/equip model
// (add/remove/getEquipped/learned-set) is gone. Grant validation lives
// in TechniqueSystem; save contract validation lives in the v70
// preflight - this class only stores the single live instance.
export class TechniqueManager {
  private active: Technique | null = null

  getActive(): Technique | undefined {
    return this.active ?? undefined
  }

  setActive(technique: Technique | null) {
    this.active = technique
  }

  get(techniqueId: string): Technique | undefined {
    return this.active?.id === techniqueId ? this.active : undefined
  }

  getAll(): Technique[] {
    // Snapshot-shaped for the save boundary - shallow copies so callers
    // cannot mutate live progression through the returned entries.
    return this.active ? [{ ...this.active }] : []
  }

  /**
   * Session-restore boundary: the v70 preflight guarantees <= 1 entry
   * matching the active Way; keep only the first, detached (A3).
   */
  restore(techniques: Technique[]) {
    this.active = techniques.length > 0 ? structuredClone(techniques[0]!) : null
  }

  has(techniqueId: string) {
    return this.active?.id === techniqueId
  }
}
