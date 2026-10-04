import type { ProgressionNode } from './ProgressionNode'

// Cung pattern moi Registry khac trong project (BuffRegistry/
// AilmentRegistry/...) - id trung thi throw luc register (bug data,
// nen fail som), get() throw neu khong ton tai (caller phai chac chan
// da register truoc khi tra).
export class NodeRegistry {
  private readonly nodes = new Map<string, ProgressionNode>()

  register(node: ProgressionNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`ProgressionNode already registered: ${node.id}`)
    }

    this.nodes.set(node.id, node)
  }

  get(id: string): ProgressionNode {
    const node = this.nodes.get(id)

    if (!node) {
      throw new Error(`ProgressionNode not found: ${id}`)
    }

    return node
  }

  has(id: string): boolean {
    return this.nodes.has(id)
  }

  getAll(): ProgressionNode[] {
    return Array.from(this.nodes.values())
  }
}
