# Arcadia Effects Tooling Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Arcadia Effects beside the Tu Tien IDLE repository, verify its local editor, and document a minimal local/cloud-agent workflow without changing gameplay.

**Architecture:** Keep the upstream Arcadia repository under `E:\tutienidle-tools\arcadia-effects`, outside the game Git tree. Add only Markdown discovery guidance to the game repository: a focused tooling guide plus a short `AGENTS.md` pointer. Cloud-hosted agents recreate the public tool in their own workspace because they cannot address the local Windows `E:` drive.

**Tech Stack:** Git, Node.js, Arcadia Effects (Vanilla JavaScript/Canvas2D), Phaser asset pipeline documentation.

**Spec:** `game/docs/tooling/arcadia-effects.md` (the task requirements and final bridge contract).

## Global Constraints

- Do not modify gameplay, dependencies, package files, runtime wiring, or existing VFX assets.
- Preserve all unrelated working-tree changes.
- Keep Arcadia as an independent Git repository outside `E:\tutienidle`.
- Do not claim cloud-hosted access to a local Windows path; document reproducible clone/setup instead.
- Do not commit, push, merge, or deploy.

---

### Task 1: Install the independent editor checkout

**Files:**
- Create externally: `E:\tutienidle-tools\arcadia-effects\` (upstream Git clone)

**Interfaces:**
- Consumes: public repository `https://github.com/xaidan777/Arcadia-Effects.git`
- Produces: a pinned, inspectable local checkout with upstream origin metadata

- [x] **Step 1: Confirm the target does not already exist**

Run: `Test-Path E:\tutienidle-tools\arcadia-effects`

Expected: `False` before cloning.

- [x] **Step 2: Clone the upstream repository**

Run: `git clone https://github.com/xaidan777/Arcadia-Effects.git E:\tutienidle-tools\arcadia-effects`

Expected: exit code 0 and an independent `.git` directory at the target.

- [x] **Step 3: Record the exact upstream state**

Run: `git -C E:\tutienidle-tools\arcadia-effects rev-parse HEAD` and `git -C E:\tutienidle-tools\arcadia-effects remote -v`

Expected: one commit SHA and `origin` pointing to the requested repository.

### Task 2: Verify requirements and the editor server

**Files:**
- Inspect: `E:\tutienidle-tools\arcadia-effects\README.md`
- Inspect: `E:\tutienidle-tools\arcadia-effects\Arcada Effects\README.md` if present
- Execute: upstream `run.bat` or `server.mjs`

**Interfaces:**
- Consumes: installed Node.js and the cloned editor
- Produces: verified HTTP response from the editor's declared local URL

- [x] **Step 1: Confirm the installed Node.js version**

Run: `node --version`

Expected: a valid version string; Arcadia declares Node.js as its only server-mode requirement.

- [x] **Step 2: Locate the actual application root and read its agent/format documentation**

Inspect the clone for `server.mjs`, `run.bat`, `library/`, `CLAUDE.md`, `skills/`, and `docs/FORMAT.md`.

Expected: one application root containing those editor surfaces.

- [x] **Step 3: Start the server without modifying the upstream checkout**

Run `run.bat`, or `node server.mjs` when a non-interactive launch is required.

Expected: the editor listens on its declared port, normally `5179`.

- [x] **Step 4: Probe the editor and stop the verification process**

Request `http://127.0.0.1:5179/` and confirm an HTTP success plus Arcadia editor content, then stop only the process started for this check.

Expected: HTTP 200 and editor HTML; no lingering verification process.

### Task 3: Add the minimal Tu Tien IDLE discovery bridge

**Files:**
- Create: `game/docs/tooling/arcadia-effects.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: verified clone path, app root, launch URL, library/export contracts
- Produces: local/self-hosted instructions and a separate cloud-hosted bootstrap workflow

- [x] **Step 1: Write the focused tooling guide**

Document the canonical local path, actual application root, commands, URL, `library/*.json`, export modes, Phaser handoff boundary, cloud bootstrap path, and the rule that exported assets are not integrated without a separate authorized task.

- [x] **Step 2: Add a short contextual pointer in `AGENTS.md`**

Add a small external-VFX-tooling section that tells agents to read the tooling guide only for Arcadia/VFX-authoring work.

- [x] **Step 3: Confirm the game diff is documentation-only**

Run: `git diff -- AGENTS.md game/docs/tooling/arcadia-effects.md game/docs/superpowers/plans/2026-10-04-arcadia-effects-tooling-bridge.md`

Expected: only Markdown additions/changes; no gameplay or configuration edits.

### Task 4: Verify references and handoff

**Files:**
- Verify: `AGENTS.md`
- Verify: `game/docs/tooling/arcadia-effects.md`
- Verify: `game/docs/superpowers/plans/2026-10-04-arcadia-effects-tooling-bridge.md`

**Interfaces:**
- Consumes: final docs and external checkout
- Produces: evidence-backed local/cloud operating instructions

- [x] **Step 1: Check every documented local path exists**

Use `Test-Path` for the clone, app root, `server.mjs`, `library`, `docs/FORMAT.md`, and agent guidance files.

Expected: every local path documented as installed resolves successfully.

- [x] **Step 2: Check key wording and cross-references**

Search for the install path, URL, library contract, export contract, cloud limitation, Phaser handoff, and the `AGENTS.md` link.

Expected: every required topic appears once in the focused guide and the root pointer resolves.

- [x] **Step 3: Recheck repository scope**

Run `git status --short` and targeted `git diff --check` without disturbing unrelated files.

Expected: only the task-owned Markdown files are new/modified for this task; whitespace checks pass.
