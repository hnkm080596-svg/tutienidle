/** Cultivation income is always active; only the visual pose follows combat. */
export function isCultivationPoseActive(isFighting: boolean): boolean {
  return !isFighting
}
