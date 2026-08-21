from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Sequence


ROOT = Path(__file__).resolve().parents[1]
TOOLS = Path(__file__).resolve().parent
CONFIG_PATH = TOOLS / "workflow.json"


class WorkflowError(RuntimeError):
    pass


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_command(name: str, env_name: str, fallbacks: Sequence[Path]) -> str:
    configured = os.environ.get(env_name)
    if configured and Path(configured).is_file():
        return configured
    found = shutil.which(name)
    if found:
        return found
    for candidate in fallbacks:
        if candidate.is_file():
            return str(candidate)
    raise WorkflowError(f"Cannot find {name}. Set {env_name} to its executable path.")


def claude_command() -> str:
    user = Path.home()
    extensions = sorted(
        (user / ".vscode" / "extensions").glob(
            "anthropic.claude-code-*-win32-x64/resources/native-binary/claude.exe"
        ),
        reverse=True,
    )
    return resolve_command(
        "claude",
        "CLAUDE_BIN",
        [user / ".local" / "bin" / "claude.exe", *extensions],
    )


def codex_command() -> str:
    user = Path.home()
    extensions: list[Path] = []
    for root in (user / ".vscode" / "extensions", user / ".vscode-insiders" / "extensions"):
        extensions.extend(
            sorted(
                root.glob("openai.chatgpt-*-win32-x64/bin/windows-x86_64/codex.exe"),
                reverse=True,
            )
        )
    return resolve_command("codex", "CODEX_BIN", extensions)


def run_process(
    command: Sequence[str],
    *,
    cwd: Path,
    stdin: str | None = None,
    log_path: Path | None = None,
    timeout: int = 7200,
    display_name: str | None = None,
) -> subprocess.CompletedProcess[str]:
    display = subprocess.list2cmdline(list(command))
    print(f"> {display_name or display}", flush=True)
    started = time.monotonic()
    try:
        process = subprocess.Popen(
            list(command),
            cwd=cwd,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdin=subprocess.PIPE if stdin is not None else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            shell=False,
            env={
                **os.environ,
                "NO_COLOR": "1",
                "CODEX_HOME": os.environ.get("CODEX_HOME", str(Path.home() / ".codex")),
            },
        )
        if stdin is not None and process.stdin is not None:
            try:
                process.stdin.write(stdin)
                process.stdin.close()
            except BrokenPipeError:
                # The child may reject its arguments before consuming stdin.
                # Continue draining output so the actionable CLI error is shown.
                pass

        output_queue: queue.Queue[str | None] = queue.Queue()

        def read_output() -> None:
            assert process.stdout is not None
            for line in process.stdout:
                output_queue.put(line)
            output_queue.put(None)

        reader = threading.Thread(target=read_output, daemon=True)
        reader.start()
        chunks: list[str] = []
        stream_finished = False
        last_heartbeat = started
        while not stream_finished:
            elapsed = time.monotonic() - started
            if elapsed > timeout:
                process.kill()
                raise WorkflowError(f"Command timed out after {timeout}s: {display}")
            try:
                item = output_queue.get(timeout=1)
                if item is None:
                    stream_finished = True
                else:
                    chunks.append(item)
                    print(item, end="", flush=True)
            except queue.Empty:
                pass
            now = time.monotonic()
            if now - last_heartbeat >= 10:
                minutes, seconds = divmod(int(now - started), 60)
                print(f"[still working | {minutes:02d}:{seconds:02d}]", flush=True)
                last_heartbeat = now
        return_code = process.wait()
        result = subprocess.CompletedProcess(command, return_code, "".join(chunks), None)
    except OSError:
        raise
    if log_path:
        log_path.write_text(result.stdout, encoding="utf-8")
    if result.returncode != 0:
        raise WorkflowError(f"Command failed ({result.returncode}): {display}")
    return result


def announce(title: str, detail: str = "") -> None:
    line = "=" * 68
    print(f"\n{line}\n{title}", flush=True)
    if detail:
        print(detail, flush=True)
    print(f"{line}\n", flush=True)


