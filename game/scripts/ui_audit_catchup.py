import asyncio
import os
import sys

# Catch-up pass for scopes the main run dropped to the 429 session cap.
# Targets are computed at launch: every scope missing final-review-<scope>.md.
# Scopes already holding review-<scope>.md skip W2 (findings read back from
# disk) and only run W3+W4; the rest run the full review -> research ->
# final chain. The runner copies this file to a temp dir, so sys.path uses
# the worktree scripts dir, not __file__.

sys.path.insert(0, r"C:\Users\Administrator\repos\tutienidle\.agent-worktrees\artui-c0-foundation\game\scripts")
import ui_audit_common as _common  # noqa: E402
from ui_audit_common import (  # noqa: E402
    SCOPES, AUDIT_DIR, SEARCH_SCHEMA, REVIEW_SCHEMA, REPO,
    review_prompt, research_prompt, final_review_prompt, write_doc, wave,
)

# The workflow runtime injects agent/parallel/log/register_workflow into THIS
# script's globals, not into imported modules — hand them to common so its
# wave() can spawn agents.
_common.agent = agent  # noqa: F821
_common.parallel = parallel  # noqa: F821
_common.log = log  # noqa: F821

async def main():
    missing = [s[0] for s in SCOPES
               if not os.path.exists(os.path.join(AUDIT_DIR, f"final-review-{s[0]}.md"))]
    await register_workflow({
        "name": "ui-audit-catchup",
        "description": "review->research->final-review for scopes the main UI audit run dropped.",
        "subscribe": "refresh",
        "phases": [
            {"title": "w2-review", "detail": "skeptical review", "count": len(missing)},
            {"title": "w3-research", "detail": "adjudicate + corrected report", "count": len(missing)},
            {"title": "w4-final-review", "detail": "last pass", "count": len(missing)},
        ],
    })

    log(f"catch-up scopes: {missing}")
    scopes = [s for s in SCOPES if s[0] in missing]
    reports = {}
    for s in scopes:
        with open(os.path.join(AUDIT_DIR, f"{s[0]}.md"), encoding="utf-8") as f:
            reports[s[0]] = f.read()

    # W2 review — reuse an existing findings file when the main run wrote one.
    findings = {}
    needs_review = []
    for item in scopes:
        p = os.path.join(AUDIT_DIR, f"review-{item[0]}.md")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                findings[item[0]] = f.read()
            log(f"review {item[0]}: reused existing findings file")
        else:
            needs_review.append(item)
    def rv(item):
        return review_prompt(item, reports[item[0]])
    for item, res in zip(needs_review, await wave(needs_review, rv, "w2-review", "review",
                                                  REVIEW_SCHEMA, retries=20, backoff=75)):
        if res and res.get("findings_md"):
            write_doc(f"review-{item[0]}.md", res["findings_md"])
            findings[item[0]] = res["findings_md"]
        log(f"review {item[0]}: verdict={res.get('verdict','?') if res else 'FAILED'}")

    todo3 = [i for i in scopes if i[0] in findings]
    finals = {}
    def rs(item):
        return research_prompt(item, reports[item[0]], findings[item[0]])
    for item, res in zip(todo3, await wave(todo3, rs, "w3-research", "research",
                                           SEARCH_SCHEMA, retries=20, backoff=75)):
        if res and res.get("report_md"):
            write_doc(f"{item[0]}.md", res["report_md"])
            finals[item[0]] = res["report_md"]
        log(f"research {item[0]}: {'ok' if item[0] in finals else 'FAILED'}")

    todo4 = [i for i in scopes if i[0] in finals]
    def fr(item):
        return final_review_prompt(item, finals[item[0]])
    for item, res in zip(todo4, await wave(todo4, fr, "w4-final-review", "final",
                                           REVIEW_SCHEMA, retries=20, backoff=75)):
        if res and res.get("findings_md"):
            write_doc(f"final-review-{item[0]}.md", res["findings_md"])
        log(f"final {item[0]}: verdict={res.get('verdict','?') if res else 'FAILED'}")

asyncio.run(main())
