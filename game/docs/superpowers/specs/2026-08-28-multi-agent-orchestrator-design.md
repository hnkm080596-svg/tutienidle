# Multi-Agent Orchestrator Design

Date: 2026-08-28

## 1. Purpose

Replace the current linear `Claude -> Codex -> verification -> Claude review`
workflow with a local, cross-provider orchestrator that accepts one user task,
decomposes it automatically, and coordinates five terminal-based coding agents.

The workflow must:

- Use Codex CLI, Claude Code, two OpenCode Qwen workers, and one OpenCode GLM
  worker.
- Run independent implementation tasks concurrently in isolated Git worktrees.
- Let agents create commits on task branches.
- Cherry-pick accepted task commits into a run-specific staging branch.
- Never push and never merge into `master`.
- Stop with a reviewed, verified staging branch for the user to inspect.
- Treat Codex and Claude Code as scarce frontier resources.
- Use the three OpenCode workers for high-volume discovery, implementation,
  testing, summarization, and routine review.
- Keep all API credentials outside the repository, prompts, logs, reports, and
  state database.

## 2. Current State

The repository already contains a local Python workflow in
`tools/agent_workflow.py`, configuration in `tools/workflow.json`, prompts and
schemas under `tools/`, run artifacts in `.agent-runs/`, and isolated checkouts
in `.agent-worktrees/`.

The current workflow is sequential. In Full mode Claude Code plans, Codex
implements, project verification runs, and a fresh Claude Code session reviews.
It does not decompose a task into a dependency graph or schedule multiple
writers.

The installed terminal tools observed during design are:

- Codex CLI `0.150.0-alpha.8`.
- Claude Code `2.1.231`.
- OpenCode `1.18.23`.

On this Windows machine, PowerShell resolves `opencode` to `opencode.ps1`, which
is blocked by the current execution policy. `opencode.cmd` works. All automated
OpenCode invocations must therefore call `opencode.cmd` directly; the workflow
must not weaken the user's PowerShell execution policy.

OpenCode already has a `tokenrouter` credential and exposes this configured
Qwen model:

```text
tokenrouter/qwen/qwen3.8-max-free
```

Kira AI exposes an OpenAI-compatible Chat Completions API with this base URL:

```text
https://kiraai.vn/api/v1
```

The configured GLM model ID will be `glm-5.3`. The full
`/chat/completions` path must not be used as `baseURL`, because the OpenAI-
compatible provider appends that endpoint itself.

Existing legacy runs and worktrees must remain untouched. The new orchestrator
may read their `run.json` files for status compatibility, but it must not resume
them using the new scheduler.

## 3. Authority and Safety Boundary

The orchestrator may:

- Create run directories, task branches, worktrees, and a staging branch.
- Run the configured agent CLIs and project verification commands.
- Let a worker commit changes inside its isolated task branch.
- Cherry-pick accepted commits into the run staging branch.
- Create follow-up commits that repair staging verification failures.

The orchestrator may not:

- Push any branch or tag.
- Merge into `master` or another user branch.
- Commit directly on `master`.
- Delete branches, worktrees, run artifacts, or user files automatically.
- Read `.env`, `APIKey`, credential stores, or other repository secrets.
- Put API keys or authorization headers in command arguments, prompts, logs,
  SQLite, JSON artifacts, or reports.
- Use `--dangerously-bypass-approvals-and-sandbox`, OpenCode `--auto`, or an
  equivalent unrestricted mode.

`AGENTS.md` must be updated narrowly so orchestrator-managed commits and
staging cherry-picks are allowed while push and merge remain prohibited.

## 4. High-Level Architecture

The orchestrator is a deterministic Python controller, not a sixth LLM agent.
It owns state, scheduling, Git operations, process execution, verification, and
reporting. LLM agents own planning judgments, implementation, debugging, and
review.

```text
TASK.md or a task supplied by Codex
              |
              v
     Cheap planner and discovery
        (GLM/Qwen workers)
              |
              v
     Frontier validation if needed
        (Claude Code or Codex)
              |
              v
        Validated task DAG
              |
              v
       Deterministic scheduler
      /      /      |      \
  Codex  Claude  Qwen x2   GLM
      \      \      |      /
              v
   test -> cross-review -> commit
              |
              v
       cherry-pick to staging
              |
              v
 full test + type-check + build
              |
              v
 final report; no push or merge
```

The implementation is split into independently testable modules:

```text
tools/orchestrator/
|-- cli.py
|-- config.py
|-- planner.py
|-- dag.py
|-- scheduler.py
|-- state.py
|-- git_workspace.py
|-- verifier.py
|-- reviewer.py
|-- reporter.py
`-- adapters/
    |-- base.py
    |-- codex.py
    |-- claude.py
    `-- opencode.py
```

