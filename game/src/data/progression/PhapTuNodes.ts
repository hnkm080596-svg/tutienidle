import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import { buildElementBranch } from './PhapTuNodes.builders'

// Phap Tu Reimagined (2026-09-15 plan, Task 6) — new tree shape:
// 5 mutex element roots (committed atomically by selectPhapTuElement,
// no auto-Fire, no unlocksElement), per-element growth + special/god-ult
// unlock + The lanes + route-tagged specialization (3 'dot' + 3 'no' +
// truong_the). The old keystoneReaction/keystonePure XOR, lap_dao_thuan,
// reaction_path_unlock, B/D-position chains and The Man nodes are gone.
// phap_tu_an has NO presence here — separate CultivationPathId with its
// own deferred tree (PhapTuAnNodes.ts, spec §5.3).
export const PHAP_TU_NODES: ProgressionNode[] = [
  ...buildElementBranch('fire'),
  ...buildElementBranch('water'),
  ...buildElementBranch('wood'),
  ...buildElementBranch('metal'),
  ...buildElementBranch('earth'),
]