def git(args: Sequence[str], cwd: Path = ROOT) -> str:
    result = subprocess.run(
        ["git", *args], cwd=cwd, text=True, encoding="utf-8", errors="replace",
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, shell=False,
    )
    if result.returncode != 0:
        raise WorkflowError(result.stdout.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def repo_blockers() -> list[str]:
    entries = git(["status", "--porcelain", "--untracked-files=all"]).splitlines()
    return [entry for entry in entries if entry.split(maxsplit=1)[-1] != "TASK.md"]


def require_clean_repo() -> None:
    blockers = repo_blockers()
    if blockers:
        raise WorkflowError(
            "Repository has changes outside TASK.md. Commit or stash them before starting an "
            "isolated run:\n" + "\n".join(blockers)
        )


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return (slug[:42] or "task")


def task_mode(task: str) -> str | None:
    match = re.search(r"(?im)^##\s+Mode\s*$\s*([^\r\n#]+)", task)
    if not match:
        return None
    selected = match.group(1).strip()
    modes = {"quick": "Quick", "balanced": "Balanced", "full": "Full"}
    try:
        return modes[selected.casefold()]
    except KeyError as exc:
        raise WorkflowError("Mode must be Quick, Balanced, or Full.") from exc


def run_mode_advisor(task: str, config: dict[str, Any]) -> dict[str, Any]:
    announce("CLAUDE — MODE ADVISOR", "Claude is estimating scope and risk before any work starts.")
    context_path = ROOT / "PROJECT_CONTEXT.md"
    context = context_path.read_text(encoding="utf-8") if context_path.is_file() else ""
    schema = load_json(TOOLS / "schemas" / "advisor.schema.json")
    schema.pop("$schema", None)
    prompt = render_prompt("claude-advise.md", task=task, project_context=context)
    result = run_process(
        [
            claude_command(), "-p", prompt,
            "--output-format", "json",
            "--permission-mode", "dontAsk",
            "--tools", "",
            "--model", str(config.get("advisor_model", "haiku")),
            "--effort", str(config.get("advisor_effort", "low")),
            "--json-schema", json.dumps(schema, separators=(",", ":")),
            "--no-session-persistence",
        ],
        cwd=ROOT,
        display_name="claude (read-only mode advice)",
    )
    return json.loads(extract_claude_result(result.stdout))


def choose_mode(advice: dict[str, Any]) -> str:
    recommended = str(advice["recommended_mode"])
    print(f"\nRecommended mode: {recommended}")
    print(f"Reason: {advice['reason']}")
    print(f"Confidence: {advice['confidence']}")
    while True:
        try:
            choice = input("Press Enter to accept, Q=Quick, B=Balanced, F=Full, X=Cancel: ").strip().casefold()
        except EOFError:
            print(f"No interactive input; accepting {recommended}.")
            return recommended
        if not choice:
            return recommended
        choices = {"q": "Quick", "b": "Balanced", "f": "Full"}
        if choice in choices:
            return choices[choice]
        if choice == "x":
            raise WorkflowError("Cancelled by user before workflow started.")
        print("Please choose Enter, Q, B, F, or X.")


def compact_plan(task: str, mode: str) -> str:
    return (
        f"{mode} mode: read PROJECT_CONTEXT.md first, then inspect only files relevant to "
        "the task. Make focused changes and avoid broad repository scans unless the task "
        "cannot be completed otherwise.\n\nTASK:\n" + task
    )


def extract_claude_result(raw: str) -> str:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = None
        for line in reversed(raw.splitlines()):
            try:
                candidate = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(candidate, dict) and candidate.get("type") == "result":
                payload = candidate
                break
        if payload is None:
            raise WorkflowError("Claude did not return valid JSON output.")
    if payload.get("is_error"):
        raise WorkflowError(str(payload.get("result", "Claude returned an error")))
    structured = payload.get("structured_output")
    if structured is not None:
        return json.dumps(structured, ensure_ascii=False, indent=2)
    result = payload.get("result")
    if not isinstance(result, str):
        raise WorkflowError("Claude JSON output has no text result.")
    return result


def render_prompt(name: str, **values: str) -> str:
    template = (TOOLS / "prompts" / name).read_text(encoding="utf-8")
    return template.format(**values)


def run_claude_plan(task: str, worktree: Path, run_dir: Path, config: dict[str, Any]) -> str:
    announce("CLAUDE — PLANNING", "Claude đang đọc và phân tích dự án. Bước này chỉ chạy trong Full mode.")
    prompt = render_prompt("claude-plan.md", task=task)
    result = run_process(
        [
            claude_command(), "-p", prompt,
            "--output-format", "json",
            "--permission-mode", "dontAsk",
            "--tools", "Read,Glob,Grep",
            "--model", str(config["claude_model"]),
            "--effort", str(config["claude_effort"]),
            "--no-session-persistence",
        ],
        cwd=worktree,
        log_path=run_dir / "claude-plan.json",
        display_name="claude (read-only planning)",
    )
    plan = extract_claude_result(result.stdout)
    (run_dir / "plan.md").write_text(plan + "\n", encoding="utf-8")
    return plan


def codex_session_id(raw: str) -> str | None:
    for line in raw.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict):
            continue
        for key in ("thread_id", "session_id"):
            value = event.get(key)
            if isinstance(value, str) and value:
                return value
        thread = event.get("thread")
        if isinstance(thread, dict) and isinstance(thread.get("id"), str):
            return thread["id"]
    return None


