export interface VfxLease<T> { readonly value: T; release(): void }
interface Slot<T> { value: T; generation: number; active: boolean }

/** Scene-local bounded storage. Lease generations prevent stale release callbacks. */
export class VfxPool<T> {
  private readonly slots: Slot<T>[] = []
  private disposed = false
  constructor(
    private readonly capacity: number,
    private readonly create: () => T,
    private readonly resetValue: (value: T) => void,
    private readonly destroyValue: (value: T) => void,
  ) {
    if (!Number.isInteger(capacity) || capacity < 0) throw new Error('Invalid VFX pool capacity')
  }
  get stats() {
    return { allocated: this.slots.length, active: this.slots.filter(slot => slot.active).length, capacity: this.capacity }
  }
  acquire(): VfxLease<T> | null {
    if (this.disposed) return null
    let slot = this.slots.find(item => !item.active)
    if (!slot) {
      if (this.slots.length >= this.capacity) return null
      slot = { value: this.create(), generation: 0, active: false }
      this.slots.push(slot)
    }
    slot.active = true
    const generation = ++slot.generation
    return { value: slot.value, release: () => {
      if (!slot.active || slot.generation !== generation || this.disposed) return
      this.releaseSlot(slot)
    } }
  }
  private releaseSlot(slot: Slot<T>): void {
    slot.active = false
    slot.generation++
    try { this.resetValue(slot.value) } catch (error) {
      this.slots.splice(this.slots.indexOf(slot), 1)
      this.destroyValue(slot.value)
      throw error
    }
  }
  reset(): void {
    let firstError: unknown
    for (const slot of [...this.slots]) {
      if (!slot.active) continue
      try { this.releaseSlot(slot) } catch (error) { firstError ??= error }
    }
    if (firstError !== undefined) throw firstError
  }
  destroy(): void {
    if (this.disposed) return
    this.disposed = true
    let firstError: unknown
    for (const slot of this.slots.splice(0)) {
      slot.active = false
      slot.generation++
      try { this.destroyValue(slot.value) } catch (error) { firstError ??= error }
    }
    if (firstError !== undefined) throw firstError
  }
}
