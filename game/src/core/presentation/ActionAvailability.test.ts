import { describe, expect, it } from 'vitest'
import { i18n } from '../../i18n'
import {
  ACTION_FAILURE_FALLBACK_KEY,
  ACTION_FAILURE_KEYS,
  ACTION_FAILURE_UNKNOWN_KEY,
  actionFailureKey,
} from './ActionAvailability'

function t(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(key)
}

describe('actionFailureKey', () => {
  it('mọi reason trong mapping có key actionFailure.<reason>', () => {
    for (const [reason, key] of Object.entries(ACTION_FAILURE_KEYS)) {
      expect(key).toBe(`actionFailure.${reason}`)
    }
  })

  it('mọi key resolve được qua locale (không trả raw key — không lọt codename ra UI)', () => {
    for (const key of Object.values(ACTION_FAILURE_KEYS)) {
      expect(t(key)).not.toBe(key)
    }
  })

  it('fallback keys tồn tại + resolve được', () => {
    expect(t(ACTION_FAILURE_FALLBACK_KEY)).not.toBe(ACTION_FAILURE_FALLBACK_KEY)
    expect(t(ACTION_FAILURE_UNKNOWN_KEY)).not.toBe(ACTION_FAILURE_UNKNOWN_KEY)
  })

  it('reason lạ → unknown key; không có reason → null (caller tự chọn fallback)', () => {
    expect(actionFailureKey('reason_khong_ton_tai')).toBe(ACTION_FAILURE_UNKNOWN_KEY)
    expect(actionFailureKey(undefined)).toBeNull()
    expect(actionFailureKey('')).toBeNull()
  })

  it('dịch invalid_random_roll thành lỗi dữ liệu thay vì lộ fallback chung (vi giữ nguyên thông điệp cũ)', () => {
    expect(t(actionFailureKey('invalid_random_roll')!)).toBe(
      'Kết quả ngẫu nhiên không hợp lệ — Tinh Luyện chưa tiêu hao tài nguyên.',
    )
  })
})
