import { parseMaterialReceiptState, sameMaterialReceipt, receiptId, MAX_PENDING_MATERIAL_DELIVERIES, type MaterialGrant, type MaterialReceipt, type MaterialReceiptState } from './MaterialReceipt'
import type { Material } from './Material'
import type { MaterialStack } from './MaterialStack'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'


export class MaterialBag {
  constructor(private readonly now: () => number = Date.now) {}
  private receiptState: MaterialReceiptState = {
    version: 2, playerId: crypto.randomUUID(), runId: crypto.randomUUID(), sequence: 0, acknowledgedThrough: 0, pending: [],
  }
  private deliveryConsumer: ((grant: MaterialGrant) => void) | undefined
  private delivering = false
  private acquisitionDepth = 0

  setDeliveryConsumer(consumer: (grant: MaterialGrant) => void): void { this.deliveryConsumer = consumer }

  /** Retry outstanding work before a new producer is allowed to debit or grant. */
  prepareCredit(): void { if (this.acquisitionDepth === 0) this.flushDeliveries() }

  withAcquisition<T>(operation: () => T): T {
    this.prepareCredit()
    this.acquisitionDepth++
    let committed = false
    try { const result = operation(); committed = true; return result }
    finally {
      this.acquisitionDepth--
      if (committed && this.acquisitionDepth === 0) {
        try { this.flushDeliveries() } catch { /* Block the next command; keep this committed outbox. */ }
      }
    }
  }

  flushDeliveries(): void {
    if (this.delivering) throw new Error('Material delivery consumer reentry')
    this.delivering = true
    try {
      while (this.receiptState.pending.length > 0) {
        const grant = this.receiptState.pending[0]!
        this.deliveryConsumer?.(structuredClone(grant))
        this.receiptState.acknowledgedThrough = grant.sequence
        this.receiptState.pending.shift()
      }
    } finally { this.delivering = false }
  }

  /** Arbitrary origin strings are retired, never reinterpreted as a fresh grant. */
  credit(material: Material, amount: number, retiredOrigin?: string): MaterialGrant {
    if (retiredOrigin !== undefined) throw new Error('Retired material origin cannot issue a fresh grant')
    return this.creditBatch([{ material, amount }])[0]!
  }

  /** Commit a producer batch before attempting its ordered consumer delivery. */
  creditBatch(items: readonly { material: Material; amount: number; sourceId?: string }[]): MaterialGrant[] {
    this.prepareCredit()
    if (items.length + this.receiptState.pending.length > MAX_PENDING_MATERIAL_DELIVERIES) throw new Error('Material receipt outbox capacity')
    const committedAtMs = Math.floor(this.now())
    if (!Number.isSafeInteger(committedAtMs) || committedAtMs < 0 ||
      !Number.isSafeInteger(this.receiptState.sequence + items.length)) throw new Error('Invalid material grant epoch or sequence')
    for (const { material, amount, sourceId } of items) {
      if (!receiptId(material.id) || !Number.isSafeInteger(amount) || amount <= 0 ||
        (sourceId !== undefined && !receiptId(sourceId))) throw new Error('Invalid material grant')
    }
    const stacks = this.getAll()
    const checkpoint = this.receiptSnapshot()
    const grants: MaterialGrant[] = []
    try {
      for (const { material, amount, sourceId } of items) {
        const sequence = this.receiptState.sequence + 1
        const source = sourceId ?? `inventory:${this.receiptState.runId}:${sequence}`
        const overflow = amount - this.canAcceptAmount(material, amount)
        if (!Number.isSafeInteger(overflow) || overflow < 0) throw new Error('Invalid material grant capacity')
        const delivered = amount - overflow
        const receipt: MaterialReceipt | null = delivered > 0 ? {
          version: 2, producer: 'inventory', sequence, eventId: `inventory:${this.receiptState.runId}:${sequence}`,
          playerId: this.receiptState.playerId, runId: this.receiptState.runId, sourceId: source, committedAtMs, units: delivered,
          payload: { kind: 'material_delivered', materialId: material.id, delivered },
        } : null
        const grant = { sequence, playerId: this.receiptState.playerId, runId: this.receiptState.runId,
          sourceId: source, materialId: material.id, requested: amount, overflow, receipt }
        this.add(material, amount)
        this.receiptState.sequence = sequence
        this.receiptState.pending.push(grant)
        grants.push(grant)
      }
    } catch (error) {
      this.restoreStacks(stacks)
      this.replaceReceiptCheckpoint(checkpoint)
      throw error
    }
    // Inventory committed. A failed consumer leaves a durable outbox, and the
    // next producer is blocked by prepareCredit before making another debit.
    if (this.acquisitionDepth === 0) {
      try { this.flushDeliveries() } catch { /* Pending facts remain owned here. */ }
    }
    return structuredClone(grants)
  }

  isRetiredReceipt(receipt: MaterialReceipt): boolean {
    return receipt.playerId === this.receiptState.playerId && receipt.runId === this.receiptState.runId &&
      Number.isSafeInteger(receipt.sequence) && receipt.sequence > 0 && receipt.sequence <= this.receiptState.acknowledgedThrough
  }

