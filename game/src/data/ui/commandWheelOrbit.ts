export type CommandWheelOrbitDirection = 'clockwise' | 'counterclockwise'

/** Directions alternate from the inside out: CCW, CW, CCW, and so on. */
export function getCommandWheelOrbitDirection(orbitIndex: number): CommandWheelOrbitDirection {
  return orbitIndex % 2 === 0 ? 'counterclockwise' : 'clockwise'
}
