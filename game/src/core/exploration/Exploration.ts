export interface Exploration {
  id: string

  name: string

  description: string

  /**
   * Thời gian cần để hoàn thành
   * một lượt thám hiểm.
   *
   * Đơn vị: giây
   */
  duration: number

  /**
   * Số lượt tối đa có thể
   * hoàn thành liên tục.
   *
   * Ví dụ:
   * maxRuns = 10
   *
   * Sau khi offline đủ lâu,
   * tối đa chỉ nhận 10 lượt.
   */
  maxRuns: number

  enabled: boolean

  // Vùng thám hiểm (MASTER SPEC Mục IV/V — vd 'fire_region',
  // 'ice_region') — thuần flavor/UI, không bắt buộc.
  region?: string
}