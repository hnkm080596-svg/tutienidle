# UI/UX Deep-Scan — 2026-09-28 (origin/master)

5-pass scan: 4 slice reviewers (player-perspective, Playwright browser evidence, screenshots) + 1 coordinator consistency pass.

| Slice | Report | Screens | Findings (C/H/M/L/N) |
|---|---|---|---|
| Creation / meta | [creation-meta/report.md](creation-meta/report.md) | 12 | 16 (0/5/6/2/3) |
| Progression | [progression/report.md](progression/report.md) | 16 | 23 (1/4/9/6/3) |
| Combat | [combat/report.md](combat/report.md) | 15 | 19 (1/5/6/6/1) |
| Economy / social | [economy/report.md](economy/report.md) | 18 | 21 (0/4/8/5/4) |
| Consistency (coordinator) | [consistency.md](consistency.md) | — | 6 (0/1/3/2/0 nit) |

**Total: 79 slice findings + 6 consistency findings. 2 Critical, 18 High.**

## Criticals (fix first)

1. **Progression**: mortal Quán Khí breakthrough button disabled with zero requirement text (`RealmPanel.vue` scopes requirement rows to `qi_refining` only; `getBreakthroughRequirements` already returns a `level` row for mortal).
2. **Combat**: manual skill slots render at 2×2px — invisible inside the dock (`.turn-combat-skill-bar__slot-button` has no width).

## Recurring themes across slices

- **Dark-on-dark headings** — `var(--paper-text)` dark ink on dark surfaces hits titles in creation, settings, victory panel, building headers (systemic token bug).
- **EN locale unreachable + half-broken** — `en.json` fully translated but nothing assigns `locale`; forced EN shows VI/raw keys; plus ~15 hardcoded VI strings (see consistency C-1).
- **Missing nav affordances** — command wheel only via unlabeled hotspot/`Tab`; standalone panels lack close buttons; no way to exit an active battle (`requestCombatExit` has no call sites).
- **Invisible economy feedback** — no currency HUD; "Bán hết" sells stacks with no confirm/toast/preview.
