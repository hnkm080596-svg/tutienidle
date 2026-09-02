// Task 19 (item-grade-quality-rework, rework P6) — typed provide/inject
// key for the equipped-instance selection shared ONLY by Wash/Refine tabs
// (Enhance selects by SLOT, not instance; Dissolve has its own independent
// multi-select — neither needs this). Shell provides it; children inject.
import type { InjectionKey, Ref } from 'vue'

export interface HallSelection {
  selectedInstanceId: Ref<string | null>

  selectEquipped: (instanceId: string) => void

  clearSelection: () => void
}

export const HALL_SELECTION_KEY: InjectionKey<HallSelection> = Symbol('hall-selection')
