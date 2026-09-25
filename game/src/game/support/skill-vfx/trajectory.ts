export interface Point { readonly x: number; readonly y: number }
export interface FlightCurve { readonly p0: Point; readonly p1: Point; readonly p2: Point; readonly p3: Point }
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))

/** Cubic control points share a normal offset, giving a clean travelling tangent. */
export function makeFlightCurve(source: Point, target: Point, bend: number): FlightCurve {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const length = Math.hypot(dx, dy)
  const nx = length ? -dy / length * bend : 0
  const ny = length ? dx / length * bend : 0
  return {
    p0: { ...source }, p3: { ...target },
    p1: { x: source.x + dx / 3 + nx, y: source.y + dy / 3 + ny },
    p2: { x: source.x + dx * 2 / 3 + nx, y: source.y + dy * 2 / 3 + ny },
  }
}
export function sampleCurve(c: FlightCurve, progress: number): Point & { angle: number } {
  const t = clamp(progress)
  const u = 1 - t
  const dx = 3 * u * u * (c.p1.x - c.p0.x) + 6 * u * t * (c.p2.x - c.p1.x) + 3 * t * t * (c.p3.x - c.p2.x)
  const dy = 3 * u * u * (c.p1.y - c.p0.y) + 6 * u * t * (c.p2.y - c.p1.y) + 3 * t * t * (c.p3.y - c.p2.y)
  return {
    x: u ** 3 * c.p0.x + 3 * u * u * t * c.p1.x + 3 * u * t * t * c.p2.x + t ** 3 * c.p3.x,
    y: u ** 3 * c.p0.y + 3 * u * u * t * c.p1.y + 3 * u * t * t * c.p2.y + t ** 3 * c.p3.y,
    angle: Math.atan2(dy, dx),
  }
}
export function flightProgress(elapsedMs: number, releaseMs: number, cruiseMs: number, accelerationMs: number): number {
  if (elapsedMs <= releaseMs) return 0
  const flight = elapsedMs - releaseMs
  if (flight < cruiseMs) return 0.7 * clamp(flight / Math.max(1, cruiseMs))
  const acceleration = clamp((flight - cruiseMs) / Math.max(1, accelerationMs))
  return 0.7 + 0.3 * acceleration * acceleration
}
