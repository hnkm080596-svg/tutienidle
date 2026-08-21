export interface GameClockState {
  /**
   * Timestamp thực tế lần cuối
   * game được cập nhật / lưu trạng thái.
   *
   * Unix timestamp milliseconds.
   */
  lastOnlineAt: number
}

export interface GameClockUpdate {
  /**
   * Thời gian hiện tại.
   */
  currentTime: number

  /**
   * Thời gian đã trôi qua kể từ lần update trước.
   *
   * Đơn vị: giây.
   */
  deltaSeconds: number
}

export interface OfflineTimeResult {
  /**
   * Timestamp lúc offline bắt đầu.
   */
  lastOnlineAt: number

  /**
   * Timestamp hiện tại.
   */
  currentTime: number

  /**
   * Tổng thời gian offline.
   *
   * Đơn vị: giây.
   */
  offlineSeconds: number
}

export const DEFAULT_MAX_OFFLINE_SECONDS = 24 * 60 * 60

/**
 * Tính thời gian offline (đã clamp theo maxOfflineSeconds).
 *
 * Đây là NGUỒN DUY NHẤT cho việc tính offline-seconds trong
 * toàn bộ game. GameClock (instance) và bất kỳ nơi nào khác
 * cần tính offline (ví dụ: store lúc load save) đều gọi hàm
 * thuần này, để tránh 2 nơi tự tính elapsed time theo 2 kiểu
 * khác nhau và bị lệch nhau.
 *
 * Hàm thuần, không cần khởi tạo GameClock instance.
 */
export function calculateOfflineTime(
  state: GameClockState,
  timestamp = Date.now(),
  maxOfflineSeconds = DEFAULT_MAX_OFFLINE_SECONDS,
): OfflineTimeResult {
  const currentTime = Math.max(state.lastOnlineAt, timestamp)

  const elapsedMilliseconds = currentTime - state.lastOnlineAt

  const elapsedSeconds = elapsedMilliseconds / 1000

  const offlineSeconds = Math.min(Math.max(0, elapsedSeconds), Math.max(0, maxOfflineSeconds))

  return {
    lastOnlineAt: state.lastOnlineAt,

    currentTime,

    offlineSeconds,
  }
}

export class GameClock {
  private currentTime: number

  private previousTime: number

  private running = false

  /**
   * Thời gian offline tối đa được tính.
   *
   * Ví dụ:
   * 24 giờ = 86400 giây
   */
  private maxOfflineSeconds: number

  constructor(maxOfflineSeconds = DEFAULT_MAX_OFFLINE_SECONDS) {
    const now = Date.now()

    this.currentTime = now

    this.previousTime = now

    this.maxOfflineSeconds = Math.max(0, maxOfflineSeconds)
  }

  /**
   * Bắt đầu GameClock.
   */
  start(timestamp = Date.now()): void {
    this.currentTime = timestamp

    this.previousTime = timestamp

    this.running = true
  }

  /**
   * Dừng GameClock.
   */
  stop(): void {
    this.running = false
  }

  /**
   * GameClock có đang chạy không.
   */
  isRunning(): boolean {
    return this.running
  }

  /**
   * Cập nhật thời gian game.
   *
   * Hàm này nên được gọi bởi game loop.
   *
   * Ví dụ:
   *
   * clock.update()
   *
   * hoặc:
   *
   * const result = clock.update()
   */
  update(timestamp = Date.now()): GameClockUpdate {
    if (!this.running) {
      return {
        currentTime: this.currentTime,

        deltaSeconds: 0,
      }
    }

    this.previousTime = this.currentTime

    this.currentTime = Math.max(this.previousTime, timestamp)

    const deltaMilliseconds = this.currentTime - this.previousTime

    const deltaSeconds = deltaMilliseconds / 1000

    return {
      currentTime: this.currentTime,

      deltaSeconds,
    }
  }

  /**
   * Timestamp hiện tại.
   */
  now(): number {
    return this.currentTime
  }

  /**
   * Thời gian hiện tại tính bằng giây.
   */
  nowSeconds(): number {
    return this.currentTime / 1000
  }

  /**
   * Tạo state để SaveSystem lưu.
   */
  createState(): GameClockState {
    return {
      lastOnlineAt: this.currentTime,
    }
  }

  /**
   * Tính thời gian đã offline từ một GameClockState đã lưu.
   *
   * Hàm này KHÔNG thay đổi clock. Ủy quyền cho hàm thuần
   * calculateOfflineTime() để đảm bảo chỉ có một chỗ chứa logic này.
   */
  calculateOfflineTime(state: GameClockState, timestamp = Date.now()): OfflineTimeResult {
    return calculateOfflineTime(state, timestamp, this.maxOfflineSeconds)
  }

  /**
   * Đặt lại clock sau khi load game.
   */
  restore(timestamp: number): void {
    this.currentTime = timestamp

    this.previousTime = timestamp
  }

  /**
   * Thay đổi giới hạn offline.
   */
  setMaxOfflineSeconds(seconds: number): void {
    this.maxOfflineSeconds = Math.max(0, seconds)
  }

  /**
   * Lấy giới hạn offline hiện tại.
   */
  getMaxOfflineSeconds(): number {
    return this.maxOfflineSeconds
  }
}
