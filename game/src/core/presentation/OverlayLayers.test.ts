import { describe, expect, it } from 'vitest'
import { OVERLAY_LAYERS } from './OverlayLayers'

// The stacking scale is the single owner of app-root z-order (A2). These
// pins encode the contract the scale documents: transient surfaces stay
// visible above the panels they report on, blocking surfaces outrank
// transient ones, and the presentation curtain covers everything while
// closed.
describe('OVERLAY_LAYERS stacking contract', () => {
  it('toast renders above full-screen panels and announcements (in-panel feedback stays visible)', () => {
    expect(OVERLAY_LAYERS.toast).toBeGreaterThan(OVERLAY_LAYERS.panel)
    expect(OVERLAY_LAYERS.toast).toBeGreaterThan(OVERLAY_LAYERS.announcement)
  })

  it('blocking surfaces outrank transient ones (modal above toast, save gate above panel)', () => {
    expect(OVERLAY_LAYERS.modal).toBeGreaterThan(OVERLAY_LAYERS.toast)
    expect(OVERLAY_LAYERS.saveGate).toBeGreaterThan(OVERLAY_LAYERS.panel)
    expect(OVERLAY_LAYERS.appError).toBeGreaterThan(OVERLAY_LAYERS.panel)
  })

  it('curtain is topmost by contract - no layer may outrank it while closed', () => {
    for (const [key, layer] of Object.entries(OVERLAY_LAYERS)) {
      expect(OVERLAY_LAYERS.curtain, `curtain must stay at-or-above '${key}'`).toBeGreaterThanOrEqual(layer)
    }
  })
})
