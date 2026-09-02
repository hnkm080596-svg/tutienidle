import { describe, expect, it } from 'vitest'
import { actionFailureLabel } from './ActionAvailability'

describe('actionFailureLabel', () => {
  it('dịch invalid_random_roll thành lỗi dữ liệu thay vì lộ fallback chung', () => {
    expect(actionFailureLabel('invalid_random_roll')).toBe(
      'Kết quả ngẫu nhiên không hợp lệ — Tinh Luyện chưa tiêu hao tài nguyên.',
    )
  })
})
