# Review — S06 Technique + S07 Skill (2026-10-02)

## S06 Technique — `after/06-technique.png`

Ref: plinth centerpiece + card + detail rail.

- Composition: `TechniqueSlotCard`(hero) | `technique-display-plinth` vista | canonical `getBetaTechniqueSurfaceModel` sections + grade CTA | bottom grade-track — matches spec 06.
- Empty state no longer renders a bare line on blank paper: the full scene grid mounts (slot card shows its own empty glyph + "tự cấp khi bước vào nghề nghiệp tu luyện", plinth present, rail carries the no-technique message). No invented technique/effects.
- Capture shows committed-fire state (Tiểu Ngũ Hành Quyết, Phẩm 1→2 track, 0/5000 material cost).

## S07 Skill — `after/07-skill.png`

Ref: radial core/orbit constellation + detail rail.

- `NodeTreePanel` now projects the canonical `betaSkillTreeFor` graph onto radial orbits via `skillGraphLayout.ts` (pure: id/parentId/depth → positions; zero domain semantics).
- Invariant: equal leaf angular slots → leaves ride the outer rim; internal nodes on depth-scaled inner rings; per-depth circumference + ≥82px ring gap prevent card overlap; multiple depth-0 roots share a tight inner orbit.
- Edges redrawn center-to-center with branch-tinted stroke + dark halo (readable on night substrate); unlock flow animation preserved (dash flow parent→child).
- Node cards compacted for constellation density (desc removed — NodeInspector owns detail); locked nodes readable at 0.72 opacity.
- `zoom` fit machinery untouched (floor 0.65 preserved); measurement stays `getBoundingClientRect`-true; `translate` property used so unlock scale animation doesn't fight centering.
- Zoom control, respec button, Tree/Detail tabs, inspector rail, active-arts strip all preserved.
- Mortal/way-less state: `showTree=false` → canonical detail view (no fabricated tree) — correct per domain authority.

## Deferred / notes

- Imperial nav seal labels still clip a few glyphs at 1280 (pre-existing from Task 4 pass; Low).
- Locked-node text at 65% fit-zoom is small but legible; inspector carries full detail.
