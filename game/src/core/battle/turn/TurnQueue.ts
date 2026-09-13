// Turn-Based Combat Foundation (spec Phần 3) — vòng lặp step tìm actor kế
// tiếp đến lượt. priority chỉ dùng khi speed bằng nhau tuyệt đối (spec:
// player > ally theo slot > enemy theo spawn — caller truyền priority
// theo đúng thứ tự đó, số nhỏ hơn = ưu tiên cao hơn).
import { advanceGauge, isGaugeReady, type GaugeActor } from './ActionGauge'

export interface TurnQueueActor extends GaugeActor {
  priority: number
}

export interface ResolvedTurn<T extends TurnQueueActor> {
  actor: T
  steps: number
}

const STEP_RATE = 1

// Chặn vòng lặp vô hạn nếu mọi actor còn sống đều có speed <= 0.
const MAX_STEPS = 100_000

export function resolveNextTurn<T extends TurnQueueActor>(actors: T[]): ResolvedTurn<T> | null {
  const living = actors.filter((actor) => actor.alive)
  if (living.length === 0) {
    return null
  }

  for (let steps = 1; steps <= MAX_STEPS; steps++) {
    for (const actor of living) {
      advanceGauge(actor, STEP_RATE)
    }

    const ready = living.filter(isGaugeReady)
    if (ready.length === 0) {
      continue
    }

    ready.sort((a, b) => {
      if (a.speed !== b.speed) {
        return b.speed - a.speed
      }
      return a.priority - b.priority
    })

    return { actor: ready[0]!, steps }
  }

  return null
}
