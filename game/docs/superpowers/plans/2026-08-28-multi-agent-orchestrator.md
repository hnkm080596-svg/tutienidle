# Multi-Agent Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local one-command orchestrator that automatically decomposes a task and coordinates Codex CLI, Claude Code, two Token Router Qwen OpenCode workers, and one Kira GLM OpenCode worker in isolated Git worktrees.

**Architecture:** Keep `workflow.cmd` and `tools/agent_workflow.py` as compatibility entrypoints, but move new behavior into focused Python modules under `tools/orchestrator/`. A deterministic controller stores state in SQLite, validates a structured task DAG, leases write scopes, launches terminal adapters, verifies and cross-reviews candidate commits, then cherry-picks accepted commits into a run-specific staging branch without pushing or merging to `master`.

**Tech Stack:** Python 3 standard library (`argparse`, `dataclasses`, `json`, `sqlite3`, `subprocess`, `threading`, `unittest`), Git worktrees, Codex CLI, Claude Code, OpenCode CLI, npm/Vitest/vue-tsc/Vite.

**Spec:** `game/docs/superpowers/specs/2026-08-28-multi-agent-orchestrator-design.md`

## Global Constraints

- Application root is `game/`; orchestration code remains under repository-root `tools/`.
- Do not add Python or npm dependencies.
- Use `opencode.cmd`, never the PowerShell-blocked `opencode.ps1` launcher.
- Token Router Qwen model is exactly `tokenrouter/qwen/qwen3.8-max-free`.
- Kira base URL is exactly `https://kiraai.vn/api/v1`; Kira model ID is exactly `glm-5.3`.
- Never store API keys in the repository, prompts, logs, SQLite, JSON artifacts, or reports.
- Workers may commit only in isolated task branches; accepted commits may be cherry-picked only into a run staging branch.
- Never push and never merge into `master`.
- Preserve all legacy `.agent-runs/` and `.agent-worktrees/`; do not automatically resume or delete them.
- Use cheap-first routing: Qwen/GLM handle routine volume; Codex/Claude are budgeted escalation resources.
- Run relevant tests throughout and `npm.cmd run test`, `npm.cmd run type-check`, and `npm.cmd run build` before declaring the implementation complete.

---

## File Map

### Entrypoints and configuration

- Create `opencode.json`: project-local Token Router/Qwen and Kira/GLM worker profiles with no credential literal.
- Modify `workflow.cmd`: preserve current usage while forwarding every subcommand to the Python compatibility entrypoint.
- Modify `tools/agent_workflow.py`: reduce to a compatibility shim that imports and calls `tools.orchestrator.cli.main`.
- Replace `tools/workflow.json`: add worker profiles, frontier budgets, resource limits, retry policy, verification commands, and legacy paths.
- Modify `AGENTS.md`: allow orchestrator commits/cherry-picks only on isolated task/staging branches while retaining the push/merge prohibition.

### Orchestrator package

- Create `tools/orchestrator/__init__.py`: package marker and version.
- Create `tools/orchestrator/errors.py`: shared `WorkflowError`, `ConfigError`, `StateTransitionError`, and `ScopeViolationError`.
- Create `tools/orchestrator/models.py`: typed enums/dataclasses for workers, tasks, reviews, commands, and run state.
- Create `tools/orchestrator/config.py`: load and validate `tools/workflow.json`; discover executable paths without reading credentials.
- Create `tools/orchestrator/process.py`: safe subprocess execution, streaming logs, timeout, cancellation, and redaction.
- Create `tools/orchestrator/dag.py`: parse and validate plan JSON, dependency ordering, readiness, and cycle detection.
- Create `tools/orchestrator/state.py`: SQLite schema, transactional state transitions, legacy state reader, and `status.json` export.
- Create `tools/orchestrator/scopes.py`: Windows-safe path normalization, glob overlap, hotspot locks, and write leases.
- Create `tools/orchestrator/git_workspace.py`: staging/task branch and worktree operations, changed-path validation, commits, and cherry-picks.
- Create `tools/orchestrator/routing.py`: cheap-first risk classification, worker selection, reviewer separation, budgets, and provider rate limits.
- Create `tools/orchestrator/planner.py`: GLM/Qwen plan generation, schema validation, cheap repair, and frontier escalation.
- Create `tools/orchestrator/verifier.py`: targeted verification, resource locks, full staging gate, and reports.
- Create `tools/orchestrator/reviewer.py`: cross-review selection, structured verdicts, and repair-cycle decisions.
- Create `tools/orchestrator/scheduler.py`: concurrent ready-task scheduling and orchestration state machine.
- Create `tools/orchestrator/reporter.py`: watch/status output and final Markdown report.
- Create `tools/orchestrator/cli.py`: `run`, `doctor`, `status`, `watch`, `resume`, `cancel`, and `report` commands.

### Terminal adapters

