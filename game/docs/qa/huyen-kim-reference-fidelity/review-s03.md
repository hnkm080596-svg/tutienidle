# S03 Động Phủ — reference-fidelity review

Date: 2026-10-02 · Viewport: 1280×720 (design 1672×941, scale 0.7655)
Reference: AI-generated 03-dong-fu (moonlit blue-gold vista, dais + 2-orbit wheel, vertical building tags, right rail)
Evidence: `evidence/before/03-dong-fu-closed.png`, `03-dong-fu-open.png` → `evidence/after/` same names.

## Before → After deltas

| Spec region | Before (PR97 state) | After | Verdict |
|---|---|---|---|
| vista | spring/morning sepia-yellow kit | `DEFAULT_THANH_VAN_VARIANT = autumn/night` — moonlit ink sky, gold foliage; deterministic preset contract kept (`peekThanhVanVariant`, QA overrides unchanged) | MATCH |
| top-bar | 1 spirit-stone pill; text seals clipped past right edge | `resource-pill` ×3 tiers always (0 shown); utility seals icon-only; `data-hk-region="top-bar"`; right edge inside 1280 | MATCH |
| dao-luan-hub | filled "TU LUYỆN" disc occluded the seated cultivator | hollow gold ring — cultivator visible inside hub (ref: figure inside glowing ring); label under ring | MATCH |
| wheel-inner-orbit | single effective orbit visible (~132px) | inner r≈138px (spec ≈142); ring stroked gold-muted, `data-hk-region` | MATCH |
| wheel-outer-orbit | r≈189px | r≈197px (spec ≈202, bottom-fit clamp −48 covers label-below-disc overhang) | MATCH |
| wheel slots | labels wrapped 2–3 lines INSIDE 57px discs (clip) | 56px disc = `dao-luan-node` art + stable-art glyph; label hangs below node in dark chip, no wrap | MATCH |
| hotspots | horizontal paper pills w/ squashed 13×20 plaque icon | vertical hanging tags — `building-plaque` 96×160 art, `writing-mode: vertical-rl` name, level chip below, status dot on top; CSS fallback when art pending | MATCH |
| thien-co | always-open card mid-right | collapsed chip bottom-right (count badge) → click opens right-edge drawer (`data-hk-region="thien-co-open"`); canonical `useThienCoEntries` unchanged | MATCH |
| quest-tracker | absent | `HuyenKimQuestTracker.vue` — chip above the Thiên Cơ chip reading `questOps.getBetaQuestSurfaceModels()` (claimable-first); CTA = existing `openStandalonePanel('quest')`; renders nothing when empty | MATCH |
| chat-strip | — | not implemented — spec marks region INVALID (no chat system) | N/A |

## Preserved contracts

- `betaWheelSlots()` filtering — scope-hidden slots (phap_bao/formation/companion/chi_hien_quan) render nothing.
- Wheel open/close paths (Tab, Esc, player trigger, backdrop) untouched; ignition cue kept.
- Building popover authority (`ui.activeBuildingPopoverId`) and hotspot hitboxes unchanged — nameplate stays `pointer-events: none`.
- Variant lifecycle: only the fixed preset changed; `selectNextThanhVanVariant` post-battle roll intact.
- `data-hk-scene="dong-fu"` + `data-hk-region` hooks added for the fidelity spec.

## Known residuals

- White circular "V" at bottom-center in dev captures = Vue DevTools anchor (vite plugin), not game UI — verified via `elementFromPoint` probe; absent from production builds.
- Outer orbit 197 vs spec 202 (bottom-fit clamp at 720px height; within 3%).
- Bottom-most outer slot's label sits ~y695 — inside viewport; no clip.

## Verification

- `huyen-kim-reference-fidelity.spec.ts` — 4/4 pass (S01, S02, S03 smoke, S03 geometry: orbit radii/hub position/tag orientation/3 pills/thien-co toggle/label bounds).
- Unit: DongFuCommandWheel 16, HomeBuildingIcons 18, ThienCoRail 2 (updated for collapsed default), CurrencyHud, GlobalTopBar — green.
- `vue-tsc --build` clean.
