import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

// Dialog art pack (tien-hiep-2026-10/dialog): whole-component slices cut
// from the owner's ornate-ui-sheet (docs/art-ref/ornate-ui-sheet.png).
// Single resolver shared by every ornate dialog chrome primitive - same
// convention as equipmentArt; the art is rendered contain, never stretched.
export const dialogArtRoot = '/assets/ui/tien-hiep-2026-10/dialog/'
export function dialogArt(name: string): string {
  return resolveAssetUrl(`${dialogArtRoot}${name}.png`)
}
