import { resolveAssetUrl } from './AssetBaseUrl'
import { pcPaperControlStyles } from './PcPaperControls'

const SKIN_ART = {
  "navigation-rail": "/assets/ui/tien-hiep-2026-10/runtime/navigation-rail.png",
  "section-header": "/assets/ui/tien-hiep-2026-10/runtime/section-header.png",
  "power-ribbon": "/assets/ui/tien-hiep-2026-10/runtime/power-ribbon.png",
  "slot-frame": "/assets/ui/tien-hiep-2026-10/runtime/slot-frame.png",
  "orb-frame": "/assets/ui/tien-hiep-2026-10/runtime/orb-frame.png",
  "title-plaque": "/assets/ui/tien-hiep-2026-10/runtime/title-plaque.png",
  "paper-panel": "/assets/ui/tien-hiep-2026-10/runtime/paper-panel.png",
  "button-primary": "/assets/ui/tien-hiep-2026-10/runtime/button-primary.png",
  "building-plaque": "/assets/ui/tien-hiep-2026-10/runtime/building-plaque.png",
  "resource-pill-1x": "/assets/ui/tien-hiep-2026-10/runtime/resource-pill@1x.png",
  "identity-plate-1x": "/assets/ui/tien-hiep-2026-10/runtime/identity-plate@1x.png",
  "paper-surface": "/assets/ui/tien-hiep-2026-10/runtime/paper-surface.png",
  "panel-frame-v2": "/assets/ui/tien-hiep-2026-10/runtime/panel-frame-v2.png",
  "world-vista": "/assets/ui/tien-hiep-2026-10/source/world-vista.png",
  "world-vista-warm": "/assets/ui/tien-hiep-2026-10/source/world-vista-warm-v1.png",
  "warm-landscape-header": "/assets/ui/tien-hiep-2026-10/source/warm-landscape-header-v1.png",
  "warm-branch-corner": "/assets/ui/tien-hiep-2026-10/source/warm-branch-corner-v1.png",
} as const

/** Resolve presentation CSS art through the same CDN owner as Vue images. */
export function installTienHiepUiAssets(root: HTMLElement): void {
  for (const [name, value] of Object.entries(pcPaperControlStyles())) root.style.setProperty(name, value)
  for (const [name, url] of Object.entries(SKIN_ART)) {
    root.style.setProperty(`--th-art-${name}`, `url(${JSON.stringify(resolveAssetUrl(url))})`)
  }
}
