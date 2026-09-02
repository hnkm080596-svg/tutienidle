import { nextTick, onBeforeUnmount, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * Focus management dùng chung cho dialog primitives (QA-003, Task 9.3):
 * focus-on-open → Tab cycle trong card → Escape callback → restore trigger.
 * Gắn 1 lần ở OverlayPanel/ConfirmModal — mọi consumer kế thừa.
 */
export function useDialogFocus(
  cardRef: Ref<HTMLElement | null>,
  open: MaybeRefOrGetter<boolean>,
  options: { onEscape: () => void },
): void {
  let lastTrigger: HTMLElement | null = null
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null

  function focusables(): HTMLElement[] {
    return cardRef.value ? Array.from(cardRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []
  }

  const stopWatch = watch(() => toValue(open), async (isOpen) => {
    if (isOpen) {
      lastTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      if (!toValue(open)) return
      const items = focusables()
      ;(items[0] ?? cardRef.value)?.focus()
      keydownHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          options.onEscape()
          return
        }
        if (event.key !== 'Tab') return
        const list = focusables()
        if (list.length === 0) return
        event.preventDefault()
        if (list.length === 1) {
          list[0]!.focus()
          return
        }
        const first = list[0]!
        const last = list[list.length - 1]!
        const active = document.activeElement
        if (event.shiftKey) {
          (active === first || !cardRef.value?.contains(active) ? last : list[Math.max(0, list.indexOf(active as HTMLElement) - 1)]!).focus()
        } else {
          (active === last || !cardRef.value?.contains(active) ? first : list[Math.min(list.length - 1, list.indexOf(active as HTMLElement) + 1)]!).focus()
        }
      }
      cardRef.value?.addEventListener('keydown', keydownHandler)
    } else {
      if (keydownHandler) cardRef.value?.removeEventListener('keydown', keydownHandler)
      keydownHandler = null
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus()
      lastTrigger = null
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    stopWatch()
    if (keydownHandler) cardRef.value?.removeEventListener('keydown', keydownHandler)
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus()
  })
}
