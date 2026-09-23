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

- Read `AGENTS.md` and the closest `CLAUDE.MD` before changing code.
- Search narrowly from symbols and relevant tests; do not scan every source file by default.
- Preserve architecture and avoid new dependencies unless the task requires them.
- Never read `APIKey`, `.env`, or other secrets.
- Work on each task in a dedicated branch and linked worktree as required by `AGENTS.md`.
- Do not push, deploy, or destructively modify Git state.

## Verification

Run from `game/`:

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

Prefer targeted tests during implementation and the full verification gate before final review.

## Context policy

- Start a new agent session for each new task so stale decisions do not leak across work.
- The implementing agent leaves a verified commit on its task branch and opens a PR.
- Merge policy (cloud workflow): the agent may merge once all test gates pass — P3 verification, P18 OCR, P4 adversarial QA, P5 sequential review, and the C2C external review (via `chatgpt-web-review` skill) — with no unresolved Medium-or-higher findings. No per-PR merge approval is required; escalate only on gate failures or conflicts.
- Fan-out model (cloud workflow): independent missions are dispatched to parallel child Devin sessions — one session per mission, each on its own VM with its own clone. The coordinator session batches only dependency-free missions (per the mission graph), collects each child's PR, runs the C2C external review serially (the dedicated ChatGPT chat lives on the coordinator's browser), and sequences merges in dependency order. Children never merge; they stop after opening their PR. Local-agent handoffs arrive either as pushed `p7/mqi-*` branches on origin or as `[C2C] go <name>` tasks on the dedicated chat.
- The reviewer path still applies for a completed task branch: rerun the verification gate and merge only with a clean primary worktree and no unresolved findings.
- Treat this file as orientation, then read only task-relevant code and diffs.
