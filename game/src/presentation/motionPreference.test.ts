// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { prefersReducedMotion, setReducedMotionSetting } from './motionPreference'
it('applies a persisted UI override while continuing to respect the OS preference', () => {
  let osReduced = false
  vi.stubGlobal('matchMedia', () => ({ matches: osReduced }))
  try {
    setReducedMotionSetting(true)
    expect(prefersReducedMotion()).toBe(true)
    expect(document.documentElement.dataset.reducedMotion).toBe('true')
    expect(localStorage.getItem('tutien-reduced-motion')).toBe('true')
    setReducedMotionSetting(false)
    expect(document.documentElement.dataset.reducedMotion).toBe('false')
    expect(prefersReducedMotion()).toBe(false)
    osReduced = true
    expect(prefersReducedMotion()).toBe(true)
  } finally { setReducedMotionSetting(false); vi.unstubAllGlobals() }
})