`workflow.cmd` remains the user-facing entrypoint. The existing
`tools/agent_workflow.py` becomes a compatibility entrypoint that dispatches to
the new orchestrator.

## 5. Worker Profiles and Frontier Token Policy

### 5.1 Initial roles

| Worker | Preferred responsibilities |
| --- | --- |
| Claude Code | High-risk architecture validation, high-risk review |
| Codex | Complex implementation, difficult debugging, final audit |
| Qwen 1 | Discovery, bounded implementation, unit tests |
| Qwen 2 | Parallel bounded implementation, fixes, routine cross-review |
| GLM | Initial task decomposition, dependency analysis, implementation, data/docs, routine review |

These are preferences, not permanent ownership. The scheduler may choose a
different compatible worker based on availability, prior results, and task
risk. An agent must never be the principal reviewer of its own work.

### 5.2 Cheap-first routing

The default path uses GLM and Qwen before frontier agents:

| Task risk | Implementation | Review |
| --- | --- | --- |
| Low | Qwen or GLM | A different Qwen/GLM worker |
| Medium | Qwen or GLM | Exactly one frontier agent |
| High | Qwen/GLM or Codex | The other suitable frontier agent |
| Architectural or difficult debugging | Codex or Claude Code | The other frontier agent |

Frontier escalation is allowed when one or more of these conditions holds:

- The task changes shared contracts, save behavior, cross-domain architecture,
  build configuration, or security-sensitive code.
- The cheap planner reports low confidence or produces an invalid DAG twice.
- Two cheap workers disagree on the diagnosis or required behavior.
- Verification fails twice without a stable root cause.
- A staging conflict requires semantic integration across domains.
- Final verification fails after all cheap repair attempts.

### 5.3 Token-saving controls

- Low-risk tasks do not call Codex or Claude Code.
- Medium-risk tasks use at most one frontier model unless escalated.
- Full logs and broad repository context are summarized by a cheap worker before
  frontier review.
- Frontier prompts contain the task, acceptance criteria, declared scope,
  relevant source excerpts, candidate diff, and concise verification results.
- Frontier agents do not scan the whole repository by default.
- Claude Code print-mode calls use a configurable `--max-budget-usd` ceiling.
- Codex uses low or medium reasoning for normal validation and review; high
  reasoning is reserved for architecture, difficult debugging, and final audit.
- A frontier implementation session is resumed only for fixes to the same task.
  Review uses a fresh independent session.
- Per-run frontier call counts and estimated spend are recorded in metadata and
  shown in the final report.

## 6. Terminal and API Configuration

### 6.1 Codex

The adapter uses non-interactive mode with structured output and an isolated
workspace:

```text
codex exec -C <worktree> --sandbox workspace-write --json \
  --output-schema <schema> <prompt>
```

Authentication is configured outside the repository using Codex API-key login.
The orchestrator checks `codex login status` but never reads cached credentials.

### 6.2 Claude Code

The adapter uses print mode with structured streaming output, an explicit
permission mode, and a per-call budget:

```text
claude -p --output-format stream-json --permission-mode acceptEdits \
  --max-budget-usd <budget> --model <model> <prompt>
```

Read-only planning and review calls use plan/read-only permissions. The API key
is supplied by Claude Code's supported terminal authentication mechanism, such
as `ANTHROPIC_API_KEY`, without being written by the orchestrator.

### 6.3 OpenCode Qwen workers

Both Qwen workers use separate sessions, task branches, worktrees, and random
local ports while sharing the configured Token Router model:

```text
opencode.cmd run --format json --agent build \
  --model tokenrouter/qwen/qwen3.8-max-free \
  --dir <worktree> <prompt>
```

They are separate workers even though they use the same provider/model. Rate
limits are tracked at the shared provider level.

### 6.4 OpenCode GLM worker

A project-local `opencode.json` defines the `kiraai` OpenAI-compatible provider:

- Provider ID: `kiraai`.
- Package: OpenAI-compatible Chat Completions provider supported by the installed
  OpenCode version.
- Base URL: `https://kiraai.vn/api/v1`.
- Model ID: `glm-5.3`.
- Credential source: OpenCode credential store or an environment substitution;
  never a literal key in the repository.

The worker command is:

```text
opencode.cmd run --format json --agent build \
  --model kiraai/glm-5.3 --dir <worktree> <prompt>
```

The user performs the one interactive credential step after the configuration
exists:

```powershell
opencode.cmd auth login -p kiraai
```

