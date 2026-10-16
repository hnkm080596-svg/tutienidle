import type { ElementType } from '@/core/element/ElementType'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

export function techniqueCodexUrl(element: ElementType | null | undefined): string {
  const filename = element === 'fire' ? 'technique-fire-codex-v1.png' : 'technique-codex-v1.png'
  return resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/character-presentation/${filename}`)
}
