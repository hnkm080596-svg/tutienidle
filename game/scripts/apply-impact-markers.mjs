// Impact-marker applier (impact-sync): injects art/animation-impact-markers.json
// values into the already-packed manifests as `impactFrameIndex` - the exact
// field pack-character-art.mjs / pack-enemy-art.mjs emit on a full repack.
// Same validation rules live in scripts/lib/impact-markers.mjs.
//
// Needed when the raw NEWSPRITE dumps are not on hand: the markers live in
// this repo, so re-injecting them into committed manifests keeps the
// manifest the generated artifact while the JSON stays the authoring surface.
// Entries whose marker was removed from the JSON are cleared, so the manifest
// can never carry a stale marker the authoring surface no longer owns.
//
// Usage: node scripts/apply-impact-markers.mjs [--dry-run] [--markers <json>]
//   --markers overrides the marker file (validation-fixture hooks for tests).
import { readFileSync, writeFileSync } from 'node:fs'
import {
  MARKERS_PATH,
  loadImpactMarkers,
  assertMarkerInRange,
  assertKnownMarkerClips,
  assertKnownMarkerVariants,
} from './lib/impact-markers.mjs'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const markersFlag = args.indexOf('--markers')
if (markersFlag >= 0 && (markersFlag + 1 >= args.length || args[markersFlag + 1].startsWith('--'))) {
  throw new Error("--markers requires a <json> path value")
}
const markersPath = markersFlag >= 0 ? args[markersFlag + 1] : undefined
const MARKERS = loadImpactMarkers(markersPath ?? new URL(`../${MARKERS_PATH}`, import.meta.url))

const TARGETS = [
  { manifest: 'public/assets/characters/animated/manifest.json', table: MARKERS.characters ?? {}, label: 'character' },
  { manifest: 'public/assets/enemies/animated/manifest.json', table: MARKERS.enemies ?? {}, label: 'enemy' },
]

for (const { manifest: manifestPath, table, label } of TARGETS) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  // Sync semantics: clear every previously-injected marker first so a marker
  // deleted from the JSON can not linger in the committed manifest.
  for (const variant of Object.values(manifest.variants ?? {})) {
    for (const entry of [...Object.values(variant.clips ?? {}), ...Object.values(variant.cast ?? {})]) {
      delete entry.impactFrameIndex
    }
  }
  assertKnownMarkerVariants(label, table, Object.keys(manifest.variants ?? {}))
  let injected = 0

  for (const [slug, clips] of Object.entries(table)) {
    const variant = manifest.variants[slug]
    const castKeys = Object.keys(variant.cast ?? {})
    const emitted = [...Object.keys(variant.clips ?? {}), ...castKeys, ...castKeys.map((k) => `cast-${k}`)]
    assertKnownMarkerClips(`${label} '${slug}'`, clips, emitted)

    for (const [clipName, marker] of Object.entries(clips)) {
      const entry = variant.clips[clipName] ?? variant.cast?.[clipName.replace(/^cast-/, '')]
      assertMarkerInRange(`${label} '${slug}'`, clipName, marker, entry.frameCount)
      entry.impactFrameIndex = marker
      injected++
    }
  }

  if (!DRY_RUN) {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }
  console.log(`${manifestPath}: ${injected} impact markers ${DRY_RUN ? 'validated' : 'injected'}`)
}
