// Turn-Based Combat Foundation (spec Phần 5) — Momentum gain vẫn theo sự
// kiện (đòn trúng, không đổi). Decay đổi từ "mỗi giây thực" sang "mỗi lần
// đến lượt mà KHÔNG đánh trúng kể từ lượt trước". Break đổi từ "N giây"
// sang "N lượt".
export interface MomentumState {
  stack: number
  breakTurnsRemaining: number
}

export function onHitLanded(state: MomentumState, gain: number): MomentumState {
  return { ...state, stack: Math.max(0, state.stack + gain) }
}

export function onTurnStartWithoutHit(state: MomentumState, decay: number): MomentumState {
  return { ...state, stack: Math.max(0, state.stack - decay) }
}

export function checkBreakThreshold(
  state: MomentumState,
  threshold: number,
  breakDurationTurns: number,
): MomentumState {
  if (state.stack < threshold) {
    return state
  }

  return { stack: 0, breakTurnsRemaining: breakDurationTurns }
}

export function tickBreakOnTurnStart(state: MomentumState): MomentumState {
  if (state.breakTurnsRemaining <= 0) {
    return state
  }

  return { ...state, breakTurnsRemaining: state.breakTurnsRemaining - 1 }
}

export function isBroken(state: MomentumState): boolean {
  return state.breakTurnsRemaining > 0
}