- Create `tools/orchestrator/adapters/__init__.py`: adapter registry.
- Create `tools/orchestrator/adapters/base.py`: `AgentAdapter` protocol and structured invocation result.
- Create `tools/orchestrator/adapters/codex.py`: `codex exec` and resume invocation.
- Create `tools/orchestrator/adapters/claude.py`: `claude -p`, read-only modes, session handling, and budget ceiling.
- Create `tools/orchestrator/adapters/opencode.py`: `opencode.cmd run`, separate sessions, model/profile selection, and JSON event parsing.

### Prompts and schemas

- Create `tools/prompts/cheap-plan.md`, `frontier-plan-review.md`, `worker-task.md`, `worker-repair.md`, and `cross-review.md`.
- Create `tools/schemas/plan.schema.json` and `tools/schemas/worker-result.schema.json`.
- Modify `tools/schemas/review.schema.json` to include missing tests, scope concerns, and confidence.

### Tests and documentation

- Create focused `unittest` modules under `tools/tests/` matching each orchestrator component.
- Create fake terminal agents under `tools/tests/fixtures/` for no-cost integration tests.
- Modify `tools/README.md`, `HUONG_DAN_WORKFLOW.md`, and `PROJECT_CONTEXT.md` for the new commands, authority boundary, and five-agent setup.

---

### Task 1: Configure and diagnose all five terminal workers

**Files:**
- Create: `opencode.json`
- Create: `tools/orchestrator/__init__.py`
- Create: `tools/orchestrator/errors.py`
- Create: `tools/orchestrator/models.py`
- Create: `tools/orchestrator/config.py`
- Create: `tools/orchestrator/adapters/__init__.py`
- Create: `tools/orchestrator/adapters/base.py`
- Create: `tools/orchestrator/adapters/codex.py`
- Create: `tools/orchestrator/adapters/claude.py`
- Create: `tools/orchestrator/adapters/opencode.py`
- Create: `tools/tests/test_config.py`
- Create: `tools/tests/test_adapters.py`
- Modify: `tools/workflow.json`

**Interfaces:**
- Produces: `WorkflowConfig.load(path: Path) -> WorkflowConfig`
- Produces: `WorkerConfig`, `CommandSpec`, `AgentRunResult`
- Produces: `AgentAdapter.build_command(request: AgentRequest) -> CommandSpec`
- Produces: `build_adapter(worker: WorkerConfig) -> AgentAdapter`

- [ ] **Step 1: Write configuration tests that lock exact worker IDs and secret-free OpenCode config**

```python
class WorkflowConfigTests(unittest.TestCase):
    def test_loads_exact_five_workers(self) -> None:
        config = WorkflowConfig.load(ROOT / "tools" / "workflow.json")
        self.assertEqual(
            {worker.id for worker in config.workers},
            {"codex", "claude", "qwen-1", "qwen-2", "glm"},
        )

    def test_project_opencode_config_contains_no_api_key_literal(self) -> None:
        raw = (ROOT / "opencode.json").read_text(encoding="utf-8")
        self.assertNotRegex(raw, r"(?i)(sk-|api[_-]?key\s*[\":=]+\s*[^\{])")
        parsed = json.loads(raw)
        self.assertEqual(parsed["provider"]["kiraai"]["options"]["baseURL"], "https://kiraai.vn/api/v1")
        self.assertIn("glm-5.3", parsed["provider"]["kiraai"]["models"])
```

- [ ] **Step 2: Run the tests and verify they fail because configuration types/files do not exist**

Run: `python -m unittest tools.tests.test_config -v`

Expected: import or file-not-found failure for `tools.orchestrator.config`/`opencode.json`.

- [ ] **Step 3: Add typed configuration models and exact five-worker configuration**

```python
@dataclass(frozen=True)
class WorkerConfig:
    id: str
    adapter: Literal["codex", "claude", "opencode"]
    model: str | None
    capabilities: tuple[str, ...]
    frontier: bool
    provider_group: str
    max_concurrent_tasks: int = 1


@dataclass(frozen=True)
class WorkflowConfig:
    project_dir: str
    run_root: str
    worktree_root: str
    workers: tuple[WorkerConfig, ...]
    max_writers: int
    max_reviewers: int
    verification_commands: tuple[tuple[str, ...], ...]
```

`opencode.json` must define primary agents `qwen-worker-1`, `qwen-worker-2`, and `glm-worker`; both Qwen agents use `tokenrouter/qwen/qwen3.8-max-free`, while GLM uses `kiraai/glm-5.3`.

- [ ] **Step 4: Write adapter command tests**

```python
def test_opencode_uses_cmd_launcher_and_isolated_directory(self) -> None:
    command = OpenCodeAdapter(worker).build_command(request)
    self.assertTrue(command.argv[0].lower().endswith("opencode.cmd"))
    self.assertIn("--dir", command.argv)
    self.assertIn("tokenrouter/qwen/qwen3.8-max-free", command.argv)

def test_claude_frontier_call_has_budget(self) -> None:
    command = ClaudeAdapter(worker).build_command(request)
    self.assertIn("--max-budget-usd", command.argv)

def test_codex_uses_workspace_write_without_yolo(self) -> None:
    command = CodexAdapter(worker).build_command(request)
    self.assertEqual(command.argv[:2], (command.argv[0], "exec"))
    self.assertIn("workspace-write", command.argv)
    self.assertNotIn("--dangerously-bypass-approvals-and-sandbox", command.argv)
```

