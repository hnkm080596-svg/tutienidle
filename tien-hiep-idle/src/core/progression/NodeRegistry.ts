import type { ProgressionNode } from './ProgressionNode'

// Cùng pattern mọi Registry khác trong project (BuffRegistry/
// AilmentRegistry/...) — id trùng thì throw lúc register (bug data,
// nên fail sớm), get() throw nếu không tồn tại (caller phải chắc chắn
// đã register trước khi tra).
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
