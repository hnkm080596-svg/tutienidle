import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

// Controls art pack (tien-hiep-2026-10): single resolver so every common
// art primitive and preview mock resolves pack assets the same way.
export const equipmentArtRoot = '/assets/ui/tien-hiep-2026-10/controls/'
export function equipmentArt(name: string): string {
  return resolveAssetUrl(`${equipmentArtRoot}${name}.png`)
}
