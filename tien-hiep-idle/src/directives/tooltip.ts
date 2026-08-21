import type { Directive } from 'vue'
import { useTooltip, type TooltipContent } from '../composables/useTooltip'

export type TooltipDirectiveValue = TooltipContent | string

interface TooltipBinding {
  value: TooltipDirectiveValue

  onMouseEnter: (event: MouseEvent) => void

  onMouseMove: (event: MouseEvent) => void

  onMouseLeave: () => void
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
 * — tự gắn mouseenter/mousemove/mouseleave, gọi thẳng useTooltip().
 * Đây là "điểm chạm" duy nhất cần thêm vào bất kỳ element nào muốn
 * có tooltip, không cần tự viết handler mỗi chỗ.
 */
export const vTooltip: Directive<HTMLElement, TooltipDirectiveValue> = {
  mounted(el, binding) {
    const state: TooltipBinding = {
      value: binding.value,

      onMouseEnter(event) {
        if (!state.value) {
          return
        }

        useTooltip().showTooltip(normalize(state.value), event, el)
      },

      onMouseMove(event) {
        useTooltip().moveTooltip(event)
      },

      onMouseLeave() {
        useTooltip().hideTooltip(el)
      },
    }

    bindings.set(el, state)

    el.addEventListener('mouseenter', state.onMouseEnter)
    el.addEventListener('mousemove', state.onMouseMove)
    el.addEventListener('mouseleave', state.onMouseLeave)
  },

  updated(el, binding) {
    const state = bindings.get(el)

    if (state) {
      state.value = binding.value
    }
  },

  unmounted(el) {
    const state = bindings.get(el)

    if (!state) {
      return
    }

    el.removeEventListener('mouseenter', state.onMouseEnter)
    el.removeEventListener('mousemove', state.onMouseMove)
    el.removeEventListener('mouseleave', state.onMouseLeave)

    bindings.delete(el)

    // Element có thể bị unmount ngay giữa lúc đang hover (vd
    // BreakthroughButton biến mất do v-if tắt ngay sau khi bấm,
    // cultivation reset) — mouseleave tự nhiên không kịp fire, tooltip
    // sẽ dính màn hình vĩnh viễn nếu không dọn ở đây.
    useTooltip().hideTooltip(el)
  },
}
