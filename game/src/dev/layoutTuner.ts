// Dev-only layout tuner: press ` (backquote) to toggle. While ON, titles and
// dividers show a dashed outline and can be dragged; on drop the final
// top/left is logged to the console and copied to the clipboard so the
// values can be baked into CSS afterwards.

import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'

const DRAGGABLE_SELECTORS = [
  '.cf-head-title h1',
  '.skill-head h1',
  '.equipment-heading__title h1',
  '.body-heading__col h1',
  '.zone-title',
  '.inventory-title',
  '.quest-title',
  '.settings-title',
  '.realm-paper h1',
  '.alchemy-scene .title',
  '.technique-paper h1',
] as const

const SELECTOR = DRAGGABLE_SELECTORS.join(',')
let active = false
let hintEl: HTMLDivElement | null = null
let styleEl: HTMLStyleElement | null = null

function describe(el: Element): string {
  for (const sel of DRAGGABLE_SELECTORS) {
    if (el.matches(sel)) return sel
  }
  const cls = (el.getAttribute('class') || '').trim().split(/\s+/).join('.')
  return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`
}

function report(el: HTMLElement): void {
  const cs = getComputedStyle(el)
  const out = {
    selector: describe(el),
    position: cs.position,
    top: cs.top,
    left: cs.left,
  }
  const text = JSON.stringify(out)
  console.log('[layout-tuner]', text)
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {})
}

function onPointerDown(ev: PointerEvent): void {
  if (!active) return
  const target = ev.target as HTMLElement | null
  const el = target?.closest(SELECTOR) as HTMLElement | null
  if (!el) return
  ev.preventDefault()
  ev.stopPropagation()

  const startX = ev.clientX
  const startY = ev.clientY
  const cs = getComputedStyle(el)
  if (cs.position !== 'absolute' && cs.position !== 'fixed') {
    el.style.position = 'relative'
  }
  const baseTop = parseFloat(cs.top) || 0
  const baseLeft = parseFloat(cs.left) || 0

  const move = (e: PointerEvent) => {
    el.style.top = `${baseTop + e.clientY - startY}px`
    el.style.left = `${baseLeft + e.clientX - startX}px`
  }
  const up = () => {
    window.removeEventListener('pointermove', move, true)
    window.removeEventListener('pointerup', up, true)
    report(el)
  }
  window.addEventListener('pointermove', move, true)
  window.addEventListener('pointerup', up, true)
}

function toggle(): void {
  active = !active
  document.body.classList.toggle('layout-tuner-on', active)
  if (active) {
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.textContent =
        `body.layout-tuner-on ${SELECTOR}{cursor:grab;outline:1px dashed rgba(240,200,90,.85);outline-offset:2px}`
      document.head.appendChild(styleEl)
    }
    if (!hintEl) {
      hintEl = document.createElement('div')
      hintEl.textContent = 'LAYOUT MODE — kéo title/divider, ` để tắt'
      hintEl.style.cssText =
        `position:fixed;top:8px;right:12px;z-index:${OVERLAY_LAYERS.tooltip};background:#241c10;color:#f0d28a;` +
        'font:12px monospace;padding:6px 10px;border:1px solid #a9884c;border-radius:3px;pointer-events:none'
      document.body.appendChild(hintEl)
    }
  } else if (hintEl) {
    hintEl.remove()
    hintEl = null
  }
}

export function installLayoutTuner(): void {
  window.addEventListener('keydown', (ev) => {
    if (ev.key === '`' && !ev.repeat) toggle()
  })
  window.addEventListener('pointerdown', onPointerDown, true)
}
