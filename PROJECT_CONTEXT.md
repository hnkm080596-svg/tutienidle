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
- The implementing agent leaves a verified commit on its task branch and does not merge it.
- The user directly assigns Codex or Claude Code to review and merge a completed task branch.
- The reviewer reruns the verification gate and merges only with a clean primary worktree and no unresolved findings.
- Treat this file as orientation, then read only task-relevant code and diffs.

## Cloud review pipeline (ruling 2026-09-23)

Mission workflow: spec → C2C review → plan → C2C review → implement (internal workflow + all gates) → external review → merge.

- **C2C** = ChatGPT-web external review, coordinator-driven only (browser on the coordinator VM; children never call it). All material goes INLINE (external fetch is disabled in that runtime). 4 parallel lanes in one ChatGPT project; global ROUND counter dedupes verdicts.
- **Devin Review** (`devin_review_manage`): automatic on every mission PR — it catches the i18n/API-contract bug class C2C misses. C2C still runs spec/plan gates and impl review on complex PRs (it catches state-invariant bugs Devin Review misses). Verified complementary on PRs #12/#14/#15.
- Spec/plan docs live at `game/docs/specs/` + `game/docs/plans/`; children write them, stop at the gate, and implement only after the coordinator reports DONE verdicts.
- Mission PRs base `p7/truc-co` (coordinator merges); user merges the final `p7/truc-co → master` PR.
- Save-version rule: `CURRENT_SAVE_VERSION = merged-base CURRENT + 1` at implementation time; reject the immediately previous version. Never hardcode literals.
- Dev-phase ruling: no backward compatibility / no migration — save-version rejection is the mechanism. Don't re-ask.
