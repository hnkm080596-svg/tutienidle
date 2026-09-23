import { nextTick, onBeforeUnmount, toValue, watch, type MaybeRefOrGetter } from 'vue'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * Focus management dùng chung cho dialog primitives (QA-003, Task 9.3):
 * focus-on-open → Tab cycle trong card → Escape callback → restore trigger.
 * Gắn 1 lần ở OverlayPanel/ConfirmModal — mọi consumer kế thừa.
 */
export function useDialogFocus(
  cardRef: MaybeRefOrGetter<HTMLElement | null>,
  open: MaybeRefOrGetter<boolean>,
  options: { onEscape: () => void },
): void {
  let lastTrigger: HTMLElement | null = null
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null
  let mousedownHandler: ((event: MouseEvent) => void) | null = null

  function focusables(): HTMLElement[] {
    const el = toValue(cardRef)
    return el ? Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []
  }

  const stopWatch = watch(() => toValue(open), async (isOpen) => {
    if (isOpen) {
      const activeElement = document.activeElement
      const activeInCard = activeElement instanceof HTMLElement && toValue(cardRef)?.contains(activeElement) === true
      // Re-open guard: focus đã nằm trong card (same-tick bounce) → giữ trigger gốc,
      // không ghi đè bằng phần tử trong dialog (restore sẽ bị skip vì contains guard).
      if (lastTrigger === null || !activeInCard) {
        lastTrigger = activeElement instanceof HTMLElement ? activeElement : null
      }
      await nextTick()
      if (!toValue(open)) return
      const items = focusables()
      ;(items[0] ?? toValue(cardRef))?.focus()
      keydownHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          options.onEscape()
          return
        }
        if (event.key !== 'Tab') return
        // Tab luôn bị chặn native trước early-return: dialog không có focusable
        // cũng KHÔNG cho Tab thoát containment (focus giữ nguyên tại chỗ).
        event.preventDefault()
        const list = focusables()
        if (list.length === 0) return
        if (list.length === 1) {
          list[0]!.focus()
          return
        }
        const first = list[0]!
        const last = list[list.length - 1]!
        const active = document.activeElement
        if (event.shiftKey) {
          (active === first || !toValue(cardRef)?.contains(active) ? last : list[Math.max(0, list.indexOf(active as HTMLElement) - 1)]!).focus()
        } else {
          (active === last || !toValue(cardRef)?.contains(active) ? first : list[Math.min(list.length - 1, list.indexOf(active as HTMLElement) + 1)]!).focus()
        }
      }
      toValue(cardRef)?.addEventListener('keydown', keydownHandler)
      // M-UI-SYSTEM QA - pointer containment, sibling to the Tab cycle:
      // a mousedown on unfocusable space outside the open card lets the
      // browser move focus to a BACKGROUND focusable ancestor (a parent
      // overlay card is tabindex=-1), so the blocked surface answers
      // Escape through the blocking dialog. Cancelling the default
      // mousedown action keeps focus inside the card; click handlers
      // (e.g. scrim close) still fire because click is a separate event.
      mousedownHandler = (event: MouseEvent) => {
        const card = toValue(cardRef)
        if (card && !(event.target instanceof Node && card.contains(event.target))) {
          event.preventDefault()
        }
      }
      document.addEventListener('mousedown', mousedownHandler)
    } else {
      if (keydownHandler) toValue(cardRef)?.removeEventListener('keydown', keydownHandler)
      keydownHandler = null
      if (mousedownHandler) {
        document.removeEventListener('mousedown', mousedownHandler)
        mousedownHandler = null
      }
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus()
      lastTrigger = null
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    stopWatch()
    if (keydownHandler) toValue(cardRef)?.removeEventListener('keydown', keydownHandler)
    if (mousedownHandler) {
      document.removeEventListener('mousedown', mousedownHandler)
      mousedownHandler = null
    }
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus()
  })
}
