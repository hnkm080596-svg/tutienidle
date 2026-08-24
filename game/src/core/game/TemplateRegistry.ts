// Registry tra cứu template theo id cho data tĩnh (Skill/Technique/
// Enemy/Stage) — thay 4 Map trần trước đây trong GameManager để cùng
// pattern với các Registry còn lại (MaterialRegistry...). Khác biệt
// cố ý so với Registry "instance": get() trả `T | undefined` thay vì
// throw — caller GameManager tự xử lý template thiếu (id lạ từ node/
// stage data phải graceful, không crash tick loop).
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
}