- [ ] **Step 5: Implement minimal adapters and executable discovery**

Use argv tuples, stdin prompts, explicit cwd, structured-output flags, and no shell interpolation. Resolve OpenCode in this order: `OPENCODE_BIN`, `shutil.which("opencode.cmd")`, npm roaming fallback. Do not fall back to `opencode.ps1`.

- [ ] **Step 6: Run Task 1 tests**

Run: `python -m unittest tools.tests.test_config tools.tests.test_adapters -v`

Expected: PASS.

- [ ] **Step 7: Validate the installed OpenCode configuration without invoking a paid model**

Run: `opencode.cmd models tokenrouter`

Expected output contains: `tokenrouter/qwen/qwen3.8-max-free`.

Run after the user enters the Kira credential: `opencode.cmd models kiraai`

Expected output contains: `kiraai/glm-5.3`.

- [ ] **Step 8: Commit the terminal-worker foundation**

```powershell
git add -- opencode.json tools/workflow.json tools/orchestrator tools/tests/test_config.py tools/tests/test_adapters.py
git commit -m "feat: configure five terminal agent workers"
```

### Task 2: Add safe process execution and credential-redacting doctor checks

**Files:**
- Create: `tools/orchestrator/process.py`
- Create: `tools/tests/test_process.py`
- Create: `tools/tests/test_doctor.py`
- Modify: `tools/orchestrator/cli.py`
- Modify: `tools/orchestrator/config.py`

**Interfaces:**
- Consumes: `CommandSpec`
- Produces: `ProcessRunner.run(spec: CommandSpec, cancel: threading.Event) -> AgentRunResult`
- Produces: `run_doctor(config: WorkflowConfig) -> tuple[DoctorCheck, ...]`

- [ ] **Step 1: Write failing tests for argv execution, timeout, cancellation, and redaction**

```python
def test_redacts_known_secret_values_from_log(self) -> None:
    runner = ProcessRunner(secret_values=("super-secret",))
    result = runner.run(CommandSpec(argv=(sys.executable, "-c", "print('super-secret')"), cwd=TMP))
    self.assertNotIn("super-secret", result.output)
    self.assertIn("[REDACTED]", result.output)

def test_runner_never_uses_shell(self) -> None:
    with mock.patch("subprocess.Popen") as popen:
        runner.run(spec)
        self.assertFalse(popen.call_args.kwargs["shell"])
```

- [ ] **Step 2: Run tests and observe the missing runner failure**

Run: `python -m unittest tools.tests.test_process -v`

Expected: FAIL because `ProcessRunner` is undefined.

- [ ] **Step 3: Implement streaming `ProcessRunner` with process-tree cancellation on Windows**

Use `subprocess.Popen(..., shell=False, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)` on Windows. On timeout/cancel, call `taskkill /PID <pid> /T /F` using a fixed argv list, then wait and record a typed failure. Redact configured secret values before printing or writing any output.

- [ ] **Step 4: Write doctor tests using fake adapters**

```python
def test_doctor_reports_five_workers_without_credentials(self) -> None:
    checks = run_doctor(config, registry=fake_registry)
    self.assertEqual({check.worker_id for check in checks if check.kind == "worker"}, EXPECTED_WORKERS)
    self.assertNotIn("api-key-value", json.dumps([asdict(check) for check in checks]))
```

- [ ] **Step 5: Implement doctor checks**

Check versions, Codex login status, Claude auth status, `opencode.cmd auth list`, exact Token Router model availability, Kira model availability, Git/Python/Node/npm, project path, and repository blockers. Mark a missing Kira credential as `ACTION_REQUIRED`, not an orchestrator crash.

- [ ] **Step 6: Run tests and the real doctor**

Run: `python -m unittest tools.tests.test_process tools.tests.test_doctor -v`

Run: `python tools/agent_workflow.py doctor`

Expected: all installed tools are identified; Kira is either READY or gives the exact command `opencode.cmd auth login -p kiraai`; no secret value appears.

- [ ] **Step 7: Commit safe execution and doctor support**

```powershell
git add -- tools/orchestrator/process.py tools/orchestrator/cli.py tools/orchestrator/config.py tools/tests/test_process.py tools/tests/test_doctor.py
git commit -m "feat: add safe agent process diagnostics"
```

### Task 3: Define and validate the structured task DAG

**Files:**
- Create: `tools/schemas/plan.schema.json`
- Create: `tools/orchestrator/dag.py`
- Create: `tools/tests/test_dag.py`
- Create: `tools/prompts/cheap-plan.md`
- Create: `tools/prompts/frontier-plan-review.md`

