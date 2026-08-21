import type { Material } from './Material'

export class MaterialRegistry {
  private readonly materials = new Map<string, Material>()

  register(material: Material): void {
    if (this.materials.has(material.id)) {
      throw new Error(`Material already registered: ${material.id}`)
    }

    this.materials.set(material.id, material)
  }

  get(materialId: string): Material {
    const material = this.materials.get(materialId)

    if (!material) {
      throw new Error(`Material not found: ${materialId}`)
    }

    return material
  }

  has(materialId: string): boolean {
    return this.materials.has(materialId)
  }

  getAll(): Material[] {
    return Array.from(this.materials.values())
  }
}
