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
- Do not commit, push, deploy, or destructively modify Git state.

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
- Resume the Codex session only for fixes within the same task.
- Use a fresh Claude reviewer session so review remains independent.
- Treat this file as orientation, then read only task-relevant code and diffs.
