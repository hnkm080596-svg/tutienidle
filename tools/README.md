# Claude → Codex → Claude workflow

This local orchestrator gives each phase a fresh agent session and an isolated Git worktree:

1. Claude inspects the task in read-only plan mode.
2. Codex implements the plan with workspace-write permissions.
3. Project tests, type checking, and build run locally.
4. A fresh Claude session reviews the diff using structured output.
5. Codex receives review findings for at most two implementation cycles.

## Prerequisites

- A clean Git working tree. Commit or stash existing work first.
- `claude`, `codex`, `git`, `python`, and `npm.cmd` available.
- Claude and Codex authenticated.

Run the environment check from the repository root:

```powershell
python tools/agent_workflow.py doctor
```

Start a task:

```powershell
.\workflow.cmd
```

The default task is read from `TASK.md`. Without a `## Mode` section, a lightweight,
read-only NVIDIA Nemotron advisor recommends `Quick`, `Balanced`, or `Full`. It starts
automatically at high/medium confidence and asks the user only at low confidence or on provider failure.
Add `## Mode` or pass `--mode` to bypass advice. Advanced users can
still supply text directly with `--task` or choose another file with `--task-file`.

Inspect a run:

```powershell
python tools/agent_workflow.py status .agent-runs/<run-id>
```

Artifacts are kept in `.agent-runs/`. Implementation work remains on the generated `agent/<run-id>` branch and in `.agent-worktrees/<run-id>`. The workflow never commits, pushes, deploys, or deletes a worktree automatically.

Use `CLAUDE_BIN` or `CODEX_BIN` to override executable discovery. Models, verification commands, and the review-cycle limit are configured in `tools/workflow.json`.
The advisor reads `NVIDIA_API_KEY` from the process environment and never stores it in the repository.
