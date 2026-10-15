// Scene owns ready requests; the line reports only completed visual travel.
let views = 0
const requests = new Map<string, { token: string; complete: boolean }>()
const hiddenSummons = new Set<string>()
export function setInitiativeSummoned(id: string, visible: boolean): void { if (visible) hiddenSummons.delete(id); else hiddenSummons.add(id) }
export function isInitiativeSummoned(id: string): boolean { return !hiddenSummons.has(id) }
export function resetInitiativeSummons(): void { hiddenSummons.clear() }
export function mountInitiativeView(): () => void {
  views++
  return () => { views = Math.max(0, views - 1); if (!views) requests.clear() }
}
export function hasInitiativeView(): boolean { return views > 0 }
export function beginInitiativeReady(actorId: string, token: string): void { requests.set(actorId, { token, complete: false }) }
export function isInitiativeReadyRequested(actorId: string): boolean { return requests.has(actorId) }
export function reportInitiativeTravel(actorId: string, percent: number): void {
  const request = requests.get(actorId)
  if (request && percent >= 100) request.complete = true
}
export function consumeInitiativeReady(actorId: string, token: string): boolean {
  const request = requests.get(actorId)
  if (!request || request.token !== token || !request.complete) return false
  requests.delete(actorId)
  return true
}
export function cancelInitiativeReady(actorId: string, token: string): void {
  if (requests.get(actorId)?.token === token) requests.delete(actorId)
}
