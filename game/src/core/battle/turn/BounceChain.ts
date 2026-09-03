// Turn-Based Combat Foundation (spec Phần 4) — thay Projectile Bounce cũ:
// không còn vật lý di chuyển, resolve toàn bộ chuỗi nảy tức thời trong 1
// lần gọi. Không tìm được mục tiêu hợp lệ thì DỪNG SỚM, không phải lỗi.
import { getChebyshevDistance, type GridPosition } from '../BattleGrid'

export interface BounceCandidate {
  id: string
  position: GridPosition
  alive: boolean
}

export function resolveBounceChain(
  candidates: BounceCandidate[],
  startTargetId: string,
  bounceArea: number,
  bounceCount: number,
): string[] {
  const chain: string[] = [startTargetId]
  const visited = new Set<string>([startTargetId])
  let currentId = startTargetId

  for (let hop = 0; hop < bounceCount; hop++) {
    const current = candidates.find((candidate) => candidate.id === currentId)
    if (!current) {
      break
    }

    const next = candidates
      .filter((candidate) => candidate.alive && !visited.has(candidate.id))
      .filter(
        (candidate) => getChebyshevDistance(current.position, candidate.position) <= bounceArea,
      )
      .sort(
        (a, b) =>
          getChebyshevDistance(current.position, a.position) -
          getChebyshevDistance(current.position, b.position),
      )[0]

    if (!next) {
      break
    }

    chain.push(next.id)
    visited.add(next.id)
    currentId = next.id
  }

  return chain
}
