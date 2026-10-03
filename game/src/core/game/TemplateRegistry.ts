// Registry tra cuu template theo id cho data tinh (Skill/Technique/
// Enemy/Stage) - thay 4 Map tran truoc day trong GameManager de cung
// pattern voi cac Registry con lai (MaterialRegistry...). Khac biet
// co y so voi Registry "instance": get() tra `T | undefined` thay vi
// throw - caller GameManager tu xu ly template thieu (id la tu node/
// stage data phai graceful, khong crash tick loop).
export class TemplateRegistry<T> {
  private readonly templates = new Map<string, T>()

  register(id: string, template: T): void {
    this.templates.set(id, template)
  }

  get(id: string): T | undefined {
    return this.templates.get(id)
  }

  has(id: string): boolean {
    return this.templates.has(id)
  }

  getAll(): T[] {
    return Array.from(this.templates.values())
  }
}
