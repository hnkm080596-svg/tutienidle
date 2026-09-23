# Round-1 repair — commit ec5a7ead (post-145a9705)

Origin: sealed correctness review rev-roundA-correctness (session ddb2250c5f934983840fa655571ad998).
Decisive oracle (reviewer's chromium probes, coordinator-verified at /tmp/clip-probe.png):
on the SAME element, clip-path clips box-shadow, positive-offset outline, and
same-element filter:drop-shadow. Survives: outline-offset:-N (inner ring),
inset box-shadow, filter:drop-shadow on the PARENT.

## Fixes applied
- F-1 High: focus rings on chamfered controls → outline-offset:-2px inner ring
  (global .sys-surface/.sys-modal/.overlay-panel__card--system rule + scoped
  overrides GameButton, Chip, TalentEntitlementModal, BattleLogPanel;
  DongFuCommandWheel slots → inset box-shadow ring).
- F-2 Medium: dead outer shadows on clipped surfaces → inset depth/backlit
  glow (system-theme.css sys-surface/primary/ephemeral/pop/bloom/ink-drawer +
  Chip.is-active, NotificationBadge, CharacterCreationScreen, wheel slots,
  HomeBuildingIcons, ActionFeedbackLog). Tooltip drop-shadow moved to root
  (parent filter follows clipped child silhouette — the ToastContainer pattern).
- F-3 Medium: tests/e2e/system-ui.spec.ts focus oracle now requires
  outline-offset<=0 or inset ring shadow on clipped elements.
- F-4 Low: 13 accent-var call sites gained literal fallbacks.
- F-5 Nit: LoreCodexModal caches last shown content (title stable on leave).
- F-8 Nit: TabBar re-measures ink on document.fonts ready/loadingdone.
- Deferred: F-6 (circle+system octagon — design-consistent nit),
  F-7 (dead utility vocabulary — non-actionable; kept with corrected semantics).

## Verification
- npx vue-tsc --noEmit: clean.
- npx vitest run (system + panels + TabBar scope): 163/163.
- systemThemeBoundary.test.ts: 10/10.
- Static sweeps: no clipped element retains outer box-shadow, same-element
  drop-shadow, or positive-offset focus ring (coordinator scans).

## State drift note
Head advanced ec5a7ead -> 8c31727d after round-B dispatch: a one-line
optional-chain hardening in TabBar (document.fonts?.ready?.then) with no
rendered-behavior change (identical execution path in real browsers; only
affects environments lacking FontFaceSet.ready). Round-B reviewers are
pinned at ec5a7ead = productStateId 156c2faa — the frozen candidate under
review. Coordinator verified the tail commit is behavior-identical.

## Round-2 repairs — commit d3b2b281 (reviewer-B findings)

- F-B1 Medium: dead scoped scrim/card overrides on teleported SysModalBase
  moved to system-theme.css (.combat-pause.sys-modal +
  .sys-modal__card.combat-pause__card).
- F-B2 Low: ConfirmModal bound accent-var fallback added.
- F-B3 Medium: SysModalBase bare var() reads + SysPanel card revert
  legibility (paper surface/text fallbacks) fixed.
- F-B4 Low: boundary guard now polices non-:root --sys-* in plain .css;
  variant opt-in regex accepts quote/bind spellings.
- F-B5 Low: TabBar deep watch on props.tabs.
- F-B6 Nit: font-blocked e2e actually aborts font hosts.
Verification: boundary 11/11, scoped vitest 266/266, vue-tsc clean.
