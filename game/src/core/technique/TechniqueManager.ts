import type { Technique } from './Technique'

export class TechniqueManager {
  private techniques: Technique[] = []

  add(technique: Technique) {
    this.techniques.push(technique)
  }

  remove(techniqueId: string) {
    this.techniques = this.techniques.filter((technique) => technique.id !== techniqueId)
  }

  get(techniqueId: string) {
    return this.techniques.find((technique) => technique.id === techniqueId)
  }

  getAll() {
    return [...this.techniques]
  }

  /**
   * M1 (ARCH-001) — session-restore boundary: replace the whole learned
   * set with a DETACHED copy of the payload. The input is a value —
   * mutating it afterwards must not leak into live state (A3).
   */
  restore(techniques: Technique[]) {
    this.techniques = techniques.map((technique) => structuredClone(technique))
  }

  // Tâm Pháp hợp nhất (2026-08-15) — CHỈ 1 tâm pháp trang bị cho toàn
  // hệ thống (trước đây getEquippedInSlot() có 3 overload theo type,
  // xoá hẳn — không còn khái niệm slot).
  getEquipped(): Technique | undefined {
    return this.techniques.find((technique) => technique.equipped)
  }

  has(techniqueId: string) {
    return this.techniques.some((technique) => technique.id === techniqueId)
  }
}
