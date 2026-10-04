# QA Review: Linh Bao point-detonation atlas VFX

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - game/src/presentation/skills/SkillPresentationRecipe.ts
  - game/src/data/vfx/SkillPresentationRecipes.ts
  - game/src/game/support/skill-vfx/PhaserSkillVfxDriver.ts
  - game/src/game/support/LinhBaoVfxAssets.ts (new)
  - game/src/game/support/CombatPreload.ts
  - game/src/presentation/assets/AssetBundleCatalog.ts
  - game/src/game/scenes/CombatScene.ts
  - game/src/dev/skill-vfx.ts
  - game/src/locales/{vi,en}.json
  - game/scripts/export-arcadia-linh-bao.mjs (new)
  - game/art/vfx/linh-bao/Linh Bao Burst.json (new, authored data)
  - game/public/assets/vfx/linh-bao/* (new, generated assets)
  - game/tests/{architecture/linhBaoVfxAssets.test.ts (new), architecture/catalogPreloadParity.test.ts, e2e/skill-vfx.spec.ts}
  - game/src/data/vfx/SkillPresentationRecipes.test.ts
  - game/src/game/support/skill-vfx/PhaserSkillVfxDriver.test.ts

## Scope and Risk Map

changed-risk-map routes the diff to `combat-and-tribulation` +
`pinia-phaser-sync` and flags `deepAuditCandidate: true` on "2 domains".
Not escalated: the domain breadth is path-routing, not behavioral. The
change adds one presentation primitive (`atlas`) inside an existing
scene-owned driver and one data recipe; it touches no save/cloud, clock,
economy/progression, Pinia store, or authoritative combat state (A7/P17:
the driver only renders acked playback). Phaser lifecycle risk is bounded
by verified call sites (CombatScene.ts:1561 destroy, :1973 reset) that
already own the graphics pool the sprite pools now ride on, plus unit and
e2e evidence of release. One-hop consumers (CombatScene surface,
SkillPresentationRunner, preload/catalog parity guards, dev lab) were all
inspected in current code.

Exclusions: `game/art/vfx/linh-bao/Linh Bao Burst.json` and
`game/public/assets/vfx/linh-bao/*` are authored/generated artifacts —
verified by `tools/validate.mjs` (0 errors), exporter contract asserts,
and `linhBaoVfxAssets.test.ts` pixel checks rather than line review.

## Invariant Ledger

| Invariant | Check | Evidence |
|---|---|---|
| Detonation draws only on landed hits (no fabricated impact) | unit + e2e miss path | PhaserSkillVfxDriver.test "does not fabricate detonation imagery"; spec spriteActive stays 0 on miss |
| Sprites released on finish/cancel/reset/destroy | unit | spritesDestroyed == allocated after destroy; spriteStats.active 0 after finish/reset |
| Per-key sprite budget bounded | unit | low-quality 4-cap honored across concurrent cues |
| Stale handles cannot rewrite frames or release live cues | unit | epoch guard; sample(600) post-finish leaves frame_11 |
| Burst anchored at the landed target, not the caster | e2e screenshot | test-results/linh-bao-burst.png — burst centered on enemy figure |
| Frame window stays inside the authored sheet | unit | floor/clamp mapping; last sampled frame = frame_11 |
| Recipe atlas key/frames resolve to a real loaded texture | arch test | linhBaoVfxAssets.test pins cue.atlas.key == descriptor key + frames == lastFrame+1; parity test keeps preload enumeration |
| Surfaces without a sprite hook drop the cue loudly | unit | console.warn + quietHandle, zero sprites |
| Runner times impact on the authored clip marker | source + prior test | pham_nhan_unarmed marker `cast-linh_bao`:10 -> clipImpactMs 1312.5ms -> timing.castMs override (CombatScene.ts:715-731) |
| Missing/failed mid-cue lifecycle (cancel, battle reset, scene destroy) | unit | end() releases all leases; pool.reset hides sprites; destroy frees them |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npm run type-check` | clean | post-fix rerun |
| `npx vitest run` (recipes, driver, runner, arch assets, parity, i18n parity, hoa-cau assets) | 68 pass | scoped suite |
| `npx playwright test skill-vfx.spec.ts` | 3 pass incl. new linh-bao case | deterministic `advance()` stepping; miss path covered |
| Canvas screenshot mid-detonation | burst on target | test-results/linh-bao-burst.png |
| `node tools/validate.mjs` on Arcadia source | 0 errors | run during authoring |
| Exporter asserts (loadEffectFile awaited, texs.size === textures.length, exp/frames/mode contract) | holds | reran exporter to produce shipped atlas |

## Findings

### QA-2026-10-04-1: nested ternary in atlas anchor resolution
- Severity: Low
- Status: Confirmed (style rule violation, not behavioral)
- Invariant: system review rules — nested ternary prohibited
- Evidence: `cue.anchor === 'source' ? [source] : unique.length ? unique : [source]`
- Resolution: rewritten as `let anchors = unique; if (cue.anchor === 'source' || unique.length === 0) anchors = [source]` — identical semantics, type-check + tests re-run green.

### QA-2026-10-04-2: reduced-motion has no atlas-specific degradation
- Severity: Low
- Status: Coverage gap
- Invariant: reduced-motion users get reduced motion
- Evidence: atlas primitive plays the authored sheet regardless of
  `reducedMotion`; graphics cues only shed decorative trails under the
  same flag. The burst is the skill's payload imagery (not a trail), so
  behavior matches stroke/burst precedent; no dedicated reduced-motion
  contract exists for authored atlases. Deferred: authoring a reduced
  variant is an art decision, not a defect.

### QA-2026-10-04-3: sprite budget is per texture key
- Severity: Low
- Status: Coverage gap
- Invariant: bounded VFX memory
- Evidence: `budget.sprites` caps each key's pool; N distinct keys get
  N pools. Only one atlas key exists today (`linh-bao-burst`), so the
  bound holds; if recipes add more keys, total sprite memory grows
  linearly. Recorded so a future multi-key change re-examines the cap.

## New or Changed QA Tests

- `src/game/support/skill-vfx/PhaserSkillVfxDriver.test.ts` — atlas
  lifecycle: landed-only spawn, frame progression/clamp, stale handle,
  miss suppression, no-sprite-surface drop, budget, destroy frees all.
- `src/data/vfx/SkillPresentationRecipes.test.ts` — recipe pin +
  malformed atlas payload rejections (missing/empty key, non-integer or
  out-of-range frames, bad scale, atlas on non-atlas primitive).
- `tests/architecture/linhBaoVfxAssets.test.ts` — descriptor/catalog
  enumeration, occupied-frame ranges, recipe cue ↔ asset key binding,
  nonblank pixel check inside the real PNG.
- `tests/e2e/skill-vfx.spec.ts` — deterministic lab run: impact ACK at
  the recipe boundary, detonation sprite active then released, miss path
  spawns none, no browser errors.
