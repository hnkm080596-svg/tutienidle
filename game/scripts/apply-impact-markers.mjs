// Impact-marker applier (impact-sync): injects art/animation-impact-markers.json
// values into the already-packed manifests as `impactFrameIndex` - the exact
// field pack-character-art.mjs / pack-enemy-art.mjs emit on a full repack.
// Same validation rules: integer, 0..frameCount-1, known variant, known clip.
//
// Needed when the raw NEWSPRITE dumps are not on hand: the markers live in
// this repo, so re-injecting them into committed manifests keeps the
// manifest the generated artifact while the JSON stays the authoring surface.
//
// Usage: node scripts/apply-impact-markers.mjs [--dry-run] [--markers <json>]
//   --markers overrides the marker file (validation-fixture hooks for tests).
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const MARKERS_PATH = args[args.indexOf('--markers') + 1] ?? 'art/animation-impact-markers.json'
const MARKERS = JSON.parse(readFileSync(MARKERS_PATH, 'utf8'))

const TARGETS = [
  { manifest: 'public/assets/characters/animated/manifest.json', table: MARKERS.characters ?? {}, label: 'character' },
  { manifest: 'public/assets/enemies/animated/manifest.json', table: MARKERS.enemies ?? {}, label: 'enemy' },
]

for (const { manifest: manifestPath, table, label } of TARGETS) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  let injected = 0

  for (const [slug, clips] of Object.entries(table)) {
    const variant = manifest.variants[slug]
    if (!variant) {
      throw new Error(`${label} impact marker names unknown variant '${slug}'`)
    }

    for (const [clipName, marker] of Object.entries(clips)) {
      const entry = variant.clips[clipName] ?? variant.cast?.[clipName.replace(/^cast-/, '')]
      if (!entry) {
        throw new Error(`${label} '${slug}': impact marker names unknown clip '${clipName}'`)
      }
      if (!Number.isInteger(marker) || marker < 0 || marker >= entry.frameCount) {
        throw new Error(`${label} '${slug}': impact marker '${clipName}'=${marker} out of range 0..${entry.frameCount - 1}`)
      }
      entry.impactFrameIndex = marker
      injected++
    }
  }

  if (!DRY_RUN) {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }
  console.log(`${manifestPath}: ${injected} impact markers ${DRY_RUN ? 'validated' : 'injected'}`)
}
