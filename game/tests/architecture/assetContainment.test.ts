/**
 * R14.6a guard — asset containment (roadmap R14 "asset destination must
 * remain under asset root", A10 canonical catalog).
 *
 * Regression classes protected:
 * - A runtime asset URL that escapes `assets/` (path traversal, absolute
 *   filesystem path, URL scheme, or a `public/` prefix that 404s at serve
 *   time) — checked across every AssetBundleCatalog descriptor AND every
 *   literal `load.*` URL argument in production source.
 * - `scripts/route-assets.mjs` derives destinations from EXTERNAL filenames
 *   (`name__sub.png` -> `public/assets/name/sub.png`). A `..` segment (or a
 *   crafted absolute segment) escapes the asset root. The script must
 *   resolve each destination and verify containment before moving it.
 * - Asset-pipeline script write destinations must derive from the declared
 *   roots: `public/assets` (runtime art), `art-source` (source art staging),
 *   `src/assets` (source manifests). A new root constant pointing elsewhere
 *   fails here until reviewed.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readTs, srcCorpus, SCAN_TIMEOUT } from './helpers/scanTs'
import { enumerateResources } from '@/presentation/assets/AssetBundleCatalog'

const GAME_ROOT = process.cwd()

/** Leading `/` and `public/` are the same public-dir asset at serve time. */
function normalizeAssetUrl(url: string): string {
  return url.replace(/^\/+/, '').replace(/^public\//, '')
}

function expectContainedAssetUrl(url: string, where: string): void {
  expect(url.startsWith('data:'), `${where}: data: URLs are not files`).toBe(false)
  expect(url.includes('://'), `${where}: scheme URL "${url}" is not a local asset`).toBe(false)
  expect(url.includes('\\'), `${where}: backslash in "${url}"`).toBe(false)
  const normalized = normalizeAssetUrl(url)
  expect(
    normalized === 'assets' || normalized.startsWith('assets/'),
    `${where}: "${url}" is outside the asset root`,
  ).toBe(true)
  expect(normalized.includes('..'), `${where}: traversal segment in "${url}"`).toBe(false)
}

describe('R14.6a — runtime asset URLs stay under assets/', () => {
  it('every AssetBundleCatalog descriptor URL resolves under assets/', () => {
    const descriptors = enumerateResources(['core-ui', 'home', 'combat', 'tribulation'])

    expect(descriptors.length).toBeGreaterThan(0)

    for (const d of descriptors) {
      const fields: Record<string, string | undefined> = {
        url: 'url' in d ? d.url : undefined,
        textureUrl: 'textureUrl' in d ? d.textureUrl : undefined,
        atlasUrl: 'atlasUrl' in d ? d.atlasUrl : undefined,
        jsonUrl: 'jsonUrl' in d ? d.jsonUrl : undefined,
        basePath: 'basePath' in d ? d.basePath : undefined,
      }

      for (const [field, value] of Object.entries(fields)) {
        if (value !== undefined) {
          expectContainedAssetUrl(value, `descriptor ${d.key}.${field}`)
        }
      }
    }
  })

  it('every literal load.* URL argument in production source stays under assets/', { timeout: SCAN_TIMEOUT }, () => {
    const corpus = srcCorpus(join(GAME_ROOT, 'src'))
    // Matches scene.load.image('key', 'url'...) style calls; only the
    // STRING-LITERAL url-ish arguments are checked — identifier args are
    // covered by the catalog-parity guard.
    const loadCall = /\.load\.(?:image|atlas|spritesheet|multiatlas|audio|json)\s*\(([^)]*)\)/g
    const literalArg = /'([^']+)'|"([^"]+)"/g

    for (const file of corpus) {
      for (const call of file.text.matchAll(loadCall)) {
        const args = call[1]!

        for (const literal of args.matchAll(literalArg)) {
          const value = literal[1] ?? literal[2]!

          // First arg is the texture KEY, not a path — only inspect args
          // that look like paths (contain a slash).
          if (!value.includes('/')) {
            continue
          }

          expectContainedAssetUrl(value, `${file.fromSrc} literal load arg`)
        }
      }
    }
  })
})

