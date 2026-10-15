# Combat result ceremony handoff

- Branch: `codex/combat-result-ceremony`.
- Worktree: `E:/tutienidle/.agent-worktrees/combat-result-ceremony`.
- App root: `E:/tutienidle/.agent-worktrees/combat-result-ceremony/game`.
- Base: `72dea7dfd`; implementation is uncommitted. No commit, merge or push performed.
- Latest user direction: remove the failure-reason block; do not run fixed-point QA. Aggregate convergence work stopped; no fixed-point certificate is claimed.

## Delivered

Production `CombatResultModal` explicitly selects the separate `ceremony` variant. Existing classic components remain available. The fresh layout uses the current gold/red title PNGs, a masked title reveal, layered paper opening, staggered reward rows and a bounded count-up to the settled summary. No gameplay reward is granted by animation or skip. First activation during reveal completes presentation without also activating the action. Reduced motion shows the final state directly; long reward lists scroll inside the result surface.

The new defeat variant has no failure-reason heading, text block, prop or styles. It keeps title, stage, flavor line, rewards and actions. Classic content is retained as the separate classic variant.

Directly affected controller defects found during implementation were repaired with failing-then-passing pins: repeated defeat retry admission, initial repeat pace, preserved ten-second fallback after refused retry, stale victory refusal after unmount, and a shared dialog-focus continuation registering listeners after disposal. Existing result E2E consumers now locate the separate ceremony roots.

## Direct evidence

- Relevant unit/component/controller/focus/i18n tests: **52 tests across 9 files passed**, `runs/combat-result-ceremony/evidence/focused-latest.log`.
- Focused Edge browser scenarios: **2 passed**, `runs/combat-result-ceremony/evidence/runtime-handoff.log`. Includes victory/defeat art, intermediate counts, exact totals, scrolling at 900x600 and 480x800, skip, accepted manual retry, return, keyboard containment, reduced motion and automatic retry/manual recovery presentation.
- Screenshots inspected: `runs/combat-result-ceremony/evidence/browser-handoff/combat-result-ceremony-pro-57c87-kip-retry-defeat-and-return/{victory-desktop,defeat-desktop,victory-900x600,victory-480x800}.png`.
- Runtime result fixtures close the current stage via `abandonBattle()` before substituting display-only terminal data. They test the real modal/controllers, not real reward settlement. An earlier separate `create-to-combat` run reached a natural battle outcome successfully.
- `git diff --check`: clean. Type-check result is retained separately in `runs/combat-result-ceremony/evidence/type-check-handoff.log`.

Broader aggregate attempts and independent findings are historical run material. Full E2E needed unavailable Supabase contract configuration; another legacy HUD test failed before reaching combat. No credentials were read and no unrelated backend/navigation repairs were made. No further convergence rounds were run after the user's instruction. Scratch CLI logs were retained because automatic policy rejected recursive cleanup; the CLI browser session was closed.

## Run

From the app root: `npm run dev -- --host 127.0.0.1`. Use the actual URL printed by Vite, then enter a stage battle. Animation does not change the existing retry or return deadline owners.
