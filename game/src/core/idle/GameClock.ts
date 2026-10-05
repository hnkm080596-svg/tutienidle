export interface GameClockState {
  /**
   * Timestamp thuc te lan cuoi
   * game duoc cap nhat / luu trang thai.
   *
   * Unix timestamp milliseconds.
   */
  lastOnlineAt: number
}

export interface GameClockUpdate {
  /**
   * Thoi gian hien tai.
   */
  currentTime: number

  /**
   * Thoi gian da troi qua ke tu lan update truoc.
   *
   * Don vi: giay.
   */
  deltaSeconds: number
}

export interface OfflineTimeResult {
  /**
   * Timestamp luc offline bat dau.
   */
  lastOnlineAt: number

  /**
   * Timestamp hien tai.
   */
  currentTime: number

  /**
   * Tong thoi gian offline.
   *
   * Don vi: giay.
   */
  offlineSeconds: number
}

export const DEFAULT_MAX_OFFLINE_SECONDS = 24 * 60 * 60

// Minh ruling 2026-10-05 (reward-channels worker, "offline 50%"):
// offline accrual pays HALF the live autofarm rate. The auto-farm
// offline settle multiplies its eligible window by this factor BEFORE
// flooring into reward cycles, so every channel the cycle mints
// (stones/materials/mastery/insight) is halved uniformly and the
// unsettled remainder also carries at half value into the next live
// tick. Online tickAutoFarm is unaffected.
// r10-AUT: scoped name - the ruling covers the AUTO-FARM channel
// only. Cultivation/production/decompose offline settles do NOT read
// this; importing it into another channel silently halves a flow Minh
// did not rate.
export const AUTO_FARM_OFFLINE_EFFICIENCY = 0.5

const UTC_DAY_MS = 24 * 60 * 60 * 1000

/** Canonical UTC day-bucket for daily-reset surfaces (r10-AUT shared
 *  convention - quest daily reset and the idle insight ledger must
 *  agree on the same boundary or their resets drift apart). */
export function utcDayBucket(ms: number): number {
  return Math.floor(ms / UTC_DAY_MS)
}

/**
 * Tinh thoi gian offline (da clamp theo maxOfflineSeconds).
 *
 * Day la NGUON DUY NHAT cho viec tinh offline-seconds trong
 * toan bo game. GameClock (instance) va bat ky noi nao khac
 * can tinh offline (vi du: store luc load save) deu goi ham
 * thuan nay, de tranh 2 noi tu tinh elapsed time theo 2 kieu
 * khac nhau va bi lech nhau.
 *
 * Ham thuan, khong can khoi tao GameClock instance.
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
   * Thoi gian offline toi da duoc tinh.
   *
   * Vi du:
   * 24 gio = 86400 giay
   */
  private maxOfflineSeconds: number

  constructor(maxOfflineSeconds = DEFAULT_MAX_OFFLINE_SECONDS) {
    const now = Date.now()

    this.currentTime = now

    this.previousTime = now

    this.maxOfflineSeconds = Math.max(0, maxOfflineSeconds)
  }

  /**
   * Bat dau GameClock.
   */
  start(timestamp = Date.now()): void {
    this.currentTime = timestamp

    this.previousTime = timestamp

    this.running = true
  }

  /**
   * Dung GameClock.
   */
  stop(): void {
    this.running = false
  }

  /**
   * GameClock co dang chay khong.
   */
  isRunning(): boolean {
    return this.running
  }

  /**
   * Cap nhat thoi gian game.
   *
   * Ham nay nen duoc goi boi game loop.
   *
   * Vi du:
   *
   * clock.update()
   *
   * hoac:
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
   * Timestamp hien tai.
   */
  now(): number {
    return this.currentTime
  }

  /**
   * Thoi gian hien tai tinh bang giay.
   */
  nowSeconds(): number {
    return this.currentTime / 1000
  }

  /**
   * Tao state de SaveSystem luu.
   */
  createState(): GameClockState {
    return {
      lastOnlineAt: this.currentTime,
    }
  }

  /**
   * Tinh thoi gian da offline tu mot GameClockState da luu.
   *
   * Ham nay KHONG thay doi clock. Uy quyen cho ham thuan
   * calculateOfflineTime() de dam bao chi co mot cho chua logic nay.
   */
  calculateOfflineTime(state: GameClockState, timestamp = Date.now()): OfflineTimeResult {
    return calculateOfflineTime(state, timestamp, this.maxOfflineSeconds)
  }

  /**
   * Dat lai clock sau khi load game.
   */
  restore(timestamp: number): void {
    this.currentTime = timestamp

    this.previousTime = timestamp
  }

  /**
   * Thay doi gioi han offline.
   */
  setMaxOfflineSeconds(seconds: number): void {
    this.maxOfflineSeconds = Math.max(0, seconds)
  }

  /**
   * Lay gioi han offline hien tai.
   */
  getMaxOfflineSeconds(): number {
    return this.maxOfflineSeconds
  }
}
