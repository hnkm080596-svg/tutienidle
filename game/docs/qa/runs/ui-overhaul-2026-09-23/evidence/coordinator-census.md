# Coordinator run-census — ui-overhaul-2026-09-23

Candidate: `devin/1790183125-m-ui-overhaul @ 145a9705` (PR #20, draft) vs `origin/p7/truc-co`.
Diff shape: 135 files, +5.6k/−2.7k — CSS/DOM-only by mandate (no gameplay/save/economy writes).

## Changed-concept census (CANONICAL owners)

| Concept | Owner | Readers/consumers | Classification |
|---|---|---|---|
| `--sys-*` token definitions | `src/assets/system-theme.css` :root ONLY | every component `var(--sys-*, fallback)` read | CANONICAL; guard-enforced |
| `.sys-*` utility classes | system-theme.css | ~70 components | CANONICAL |
| Modal chrome/trap/teleport | `SysModalBase.vue` | 6 modal surfaces | CANONICAL; Escape/scrim parity required vs base |
| Button chrome | `GameButton.vue` (variant default 'system') | 24 bare + pinned-variant call sites | CANONICAL; flip gated by census |
| fx-low class | `src/composables/sysFxMode.ts` → `documentElement` | system-theme.css `.sys-fx-low` block; SettingsPanel toggle | CANONICAL |
| Overlay z-order | `src/core/presentation/OverlayLayers.ts` | SysModalBase `:layer`, overlays | UNCHANGED contract |
| InkNineSlice (dormant) | `InkNineSlice.vue` | Victory/Defeat panels, OverlayPanel 'ink', non-system GameButton | LEGACY/dormant — allowlist-pinned |
| `menu/*` | DELETED | zero refs verified | DEAD removed |
| i18n keys | `src/locales/{vi,en}.json` | t() callers | added-only (zero deletions) |

## Required/N-A cells

- B deterministic: `npm run verify` REQUIRED — executed (green; 1 env-blocked powershell test pre-existing on base).
- P18 OCR: REQUIRED — executed, 128/128, 4 findings fixed (2de3584d).
- P14 runtime: REQUIRED — executed, 52 pass + evidence PNGs.
- P4 adversarial: REQUIRED — executed, PASS WITH EVIDENCE (docs/qa/2026-09-23-m-ui-overhaul-quick.md).
- P5 sequential: REQUIRED — 3 passes, zero Medium+ open.
- E persistence attack: NOT_APPLICABLE — zero save-schema/storage writes except sysFxLow localStorage key (attacked under integration lens).
- I/J/K property/fuzz/mutation campaigns: NOT_APPLICABLE for a CSS/DOM-only diff — no stateful owners or persisted-data adapters changed; weighted per coordinator scope note.
- L sealed reviewers: REQUIRED — 3 lenses dispatched (this run).

## Reviewer sealing

priorFindingsVisible=NO enforced by instruction + exclusion: reviewers told not to open `docs/qa/**` (coordinator's quick report is inside the diff — declared in request.extraExclude intent) and attest actual exposure in REVIEW_RESULT.