def run_codex(
    task: str, plan: str, worktree: Path, run_dir: Path, cycle: int,
    config: dict[str, Any], session_id: str | None,
) -> str | None:
    announce(f"CODEX — IMPLEMENTING (CYCLE {cycle})", "Các thao tác và tiến độ của Codex sẽ xuất hiện bên dưới.")
    if session_id:
        prompt = (
            "Continue the same task in the same worktree. Keep prior context and fix only the "
            "actionable verification or review feedback below. Re-run relevant checks.\n\n" + plan
        )
    else:
        prompt = render_prompt("codex-implement.md", task=task, plan=plan)
    output = run_dir / f"implementation-{cycle}.md"
    if session_id:
        command = [
            codex_command(), "exec", "resume", "--json",
            "-o", str(output), session_id, "-",
        ]
        if config.get("codex_model"):
            command[3:3] = ["--model", str(config["codex_model"])]
    else:
        command = [
            codex_command(), "exec", "-C", str(worktree),
            "--approve-for-me", "--json",
            "-o", str(output), "-",
        ]
        if config.get("codex_model"):
            command[2:2] = ["--model", str(config["codex_model"])]
    result = run_process(
        command,
        cwd=worktree,
        stdin=prompt,
        log_path=run_dir / f"codex-events-{cycle}.jsonl",
    )
    return session_id or codex_session_id(result.stdout)


def verify(worktree: Path, run_dir: Path, cycle: int, config: dict[str, Any]) -> bool:
    announce("VERIFY — TEST / TYPE-CHECK / BUILD", "Chạy test, kiểm tra TypeScript và build dự án.")
    report: list[str] = []
    passed = True
    project = worktree / str(config["project_dir"])
    for index, command in enumerate(config["verification_commands"], start=1):
        display = subprocess.list2cmdline(command)
        command_log = run_dir / f"verification-{cycle}-{index}.txt"
        try:
            result = run_process(command, cwd=project, log_path=command_log)
            output, return_code = result.stdout, 0
        except WorkflowError:
            output = command_log.read_text(encoding="utf-8") if command_log.is_file() else ""
            return_code = 1
        report.extend([f"$ {display}", output, f"exit_code={return_code}", ""])
        passed = passed and return_code == 0
    (run_dir / f"verification-{cycle}.txt").write_text("\n".join(report), encoding="utf-8")
    return passed


def run_review(
    task: str, plan: str, baseline: str, worktree: Path, run_dir: Path,
    cycle: int, config: dict[str, Any],
) -> dict[str, Any]:
    announce(f"CLAUDE — REVIEWING (CYCLE {cycle})", "Claude đang đọc diff và kết quả kiểm tra; không chỉnh sửa code.")
    schema = load_json(TOOLS / "schemas" / "review.schema.json")
    schema.pop("$schema", None)
    verification = run_dir / f"verification-{cycle}.txt"
    prompt = render_prompt(
        "claude-review.md", task=task, plan=plan, baseline=baseline,
        verification_path=str(verification),
    )
    result = run_process(
        [
            claude_command(), "-p", prompt,
            "--output-format", "json",
            "--permission-mode", "dontAsk",
            "--tools", "Read,Glob,Grep,Bash",
            "--allowedTools", "Read,Glob,Grep,Bash(git diff *),Bash(git status *),Bash(git show *)",
            "--model", str(config["claude_model"]),
            "--effort", str(config["claude_effort"]),
            "--json-schema", json.dumps(schema, separators=(",", ":")),
            "--add-dir", str(run_dir),
            "--no-session-persistence",
        ],
        cwd=worktree,
        log_path=run_dir / f"claude-review-{cycle}.json",
        display_name=f"claude (read-only review cycle {cycle})",
    )
    review = json.loads(extract_claude_result(result.stdout))
    write_json(run_dir / f"review-{cycle}.json", review)
    return review


def command_doctor(_: argparse.Namespace) -> int:
    config = load_json(CONFIG_PATH)
    checks: list[tuple[str, str]] = []
    for label, resolver in (("Claude", claude_command), ("Codex", codex_command)):
        path = resolver()
        version = run_process([path, "--version"], cwd=ROOT).stdout.strip()
        checks.append((label, f"{version} [{path}]"))
    checks.append(("Git", git(["--version"])))
    checks.append(("Project", str(ROOT / str(config["project_dir"]))))
    checks.append(("Repo ready", "yes" if not repo_blockers() else "no (run is blocked)"))
    for label, value in checks:
        print(f"{label}: {value}")
    return 0


