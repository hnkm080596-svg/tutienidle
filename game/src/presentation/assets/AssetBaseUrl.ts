/**
 * Single indirection for every static-asset URL the runtime requests.
 *
 * `VITE_ASSET_BASE_URL` (build-time env) may point asset traffic at an
 * external CDN (e.g. Cloudflare R2 public bucket). Empty/absent keeps the
 * historical behavior: same-origin paths under `public/assets/`.
 *
 * The CDN mirrors the `public/assets` directory layout, so resolution is a
 * plain prefix join - no per-file mapping table is maintained. Absolute
 * URLs (scheme, scheme-relative, data:, blob:) pass through untouched.
 */

const EXTERNAL_BASE = (import.meta.env.VITE_ASSET_BASE_URL ?? '').trim().replace(/\/+$/, '')

export function getAssetBaseUrl(): string {
  return EXTERNAL_BASE
}

export function resolveAssetUrl(path: string): string {
  if (!EXTERNAL_BASE) {
    return path
  }
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  return `${EXTERNAL_BASE}/${path.replace(/^\/+/, '')}`
}
