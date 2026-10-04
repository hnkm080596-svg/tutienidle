# QA Review: mob-ram / mob-ram-multi spectral VFX atlases

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/art/vfx/mob-attacks/build-ram.mjs`
  - `game/art/vfx/mob-attacks/build-ram-multi.mjs`
  - `game/art/vfx/mob-attacks/Ram.json` (generated doc)
  - `game/art/vfx/mob-attacks/Ram Multi.json` (generated doc)
  - `game/public/assets/vfx/mob-ram/ram.png`
  - `game/public/assets/vfx/mob-ram-multi/ram-multi.png`

## Scope and Risk Map

changed-risk-map.mjs returned all six paths as `unmappedPaths` (art pipeline
files are outside its domain table) with `deepAuditCandidate: false`.
Manual routing from code inspection:

- One-hop consumer: `src/data/vfx/VfxSheetManifest.ts` bindings `ram`
  (frames 0-11, `/assets/vfx/mob-ram`) and `ram_multi` (frames 0-16,
  `/assets/vfx/mob-ram-multi`). Bindings unchanged; frame counts preserved.
- Runtime loader consumes `<dir>/<name>.png` + frame-rect JSON sidecar.
  Both sidecar JSONs are byte-identical (same export grid -> identical
  rects), so the playback contract is unchanged.
- No economy/save/time/Pinia-Phaser boundary touched; no `src/` edits.
  Escalation to deep audit not triggered: material risk bounded by
  doc-contract inspection plus deterministic re-export.
- Exclusions: none; `git status` shows no unrelated dirty files.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-RAM-1 | Atlas files / VfxSheetManifest | Export regenerated atlases | Conservation: binding frame count and path must still resolve | Value mutation (grid/frame drift) | manifest frames 0-11 / 0-16 vs exported 12 / 17 frames; `catalogPreloadParity` + `linhBaoVfxAssets` suites | vitest (2 files, 6 tests) | High - loader 404/blank frames |
| INV-RAM-2 | Arcadia doc JSON | Build scripts regenerate docs | Synchronization: doc id/name/comp/exp must match wired metadata | Stale state | `doc.id`/`name`/`comp`/`exp` identical to prior revision (256x192, dur 0.4/0.56, fps 30, rgba, same grids) | inspection | High - silent binding break |
| INV-RAM-3 | Export pipeline | Re-run exporter | Determinism: same inputs -> identical outputs | Repeat | md5 of both PNGs identical across two exports; 11 untouched atlases produce zero git diff | shell | Medium - nondeterministic art churn |
| INV-RAM-4 | Renderer input | Doc layers/textures validate | Recoverability: malformed doc fails safe before export | Degraded environment | `tools/validate.mjs` reports 0 errors for both docs | headless validator | Medium |
| INV-RAM-5 | Composed frames | Rendered art must obey spectral translucent spec | Boundedness: fill-opacity 0.55-0.8, layer cap ~0.85, flash < ~40% cell, transparent bg | Value mutation | per-frame alpha coverage <= 30.7%; background alpha 0 outside sprites; glint/flash confined to impact point | PIL frame inspection | Medium - spec rejection risk |
| INV-RAM-6 | Build files | Committed source | P15: ASCII-only comments | Value mutation | byte scan: 0 non-ASCII bytes in both build files | python scan | Low |
| INV-RAM-7 | Two-hit timing | ram_multi keeps hit structure | Monotonicity: hit order/timing preserved | Timing boundary | hits at t=0.115/0.375 vs prior 0.12/0.38; same recoil-out / lower-second-hit structure | doc inspection + frames | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vue-tsc --noEmit` (game/) | clean, exit 0 | no src touched; covers repo-wide types |
| `npx vitest run tests/architecture/catalogPreloadParity.test.ts tests/architecture/linhBaoVfxAssets.test.ts` | 6/6 pass | proves manifest<->asset contract still resolves |
| `node tools/validate.mjs` on both docs | 0 errors | Arcadia headless doc validation |
| Re-export + `md5sum` compare | identical hashes; `git status` unchanged (6 files only) | determinism + no cross-atlas contamination |
| Frame extraction + dark-bg sheet review | ram: charge -> small nose glint -> dissipating wake; ram-multi: hit -> visible recoil right -> lower second hit; 64px downscales stay legible | subjective look iterated over 3 export rounds |
| Per-frame alpha coverage (PIL) | peak coverage 30.7% (ram f04), max layer opacity 0.85, fills 0.55-0.72 | satisfies translucent / small-flash spec |
| Non-ASCII byte scan | 0 bytes >127 in both build files | P15 |

## Findings

None confirmed.

### QA-2026-10-04-01: boar echo layer barely visible
- Severity: Low
- Status: Suspected
- Invariant: n/a (cosmetic polish)
- Evidence: frame inspection after switching echo to `screen` blend shows a
  faint trailing ghost; effect is intentionally subtle and does not harm the
  silhouette read.
- Test file: none
- Owner subsystem: VFX art
- Blast radius: none

## New or Changed QA Tests

None - no failing reproduction was warranted; the manifest<->asset contract
is already pinned by `catalogPreloadParity` and `linhBaoVfxAssets`.

## Gaps and Residual Risk

- No automated oracle asserts the cosmetic spec (translucency caps, flash
  size, palette). Verified by frame inspection only; a future atlas
  regression would need the same manual review. Low, cosmetic-only blast
  radius - recorded, not blocking.
- In-game combat-scale legibility judged on 64px downscales of atlas
  frames, not inside a live battle scene; direction verified from atlas
  frames (head left, travel right-to-left).

## Pre-existing Failures

None observed.
