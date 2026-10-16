import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const art = (name: string) => resolveAssetUrl(`/assets/ui/huyen-kim/scene/login-v2/${name}.png`)

export const LOGIN_ART = {
  panel: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/panel-frame-v2.png'),
  wordmark: art('wordmark'),
  backdrop: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/auth-opening/backdrop-clean-v1.png'),
  mortal: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/auth-opening/mortal-wind-strip-v1.png'),
  crane: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/auth-opening/crane-flight-strip-v1.png'),
  button: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/button-primary.png'),
} as const
