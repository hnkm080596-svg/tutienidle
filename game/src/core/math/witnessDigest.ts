// Deterministic provenance fold shared by the save-boundary witness
// checks (QA fixpoint wave): the domain writers stamp the inputs they
// reserved at commit/start time into the persisted record and fold
// them with this helper; save validation and settle re-derive the same
// fold from the persisted fields and reject records that cannot
// replay it. Pure function, no runtime dependency - the digest binds
// the whole bundle atomically so a forged record that does not
// recompute every field loses its produced-state cover.
//
// FNV-1a over the unit-separated serialization of the parts. Parts
// are joined with U+001F so (["ab","c"]) and (["a","bc"]) cannot
// collide into the same digest.

const WITNESS_PART_SEPARATOR = '\u001f'

export function witnessDigest(parts: readonly (string | number | boolean)[]): number {
  let hash = 0x811c9dc5
  const text = parts.join(WITNESS_PART_SEPARATOR)
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
