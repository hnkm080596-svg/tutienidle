# QA Quick Review — art preload before game entry (2026-10-03)

## Scope

Task-owned paths:

- `game/src/presentation/assets/AssetBundleCatalog.ts` (new 'ui-chrome' + 'ui-scenes' bundles, 'ui-chrome' required on 'home')
- `game/src/presentation/assets/artWarmWiring.ts` (new: route-commit warm binding)
- `game/src/App.vue` (import + bind/unbind)
- `game/src/presentation/assets/AssetBundleCatalog.uiArt.test.ts` (new guard)
- `game/src/presentation/assets/AssetBundleCatalog.test.ts`, `AssetBundleManager.test.ts` (route-map expectations)
- `game/tests/architecture/catalogPreloadParity.test.ts`, `assetContainment.test.ts` (bundle lists)

changed-risk-map: domain `ui-input-lifecycle`; `deepAuditCandidate: false`. Three task-owned paths unmapped — routed manually: bundle enumeration (catalog -> AssetBundleManager.ensureFor/prefetch consumers), route-commit warm (coordinator subscribe -> manager prefetch), test guard (none). No save/cloud, clock/offline, or economy/progression state touched; the lifecycle risk (one coordinator subscriber with a teardown) mirrors `bindAmbientAudio` and is bounded. No deep escalation triggered.

## Invariant ledger

| ID | Hypothesis | Evidence | Verdict |
| --- | --- | --- | --- |
| INV-ART-1 | 'ui-chrome' in `getBundlesForRoute('home')` makes a missing chrome image fail the transition | ensureLoaded rejects -> 'failed' phase + retry; identical exposure to the 10 Dong-Fu dom-image layers 'home' already requires. All 131 enumerated files verified on disk (new on-disk guard test). | bounded — consistent with existing lane, guarded |
| INV-ART-2 | 'ui-scenes' prefetch could reject a route or leak an unhandled rejection | `prefetch` wraps `ensureLoaded` in try/catch and never rejects; `bindArtWarm` voids the returned promise. | Confirmed safe (SOURCE_PROOF) |
| INV-ART-3 | lazy warm (148MB, ~240 fetches) started at 'character' commit starves the required 'home' lane on slow links — same 6-connection pool | REAL RISK found during review: required assets queue behind lazy fetches if the user proceeds fast | **FIXED**: warm moved to 'home' commit (required lane completes first; curtain still opens on schedule) |
| INV-ART-4 | subscribe listener double-fires warm on bind | coordinator `subscribe()` fires immediately; local `route` seeded first -> first call is a no-op; explicit single seed after — mirrors ambientAudioDriver | Confirmed safe |
| INV-ART-5 | teardown leaks subscriber / HMR double-bind duplicates fetches | `unbindArtWarm()` in unmount cleanup; manager dedupes via `domInFlightLoads` + `isResourceLoaded` — a second bind only re-iterates descriptors | Confirmed safe |
| INV-ART-6 | dispose mid-prefetch publishes into a dead manager | `runLoad` checks `!this.disposed` before marking loaded; prefetch early-returns when disposed | Confirmed safe |
| INV-ART-7 | CDN (`VITE_ASSET_BASE_URL`) breaks descriptor URLs | raw '/assets/' paths resolved by manager via `resolveAssetUrl`; registry/stack/symbol URLs already resolved -> `resolveAssetUrl` idempotent on absolute URLs | Confirmed safe |
| INV-ART-8 | Electron `file://` / packaged paths break dom-image loads | same loader mechanism the 'home' bundle already requires for Dong-Fu layers — exposure class unchanged, count widened | bounded |
| INV-ART-9 | SKILL_ICON_MANIFEST declares icons whose PNGs are not dropped yet | prefetch lane marks `missingResources` (fail-soft, attempt bound); monogram fallback unchanged | safe — manifest contract preserved; test exempts manifest-declared URLs |
| INV-ART-10 | exhaustive switch on AssetBundleId missed a case | TS exhaustiveness via switch on union — type-check enforces; both cases added | Confirmed safe |
| INV-ART-11 | DPR density pick warms the wrong srcset file | `preferredDomDensity` mirrors the browser's pick (dpr>1 -> @2x); chrome warms both densities (mixed call sites); tribulation @1x intentionally left to its Phaser bundle | Confirmed safe |
| INV-ART-12 | 'ui-scenes' reachable from a transition deadline | dedicated guard test asserts no route includes it | Confirmed safe |

## Probe evidence (Playwright, dev server)

- Real app, guest boot: warm burst of ~235 image requests fires at 'home' commit (bindArtWarm) + ~144 at the transition (ui-chrome + home bundle). Equipment-hall panel open afterward: 0 image requests.
- Preview env (fresh context): 354-file prefetch; every subsequent /ui-* scene visit revalidates cached art (304) instead of full fetches.
- Coverage gaps found and fixed: Thanh Van modular backdrop (combat/victory/defeat rotate variants post-battle) added — 32 files across the full season×time matrix.
- Remaining residual 200s are Phaser-bundle-owned art (combat avatars, tribulation scene layers — warmed by their own required bundles at those transitions) plus dev-server cache quirks (no-cache + weak etag revalidations, headless disk-cache eviction) — not enumeration gaps.
- Known residual: `Cache-Control: no-cache` on the dev server means same-document remounts still issue cheap revalidations; on production/CDN headers with far-future max-age these become hard cache hits, and Electron `file://` issues none.

## Coverage gaps recorded

- Combat preview page mounts enemy/player avatar URLs that live in the 'combat' Phaser bundle — covered at combat entry, not a ui-scenes gap.
- Tribulation scene layers (tribulation-*@1x) stay in the 'tribulation' Phaser bundle — required at tribulation entry.

## Result

`PASS WITH GAPS` — invariant ledger closed: one real contention risk (INV-ART-3) found and fixed inside the task scope; all other hypotheses bounded or confirmed safe. Gaps: dev-server revalidation noise on remounts is an artifact of `no-cache` headers, not the app behavior; the five not-yet-dropped skill icon placeholders are warm targets by manifest contract and fail soft.