describe('R14.6a — asset-pipeline scripts cannot write outside declared roots', () => {
  const SCRIPTS_DIR = join(GAME_ROOT, 'scripts')
  // Markers that make a path constant an ASSET root. Quoted-segment form
  // ('public', 'assets') counts as well as literal 'public/assets'.
  const ASSET_ROOT_MARKERS = [
    'public/assets',
    `'public', 'assets'`,
    `"public", "assets"`,
    'art-source',
    'src/assets',
    'asset-drop',
  ]
  // Base path constants a script may define without being an asset root
  // (repo/script anchors the real roots derive from).
  const BASE_CONSTANTS = new Set(['GAME_ROOT', 'ROOT', 'SCRIPT_DIR', 'projectRoot'])

  function collectPathConstants(text: string): Map<string, string> {
    const defs = new Map<string, string>()
    const defRe = /const\s+(\w+)\s*=\s*(?:path\.|fs\.)?(?:resolve|join|dirname)\(([^;]*)\)/g

    for (const m of text.matchAll(defRe)) {
      defs.set(m[1]!, m[2]!)
    }

    return defs
  }

  function touchesAssetMarker(expr: string): boolean {
    return ASSET_ROOT_MARKERS.some((marker) => expr.includes(marker))
  }

  // A quoted `..` segment in the expr means "anchor up from the base
  // constant" — that escapes game/ and must not count as grounded.
  const DOTDOT_SEGMENT = /['"`]\.\./

  /** True when `expr` reaches an asset marker or a base constant. */
  function chainIsGrounded(defs: Map<string, string>, expr: string, depth = 0): boolean {
    if (depth > 6) {
      return false
    }

    if (touchesAssetMarker(expr)) {
      return true
    }

    for (const [name, def] of defs) {
      if (!new RegExp(`\\b${name}\\b`).test(expr)) {
        continue
      }

      if ((BASE_CONSTANTS.has(name) && !DOTDOT_SEGMENT.test(expr)) || chainIsGrounded(defs, def, depth + 1)) {
        return true
      }
    }

    return false
  }

  it('asset script path roots derive from declared asset roots', { timeout: SCAN_TIMEOUT }, () => {
    const scripts = readdirSync(SCRIPTS_DIR).filter(
      (name) => name.endsWith('.mjs') || name.endsWith('.cjs'),
    )
    // A path constant whose NAME says it is a destination/root.
    const rootishName = /ROOT|DIR|PATH|OUT|DEST/

    for (const name of scripts) {
      const text = readFileSync(join(SCRIPTS_DIR, name), 'utf8')

      // Only asset-pipeline scripts are in scope: a script that never
      // mentions the asset roots is not an asset writer (e.g. patch-*.cjs
      // source patchers are a different tool class).
      if (!ASSET_ROOT_MARKERS.some((marker) => text.includes(marker))) {
        continue
      }

      const defs = collectPathConstants(text)

      for (const [constName, defExpr] of defs) {
        if (BASE_CONSTANTS.has(constName) || !rootishName.test(constName)) {
          continue
        }

        expect(
          chainIsGrounded(defs, defExpr),
          `${name}: path constant ${constName} = (${defExpr.trim()}) does not derive from a declared asset root`,
        ).toBe(true)
      }
    }
  })

  it('route-assets.mjs verifies each externally-derived destination stays under DEST_ROOT', () => {
    const text = readTs(join(SCRIPTS_DIR, 'route-assets.mjs'))

    // relParts comes from the asset-drop FILENAME — `..__x.png` would
    // otherwise escape public/assets. Pin that a resolved containment check
    // guards the rename (reject `..`/absolute escapes before moving).
    expect(text).toMatch(/resolve\(DEST_ROOT/)
    expect(text).toMatch(/destPath/)
    expect(
      /(?:startsWith|relative)\([^)]*DEST_ROOT[^)]*\)|!.*startsWith\(/.test(text),
      'route-assets.mjs must contain a resolved-destination containment check against DEST_ROOT',
    ).toBe(true)
  })
})
