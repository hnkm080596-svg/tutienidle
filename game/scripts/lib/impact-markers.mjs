// Shared impact-marker rules (impact-sync): the marker table lives in
// art/animation-impact-markers.json, keyed by manifest variant slug, then by
// SOURCE clip name (character packer maps `cast-*` entries onto the manifest
// `cast` sub-map under the bare key). Both packers and apply-impact-markers.mjs
// validate through this module so the rules cannot drift between scripts.
import { readFileSync } from 'node:fs'

export const MARKERS_PATH = 'art/animation-impact-markers.json'

export function loadImpactMarkers(markersPath = new URL(`../../${MARKERS_PATH}`, import.meta.url)) {
  return JSON.parse(readFileSync(markersPath, 'utf8'))
}

// A marker value must be an integer frame index inside the clip it names.
export function assertMarkerInRange(label, clipName, marker, frameCount) {
  if (!Number.isInteger(marker) || marker < 0 || marker >= frameCount) {
    throw new Error(`${label}: impact marker '${clipName}'=${marker} out of range 0..${frameCount - 1}`)
  }
}

// A marker naming a clip the variant never emitted is dead data - fail loudly
// instead of shipping drift. `names` is the set of source clip names emitted.
export function assertKnownMarkerClips(label, clips, names) {
  for (const name of Object.keys(clips ?? {})) {
    if (!names.includes(name)) {
      throw new Error(`${label}: impact marker names unknown clip '${name}'`)
    }
  }
}

// Same rule at the variant level: a marker naming a variant never emitted is
// dead data. `variantSlugs` is the set of emitted slugs.
export function assertKnownMarkerVariants(kind, table, variantSlugs) {
  for (const slug of Object.keys(table)) {
    if (!variantSlugs.includes(slug)) {
      throw new Error(`impact marker names unknown ${kind} variant '${slug}'`)
    }
  }
}