**Interfaces:**
- Produces: `TaskSpec`, `TaskPlan`, `RiskLevel`, `TaskStatus`
- Produces: `load_plan(value: Mapping[str, object]) -> TaskPlan`
- Produces: `TaskPlan.ready(completed: set[str]) -> tuple[TaskSpec, ...]`

- [ ] **Step 1: Write failing DAG tests**

```python
def test_rejects_cycle(self) -> None:
    with self.assertRaises(PlanValidationError):
        load_plan(plan(tasks=[task("a", depends_on=["b"]), task("b", depends_on=["a"])]))

def test_ready_returns_only_dependency_satisfied_tasks(self) -> None:
    parsed = load_plan(plan(tasks=[task("a"), task("b", depends_on=["a"])]))
    self.assertEqual([item.id for item in parsed.ready(set())], ["a"])
    self.assertEqual([item.id for item in parsed.ready({"a"})], ["b"])
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `python -m unittest tools.tests.test_dag -v`

Expected: FAIL because plan types and validation are missing.

- [ ] **Step 3: Implement exact plan types and validation**

```python
class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

@dataclass(frozen=True)
class TaskSpec:
    id: str
    objective: str
    depends_on: tuple[str, ...]
    read_context: tuple[str, ...]
    write_scope: tuple[str, ...]
    forbidden_scope: tuple[str, ...]
    acceptance_criteria: tuple[str, ...]
    verification: tuple[tuple[str, ...], ...]
    capabilities: tuple[str, ...]
    risk: RiskLevel
```

Validate schema shape, unique IDs, dependency existence, no self-dependency, no cycle, nonempty acceptance criteria, and repository-relative paths without `..` or absolute prefixes.

- [ ] **Step 4: Add cheap planner and frontier validation prompts**

The cheap prompt must require GLM/Qwen to emit only schema-valid JSON, create read-only discovery tasks when scope is uncertain, identify hotspots, and attach a confidence value. The frontier prompt receives only the task, compact context, candidate DAG, and validation errors; it may correct the DAG but may not edit code.

- [ ] **Step 5: Run DAG tests**

Run: `python -m unittest tools.tests.test_dag -v`

Expected: PASS.

- [ ] **Step 6: Commit the task DAG contract**

```powershell
git add -- tools/schemas/plan.schema.json tools/orchestrator/dag.py tools/orchestrator/models.py tools/prompts/cheap-plan.md tools/prompts/frontier-plan-review.md tools/tests/test_dag.py
git commit -m "feat: add validated task dag"
```

### Task 4: Add transactional SQLite state and legacy status compatibility

**Files:**
- Create: `tools/orchestrator/state.py`
- Create: `tools/tests/test_state.py`
- Modify: `tools/orchestrator/models.py`

**Interfaces:**
- Produces: `StateStore.create(run_dir: Path, run: RunRecord, tasks: Sequence[TaskSpec]) -> StateStore`
- Produces: `StateStore.transition(task_id: str, expected: TaskStatus, target: TaskStatus, **fields: object) -> None`
- Produces: `StateStore.export_status(path: Path) -> None`
- Produces: `read_legacy_status(run_dir: Path) -> Mapping[str, object]`

- [ ] **Step 1: Write failing transactional state tests**

```python
def test_rejects_invalid_transition(self) -> None:
    store = make_store()
    with self.assertRaises(StateTransitionError):
        store.transition("t1", TaskStatus.PLANNED, TaskStatus.STAGED)

def test_compare_and_set_prevents_stale_worker_update(self) -> None:
    store.transition("t1", TaskStatus.PLANNED, TaskStatus.READY)
    with self.assertRaises(StateTransitionError):
        store.transition("t1", TaskStatus.PLANNED, TaskStatus.RUNNING)
```

- [ ] **Step 2: Run state tests and verify failure**

Run: `python -m unittest tools.tests.test_state -v`

Expected: FAIL because `StateStore` is missing.

- [ ] **Step 3: Implement SQLite schema and state machine**

Create tables `runs`, `tasks`, `attempts`, `leases`, `commits`, `reviews`, `verifications`, and `events`. Enable foreign keys, WAL mode, and busy timeout. All writes use `with connection:` transactions. Permit only the transitions defined in the spec lifecycle, plus `running -> interrupted` during resume.

- [ ] **Step 4: Implement atomic human-readable status export and legacy reads**

Write `status.json.tmp`, `fsync`, then `os.replace` to `status.json`. If a run has `run.json` but no `state.db`, return a read-only legacy view and reject resume with a clear error.

- [ ] **Step 5: Run state tests**

Run: `python -m unittest tools.tests.test_state -v`

Expected: PASS.

- [ ] **Step 6: Commit durable state support**

```powershell
git add -- tools/orchestrator/state.py tools/orchestrator/models.py tools/tests/test_state.py
git commit -m "feat: persist orchestrator run state"
```

### Task 5: Add Windows-safe scopes, leases, branches, and worktrees

**Files:**
- Create: `tools/orchestrator/scopes.py`
- Create: `tools/orchestrator/git_workspace.py`
- Create: `tools/tests/test_scopes.py`
- Create: `tools/tests/test_git_workspace.py`

**Interfaces:**
- Produces: `normalize_repo_path(value: str) -> PurePosixPath`
- Produces: `scopes_overlap(left: Sequence[str], right: Sequence[str]) -> bool`
- Produces: `LeaseManager.acquire(task_id: str, scopes: Sequence[str]) -> Lease`
- Produces: `GitWorkspace.create_run(run_id: str, baseline: str) -> RunWorkspace`
- Produces: `GitWorkspace.create_task(task: TaskSpec, staging_commit: str) -> TaskWorkspace`
- Produces: `GitWorkspace.validate_changed_paths(task: TaskSpec, branch: str) -> tuple[str, ...]`

- [ ] **Step 1: Write failing Windows path and overlap tests**

```python
def test_paths_are_case_insensitive_on_windows(self) -> None:
    self.assertTrue(scopes_overlap(["game/src/Core/**"], ["game/src/core/game/GameManager.ts"]))

