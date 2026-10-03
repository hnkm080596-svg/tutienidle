import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const art = (name: string) => resolveAssetUrl(`/assets/ui/huyen-kim/scene/login-v2/${name}.png`)

export const LOGIN_ART = {
  panel: art('scroll-panel'),
  wordmark: art('wordmark'),
  cultivator: art('cultivator'),
  button: art('jade-button'),
} as const
