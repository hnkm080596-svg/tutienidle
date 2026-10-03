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

// Value + listener hiện tại của mỗi element — tách khỏi closure
// trong mounted() vì binding.value có thể đổi qua updated() (vd
// label/description đến từ prop reactive), không muốn tooltip hiển
// thị dữ liệu cũ; lưu listener để unmounted() gỡ đúng, tránh rò rỉ
// khi element bị tạo/huỷ liên tục (vd v-for của SlotView).
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
 * `v-tooltip="description"` hoặc `v-tooltip="{ title, description }"`
 * — tự gắn pointer/focus lifecycle, gọi thẳng useTooltip().
 * Đây là "điểm chạm" duy nhất cần thêm vào bất kỳ element nào muốn
 * có tooltip, không cần tự viết handler mỗi chỗ.
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

    // Element có thể bị unmount ngay giữa lúc đang hover (vd
    // BreakthroughButton biến mất do v-if tắt ngay sau khi bấm,
    // cultivation reset) — mouseleave tự nhiên không kịp fire, tooltip
    // sẽ dính màn hình vĩnh viễn nếu không dọn ở đây.
    useTooltip().hideTooltip(el, true)
  },
}
