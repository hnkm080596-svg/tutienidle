import { resolveAssetUrl } from './AssetBaseUrl'

export type PcPaperResource = 'jade' | 'coin' | 'crystal' | 'essence'
export function pcPaperResourceUrl(resource: PcPaperResource): string {
  return resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/controls/resource-${resource}-v1.png`)
}

export function pcPaperControlStyles(): Record<string, string> {
  const root = '/assets/ui/tien-hiep-2026-10/controls/'
  return {
    '--pc-slot-art': `url('${resolveAssetUrl(root + 'item-slot-v1.png')}')`,
    '--pc-primary-button': `url('${resolveAssetUrl(root + 'button-primary-v1.png')}')`,
    '--pc-secondary-button': `url('${resolveAssetUrl(root + 'button-secondary-v1.png')}')`,
    '--pc-inspector-art': `url('${resolveAssetUrl(root + 'inspector-v1.png')}')`,
  }
}
