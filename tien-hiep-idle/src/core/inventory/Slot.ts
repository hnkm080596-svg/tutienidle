/**
 * Ô chứa dùng chung cho mọi nơi cần "1 ô giữ 1 item" — equipment
 * paperdoll slot, ô nguyên liệu trong lò luyện đan, ô fodder trong
 * cường hóa... Model thuần (không import Vue) — 1 UI layer sau này
 * sẽ bind vào `content`/`selected`/`locked` để render/tương tác,
 * KHÔNG tự vẽ hay xử lý DOM event ở đây.
 */
export class Slot<T> {
  private content: T | null = null

  selected = false

  locked = false

  constructor(private readonly accepts: (item: T) => boolean = () => true) {}

  canPlace(item: T): boolean {
    if (this.locked) {
      return false
    }

    if (this.content !== null) {
      return false
    }

    return this.accepts(item)
  }

  place(item: T): boolean {
    if (!this.canPlace(item)) {
      return false
    }

    this.content = item

    return true
  }

  take(): T | null {
    if (this.locked) {
      return null
    }

    const item = this.content

    this.content = null

    return item
  }

  peek(): T | null {
    return this.content
  }

  isEmpty(): boolean {
    return this.content === null
  }

  /**
   * Đổi chỗ nội dung giữa 2 slot — chỉ thực hiện nếu cả 2 đều chấp
   * nhận được nội dung của bên kia (hoặc bên kia đang rỗng), tránh
   * tình trạng đổi xong 1 bên chứa item sai loại.
   */
  swap(other: Slot<T>): boolean {
    if (this.locked || other.locked) {
      return false
    }

    const mine = this.content

    const theirs = other.content

    if (mine !== null && !other.accepts(mine)) {
      return false
    }

    if (theirs !== null && !this.accepts(theirs)) {
      return false
    }

    this.content = theirs

    other.content = mine

    return true
  }

  clear(): void {
    this.content = null
  }
}
