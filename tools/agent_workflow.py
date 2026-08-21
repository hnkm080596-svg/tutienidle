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
    return resolve_command("codex", "CODEX_BIN", [])


def run_process(
    command: Sequence[str],
    *,
    cwd: Path,
    stdin: str | None = None,
    log_path: Path | None = None,
    timeout: int = 7200,
) -> subprocess.CompletedProcess[str]:
    display = subprocess.list2cmdline(list(command))
    print(f"> {display}", flush=True)
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
            env={**os.environ, "NO_COLOR": "1"},
        )
        if stdin is not None and process.stdin is not None:
            process.stdin.write(stdin)
            process.stdin.close()

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
    announce("GIAI ĐOẠN 1/4 — CLAUDE ĐANG LẬP KẾ HOẠCH", "Claude đang đọc và phân tích dự án. Bước này có thể mất vài phút.")
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
    )
    plan = extract_claude_result(result.stdout)
    (run_dir / "plan.md").write_text(plan + "\n", encoding="utf-8")
    return plan


def run_codex(task: str, plan: str, worktree: Path, run_dir: Path, cycle: int, config: dict[str, Any]) -> None:
    announce(f"GIAI ĐOẠN 2/4 — CODEX ĐANG VIẾT CODE (VÒNG {cycle})", "Các thao tác và tiến độ của Codex sẽ xuất hiện bên dưới.")
    prompt = render_prompt("codex-implement.md", task=task, plan=plan)
    output = run_dir / f"implementation-{cycle}.md"
    command = [
        codex_command(), "exec", "-C", str(worktree),
        "-s", "workspace-write", "--approve-for-me", "--json",
        "-o", str(output), "-",
    ]
    if config.get("codex_model"):
        command[2:2] = ["--model", str(config["codex_model"])]
    run_process(
        command,
        cwd=worktree,
        stdin=prompt,
        log_path=run_dir / f"codex-events-{cycle}.jsonl",
    )


def verify(worktree: Path, run_dir: Path, cycle: int, config: dict[str, Any]) -> bool:
    announce("GIAI ĐOẠN 3/4 — ĐANG CHẠY KIỂM TRA", "Chạy test, kiểm tra TypeScript và build dự án.")
    report: list[str] = []
    passed = True
    project = worktree / str(config["project_dir"])
    for command in config["verification_commands"]:
        display = subprocess.list2cmdline(command)
        result = subprocess.run(
            command, cwd=project, text=True, encoding="utf-8", errors="replace",
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, shell=False,
        )
        report.extend([f"$ {display}", result.stdout, f"exit_code={result.returncode}", ""])
        passed = passed and result.returncode == 0
    (run_dir / f"verification-{cycle}.txt").write_text("\n".join(report), encoding="utf-8")
    return passed


def run_review(
    task: str, plan: str, baseline: str, worktree: Path, run_dir: Path,
    cycle: int, config: dict[str, Any],
) -> dict[str, Any]:
    announce(f"GIAI ĐOẠN 4/4 — CLAUDE ĐANG REVIEW (VÒNG {cycle})", "Claude đang đọc diff và kết quả kiểm tra; không chỉnh sửa code.")
    schema = load_json(TOOLS / "schemas" / "review.schema.json")
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
        "branch": branch, "worktree": str(worktree), "status": "planning", "cycle": 0,
    }
    write_json(run_dir / "run.json", state)
    (run_dir / "task.md").write_text(task + "\n", encoding="utf-8")
    try:
        plan = run_claude_plan(task, worktree, run_dir, config)
        max_cycles = int(config["max_review_cycles"])
        for cycle in range(1, max_cycles + 1):
            state.update(status="implementing", cycle=cycle)
            write_json(run_dir / "run.json", state)
            run_codex(task, plan, worktree, run_dir, cycle, config)
            tests_passed = verify(worktree, run_dir, cycle, config)
            state["status"] = "reviewing"
            write_json(run_dir / "run.json", state)
            review = run_review(task, plan, baseline, worktree, run_dir, cycle, config)
            if review["verdict"] == "PASS" and tests_passed:
                state["status"] = "passed"
                write_json(run_dir / "run.json", state)
                print(f"Workflow passed. Worktree: {worktree}")
                return 0
            plan = plan + "\n\nREVIEW FEEDBACK TO FIX:\n" + json.dumps(review, ensure_ascii=False, indent=2)
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