def command_run(args: argparse.Namespace) -> int:
    config = load_json(CONFIG_PATH)
    task = args.task
    if task is None:
        task_path = Path(args.task_file)
        if not task_path.is_absolute():
            task_path = ROOT / task_path
        if not task_path.is_file():
            raise WorkflowError(f"Task file does not exist: {task_path}")
        task = task_path.read_text(encoding="utf-8").strip()
    if not task:
        raise WorkflowError("Task is empty. Describe the work in TASK.md first.")
    mode = args.mode or task_mode(task)
    if mode is None:
        try:
            advice = run_mode_advisor(task, config)
        except (WorkflowError, OSError, json.JSONDecodeError) as exc:
            print(f"Mode Advisor unavailable: {exc}")
            advice = {
                "recommended_mode": str(config["default_mode"]),
                "reason": "Advisor could not connect, so the safe default is being offered.",
                "confidence": "low",
            }
        mode = choose_mode(advice)
    require_clean_repo()
    baseline = git(["rev-parse", "HEAD"])
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    run_id = f"{stamp}-{slugify(task)}-{uuid.uuid4().hex[:6]}"
    run_dir = ROOT / str(config["run_root"]) / run_id
    worktree = ROOT / str(config["worktree_root"]) / run_id
    run_dir.mkdir(parents=True)
    worktree.parent.mkdir(parents=True, exist_ok=True)
    branch = f"agent/{run_id}"
    git(["worktree", "add", "-b", branch, str(worktree), baseline])
    state = {
        "run_id": run_id, "task": task, "baseline": baseline,
        "branch": branch, "worktree": str(worktree), "mode": mode,
        "status": "planning" if mode == "Full" else "implementing",
        "cycle": 0, "codex_session_id": None,
    }
    write_json(run_dir / "run.json", state)
    (run_dir / "task.md").write_text(task + "\n", encoding="utf-8")
    try:
        announce(f"WORKFLOW MODE — {mode}")
        plan = run_claude_plan(task, worktree, run_dir, config) if mode == "Full" else compact_plan(task, mode)
        (run_dir / "plan.md").write_text(plan + "\n", encoding="utf-8")
        max_cycles = int(config["max_review_cycles"])
        session_id: str | None = None
        for cycle in range(1, max_cycles + 1):
            state.update(status="implementing", cycle=cycle)
            write_json(run_dir / "run.json", state)
            session_id = run_codex(task, plan, worktree, run_dir, cycle, config, session_id)
            state["codex_session_id"] = session_id
            write_json(run_dir / "run.json", state)
            tests_passed = verify(worktree, run_dir, cycle, config)
            if not tests_passed:
                plan = (
                    "Verification failed. Diagnose and fix these results:\n\n" +
                    (run_dir / f"verification-{cycle}.txt").read_text(encoding="utf-8")
                )
                continue
            if mode == "Quick":
                state["status"] = "passed"
                write_json(run_dir / "run.json", state)
                print(f"Workflow passed. Worktree: {worktree}")
                return 0
            state["status"] = "reviewing"
            write_json(run_dir / "run.json", state)
            review = run_review(task, plan, baseline, worktree, run_dir, cycle, config)
            if review["verdict"] == "PASS" and tests_passed:
                state["status"] = "passed"
                write_json(run_dir / "run.json", state)
                print(f"Workflow passed. Worktree: {worktree}")
                return 0
            plan = "REVIEW FEEDBACK TO FIX:\n" + json.dumps(review, ensure_ascii=False, indent=2)
        state["status"] = "changes_requested"
        write_json(run_dir / "run.json", state)
        print(f"Review still requests changes. See {run_dir}")
        return 2
    except Exception:
        state["status"] = "failed"
        write_json(run_dir / "run.json", state)
        raise


def command_status(args: argparse.Namespace) -> int:
    path = Path(args.run)
    if not path.is_absolute():
        path = ROOT / path
    state_path = path / "run.json" if path.is_dir() else path
    print(state_path.read_text(encoding="utf-8"))
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Claude plan -> Codex implement -> Claude review")
    commands = result.add_subparsers(dest="command", required=True)
    doctor = commands.add_parser("doctor", help="Check local prerequisites")
    doctor.set_defaults(handler=command_doctor)
    run = commands.add_parser("run", help="Start a new isolated workflow")
    task_source = run.add_mutually_exclusive_group()
    task_source.add_argument("--task", help="Task text supplied directly")
    task_source.add_argument("--task-file", default="TASK.md", help="Task file (default: TASK.md)")
    run.add_argument("--mode", choices=("Quick", "Balanced", "Full"), help="Skip advice and use this mode")
    run.set_defaults(handler=command_run)
    status = commands.add_parser("status", help="Print a run state")
    status.add_argument("run")
    status.set_defaults(handler=command_status)
    return result


def main() -> int:
    try:
        args = parser().parse_args()
        return int(args.handler(args))
    except (WorkflowError, OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
