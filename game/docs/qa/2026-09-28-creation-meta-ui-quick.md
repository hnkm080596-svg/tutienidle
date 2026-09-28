# QA Quick Review — creation-meta UI audit fixes (2026-09-28)

Scope: task-owned diff on `devin/ui-fix-creation-meta` (vs origin/master) — auth card /
creation funnel / settings / tutorial / offline+save-incompatible surfaces, command wheel
nav affordance + labels, ConfirmModal restyle, EN locale wiring, resume fast-path.

## Task-owned paths (26 reviewable)

App.vue, main.ts, theme.css, composables/locale.ts, composables/resumeSession.ts,
components/common/{ActionFeedbackLog,ConfirmModal,ErrorScreen,GameButton,LoadingScreen,
OfflineSummaryModal,OverlayPanel,SaveIncompatibleScreen,ToastContainer,TutorialOverlay}.vue,
components/common/system/SysModalBase.vue (deleted), components/game/{DongFuCommandWheel,
DongFuScene}.vue, components/onboarding/{AuthEntryScreen,CharacterCreationScreen}.vue,
components/panels/SettingsPanel.vue, components/panels/scripture/LoreCodex.vue,
components/menu/* (4 deleted), data/tutorial/tutorialSteps.ts, data/ui/commandWheelCatalog.ts,
locales/{vi,en}.json, tests/e2e/system-ui.spec.ts.

Non-task-owned dirty files: none.

## Risk map

`changed-risk-map.mjs`: domains pinia-phaser-sync + ui-input-lifecycle; deepAuditCandidate=true
("cross-system change: 2 domains"); unmappedPaths = deleted menu test, tutorialSteps.ts,
commandWheelCatalog.ts, locales, main.ts, e2e spec — all manually routable (data/catalog keys,
locale tables, boot wiring, e2e selector rename).

deepAuditCandidate disposition: **bounded, quick retained.** The mapping is cross-system only by
file count, not by authority: no store/scene/manager mutation was added or changed; the diff is
presentation + locale resolution + one AuthSession emit into the existing `authenticated` →
`setSaveAccountId`/`bootGame` path. No save/cloud write semantics, no clock/offline math, no
economy/progression transition changed. Runtime evidence (Playwright screenshots, dev server)
confirms the reachable states.

## Invariant ledger + attacks

| Hypothesis | Result |
|---|---|
| ConfirmModal teleports to body; callers inside a higher-z surface (SaveIncompatibleScreen at saveGate 4000) could render under the screen | Rejected — `:layer` threaded; SaveIncompatibleScreen passes `saveGateModal` (4100); other callers default to `panel` (1800), same as old SysModalBase contract. Runtime shot 07 shows modal above settings overlay. |
| Resume emits a session object that bypasses `AuthService.authenticate` — could bind the wrong save slot or bypass validation | Rejected — `authenticated` only feeds `accountIdForSession(session)` (mode+userId/loginId) + `bootGame(false)`; slot resolution identical to a normal auth result; guest fallback `crypto.randomUUID()` mirrors MockAuthService. Runtime shots 08-10 prove continue → loaded game + offline modal. |
| Stored login-mode session without `userId`/`loginId` (pre-Mission-F) resumes into GUEST slot | **Low — deferred.** `accountIdForSession` falls back to GUEST_ACCOUNT_ID; such a session would continue onto the guest save (or fresh game). Rare (legacy session objects only), never corrupts the user's real save (read-only resolution). Documented as residual risk. |
| `.paper-on-dark` remaps tokens but bare h1/h2 rely on inherited `color` → still dark-on-dark | Confirmed-and-fixed during evidence capture: added `color: var(--surface-text)` to the utility; re-shots 01/02 show readable titles. |
| OverlayPanel close button (new) steals focus-on-open from slot content | Rejected — DOM-order-last + absolute positioning; `dialogFocusAdversarial` suite green; e2e selector updated. |
| Deleted components/menu/* + SysModalBase still referenced | Rejected — grep shows no live imports; type-check clean; e2e spec moved to `.confirm-modal`. |
| Locale switch on auth/settings persists and survives reload | Verified — `initLocale()` before mount; saveLocale writes `tien-hiep-idle-locale`; EN shots 11-15 render English chrome. |
| `initLocale`/`saveLocale`/`hasResumeCandidate` under denied storage (private mode) | Rejected — all storage reads wrapped in try/catch with VI/false fallbacks. |
| Wheel `labelKey` unresolvable | Rejected — all 15 keys resolve in vi.json + en.json (script-checked); EN wheel shot 14. |

## Classification

- Confirmed production defects remaining: **0**
- Suspected / coverage gaps: legacy non-guest session without userId (Low, deferred above); EN talent
  card body text remains Vietnamese by design (talent names/descriptions are game data, not chrome —
  the audit finding was raw i18n keys and unreachable switcher, both fixed).
- Existing coverage exercised: vitest scoped run 177 green (incl. dialogFocus/dialogLabeling,
  asciiComments, locale tests); e2e specs unchanged except the sys-modal→confirm-modal selector.

Verdict (per-operation label): **PASS WITH EVIDENCE** — runtime screenshots + scoped tests + static
review; two Low items deferred with reasons.
