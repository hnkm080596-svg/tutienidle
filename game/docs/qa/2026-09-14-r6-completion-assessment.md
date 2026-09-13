# R6 — Combat Character Art & Asset Contract: completion assessment (2026-09-14)

Verdict: **PASS WITH GAPS → phase gate met at minimum contract; residual debt listed and ratcheted.**

User decision recorded: `phap_tu` real art deferred ("art hoan thanh sau,
debt di"). Style reference for the future drop: `player-phap-tu-v1.png`.

## Gate items vs evidence

| Gate item (phase R6) | Status | Evidence |
| --- | --- | --- |
| Production pipeline: PixelLab/Source → validated files → metadata → catalog → preload → animation def → CombatScene | Met | Proven end-to-end by `player-mortal-combat-atlas-v1` (65-frame trimmed atlas, Phaser JSON Hash); `CombatPreload` queues via `load.atlas`; scenes register clips from catalogue ranges |
| Minimum main-character states: idle / ready / cast / standby / death | Met | `playerMortalCatalogue()` — 5 clips, authored ranges, looping vs one-shot split, `impactFrame` on cast/death; browser-verified in `2026-09-12-r6-player-mortal-atlas-quick.md` |
| Stable contract: source identity | Met | `AtlasClip.sheetKey`/`sheetUrl`/`atlasUrl` |
| frame dimensions | Met | `AtlasClip.sourceSize` — checked against atlas JSON on disk (`atlasFramesExist`) |
| frame count/range | Met | `firstFrame`/`lastFrame` (count deliberately derived — no `frameCount` field) |
| FPS | Met | `frameRate` per clip |
| loop / one-shot | Met | `repeat` (-1 loop, 0 once), pinned by `animationCatalogue.test.ts` |
| body anchor | Met | `extent` = normalized character box (spec C); cell anchors from battlefield region; `SpriteBodyAnchor.flipX` modeled |
| facing | Met by convention | Single canonical facing per art set; runtime mirror via `setFlipX` + `SpriteBodyAnchor.flipX` (no mirrored spritesheets by design, per combat-grid-view note) |
| transparent background | Met | RGBA atlas PNGs; `no_background` generation flag; trim data in atlas JSON requires alpha |
| fallback | Met | `FALLBACK_PLAYER_ENTITY_KEY` + placeholder catalogue + Rectangle fallback when `presentationFor` is `undefined` |
| animation key | Met | `combatAnimationKey(entityKey, name)` single format owner |
| Verification: asset validator | Met | `atlasFramesExist`, `artExtentDeclared`, `animationCatalogue` guards |
| preload/animation registration | Met | `catalogPreloadParity` guard + registration path |
| actual CombatScene playback | Met | 2026-09-12 QA: create-to-combat, sprite visible, atlas PNG/JSON HTTP 200 |
| anchor consistency | Met | `artExtentDeclared` derives extents from tallest trimmed frame |
| missing-asset fallback | Met | `presentationFor` → `undefined` → Rectangle (explicit, §3.2.1) |
| real browser screenshot/playback | Met | 2026-09-12 QA browser pass + contact-sheet inspection of all 5 sequences |
| Evaluate hit / basic_attack / victory | Met | Removed from `CombatAnimationName` 2026-09-11 (Spec B §4.5): "each returns the day it has a clip and a caller together" — evaluation answered, names return with clips+callers |

## Debt ledger (listed, ratcheted — not blocking)

1. **`phap_tu` placeholder** — `player-phap-tu-v1` resolves to the shared
   32-frame placeholder catalogue. Ratcheted by
   `placeholderArtEntityKeys()` + the `placeholder art debt ratchet`
   block in `tests/architecture/artTierDebt.test.ts` (expected set:
   exactly `['player-phap-tu-v1']`). Art drop deferred per user
   decision; reference style `player-phap-tu-v1.png`.
2. **Boss-form art debt** — all 20 mortal templates listed in
   `ART_DEBT_ENTITY_KEYS` (deserve animated in boss form, have static
   PNG). Ratcheted by the existing `artTierDebt` guard. Shrinks when
   boss atlases land.
3. **Per-state browser oracle** — 2026-09-12 QA confirmed load +
   visible sprite + all five sequences on contact sheets; no automated
   per-state pause oracle in a live browser. Acceptable residual.

## Change in this pass

- `CombatPresentationCatalogue.placeholderArtEntityKeys()` — derived
  debt query (animated entries whose every clip uses the placeholder
  sheet). New guard pins the set to `['player-phap-tu-v1']`.
- Docs/roadmap only otherwise. No playback or catalogue behavior change.

## Verification

- `npm run type-check` — clean.
- `npx vitest run tests/architecture/artTierDebt.test.ts
  src/presentation/art/` — 2 files / 14 tests pass.
