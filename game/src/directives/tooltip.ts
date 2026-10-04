import type { Directive } from 'vue'
import { useTooltip, type TooltipContent } from '../composables/useTooltip'

export type TooltipDirectiveValue = TooltipContent | string

interface TooltipBinding {
  value: TooltipDirectiveValue

  onPointerEnter: () => void

  onPointerLeave: () => void

  onFocusIn: () => void

  onFocusOut: () => void

  onKeyDown: (event: KeyboardEvent) => void
}

// Value + listener hien tai cua moi element - tach khoi closure
// trong mounted() vi binding.value co the doi qua updated() (vd
// label/description den tu prop reactive), khong muon tooltip hien
// thi du lieu cu; luu listener de unmounted() go dung, tranh ro ri
// khi element bi tao/huy lien tuc (vd v-for cua SlotView).
const bindings = new WeakMap<HTMLElement, TooltipBinding>()

// Pointer-vs-keyboard modality: focusin tooltips are a keyboard-nav aid,
// so they only show after a Tab-initiated focus move. Programmatic focus
// moves (e.g. a dialog/panel's focus-on-open landing on a v-tooltip
// control) would otherwise mount an owner-less tooltip card that sits
// visible until the next focus change.
let keyboardModality = false
let modalityBound = false

function bindModalityTracking() {
  if (modalityBound || typeof document === 'undefined') {
    return
  }
  modalityBound = true
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') keyboardModality = true
  }, true)
  document.addEventListener('pointerdown', () => { keyboardModality = false }, true)
  document.addEventListener('mousedown', () => { keyboardModality = false }, true)
}

function normalize(value: TooltipDirectiveValue): TooltipContent {
  return typeof value === 'string' ? { description: value } : value
}

/**
 * `v-tooltip="description"` hoac `v-tooltip="{ title, description }"`
 * - tu gan pointer/focus lifecycle, goi thang useTooltip().
 * Day la "diem cham" duy nhat can them vao bat ky element nao muon
 * co tooltip, khong can tu viet handler moi cho.
 */
export const vTooltip: Directive<HTMLElement, TooltipDirectiveValue> = {
  mounted(el, binding) {
    bindModalityTracking()

    const state: TooltipBinding = {
      value: binding.value,

      onPointerEnter() {
        if (!state.value) {
          return
        }

        useTooltip().showTooltip(normalize(state.value), el)
      },

      onPointerLeave() {
        useTooltip().hideTooltip(el)
      },

      onFocusIn() {
        if (state.value && keyboardModality) useTooltip().showTooltip(normalize(state.value), el, true)
      },

      onFocusOut() {
        useTooltip().hideTooltip(el)
      },

      onKeyDown(event) {
        if (event.key === 'Escape') useTooltip().dismissTooltip()
      },
    }

    bindings.set(el, state)

    el.addEventListener('pointerenter', state.onPointerEnter)
    el.addEventListener('pointerleave', state.onPointerLeave)
    el.addEventListener('focusin', state.onFocusIn)
    el.addEventListener('focusout', state.onFocusOut)
    el.addEventListener('keydown', state.onKeyDown)
  },

  updated(el, binding) {
    const state = bindings.get(el)

    if (state) {
      state.value = binding.value
      if (binding.value) useTooltip().updateTooltip(normalize(binding.value), el)
    }
  },

  unmounted(el) {
    const state = bindings.get(el)

    if (!state) {
      return
    }

    el.removeEventListener('pointerenter', state.onPointerEnter)
    el.removeEventListener('pointerleave', state.onPointerLeave)
    el.removeEventListener('focusin', state.onFocusIn)
    el.removeEventListener('focusout', state.onFocusOut)
    el.removeEventListener('keydown', state.onKeyDown)

    bindings.delete(el)

    // Element co the bi unmount ngay giua luc dang hover (vd
    // BreakthroughButton bien mat do v-if tat ngay sau khi bam,
    // cultivation reset) - mouseleave tu nhien khong kip fire, tooltip
    // se dinh man hinh vinh vien neu khong don o day.
    useTooltip().hideTooltip(el, true)
  },
}
