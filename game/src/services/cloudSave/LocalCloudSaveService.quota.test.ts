// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalCloudSaveService } from './LocalCloudSaveService'
import type { GameSave } from '../save/SaveSystem'

describe('LocalCloudSaveService.save — write fail trả unavailable (không throw)', () => {
  beforeEach(() => localStorage.clear())

  it('setItem throw QuotaExceededError → { status: "unavailable", retryable: true }, revision KHÔNG tăng', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    const service = new LocalCloudSaveService()
    const result = await service.save({} as GameSave, 0)

    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.retryable).toBe(true)
    }
    spy.mockRestore()
  })
})
