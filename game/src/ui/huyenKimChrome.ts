import rawManifest from './huyen-kim-chrome.json'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

/**
 * Huyen Kim Son Thuy chrome slot registry (spec 44/spec 52).
 *
 * Every slot ships in one of two states:
 *   'pending' - Minh's art has not landed yet; consumers MUST render the
 *               CSS/token fallback and MUST NOT attempt to fetch a file.
 *   'ready'   - PNG exists at url1x/url2x; consumers may nine-slice it.
 *
 * Flipping a slot to 'ready' is a manifest-only change - no code edits
 * needed when an art drop lands. Tests (`huyenKimChrome.test.ts`)
 * validate manifest shape and that ready slots point at real files.
 */

export type HuyenKimChromeStatus = 'pending' | 'ready'
export type HuyenKimCenterMode = 'transparent' | 'fill' | 'stretch'

export interface HuyenKimChromeAsset {
  id: string
  role: string
  status: HuyenKimChromeStatus
  url1x: string
  url2x: string
  sourceWidth: number
  sourceHeight: number
  slices: { left: number; right: number; top: number; bottom: number }
  center: HuyenKimCenterMode
  edgeMode: 'stretch' | 'tile'
  tintable: boolean
  minimumWidth: number
  minimumHeight: number
}

interface RawAsset extends Omit<HuyenKimChromeAsset, 'status'> {
  status: string
}

const assets = (rawManifest.assets as RawAsset[]).map((a) => ({
  ...a,
  status: a.status as HuyenKimChromeStatus,
}))

export const HUYEN_KIM_CHROME: Readonly<Record<string, HuyenKimChromeAsset>> =
  Object.freeze(
    Object.fromEntries(
      assets.map((a) => [
        a.id,
        Object.freeze({ ...a, url1x: resolveAssetUrl(a.url1x), url2x: resolveAssetUrl(a.url2x) }),
      ]),
    ),
  )

export type HuyenKimChromeId = keyof typeof HUYEN_KIM_CHROME

/** Slice URL set when the slot is ready; null while pending (CSS fallback). */
export function chromeSlice(id: string): { url1x: string; url2x: string; slices: HuyenKimChromeAsset['slices'] } | null {
  const a = HUYEN_KIM_CHROME[id]
  if (!a || a.status !== 'ready') return null
  return { url1x: a.url1x, url2x: a.url2x, slices: a.slices }
}

/** All ids still awaiting Minh's art - drives the drawing-spec checklist. */
export function pendingChromeIds(): string[] {
  return assets.filter((a) => a.status === 'pending').map((a) => a.id)
}
