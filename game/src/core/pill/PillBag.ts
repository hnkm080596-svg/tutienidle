import type { Pill } from './Pill'
import type { PillStack } from './PillStack'
import type { ItemQuality } from '../item/ItemQuality'
import { ITEM_QUALITY_ORDER } from '../item/ItemQuality'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'
import { BASE_PILL_QUALITY } from './PillQuality'

// Khoa map: chat day du - 'hoang' gom ca dan cu khong co truong chat
// (cung chat nen, ruling M-PILL-GRADE: khac chat KHONG gop stack).
function stackKey(pillId: string, quality: ItemQuality | undefined): string {
  return `${pillId}|${quality ?? BASE_PILL_QUALITY}`
}

// Thu tu chat thap -> cao de chi tieu xau truoc (giu vien manh lai).
// Stack khong chat (legacy) tinh nhu hoang.
function qualityRank(quality: ItemQuality | undefined): number {
  return ITEM_QUALITY_ORDER.indexOf(quality ?? BASE_PILL_QUALITY)
}

export class PillBag {
  private readonly pills = new Map<string, PillStack>()

  /**
   * Cong don stack THEO CHAT, clamp tai MAX_STACK_AMOUNT. Tra ve luong
   * TRAN bi mat (0 neu vua du cho) - caller duong reward dung de bao
   * "tui day" thay vi mat lang le.
   */
  add(pill: Pill, amount: number, quality?: ItemQuality): number {
    // Guard NaN/Infinity (cung vector da harden o MaterialBag): NaN <= 0 la
    // false nen lot qua, cong vao stack se poison amount vinh vien.
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0
    }

    const existing = this.pills.get(stackKey(pill.id, quality))

    if (existing) {
      const next = Math.min(existing.amount + amount, MAX_STACK_AMOUNT)

      const overflow = existing.amount + amount - next

      existing.amount = next

      return overflow
    }

    const stored = Math.min(amount, MAX_STACK_AMOUNT)

    this.pills.set(stackKey(pill.id, quality), {
      pill,

      amount: stored,

      // M-PILL-GRADE: chat da roll; stack gop tu dan cu giu nguyen lo
      // danh (khong field) - save khong doi hinh thai voi dan cu.
      ...(quality !== undefined ? { quality } : {}),
    })

    return amount - stored
  }

  /**
   * Tru `amount` vien. `quality` chi dinh dung mot stack chat;
   * khong truyen = tieu tu chat thap nhat truoc. Tra ve false khi
   * khong du so luong (tai nguyen can bang chua bi dung).
   */
  remove(pillId: string, amount: number, quality?: ItemQuality): boolean {
    // Guard: amount <= 0 KHONG phai remove hop le - amount am se CONG
    // nguoc vao stack (vector nhan ban tiem an). NaN lot qua guard <= 0
    // nen phai chan Number.isFinite truoc.
    if (!Number.isFinite(amount) || amount <= 0) {
      return false
    }

    // Chat chi dinh: stack phai ton tai VA du so luong.
    if (quality !== undefined) {
      const stack = this.pills.get(stackKey(pillId, quality))

      if (stack === undefined || stack.amount < amount) {
        return false
      }

      stack.amount -= amount

      if (stack.amount <= 0) {
        this.pills.delete(stackKey(pillId, quality))
      }

      return true
    }

    if (this.getAmount(pillId) < amount) {
      return false
    }

    let remaining = amount

    for (const stack of this.stacksOf(pillId)) {
      if (remaining <= 0) break

      const taken = Math.min(remaining, stack.amount)

      stack.amount -= taken
      remaining -= taken

      if (stack.amount <= 0) {
        this.pills.delete(stackKey(stack.pill.id, stack.quality))
      }
    }

    return true
  }

  /**
   * Nhu remove() nhung tra ve sach chat da tieu (ItemQuality[]), xep
   * thap -> cao - dung de ghi chat Thong Mach Dan vao moc bat mach
   * (M-PILL-GRADE ruling 4: % bat mach nhan theo chat dan tieu).
   */
  removeDetailed(pillId: string, amount: number): ItemQuality[] {
    const spent: ItemQuality[] = []

    if (!Number.isFinite(amount) || amount <= 0 || this.getAmount(pillId) < amount) {
      return spent
    }

    let remaining = amount

    for (const stack of this.stacksOf(pillId)) {
      if (remaining <= 0) break

      const taken = Math.min(remaining, stack.amount)
      const quality = stack.quality ?? BASE_PILL_QUALITY

      for (let index = 0; index < taken; index += 1) {
        spent.push(quality)
      }

      stack.amount -= taken
      remaining -= taken

      if (stack.amount <= 0) {
        this.pills.delete(stackKey(stack.pill.id, stack.quality))
      }
    }

    return spent
  }

  get(pillId: string, quality?: ItemQuality): Readonly<PillStack> | undefined {
    if (quality !== undefined) {
      const exact = this.pills.get(stackKey(pillId, quality))
      return exact === undefined ? undefined : { ...exact }
    }

    // Stack chat thap nhat - icon/lookup cho mot loai dan bat ky.
    const stack = this.stacksOf(pillId)[0]

    // Snapshot - xem MaterialBag.get.
    return stack === undefined ? undefined : { ...stack }
  }

  /**
   * Cac stack (theo chat) cua mot vien dan, xep chat thap -> cao.
   * Internal view - dung chung cho remove/removeDetailed (KHONG clone).
   */
  private stacksOf(pillId: string): PillStack[] {
    const result: PillStack[] = []

    for (const stack of this.pills.values()) {
      if (stack.pill.id === pillId) {
        result.push(stack)
      }
    }

    return result.sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality))
  }

  /** Snapshot cac stack cua mot vien dan (UI/diagnostic). */
  getStacks(pillId: string): Readonly<PillStack>[] {
    return this.stacksOf(pillId).map((stack) => ({ ...stack }))
  }

  /** Tong so vien cua mot loai dan qua moi chat. */
  getAmount(pillId: string): number {
    let total = 0

    for (const stack of this.pills.values()) {
      if (stack.pill.id === pillId) {
        total += stack.amount
      }
    }

    return total
  }

  has(pillId: string, amount: number): boolean {
    return this.getAmount(pillId) >= amount
  }

  getAll(): Readonly<PillStack>[] {
    return Array.from(this.pills.values(), (stack) => ({ ...stack }))
  }

  /** Restore an owned bag checkpoint without re-running grant hooks. */
  restoreStacks(stacks: Readonly<PillStack>[]): void {
    this.pills.clear()
    for (const stack of stacks) {
      this.pills.set(stackKey(stack.pill.id, stack.quality), { ...stack })
    }
  }

  clear() {
    this.pills.clear()
  }
}
