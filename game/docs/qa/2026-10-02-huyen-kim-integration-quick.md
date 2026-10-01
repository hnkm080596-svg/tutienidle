# QA Review: Huyen Kim stable scene-art integration

- Date: 2026-10-02
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: 14 production files + 4 test files under `game/src/**` and `game/tests/e2e/huyen-kim-stable-art.spec.ts`. Unrelated pre-existing dirty files and the delivered art pack (`public/assets/ui/huyen-kim/**`, reviewed in the earlier package audit) excluded.

## Scope and Risk Map

Presentation-only integration: typed registry, one reusable parallax presenter, SVG symbol wrapper, scene adapters in existing panels/screens, four Phaser textures in the tribulation bundle. No gameplay rule, store API, service API, folder architecture, or dependency changed.

`changed-risk-map.mjs` over the 16 task-owned production/test paths returned domains combat-and-tribulation, economy-and-progression, inventory-equipment, pinia-phaser-sync, ui-input-lifecycle; `deepAuditCandidate: true` on cross-system breadth; `unmappedPaths`: AssetBundleCatalog.ts, StableSceneArt.ts, parallaxMath.ts.

Manual routing bounds all three: AssetBundleCatalog feeds the deterministic route-bundle chain (`getBundlesForRoute('tribulation')` -> AssetBundleManager -> `queueTribulationAssets` -> `scene.load.image`), verified live; StableSceneArt and parallaxMath are pure leaf modules consumed only by the new presenter/adapters, unit-covered. No persistence, economy, progression, or combat-authority transition is touched, so no material deep-escalation trigger survives inspection.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| INV-I1 | Parallax stack mounts | Route/panel mounts stack; pointer moves | Ordered layers, bounded drift, near > far, overscan covers | Max-negative/neutral/max-positive drift; resize | e2e `scene 01` | PASS - 6 layers ordered, drift saturates at contract max * render scale (18*0.978=17.6px observed), static L0 immobile |
| INV-I2 | Reduced motion | OS-level reduce | Every offset exactly 0 | emulateMedia reduce + pointer sweep | e2e + unit | PASS |
| INV-I3 | Scope-hidden surfaces | Any panel/wheel render | scope-hidden absent: no DOM/teaser | open every reached surface | beta-journey gate unchanged; lock badge keeps same v-if guards | PASS |
| INV-I4 | Tribulation env textures | Route enters tribulation | 4 `hk-*` textures exist and draw behind/above runtime per depth contract | missing texture, stale preload, restart | e2e `scene 14` texture existence + harness test | PASS |
| INV-I5 | SVG symbols in chrome | Buttons/badges render | mask-image urls resolve, tint by currentColor, aria-hidden, label stays on owning control | narrow viewport, dark bg | e2e `svg symbols` mask assertions | PASS |
| INV-I6 | Input/focus ownership | Substrate over runtime content | No pointer capture; controls keep focus/click | click-through attack | all art layers `pointer-events:none`, `aria-hidden` | PASS (source + e2e interactions) |
| INV-I7 | RealmPanel silhouette | body figure + overlay | Same 640x520 canvas aligned; runtime nodes own data | resize, chapter switch | e2e `scenes 05+08` | PASS |
| INV-I8 | Listener lifecycle | Mount/unmount stacks | pointermove + matchMedia + ResizeObserver all released | repeated open/close | `onBeforeUnmount` removes all three | PASS (source) |

## Verification Evidence

| Command or observation | Result |
| --- | --- |
| `node public/assets/ui/huyen-kim/_source/generate-scene-extension.mjs --check` | PASS (26 assets, 52 PNGs, 18 symbols) |
| `npm run type-check` (vue-tsc --build) | PASS |
| `npx vitest run` scoped: parallaxMath, StableSceneArt, HuyenKimParallaxStack, TribulationScene.inkWashUi, AssetBundleCatalog, AssetBundleManager | PASS (47 tests) |
| `npx playwright test huyen-kim-stable-art --workers=1` | PASS 9/9, screenshots 01/02/05/06/07/08/10/12/14 |
| Browser console errors | none (assertNoBrowserErrors in every test) |

## Findings

- Low: `StageSelectPanel` `.stage-select__map-scroll` wrapper left children at the pre-wrap indent - cosmetic only.
- Low: `.stage-select__map-frame` uses `object-fit: fill` (stretch); the panel column is layout-bounded so distortion is bounded. Recorded for a future 9-slice frame pass if the art agent ships one.

No Critical/High/Medium findings. Deep escalation not required: all `unmappedPaths` bounded by inspection plus runtime evidence; no save/economy/progression/combat-authority transition changed.
