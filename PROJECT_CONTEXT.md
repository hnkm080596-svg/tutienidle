# Project Context

This is the compact, durable map for coding agents. Source code remains authoritative when this summary differs from the implementation.

## Application

- Root: `game/`
- Stack: Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.
- Browser game entry points: `game/src/main.ts`, `game/src/App.vue`, and `game/src/router/index.ts`.
- High-level UI lives in `game/src/components/`; game-state adapters live in `game/src/composables/` and `game/src/stores/`.
- Domain logic lives in `game/src/core/`; static definitions and registries live in `game/src/data/`.
- Phaser scenes live in `game/src/game/scenes/`.
- Persistence lives in `game/src/services/save/`.

## Main domains

- Combat and battle: `core/combat/`, `core/battle/`, and combat Vue components.
- Skills and progression: `core/skill/`, `core/progression/`, `data/skill/`, `data/progression/`, and skill-path panels.
- Equipment and inventory: `core/equipment/`, inventory panels, and equipment data.
- Cultivation and realms: `core/cultivation/`, `core/realm/`, and realm data.
- Other systems include ailments, buffs, buildings, exploration, formations, pills, recipes, rewards, stages, talismans, and techniques.

## Working rules

- Read `AGENTS.md` (rules) and the closest agent instruction file for your harness before changing code.
- QA verdicts follow the Internal Fixed-Point QA Protocol: `game/docs/qa/protocol/README.md` is the sole QA decision law; run state lives under `game/docs/qa/runs/` via `npm run qa:internal`.
- Search narrowly from symbols and relevant tests; do not scan every source file by default.
- Preserve architecture and avoid new dependencies unless the task requires them.
- Never read `APIKey`, `.env`, or other secrets.
- Work on each task in a dedicated branch and linked worktree as required by `AGENTS.md`.
- Do not push, deploy, or destructively modify Git state.

## Verification

Run from `game/`:

```bash
npm run type-check
npm run build
npx vitest run        # or npm run verify for the full gate
npm run qa:internal -- validate --run <runId>   # QA ledger checks, when a run is active
```

Prefer targeted tests during implementation and the full verification gate before final review.

## Context policy

- Start a new agent session for each new task so stale decisions do not leak across work.
- The implementing agent leaves a verified commit on its task branch and does not merge it; merge authority stays with the human user.
- Internal QA reviewers are fresh isolated agent sessions (e.g. Devin child sessions) producing sealed findings into the protocol ledger — no ChatGPT Web, C2C transport, or external review bot is a completion criterion. Historical external-review references in `game/docs/p7/` are non-binding.
- The merging reviewer (the human user or their delegate) reruns the verification gate and merges only with a clean primary worktree and no unresolved findings.
- Treat this file as orientation, then read only task-relevant code and diffs.
