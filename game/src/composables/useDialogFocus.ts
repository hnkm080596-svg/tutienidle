import { nextTick, onBeforeUnmount, toValue, watch, type MaybeRefOrGetter } from 'vue'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

const activeDialogStack: Array<() => HTMLElement | null> = []

function removeDialogFromStack(getter: () => HTMLElement | null): void {
  const index = activeDialogStack.lastIndexOf(getter)
  if (index >= 0) {
    activeDialogStack.splice(index, 1)
  }
}

function isTopmostActiveDialog(getter: () => HTMLElement | null): boolean {
  for (let i = activeDialogStack.length - 1; i >= 0; i--) {
    const candidate = activeDialogStack[i]!()
    if (candidate && document.contains(candidate)) {
      return activeDialogStack[i] === getter
    }
  }
  return true
}

/**
 * Focus management dung chung cho dialog primitives (QA-003, Task 9.3):
 * focus-on-open -> Tab cycle trong card -> Escape callback -> restore trigger.
 * Gan 1 lan o OverlayPanel/ConfirmModal - moi consumer ke thua.
 */
export function useDialogFocus(
  cardRef: MaybeRefOrGetter<HTMLElement | null>,
  open: MaybeRefOrGetter<boolean>,
  options: { onEscape: () => void },
): void {
  let lastTrigger: HTMLElement | null = null
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null
  let mousedownHandler: ((event: MouseEvent) => void) | null = null
  let disposed = false
  const cardGetter = () => toValue(cardRef)

  function focusables(): HTMLElement[] {
    const el = toValue(cardRef)
    return el ? Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []
  }

  const stopWatch = watch(() => toValue(open), async (isOpen) => {
    if (isOpen) {
      removeDialogFromStack(cardGetter)
      activeDialogStack.push(cardGetter)
      const activeElement = document.activeElement
      const activeInCard = activeElement instanceof HTMLElement && toValue(cardRef)?.contains(activeElement) === true
      // Re-open guard: focus da nam trong card (same-tick bounce) -> giu trigger goc,
      // khong ghi de bang phan tu trong dialog (restore se bi skip vi contains guard).
      if (lastTrigger === null || !activeInCard) {
        lastTrigger = activeElement instanceof HTMLElement ? activeElement : null
      }
      await nextTick()
      if (disposed || !toValue(open)) return
      const items = focusables()
      ;(items[0] ?? toValue(cardRef))?.focus()
      keydownHandler = (event: KeyboardEvent) => {
        if (!isTopmostActiveDialog(cardGetter)) return
        if (event.key === 'Escape') {
          event.stopPropagation()
          options.onEscape()
          return
        }
        if (event.key !== 'Tab') return
        // Tab luon bi chan native truoc early-return: dialog khong co focusable
        // cung KHONG cho Tab thoat containment (focus giu nguyen tai cho).
        // stopPropagation: window-level listeners (DongFuStage Tab
        // toggle) must not see a Tab consumed by dialog containment.
        event.preventDefault()
        event.stopPropagation()
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
      // Never block focus into topmost teleported dialogs or editable controls.
      mousedownHandler = (event: MouseEvent) => {
        if (!isTopmostActiveDialog(cardGetter)) return
        const card = toValue(cardRef)
        const target = event.target
        if (!card || !(target instanceof Node) || card.contains(target)) return
        if (target instanceof Element && (target.closest(EDITABLE_SELECTOR) || target.closest('[role="dialog"]'))) {
          return
        }
        event.preventDefault()
      }
      document.addEventListener('mousedown', mousedownHandler)
    } else {
      removeDialogFromStack(cardGetter)
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
    disposed = true
    removeDialogFromStack(cardGetter)
    stopWatch()
    if (keydownHandler) toValue(cardRef)?.removeEventListener('keydown', keydownHandler)
    if (mousedownHandler) {
      document.removeEventListener('mousedown', mousedownHandler)
      mousedownHandler = null
    }
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus()
  })
}