### 6.5 Doctor checks

`workflow.cmd doctor` checks without printing credentials:

- Binary discovery and version for Codex, Claude Code, and `opencode.cmd`.
- Codex authentication status.
- Claude Code authentication availability through a harmless diagnostic.
- Presence of OpenCode provider names, not credential values.
- Availability of `tokenrouter/qwen/qwen3.8-max-free`.
- Availability of `kiraai/glm-5.3` after the user logs in.
- Git, Python, Node, npm, and project verification commands.
- Whether the repository is clean enough to establish a baseline.

## 7. Task DAG

The planner must emit schema-validated JSON rather than only prose. Each task
contains:

- Stable task ID and objective.
- Dependency IDs.
- Read context.
- Declared write scope and forbidden scope.
- Acceptance criteria.
- Targeted verification commands.
- Risk level and capability requirements.
- Preferred worker, if any.

Example:

```json
{
  "id": "combat-hp-events",
  "objective": "Update the HP bar immediately after damage events",
  "depends_on": ["battle-event-contract"],
  "read_context": [
    "game/src/core/battle/**",
    "game/src/components/game/combat/**"
  ],
  "write_scope": [
    "game/src/core/battle/BattleEvents.ts",
    "game/src/components/game/combat/CombatStatusBar.vue",
    "game/src/core/battle/*.test.ts"
  ],
  "forbidden_scope": [
    "game/src/services/save/**",
    "game/package-lock.json"
  ],
  "acceptance_criteria": [
    "HP changes immediately after a damage event",
    "The UI does not wait for battle completion"
  ],
  "verification": ["targeted-tests", "type-check"],
  "preferred_worker": "qwen-1",
  "risk": "medium"
}
```

The DAG validator rejects cycles, missing dependencies, tasks without acceptance
criteria, invalid paths, unsafe branch names, and independent tasks with
overlapping declared write scopes.

When file scope cannot be predicted safely, the planner creates a read-only
discovery task first. Implementation begins only after discovery returns a
concrete scope.

## 8. Scheduling and File Ownership

A task is ready only when:

- Every dependency has been accepted and cherry-picked to staging.
- Its write scope does not overlap any active write lease.
- No exclusive resource it needs is locked.
- A compatible worker is available.

Default resource limits are:

- Three concurrent code-writing workers.
- Two concurrent read-only reviewers.
- One dependency bootstrap at a time.
- Two concurrent targeted Vitest processes.
- One full test suite or full build at a time.
- One active write lease per worker.

Shared hotspots are serialized even when the planner labels tasks independent.
Initial hotspots include `GameManager.ts`, `Player.ts`, shared stores, save code,
stat contracts, package manifests and lockfiles, and cross-domain registries.

If a worker needs another file, it returns a scope-change request instead of
silently expanding its authority. The scheduler grants the expansion only when
it does not conflict with another lease. After the worker stops, the
orchestrator compares `git diff --name-only` with the final scope. Any undeclared
change produces `scope_violation` and cannot reach staging.

## 9. Task Execution, Review, and Staging

Each task follows this lifecycle:

```text
planned -> ready -> running -> verifying -> reviewing -> accepted -> staged
```

Failure states are `blocked`, `failed`, `scope_violation`,
`integration_conflict`, and `interrupted`.

The execution sequence is:

1. Create a task branch and worktree from the current staging commit.
2. Bootstrap dependencies with `npm.cmd ci --prefer-offline` when required.
3. Run the selected worker with its scoped task contract.
4. Run worker self-checks and targeted tests.
5. Create one or more candidate commits on the task branch.
6. Independently validate changed paths and rerun targeted verification.
7. Assign a different provider/model as read-only reviewer.
8. Resume the implementation session for actionable findings, up to two repair
   cycles by default.
9. Cherry-pick the accepted task commit sequence into staging.
10. Run batch-level targeted tests and type-check on staging.

The reviewer emits schema-validated findings with verdict, severity, file and
line references, missing tests, scope concerns, and confidence.

If cherry-pick conflicts, the orchestrator aborts the incomplete cherry-pick,
preserves both branches, and creates an integration-conflict worktree from
staging. Codex or Claude Code resolves the semantic conflict, then a different
frontier agent reviews the integration commit before it is staged.

If staging verification fails, the orchestrator does not reset staging. It
creates a repair task on top of staging, verifies the repair, and records the
failure and repair relationship.

## 10. Durable State and Resume

Concurrent state is stored in SQLite from the Python standard library. Only the
orchestrator writes the database. Worker output is written to task-specific
artifact files and imported transactionally.

