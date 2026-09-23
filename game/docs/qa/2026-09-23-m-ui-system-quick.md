# QA Quick Review — M-UI-SYSTEM (xuyen-khong system UI layer)

Date: 2026-09-23 · Mode: quick · Scope: `src/assets/system-theme.css` token layer, `Sys*` primitives (SysPanel/SysBar/SysTag/SysStat/SysModalBase), `useSystemRimAuthority`, `useDialogFocus` (MaybeRefOrGetter + pointer containment), `Bar`/`OverlayPanel` `variant="system"`, wave-1 opt-in surfaces (LeftPanel drawer, CharacterPanel, RealmPanel, NodeTreePanel, ConfirmModal), boundary guard test, e2e rim-handoff spec.

## Inputs

Task-owned paths — all UI/presentation; `changed-risk-map.mjs` progression-domain hits are comment-only ASCII normalization + one `getTurnBattle` test mock (shared-branch unblock, not production behavior). Bounded to **ui-input-lifecycle** domain. Deep-escalation check: no persistence/economy/combat semantics touched — CSS/DOM/lifecycle only; escalation not warranted.

## Invariant ledger

| ID | Hypothesis | Operator | Oracle | Result |
| --- | --- | --- | --- | --- |
| INV-UI-1 | `--sys-*` redefines an `--ink-*`/`--gold-*` token or an unanchored system selector leaks into ink surfaces | boundary | `tests/architecture/systemThemeBoundary.test.ts` (canonical-LHS + anchor scan + ordinary-rule scoping) | **No defect** — 6 tests green. |
| INV-UI-2 | Two eligible surfaces render `.sys-rim--live` simultaneously (drawer + modal, stacked modals) | timing boundary | `useSystemRimAuthority` unit tests + `tests/e2e/system-ui.spec.ts` handoff sequence | **No defect** — sole live rim at every observed state; claim/promote/release verified. |
| INV-UI-3 | Mounted-but-closed overlay retains a rim claim (mountedStandalone panels stay mounted) | lifecycle | e2e asserts RealmPanel subtree holds no rim while closed; `rimActive` watches `open` | **No defect** — claim is an ordered set of ACTIVE claimants; closed-but-mounted holds nothing. |
| INV-UI-4 | Escape through a blocking nested modal reaches a background card (nested ConfirmModal inside SettingsPanel) | cross-system chain | runtime probe: open settings -> reload confirm -> scrim click -> Escape | **CONFIRMED (Medium, fixed)** — compound defect: (a) `tabindex="-1"` cards are focusable, so a scrim mousedown moved focus to the *background* card -> its Escape closed the parent overlay under the modal; (b) the deeper cause: `.sys-modal` was rendered inside the caller's card subtree — `backdrop-filter` on `.overlay-panel` + `overflow:hidden` on card/body bounded `position:fixed` to the card's box, so the scrim never covered the viewport and outside clicks hit the parent's `@click.self`. Fix: `useDialogFocus` document-level mousedown containment (c117665b) + `SysModalBase` `<Teleport to="body">` (ef68904e, same convention as Tooltip/ToastContainer). Re-verified at runtime: focus stays on the modal's cancel button; Escape closes only the modal; scrim box = full 1600x900. Regression test added in `system-ui.spec.ts`. |
| INV-UI-5 | `:focus-visible` ring lost on GameButton inside sys surfaces (Vue scoped specificity war) | style authority | CDP `forcePseudoState` probe: outline computed `solid 2px --sys-focus` | **CONFIRMED (Medium, fixed)** — component-scoped `(0,3,0)` rule beat the global `(0,2,1)` sys rule; fixed via scoped re-declare under sys anchors (5b2312b5). |
| INV-UI-6 | `--paper-*` tokens read dark-on-dark inside system modal chrome (RealmPanel realm name) | style authority | computed color on `.realm-panel__name` inside system modal | **CONFIRMED (Medium, fixed)** — `--paper-*` are dark at `:root`; fixed via scoped family remap under `.overlay-panel__card--system` (b88735c4), same mechanism `.ink-drawer` owns for drawers. |
| INV-UI-7 | Reduced-motion does not stop sys animation (orbit rim / sweep / scanline flicker) | accessibility | e2e `emulateMedia({ reducedMotion: 'reduce' })` — all sys pseudo-element `animation-name` compute to `none` | **No defect** — corners + static border survive; all motion stilled. |
| INV-UI-8 | Vietnamese diacritics illegible / layout breaks when Chakra Petch unavailable | accessibility | P14 screenshot with web fonts blocked (`03-font-blocked`) | **No defect** — packaged fallback stack holds layout; diacritics (TẢI LẠI, Xác Nhận, Đan Phòng) render correctly. |
| INV-UI-9 | `closeOnScrim=false` confirm still closes on scrim click | boundary | runtime probe + post-teleport DOM order | **No defect** — scrim click is inert; only Escape/buttons act. |
| INV-UI-10 | aria contract dropped in the ConfirmModal rewrite (role/aria-modal/labelledby/describedby) | accessibility | runtime DOM probe | **No defect** — `role="alertdialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby` all present. |
| INV-UI-11 | A ConfirmModal caller uses the modal outside any overlay context (would now stack at body level) | cross-system | grep of all 9 production callers | **No defect** — all callers render inside their own surfaces; teleport preserves stacking (later DOM beats same-z parents); danger variant + message/`pre-line` contract preserved. |

## Focused checks run

- `npm run type-check` — clean.
- `npx vitest run` scoped: `systemThemeBoundary.test.ts` (6), `useSystemRimAuthority` unit suite, `InkWashLargeSurfaces`, `CombatExitConfirmModal` focus tests — green.
- `npx playwright test tests/e2e/system-ui.spec.ts` — 3 tests green (rim handoff, nested-modal Escape regression, reduced-motion).
- P14 runtime evidence (worktree dev server :5552): screenshots `/tmp/mui-p14/01-07` — dense drawer, realm modal, font-blocked fallback, sys focus ring, realm-name fix, confirm modal pre/post teleport (scrim now covers the full viewport).

## Coverage gaps

None blocking. Deferred Lows already on record: SysModalBase heading-slot dangling `aria-labelledby` path (no current caller), SlotView/Chip ink rings inside sys surfaces (still >=2px non-glow indicators), `.realm-panel__name` ink font inside sys chrome (cosmetic).

## Verdict

**PASS WITH EVIDENCE** — 11 hypotheses resolved; 3 Confirmed Medium defects found and fixed within the task diff (5b2312b5, b88735c4, c117665b, ef68904e), each with runtime/e2e regression evidence; no blocking gaps.
