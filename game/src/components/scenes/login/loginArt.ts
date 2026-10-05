import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const art = (name: string) => resolveAssetUrl(`/assets/ui/huyen-kim/scene/login-v2/${name}.png`)

export const LOGIN_ART = {
  panel: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/panel-frame-v2.png'),
  wordmark: art('wordmark'),
  cultivator: art('cultivator'),
  button: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/button-primary.png'),
} as const
