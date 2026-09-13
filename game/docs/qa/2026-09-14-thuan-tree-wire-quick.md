# QA Quick — Thuần node-tree wiring (B1 fix)

Date: 2026-09-14 · Branch: fix/thuan-tree-wire · Mode: quick
Verdict: **PASS WITH GAPS**

## What changed
- New `src/core/progression/NodeBranchViews.ts` — single owner for "which
  branchTags a tree view renders": element view → `[el, 'lap_dao', 'thuan_<el>']`;
  other tags pass through; `HIDDEN_BRANCH_TAGS = ['da_phap']`.
- `NodeTreePanel.vue` — filter consumes `viewBranchTags`; unfiltered view
  excludes hidden tags; `branchLabel`/`branchColor` resolve lap_dao/thuan
  groups via new i18n keys (`panels.nodeTree.branchLabels.lapDao/.thuan`).
- Guard `tests/architecture/nodeBranchCoverage.test.ts` — every registered
  branchTag must be renderable by some view or explicitly hidden.

## Evidence
- Mapping unit tests: 3/3 (element set, kiem passthrough, da_phap hidden).
- Coverage guard: 2/2 — fails if any future node lands on an unrenderable tag.
- `npx vitest run src/core/progression src/components/panels tests/architecture`
  + `src/data/progression`: 215 tests / 49 files — all pass.
- `npm run type-check`: clean.
- Engine consumers verified present: `TheResourceSystem`,
  `SkillRuntimeStats` read `theGainPerLinkBonus`/`theMaxBonus`/`the_man`;
  `NodeSystem` applies `skillModifiers`/`selectsSpecialization`/`unlocksSkillIds`
  — node purchase is the only missing link, now wired.

## Adversarial notes
- `lap_dao` renders in all 5 element views but purchases once (global
  `nodeLevels`) — consistent milestone, no duplicate-cost path.
- `lap_dao_thuan_<el>` mutex via `excludesNode` still enforced domain-side;
  `da_phap` remains unpurchaseable (hidden + no render path + no auto-grant),
  so the excludes check always passes.
- Realm gates unchanged: lap_dao/keystones show locked pre-Trúc Cơ via
  existing prerequisite display.
- Save compat: nodeLevels keyed by id — no migration needed.

## Gaps
- Live-browser render + purchase click-through (P14 deferred per worktree
  exception — do on main checkout at merge).
- The actual Thế buff triggering in combat (needs a Trúc Cơ save +
  chain casting) — engine tests cover mechanics; end-to-end visual
  confirm deferred to B3 progression evidence run.
