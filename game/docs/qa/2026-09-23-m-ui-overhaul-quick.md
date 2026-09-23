# M-UI-OVERHAUL — Quick Adversarial QA — 2026-09-23

Scope: aggregate diff `origin/p7/truc-co...HEAD` (135 files, CSS/DOM-only + modal/composable JS). Mapper: all task paths `unmappedPaths` (mapper has no component-table coverage), `deepAuditCandidate: false` → manual routing: `ui-input-lifecycle` (all), `pinia-phaser-sync` (PresentationTransitionOverlay only — no Phaser lifecycle touched). Escalation criteria: none triggered (no save/clock/economy/lifecycle ownership changes).

## Invariant ledger + attacks

| Hypothesis | Oracle | Evidence | Result |
|---|---|---|---|
| H1: bare GameButton (now 'system') inside ink-ceremony context | no sys chrome on painted ceremony | 24 bare buttons censused; all inside adopted sys surfaces (mind-chapter card itself sys-chamfered) | refuted |
| H2: SysModalBase adoption changes Escape/scrim semantics | per-modal Escape/scrim contract identical | Escape→@close parity per modal: offline (was onEscape→close), talent (unwired=dead), tutorial (@close=finish=Bỏ Qua), lore (@close=close), exit-confirm (@close=cancelExit, scrim=cancel via base), pause (@close=continue, scrim dead) | refuted |
| H3: sysFxLow boot/storage edge | no throw, applied pre-mount | try/catch on blocked storage; initSysFxLow() at main.ts:17 < mount:37 | refuted |
| H4: decorative layers eat world clicks | pointer-events none on rim/corners/scan/sweep/energy/marker/tooltip-surface | grep: 6 pointer-events:none in system-theme.css + tooltip surface | refuted |
| H5: teleported modal z-stacking vs combat overlay | OVERLAY_LAYERS | exit-confirm :layer=modal(1900) > combatPause(900); role=alertdialog preserved | refuted |
| H6: revert-invariant — bare var(--sys-) without fallback | every read falls back | declaration scan: NONE without fallback | refuted |
| H7: TabBar measure lifecycle | no observer leak; jsdom guard | ResizeObserver guarded + disconnect() onBeforeUnmount; flush:'post' | refuted |

## Previously found & fixed (P18): `box-shadow: var(--sys-focus,...)` ×4 (invalid CSS, focus ring lost) → fixed to real ring.

Verdict: **PASS WITH EVIDENCE** — 7 attack hypotheses refuted by direct source/property evidence; the one real defect class found (focus-ring token-type) already fixed in 2de3584d.

## Sequential review (P5)

### Sequential Review Pass 1 — Local Correctness / Regression
Reviewed state: post-OCR implementation (HEAD 2de3584d, includes focus-ring fix).
Findings:
- TabBar.vue `measureInk` doesn't re-run after webfont swap — ink underline can sit a few px off until the next modelValue/resize event (self-heals; cosmetic). Severity: Low — deferred (fonts normally resolved before panels mount; first interaction corrects).
- SysModalBase `$attrs`→scrim + `cardClass`→card verified; `@click.self` scrim guard correct; headingId via useId unique per instance. OK.
- `.sys-seg__cell` stepper `is-on` bound `number <= step` ✓; SysPanel `boot` only on 'primary' (intentional); Chip clip-path size safe at chip height.
Fixes: none required (no Medium+).
Verification: npx vitest run src/components/common src/components/panels — green; npm run verify green (1 pre-existing env-blocked powershell fail on base).

### Sequential Review Pass 2 — Architecture / Authority / Ownership
Reviewed state after Pass 1 fixes: YES (no code changed; state = Pass 1).
Findings:
- `--sys-*` canonical LHS only in system-theme.css — extended boundary guards enforce (621 arch tests green). OK.
- Single owners: SysModalBase owns focus-trap/Escape/teleport; sysFxMode owns .sys-fx-low; TabBar owns the measured underline; component-local `--button-accent`/`--btn-accent` are legit locals, not canonical. OK.
- GameButton 'system' scoped styles vs system-theme.css split is justified (composes with base sizing; reads tokens w/ fallbacks). OK.
- InkNineSlice retained only as dormant ceremony path — allowlist guard pins it. OK.
Fixes: none.
Verification: npx vitest run tests/architecture — 621/621 green.

### Sequential Review Pass 3 — Adversarial Integration
Reviewed state after Pass 2 fixes: YES.
Findings (runtime/Playwright-verified where UI-relevant):
- Re-entry: sys-boot re-arms per element mount (v-if) ✓; Transition/teleport leave handled by Vue ✓.
- Same-layer nested modals (settings→reload): both OVERLAY_LAYERS.modal → DOM-order resolves ✓.
- Persistence: localStorage '0'/missing → low=false; class applied pre-mount, no flash ✓.
- Runtime evidence: P14 e2e green — boot build, scrim blur, rim count, :focus-visible ring sweep, font-block fallback, WCAG contrast, density census (4 verified screenshots).
Fixes: none.
Verification: npx playwright test (worktree) — 52 pass; the 6 earlier failures all diagnosed & fixed.

Completion: 3 sequential passes done; zero unresolved Medium+. Low items deferred w/ reasons above (TabBar font-reload measure; .game-button--system split blocks; sys-bar-shimmer documented R41 repaint).
