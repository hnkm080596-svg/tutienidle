# QA Review: Huyen Kim stable scene art

- Date: 2026-10-02
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: nine named design/QA/plan documents; 29 files under `game/public/assets/ui/huyen-kim/_source/**`; 84 core-chrome PNG files; 52 stable-scene PNG files under `scene/**`; 18 SVG files under `symbols/**`; and 15 review PNG files under `preview/**` (207 paths total).

## Scope and Risk Map

The request is limited to stable Huyen Kim scene substrate/chrome art and implementation handoff. Volatile entity, technique, skill-topology, item, equipment-item, pill, reward, geography, and animated-VFX art is intentionally excluded. No Vue, Pinia, Phaser, gameplay, save, progression, or runtime registration file is changed.

The changed-risk mapper received all 207 task-owned paths. It returned 207 `unmappedPaths`, no mapped domain, no one-hop runtime consumer, and `deepAuditCandidate: false`. Manual routing bounded those paths to static art, deterministic export/check scripts, contracts, reports, and handoff documents. The UI/input lifecycle pack supplies the visual/reduced-motion oracle, but no material runtime lifecycle boundary is changed; deep escalation is not required. Unrelated dirty files from the main checkout are outside this worktree and were excluded.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-HK-1 | Stable scene contract and export scripts | Build/check all declared raster and symbol outputs | Every declared output exists once, has exact paired geometry, valid alpha, and visible content | Missing file, duplicate ID/path, empty-alpha output, invalid safe rectangle | Validator reports 26 raster assets, 52 PNGs, 18 SVGs with zero errors | Deterministic script | High: a missing substrate blocks scene composition |
| INV-HK-2 | Parallax metadata and aligned layer canvases | Compose neutral and maximum drift states | Each stack has one opaque L0, contiguous unique depth/order, nondecreasing bounded drift, no seams, and zero reduced-motion offset | Maximum negative/positive drift, duplicate order/depth, independent crop | `14-parallax-motion-qa.png` plus structural validator | Static visual + deterministic script | High: this is the user-confirmed background contract |
| INV-HK-3 | Human visual-inspection evidence | Re-run checks after a preview changes | A previous PASS cannot survive changed visual evidence | Append one byte to a copied parallax QA preview | Clean copy passes; tampered copy exits 1 with `human visual inspection evidence changed` | Isolated mutation probe | High: prevents stale approval reuse |
| INV-HK-4 | Core chrome generator and integrated manifest/report | Re-run core export from a clean temporary tree | Regeneration creates required directories and preserves stable-scene metadata/report | Empty preview directory; replay older producer after extension | Clean probe creates nine previews, preserves extension, aggregate count 154, and byte-preserves report | Isolated clean-tree replay | High: prevents the parallax contract disappearing on regeneration |
| INV-HK-5 | Manifest and scope boundary | Enumerate production paths | Stable package contains no excluded volatile-content category and runtime-only state/topology stays out of raster art | Banned-fragment scan and path census | 154 aggregate production files, zero missing files, zero banned fragments | Manifest/contract census | Medium: content changes frequently but is explicitly out of scope |
| INV-HK-6 | Scene compositions and safe regions | Inspect composed scenes, cutouts, and protected rectangles | Substrates remain text-free, preserve runtime negative space, and do not bake countable skill/realm topology | Full composition and safe-area inspection at original detail | Previews 12, 13, and 14 inspected; no seam, clipped focal art, baked label, or countable topology found | Direct visual observation | Medium: presentation defect without gameplay-state impact |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `node public/assets/ui/huyen-kim/_source/generate-scene-extension.mjs --check` | PASS | 26 assets, 52 PNGs, 18 symbols; validates identity/path uniqueness, dimensions, alpha/visible pixels, safe rectangles, paired bounds, parallax order/depth/drift, SVG structure/currentColor, banned paths, and visual-evidence hashes |
| Manifest/contract production census | PASS | 52 stable-scene PNGs + 18 SVG symbols, 154 aggregate production files, zero missing, zero banned fragments, 15 layers across three parallax stacks |
| Isolated stale-evidence mutation probe | PASS WITH EVIDENCE | Untouched copy passes; one-byte change to preview 14 is rejected with exit code 1 for changed human-inspection evidence |
| Isolated clean core-generator replay | PASS WITH EVIDENCE | 43 records, 84 PNGs, nine previews; stable extension retained; aggregate count remains 154; integrated report hash unchanged |
| Original-detail inspection of previews 12/13/14 | PASS WITH EVIDENCE | Composition, content-safe rectangles, and neutral/max-negative/max-positive parallax states show no visible seams or broken alignment |
| `npm run verify` after final pipeline fixes | Pre-existing failure only | Type-check PASS; build PASS; 862/863 Vitest files passed, 7873 tests passed, 5 expected failures. One stale BENIGN registry row is recorded below |
| OCR delegation on latest state | Clean task pass | 7/7 reviewable files reviewed, 0 skipped, 100% reviewable coverage; 200 Markdown/SVG/binary files excluded by supported-type rules and covered through document inspection, SVG validation, contract census, hash pins, and visual boards |

## Findings

No confirmed, suspected, or coverage-gap finding remains in the task-owned stable-art surface.

## New or Changed QA Tests

No maintained test file was added. The asset contract checker and its isolated clean-tree/mutation probes provide the lowest conclusive oracle for this static art-only package; no production runtime hook is needed.

## Gaps and Residual Risk

- This task deliberately adds no frontend consumer, so P13/P14 runtime wiring is not triggered. Browser integration, responsive crop behavior, text contrast over the composed backgrounds, and live reduced-motion behavior belong to the Devin implementation gate and are not claimed here.
- The visual boards prove the delivered art and declared maximum drift, not a future presenter's implementation. The handoff therefore requires a reusable presenter, explicit overscan, maximum-drift proof, and exact zero offsets under reduced motion.
- Independent isolated-review provenance is unavailable. The deterministic mutation and clean-tree probes are independent processes, not independent reviewers.

## Pre-existing Failures

- `tests/architecture/betaScopeRenderedTokens.test.ts`: stale `BENIGN` entry `components/panels/bag-sections/MaterialBagSection.vue :: post-beta-realm`. The test and component are untouched by this task; the same stale row exists at task baseline. It prevents a fully green repository-wide Vitest result but is not evidence against the art package.