  ownsReceipt(receipt: MaterialReceipt): boolean {
    const own = this.receiptState.pending.find((grant) => grant.sequence === receipt.sequence)?.receipt
    return own !== undefined && own !== null && sameMaterialReceipt(own, receipt)
  }

  receiptSnapshot(): MaterialReceiptState { return structuredClone(this.receiptState) }

  validateReceiptRestore(input: unknown): MaterialReceiptState {
    const next = parseMaterialReceiptState(input)
    if (!next) throw new Error('Malformed material receipt state')
    if (this.receiptState.sequence > 0 && (next.playerId !== this.receiptState.playerId || next.runId !== this.receiptState.runId ||
      next.sequence < this.receiptState.sequence || next.acknowledgedThrough < this.receiptState.acknowledgedThrough)) throw new Error('Foreign or stale material receipt state')
    return next
  }
  restoreReceiptState(input: unknown): void { this.replaceReceiptCheckpoint(this.validateReceiptRestore(input)) }
  startReceiptBaseline(): void {
    this.replaceReceiptCheckpoint({ version: 2, playerId: crypto.randomUUID(), runId: crypto.randomUUID(), sequence: 0, acknowledgedThrough: 0, pending: [] })
  }
  /** Whole-save replacement or atomic rollback; callers validate the paired state first. */
  replaceReceiptCheckpoint(state: MaterialReceiptState): void { this.receiptState = structuredClone(state) }

  private readonly materials =
    new Map<string, MaterialStack>()


  /**
   * Cong don stack, clamp tai stackLimit (mac dinh MAX_STACK_AMOUNT).
   * Tra ve luong TRAN bi mat (0 neu vua du cho) - caller duong reward
   * dung de bao "tui day" thay vi mat lang le.
   */
  add(
    material: Material,
    amount: number,
  ): number {
    // Guard NaN/Infinity: `NaN <= 0` la false nen check cu lot NaN -
    // NaN cong vao stack se poison vinh vien amount do (moi has() tra
    // false, UI hien NaN). amount phai la so huu han duong.
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0
    }

    const limit = material.stackLimit ?? MAX_STACK_AMOUNT

    const existing =
      this.materials.get(
        material.id,
      )

    if (existing) {
      const next = Math.min(existing.amount + amount, limit)

      const overflow = existing.amount + amount - next

      existing.amount = next

      return overflow
    }

    const stored = Math.min(amount, limit)

    this.materials.set(
      material.id,
      {
        material,

        amount: stored,
      },
    )

    return amount - stored
  }

  /**
   * R9 (AR-22) - preflight how much of `amount` fits WITHOUT mutating.
   * An exchange owner checks this BEFORE any debit/credit so a failed
   * compound trade leaves all balances
   * unchanged (A9: failed exchanges preserve all involved balances).
   */
  canAcceptAmount(
    material: Material,
    amount: number,
  ): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0
    }

    const limit = material.stackLimit ?? MAX_STACK_AMOUNT

    const existing =
      this.materials.get(
        material.id,
      )

    if (!existing) {
      return Math.min(amount, limit)
    }

    return Math.max(0, Math.min(amount, limit - existing.amount))
  }


  remove(
    materialId: string,
    amount: number,
  ): boolean {
    // Guard: amount <= 0 KHONG phai remove hop le - amount am se CONG
    // nguoc vao stack (vector nhan ban tiem an). NaN cung bi chan:
    // `existing.amount < NaN` la false nen NaN se lot qua va tru NaN
    // khoi stack (poison amount).
    if (!Number.isFinite(amount) || amount <= 0) {
      return false
    }

    const existing =
      this.materials.get(
        materialId,
      )

    if (!existing) {
      return false
    }

    if (
      existing.amount < amount
    ) {
      return false
    }

    existing.amount -= amount

    if (
      existing.amount <= 0
    ) {
      this.materials.delete(
        materialId,
      )
    }

    return true
  }


  get(
    materialId: string,
  ): Readonly<MaterialStack> | undefined {
    const stack = this.materials.get(
      materialId,
    )

    // Snapshot - the live stack in the map is internal state, callers only read.
    return stack === undefined
      ? undefined
      : { ...stack }
  }


  getAmount(
    materialId: string,
  ): number {
    return (
      this.materials.get(
        materialId,
      )?.amount ?? 0
    )
  }


  has(
    materialId: string,
    amount: number,
  ): boolean {
    return (
      this.getAmount(
        materialId,
      ) >= amount
    )
  }


  getAll(): Readonly<MaterialStack>[] {
    return Array.from(
      this.materials.values(),
      (stack) => ({ ...stack }),
    )
  }

  /** Restore an owned bag checkpoint without calling overridable grant hooks. */
  restoreStacks(stacks: Readonly<MaterialStack>[]): void {
    this.materials.clear()
    for (const stack of stacks) {
      this.materials.set(stack.material.id, { ...stack })
    }
  }


  clear() {
    this.materials.clear()
  }
}
