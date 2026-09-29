// screenShakePolicy.test.ts - W10 reduced-shake gate.
import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  REDUCED_SHAKE_SCALE,
  applyScreenShake,
  isReducedShakeEnabled,
  screenShakeScale,
  setReducedShakeEnabled,
} from './screenShakePolicy'

function fakeCamera() {
  return { shake: vi.fn() }
}

beforeEach(() => {
  setReducedShakeEnabled(false)
})

describe('screenShakePolicy', () => {
  it('defaults to full intensity', () => {
    expect(screenShakeScale()).toBe(1)
    expect(isReducedShakeEnabled()).toBe(false)
  })

  it('scales intensity by REDUCED_SHAKE_SCALE when enabled', () => {
    const camera = fakeCamera()
    setReducedShakeEnabled(true)
    applyScreenShake(camera, 160, 0.012)
    expect(camera.shake).toHaveBeenCalledWith(160, 0.012 * REDUCED_SHAKE_SCALE, false)
  })

  it('passes force through untouched', () => {
    const camera = fakeCamera()
    setReducedShakeEnabled(true)
    applyScreenShake(camera, 200, 0.01, true)
    expect(camera.shake).toHaveBeenCalledWith(200, 0.01 * REDUCED_SHAKE_SCALE, true)
  })

  it('disabled flag restores full intensity', () => {
    const camera = fakeCamera()
    setReducedShakeEnabled(true)
    setReducedShakeEnabled(false)
    applyScreenShake(camera, 100, 0.02)
    expect(camera.shake).toHaveBeenCalledWith(100, 0.02, false)
  })
})