```text
.agent-runs/<run-id>/
|-- state.db
|-- task.md
|-- plan.json
|-- status.json
|-- logs/
|-- reviews/
|-- verification/
`-- final-report.md
```

Human-readable `status.json` is exported after each state transition.

Supported commands are:

```powershell
.\workflow.cmd run
.\workflow.cmd status <run-id>
.\workflow.cmd watch <run-id>
.\workflow.cmd resume <run-id>
.\workflow.cmd cancel <run-id>
.\workflow.cmd report <run-id>
.\workflow.cmd doctor
```

`cancel` stops managed processes and preserves branches, worktrees, commits, and
artifacts. It does not clean up automatically.

On resume, the orchestrator validates state, worktrees, branches, staged commits,
and verification artifacts. Previously running tasks become `interrupted`.
Completed staged tasks are retained. If an agent session cannot be resumed, a
new session receives a concise task, diff, and feedback summary.

## 11. Retry and Failure Policy

Infrastructure failures such as a CLI crash, timeout, network outage, or rate
limit retry once on the same worker. Rate limits use exponential backoff. A
second failure reassigns the task to another compatible worker when safe.

Implementation failures return concise verification output to the same worker
session for at most two repair cycles.

Review failures return structured findings and rerun all relevant verification.

Architecture or scope failures do not retry blindly. They return to the cheap
planner for DAG repair. Frontier validation is invoked only if cheap replanning
fails or the change is high risk.

## 12. Verification and Testing

### 12.1 Per-task verification

- Worker self-check and targeted tests.
- Independent orchestrator rerun of targeted tests.
- Scope validation.
- Worktree cleanliness after candidate commit.
- Read-only cross-review by a different agent.

### 12.2 Staging verification

After each accepted batch, run affected tests and type-check. Before the run can
report success, run from `game/`:

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

### 12.3 Orchestrator unit tests

Tests cover DAG validation, cycle detection, Windows path normalization,
case-insensitive scope overlap, leases, scope expansion, agent selection,
reviewer separation, state transitions, timeout, retry, rate limits, resume,
branch-name validation, command argument construction, and secret redaction.

### 12.4 Integration tests

Integration tests use fake agent executables and a temporary Git repository so
they incur no model cost. They cover parallel worktrees, candidate commits,
staging cherry-picks, review feedback, verification failure, scope violations,
cherry-pick conflicts, cancellation, resume, and confirmation that no push or
merge occurs.

The rollout uses a two-fake-worker smoke run before any real model call, then one
small real task with two agents before enabling the default three-writer limit.

## 13. Reporting

The terminal watch view shows each task, worker, reviewer, dependency state, and
current phase. The final report includes:

- Run ID and staging branch.
- Accepted task commits in cherry-pick order.
- Worker and reviewer for every task.
- Verification commands and outcomes.
- Frontier calls, reasons for escalation, and configured budget usage.
- Failed, blocked, or skipped tasks.
- Conflicts and repair commits.
- Scope violations.
- Remaining limitations and risks.
- Commands for the user to inspect staging against `master`.

The run is never labeled successful when final test, type-check, or build fails.

## 14. Migration and Rollout

1. Preserve all legacy runs and worktrees.
2. Add the project-local OpenCode provider and worker profiles without secrets.
3. Have the user perform the interactive Kira credential login.
4. Add adapter doctor checks and verify all five terminal agents.
5. Add the SQLite state layer and legacy status reader.
6. Add DAG planning, validation, scheduling, leases, and worktree management.
7. Add worker execution, review, verification, commit, and staging cherry-pick.
8. Add resume, cancellation, reporting, and frontier budget controls.
9. Run unit and fake-agent integration tests.
10. Run a small real two-agent smoke task.
11. Enable up to three concurrent writers after the smoke task succeeds.

The repository must have a clean, intentional baseline before a real
multi-agent run. The orchestrator must not absorb or commit the current broad
working-tree changes automatically.

## 15. Success Criteria

The design is complete when:

- One command accepts a task and automatically produces a validated task DAG.
- At least two independent fake workers demonstrably run concurrently in
  isolated worktrees.
- Codex, Claude Code, two Token Router Qwen workers, and Kira GLM can all be
  invoked headlessly through adapters and pass doctor checks.
- Routine low-risk work completes without a frontier call.
- Frontier escalation is recorded and budget-limited.
- Agents cannot stage out-of-scope changes.
- Accepted task commits are cherry-picked only into the run staging branch.
- No workflow path pushes or merges into `master`.
- Interrupted runs resume without repeating accepted staged tasks.
- The final report includes complete verification and frontier-usage evidence.
