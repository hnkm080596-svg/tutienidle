import { GAUGE_MAX, type GaugeActor } from '@/core/battle/turn/ActionGauge'

/** Display-only linear travel: one full track per second at x1. */
export function advanceInitiativeDisplay(current: number, target: number, elapsedMs: number): number {
  const goal = Math.min(100, Math.max(0, Number.isFinite(target) ? target : 0))
  const position = Math.min(100, Math.max(0, Number.isFinite(current) ? current : 0))
  const step = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) / 10
  return position + Math.sign(goal - position) * Math.min(Math.abs(goal - position), step)
}

export interface InitiativeDisplayCycle { percent: number; previousTarget: number; finishing: boolean }
export function advanceInitiativeCycle(state: InitiativeDisplayCycle | undefined, target: number, elapsedMs: number): InitiativeDisplayCycle {
  const goal = Math.min(100, Math.max(0, Number.isFinite(target) ? target : 0))
  const current = state ?? { percent: 0, previousTarget: 0, finishing: false }
  if (current.finishing && current.percent === 100)
    return { percent: 0, previousTarget: goal, finishing: false }
  const finishing = current.finishing || goal < current.previousTarget
  return { percent: advanceInitiativeDisplay(current.percent, finishing ? 100 : goal, elapsedMs), previousTarget: goal, finishing }
}

export function initiativeGroups<T extends GaugeActor>(actors: readonly T[]): { percent: number; actors: T[] }[] {
  const groups = new Map<number, T[]>()
  for (const actor of actors) {
    if (!actor.alive) continue
    const percent = Number.isFinite(actor.actionGauge)
      ? Math.round(Math.min(100, Math.max(0, actor.actionGauge / GAUGE_MAX * 100))) : 0
    const group = groups.get(percent) ?? []
    group.push(actor)
    groups.set(percent, group)
  }
  return [...groups].sort(([a], [b]) => a - b).map(([percent, actors]) => ({ percent, actors }))
}
