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
        if (state.value) useTooltip().showTooltip(normalize(state.value), el, true)
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
