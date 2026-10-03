# QA quick review — huyen-kim-primitives (Phase-1 shared-primitive reskin)

- Date: 2026-09-30
- Mode: quick
- Scope (task-owned paths, all inside `game/src/components/common/`):
  OverlayPanel.vue, GameButton.vue, Tooltip.vue, ConfirmModal.vue,
  SlotView.vue, TabBar.vue, NotificationBadge.vue, ItemCardBody.vue,
  ToastContainer.vue, primitives/{InkNineSlice,Chip,Bar,EmptyState,Eyebrow,StatRow}.vue
  + co-located pins: InkWash{Primitives,MediumSurfaces,LargeSurfaces}.test.ts
- Excluded: none (all dirty paths are task-owned).
- Risk map: domain `ui-input-lifecycle`; unmappedPaths: none;
  deepAuditCandidate: false. One-hop consumers: every feature panel that
  imports these primitives — bounded by the zero-consumer-change diff
  contract (API identical, verified by git diff: only the 15 production
  primitives + 3 co-located test pins changed; no file outside
  `components/common/` modified).

## Invariant ledger

| Invariant | Result |
| --- | --- |
| Pending chrome slots must never fetch a file | HELD — `chromeArtStyle` built only when `chromeSlice(id)` non-null; pending => class-only fallback |
| Prop/emit/slot API identical | HELD — diff review; only optional `chromeId` added to InkNineSlice |
| Scrim/Escape/cancel semantics unchanged | HELD — ConfirmModal still has no scrim click; Escape=cancel via useDialogFocus |
| Slice layering surface<frame<content | HELD — `--ink-slice-layer` 1/2, content z-3 |
| a11y: labelled dismiss/close controls | HELD — GameButton root receives `:aria-label` (attr fallthrough); same `<button>` DOM contract as raw buttons |
| Consumer CSS-var channels (`--chip-active-bg`, `--tooltip-accent`, `--toast-color`, `--slot-*`, `--button-accent`) | HELD — channels preserved; `--slot-*` redeclared on `.slot-view` |
| Animated transitions respect prefers-reduced-motion | VIOLATED then FIXED — Chip lacked a reduce guard (added); guards present in OverlayPanel/ConfirmModal/Toast/Bar/SlotView/GameButton |
| No invisible chrome when art path unsupported | MITIGATED — `--hk-*` fallback class now always painted under ready art (image-set()/mask-box unsupported => token surface still shows) |

## Findings

1. CONFIRMED (source proof): `Chip.vue` transitions ran without a
   `prefers-reduced-motion` guard — task rule violation.
   Fix: added reduce block nulling transitions. Severity: low-medium
   (vestibular sensitivity), deterministic.
   Re-verified: scoped vitest green.

2. SUSPECTED->COVERAGE: ready-path `image-set()` in `borderImageSource`
   and `-webkit-mask-box-image` are unrasterable in some engines; with
   art ready an unsupported engine would show fully transparent chrome.
   Fixed defensively by keeping the fallback class under the art layer.
   Residual gap: no ready slot exists yet, so the ready path remains
   covered only by code review (manifest contract test pending by design).

3. PRE-EXISTING / OUT-OF-SCOPE (base commit 5de1171b, foundation files —
   not modifiable by this task):
   a. `src/assets/huyen-kim.tokens.css:9` doc comment contains
      `--ink-*/--paper-*` — the `*/` inside `--ink-*` terminates the
      comment early; `lightningcss` minify fails `Unexpected token
      Delim('*')`. `npm run build` fails on the BASE branch (confirmed
      by running lightningcss on the file standalone).
   b. `src/ui/tokens.ts` + `src/ui/huyenKimChrome.ts` carry non-ASCII
      comments (§, em dash, curly apostrophe) with zero
      `tests/architecture/baselines/asciiComments.json` entries —
      `asciiComments.test.ts` fails on the BASE branch. My changed files
      contribute zero new violations (multiset scan: only verbatim
      baselined comments carried).
   Action: reported to coordinator; foundation files are frozen for this
   worker. P15 baseline was NOT regenerated (would mask a base defect).

## Evidence

- `npm run type-check` — clean (0 errors, vue-tsc --build).
- `npx vitest run src/components/common tests/architecture/huyenKim*` —
  23 files, 122 tests green.
- `npx vitest run .../asciiComments.test.ts` — fails ONLY on
  `src/ui/{tokens,huyenKimChrome}.ts` (base defect 3b above).
- `npm run build` — fails in `vite:css-post` lightningcss minify on
  `huyen-kim.tokens.css` (base defect 3a above; reproduction: the file
  alone fails `lightningcss.transform(minify)`).
- Consumer census (identical grep, base vs worktree): unchanged for all
  primitives except GameButton 45->47 (+2: OverlayPanel, ToastContainer)
  and InkNineSlice 20->21 (+1: ToastContainer) — all inside
  `components/common/` per rule 5 routing of raw buttons.
- `git diff --name-only HEAD` — only the 18 task-owned paths listed above.

## Post-review additions (P18 OCR + P5 sequential passes)

4. FIXED during review (all reverified, type-check + scoped vitest green):
   - ToastContainer: new slice layer covered non-positioned content ->
     `.toast-item > :not(.ink-nine-slice)` z-3 lift + message span. (High)
   - 5x `box-shadow: var(--hk-shadow-low|high)` treated color tokens as
     full shadow specs -> rewritten with lengths. (High)
   - Chip: missing prefers-reduced-motion guard. (Low-Med)
   - InkNineSlice: tintVar ignored on `tintable:false` slots (mask would
     recolor art); fallback class now stays under ready art (defensive
     layering if border-image/mask-box unsupported); chromeId>assetId
     precedence enforced in class emission. (Med)
5. RUNTIME EVIDENCE (Playwright, dev server :5199):
   - Without shim: `--hk-*` vars all resolve '' -> GameButton lg renders
     16px tall, chromeless. Root cause = base defect 3a, verified live:
     the early `*/` makes the browser discard the whole :root block.
   - With a :root vars shim injected: primary action = 48px ceremonial
     height, gold-tinted slice fill, ghost hairline border - screenshot
     evidence /tmp/auth-hk-shim.png (recreated each run; also in
     test-results). My diff renders correctly once tokens resolve.
   - `tests/e2e/ink-wash-ui.spec.ts` repinned: overlay panel asserts
     data-hk-slice surface-m-panel/frame-m-modal. The spec's remaining
     failure (primary action <40px) is defect 3a, not this diff.
6. Nit/Low deferred: toast 'save' accent azure->jade-soft (palette has
   no azure); overlay close gains ui.click sound (system convention;
   toast dismiss stays silent); `variant 'ink'` name kept for API
   stability; assetId became optional (callers passing neither prop get
   no chrome - accepted extension cost); dao-luan/rune slots have 0-px
   slices (future consumers caveat).

## Verdict label

PASS WITH GAPS — the change itself is evidence-clean (122 unit tests,
runtime probe with vars shim, repinned e2e); two pre-existing
base-branch defects (frozen foundation files) are reported, not masked;
one (3a) renders ALL --hk-* consumers chromeless at runtime AND breaks
the production build - it is blocking for the whole redesign line.