def test_rejects_parent_escape(self) -> None:
    with self.assertRaises(ScopeViolationError):
        normalize_repo_path("../APIKey")

def test_hotspot_serializes_exact_file(self) -> None:
    leases.acquire("a", ["game/src/core/game/GameManager.ts"])
    with self.assertRaises(LeaseConflictError):
        leases.acquire("b", ["game/src/core/game/GameManager.ts"])
```

- [ ] **Step 2: Implement canonical scope matching and leases**

Normalize separators to `/`, reject absolute/parent paths, compare casefolded segments on Windows, support exact paths and trailing `/**` directory globs, and treat declared hotspots as exact serialized resources. Persist lease acquisition/release through `StateStore`.

- [ ] **Step 3: Write fake-repository Git tests**

```python
def test_creates_staging_and_task_worktrees_from_expected_commits(self) -> None:
    run = git_workspace.create_run("run-1", baseline)
    task = git_workspace.create_task(task_spec, run.staging_commit())
    self.assertEqual(git("rev-parse", "HEAD", cwd=task.path), run.staging_commit())

def test_scope_violation_blocks_candidate(self) -> None:
    write_file(task.path / "outside.txt", "bad")
    git("add", "outside.txt", cwd=task.path)
    with self.assertRaises(ScopeViolationError):
        git_workspace.validate_changed_paths(task_spec, task.branch)
```

- [ ] **Step 4: Implement Git operations with fixed argv and exact path validation**

Create staging branch `orchestrator/<run-id>` and task branches `agent/<run-id>/<task-id>`. Resolve every worktree path and assert it is below configured `.agent-worktrees/<run-id>/`. Implement commit and cherry-pick, but expose no push or merge method. On cherry-pick conflict, run `git cherry-pick --abort`, record the conflict, and preserve both branches.

- [ ] **Step 5: Run scope and Git tests**

Run: `python -m unittest tools.tests.test_scopes tools.tests.test_git_workspace -v`

Expected: PASS in temporary repositories; the real repository remains unchanged.

- [ ] **Step 6: Commit workspace isolation**

```powershell
git add -- tools/orchestrator/scopes.py tools/orchestrator/git_workspace.py tools/tests/test_scopes.py tools/tests/test_git_workspace.py
git commit -m "feat: isolate orchestrator task workspaces"
```

### Task 6: Implement cheap-first routing and frontier budgets

**Files:**
- Create: `tools/orchestrator/routing.py`
- Create: `tools/tests/test_routing.py`
- Modify: `tools/orchestrator/state.py`
- Modify: `tools/workflow.json`

**Interfaces:**
- Produces: `Router.select_worker(task: TaskSpec, available: Sequence[WorkerConfig]) -> WorkerConfig`
- Produces: `Router.select_reviewer(task: TaskSpec, worker: WorkerConfig, available: Sequence[WorkerConfig]) -> WorkerConfig`
- Produces: `FrontierBudget.authorize(worker_id: str, reason: EscalationReason) -> BudgetDecision`

- [ ] **Step 1: Write failing routing tests**

```python
def test_low_risk_never_uses_frontier(self) -> None:
    selected = router.select_worker(low_risk_task, all_workers)
    self.assertFalse(selected.frontier)

def test_medium_risk_uses_at_most_one_frontier_review(self) -> None:
    worker = router.select_worker(medium_task, all_workers)
    reviewer = router.select_reviewer(medium_task, worker, all_workers)
    self.assertLessEqual(int(worker.frontier) + int(reviewer.frontier), 1)

def test_reviewer_differs_from_worker_and_provider(self) -> None:
    reviewer = router.select_reviewer(task, qwen_1, all_workers)
    self.assertNotEqual(reviewer.id, qwen_1.id)
    self.assertNotEqual(reviewer.provider_group, qwen_1.provider_group)
```

- [ ] **Step 2: Implement deterministic scoring and hard budget gates**

Score capability match, availability, historical success, repair count, session continuity, latency, and frontier cost. Hard rules override scores: low-risk excludes frontier; reviewer cannot be the worker; Qwen 1 and Qwen 2 share a provider group; medium-risk permits one frontier participant; high-risk may use both only with recorded escalation reason.

- [ ] **Step 3: Persist routing evidence and frontier usage**

Record candidate scores, selected worker/reviewer, escalation reason, Claude budget ceiling, Codex reasoning level, call count, elapsed time, and reported usage when available. Never record prompt credentials or environment values.

- [ ] **Step 4: Run routing tests**

Run: `python -m unittest tools.tests.test_routing -v`

Expected: PASS.

- [ ] **Step 5: Commit token-aware routing**

```powershell
git add -- tools/orchestrator/routing.py tools/orchestrator/state.py tools/workflow.json tools/tests/test_routing.py
git commit -m "feat: route work with frontier budgets"
```

### Task 7: Implement planning, worker results, verification, and cross-review

**Files:**
- Create: `tools/orchestrator/planner.py`
- Create: `tools/orchestrator/verifier.py`
- Create: `tools/orchestrator/reviewer.py`
- Create: `tools/schemas/worker-result.schema.json`
- Create: `tools/prompts/worker-task.md`
- Create: `tools/prompts/worker-repair.md`
- Create: `tools/prompts/cross-review.md`
- Create: `tools/tests/test_planner.py`
- Create: `tools/tests/test_verifier.py`
- Create: `tools/tests/test_reviewer.py`
- Modify: `tools/schemas/review.schema.json`

**Interfaces:**
- Produces: `Planner.create_plan(task_text: str, context: str) -> TaskPlan`
- Produces: `Verifier.run_task(task: TaskSpec, workspace: Path) -> VerificationReport`
- Produces: `Verifier.run_staging(changed_tasks: Sequence[TaskSpec], workspace: Path, final: bool) -> VerificationReport`
- Produces: `Reviewer.review(task: TaskSpec, worker: WorkerConfig, candidate: CandidateCommit) -> ReviewResult`

- [ ] **Step 1: Write planner escalation tests with fake adapters**

```python
def test_valid_cheap_plan_does_not_call_frontier(self) -> None:
    plan = planner.create_plan("small task", "compact context")
    self.assertEqual(plan.tasks[0].risk, RiskLevel.LOW)
    self.assertEqual(frontier.calls, [])

def test_invalid_cheap_plan_repairs_then_escalates_once(self) -> None:
    cheap.responses = [INVALID_PLAN, INVALID_PLAN]
    planner.create_plan("cross-domain task", "context")
    self.assertEqual(len(frontier.calls), 1)
```

- [ ] **Step 2: Implement planner validation/repair/escalation flow**

Call GLM first, validate against `plan.schema.json`, ask a cheap Qwen repair once when invalid, then invoke one frontier validator only when cheap repair fails or risk rules require it. Store the final validated `plan.json` before any writer starts.

- [ ] **Step 3: Write verifier resource-lock tests**

```python
def test_only_one_full_build_runs_at_once(self) -> None:
    with ThreadPoolExecutor(max_workers=2) as pool:
        reports = list(pool.map(lambda _: verifier.run_full(workspace), range(2)))
    self.assertEqual(fake_runner.max_simultaneous("build"), 1)
```

- [ ] **Step 4: Implement targeted and staging verification**

Use task-declared argv commands only after validating executables against the allowed verification command prefixes. Limit targeted tests to two concurrent slots and full test/build to one. Final staging verification always runs test, type-check, and build in that order and stores exit code plus redacted output.

- [ ] **Step 5: Write and implement structured cross-review**

Extend review output to exact fields `verdict`, `summary`, `findings`, `missing_tests`, `scope_concerns`, and `confidence`. Reviewer prompts contain only task contract, candidate diff, relevant files, and concise verification report. Review adapters use read-only permissions.

- [ ] **Step 6: Run Task 7 tests**

Run: `python -m unittest tools.tests.test_planner tools.tests.test_verifier tools.tests.test_reviewer -v`

Expected: PASS.

- [ ] **Step 7: Commit planning and quality gates**

```powershell
git add -- tools/orchestrator/planner.py tools/orchestrator/verifier.py tools/orchestrator/reviewer.py tools/schemas tools/prompts tools/tests/test_planner.py tools/tests/test_verifier.py tools/tests/test_reviewer.py
git commit -m "feat: add multi-agent planning and review gates"
```

### Task 8: Implement concurrent scheduling, commits, and staging integration

**Files:**
- Create: `tools/orchestrator/scheduler.py`
- Create: `tools/tests/test_scheduler.py`
- Create: `tools/tests/fixtures/fake_agent.py`
- Modify: `tools/orchestrator/git_workspace.py`
- Modify: `tools/orchestrator/state.py`

**Interfaces:**
- Produces: `Scheduler.run(run_id: str) -> RunOutcome`
- Produces: `Scheduler.resume(run_id: str) -> RunOutcome`
- Consumes: planner, router, state store, leases, workspace manager, adapters, verifier, reviewer

- [ ] **Step 1: Write a failing test proving two independent fake workers overlap in time**

```python
def test_runs_independent_tasks_concurrently(self) -> None:
    outcome = scheduler.run(plan_with_two_independent_tasks())
    self.assertEqual(outcome.status, RunStatus.PASSED)
    self.assertGreater(fake_agent.overlap_seconds(), 0)
    self.assertLessEqual(fake_agent.max_writers(), 3)
```

- [ ] **Step 2: Write dependency, scope, repair, and staging tests**

```python
def test_dependent_task_starts_after_parent_is_staged(self) -> None:
    scheduler.run(parent_child_plan())
    self.assertLess(events.time("parent", "staged"), events.time("child", "running"))

def test_review_failure_resumes_same_worker_twice_then_blocks(self) -> None:
    outcome = scheduler.run(always_rejected_plan())
    self.assertEqual(outcome.task("t1").status, TaskStatus.BLOCKED)
    self.assertEqual(outcome.task("t1").attempt, 2)
```

- [ ] **Step 3: Implement ready-queue scheduling with fixed resource semaphores**

The scheduler is the only state writer. It selects dependency-satisfied tasks, acquires scope leases, creates worktrees, launches at most three writers, receives results through a thread-safe queue, and transitions state transactionally. It must stop scheduling dependents whenever staging is not green.

- [ ] **Step 4: Implement candidate commit and cross-review loop**

After self-check, validate paths, commit on the task branch, run independent verification, select a different reviewer, and resume the same worker for at most two repairs. Each repair creates an additional commit; no reset/rebase/squash is used.

- [ ] **Step 5: Implement staging cherry-pick and conflict task creation**

Cherry-pick accepted task commits in dependency-safe order. On conflict, abort the incomplete cherry-pick, mark `integration_conflict`, and create a high-risk repair task based on current staging. Never call `git merge` or `git push`.

- [ ] **Step 6: Run scheduler tests**

Run: `python -m unittest tools.tests.test_scheduler -v`

Expected: PASS with fake agents; no network/model calls.

- [ ] **Step 7: Commit concurrent orchestration**

```powershell
git add -- tools/orchestrator/scheduler.py tools/orchestrator/git_workspace.py tools/orchestrator/state.py tools/tests/test_scheduler.py tools/tests/fixtures/fake_agent.py
git commit -m "feat: schedule isolated agent tasks"
```

### Task 9: Add CLI commands, resume, cancellation, status, and reporting

**Files:**
- Create: `tools/orchestrator/reporter.py`
- Create: `tools/orchestrator/cli.py`
- Create: `tools/tests/test_cli.py`
- Create: `tools/tests/test_resume.py`
- Modify: `tools/agent_workflow.py`
- Modify: `workflow.cmd`

**Interfaces:**
- Produces: `main(argv: Sequence[str] | None = None) -> int`
- Produces commands: `run`, `doctor`, `status`, `watch`, `resume`, `cancel`, `report`
- Produces: `Reporter.final_report(run_id: str) -> Path`

- [ ] **Step 1: Write parser and compatibility-entrypoint tests**

```python
def test_all_commands_are_registered(self) -> None:
    parser = build_parser()
    for command in ("run", "doctor", "status", "watch", "resume", "cancel", "report"):
        self.assertParses(parser, [command, *( ["run-id"] if command not in {"run", "doctor"} else [] )])

def test_legacy_run_is_status_only(self) -> None:
    self.assertEqual(cli.status(legacy_run).kind, "legacy")
    with self.assertRaises(LegacyRunError):
        cli.resume(legacy_run)
```

- [ ] **Step 2: Implement CLI and retain old entrypoint**

`tools/agent_workflow.py` imports `main` from `orchestrator.cli` and exits with its return code. This import form works when Python executes `tools/agent_workflow.py` directly because `tools/` is the script directory on `sys.path`. `workflow.cmd` continues to call that file so existing user habits remain valid.

- [ ] **Step 3: Implement resume and cancel**

Resume validates state, branches, worktrees, and staged commits; transitions orphaned `running` tasks to `interrupted`; reruns verification before trusting candidate artifacts; and resumes sessions when IDs remain valid. Cancel sets a database flag, signals process runners, preserves every artifact, and exits without cleanup.

- [ ] **Step 4: Implement watch and final report**

Watch prints task ID, objective, status, worker, reviewer, dependencies, attempt, and elapsed time. Final report lists staging branch, cherry-pick order, verification evidence, frontier calls/reasons/budgets, conflicts, repairs, blocked tasks, scope violations, limitations, and inspection commands.

- [ ] **Step 5: Run CLI/resume tests**

Run: `python -m unittest tools.tests.test_cli tools.tests.test_resume -v`

Expected: PASS.

- [ ] **Step 6: Commit operator commands**

```powershell
git add -- tools/orchestrator/cli.py tools/orchestrator/reporter.py tools/agent_workflow.py workflow.cmd tools/tests/test_cli.py tools/tests/test_resume.py
git commit -m "feat: add durable orchestrator commands"
```

### Task 10: Update authority rules and operator documentation

**Files:**
- Modify: `AGENTS.md`
- Modify: `PROJECT_CONTEXT.md`
- Modify: `HUONG_DAN_WORKFLOW.md`
- Modify: `tools/README.md`
- Create: `tools/tests/test_documented_commands.py`

**Interfaces:**
- Consumes: final CLI commands and configuration from Tasks 1-9
- Produces: exact setup and operating instructions for the user

- [ ] **Step 1: Write a failing documentation contract test**

```python
def test_documented_commands_match_cli(self) -> None:
    readme = (ROOT / "tools" / "README.md").read_text(encoding="utf-8")
    for command in ("run", "doctor", "status", "watch", "resume", "cancel", "report"):
        self.assertIn(f"workflow.cmd {command}", readme)
```

- [ ] **Step 2: Update `AGENTS.md` narrowly**

Replace the unconditional commit prohibition with: orchestrator-managed workers may commit only on isolated task branches and the orchestrator may cherry-pick accepted commits only into its run staging branch; agents may not commit directly to `master`, push, or merge.

- [ ] **Step 3: Document credential setup without key literals**

Document:

```powershell
codex login status
claude auth status
opencode.cmd auth list
opencode.cmd auth login -p kiraai
.\workflow.cmd doctor
```

Explain that Token Router Qwen is already configured, two Qwen workers share the provider/model but use separate sessions/worktrees, and the workflow never asks the user to paste a key into `TASK.md` or chat.

- [ ] **Step 4: Document the one-command run and staging handoff**

Explain automatic DAG decomposition, cheap-first routing, three-writer limit, review gates, no push/merge, legacy run behavior, status/watch/resume/cancel/report, and how the user inspects staging.

- [ ] **Step 5: Run documentation tests**

Run: `python -m unittest tools.tests.test_documented_commands -v`

Expected: PASS.

- [ ] **Step 6: Commit rules and documentation**

```powershell
git add -- AGENTS.md PROJECT_CONTEXT.md HUONG_DAN_WORKFLOW.md tools/README.md tools/tests/test_documented_commands.py
git commit -m "docs: explain multi-agent workflow"
```

### Task 11: Run fake-agent integration, real doctor, and project verification

**Files:**
- Create: `tools/tests/test_integration_workflow.py`
- Modify only if a verified implementation defect requires it: files from Tasks 1-10

**Interfaces:**
- Consumes: complete orchestrator
- Produces: verification evidence and a no-cost fake-agent smoke run

- [ ] **Step 1: Add an end-to-end fake-agent test**

The test creates a temporary Git repository with a small source file and test command, asks a fake cheap planner for two independent tasks plus one dependent task, runs two fake workers concurrently, cross-reviews candidates, cherry-picks them into staging, interrupts before the dependent task, resumes, and verifies the final staging branch. Assert that `master` is unchanged and no remote/push/merge command is invoked.

- [ ] **Step 2: Run all Python orchestrator tests**

Run: `python -m unittest discover -s tools/tests -v`

Expected: PASS.

- [ ] **Step 3: Run the real doctor without making model calls**

Run: `.\workflow.cmd doctor`

Expected: Codex, Claude, both Qwen worker profiles, and GLM are READY; if the user has not entered the Kira key yet, only GLM is `ACTION_REQUIRED` with `opencode.cmd auth login -p kiraai`.

- [ ] **Step 4: Validate OpenCode configuration**

Run: `opencode.cmd models tokenrouter`

Expected: `tokenrouter/qwen/qwen3.8-max-free`.

Run after Kira login: `opencode.cmd models kiraai`

Expected: `kiraai/glm-5.3`.

- [ ] **Step 5: Run project verification from `game/`**

Run: `npm.cmd run test`

Expected: PASS.

Run: `npm.cmd run type-check`

Expected: PASS.

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 6: Inspect final diff and authority boundaries**

Run: `git diff --check HEAD~1..HEAD`

Run: `rg -n "git (push|merge)|\[.*push.*\]|\[.*merge.*\]|dangerously-bypass|api[_-]?key\s*[:=]\s*['\"]" tools opencode.json`

Expected: no executable push/merge path, no dangerous bypass flag, no credential literal; documentation may mention prohibited commands in prose.

- [ ] **Step 7: Commit integration coverage**

```powershell
git add -- tools/tests/test_integration_workflow.py
git commit -m "test: cover multi-agent orchestration"
```

- [ ] **Step 8: Run a final read-only review**

Review the spec, this plan, all commits since the implementation baseline, the Python test output, doctor output, and project verification output. Do not invoke a real paid worker smoke task until the user has entered the Kira key and explicitly accepts model usage.
