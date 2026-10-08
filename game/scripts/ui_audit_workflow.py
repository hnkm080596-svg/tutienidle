import asyncio
import json

# UI audit fan-out for tutienidle's artui-c0-foundation worktree.
# Agents MUST be vm_mode="shared": they audit the worktree's UNCOMMITTED
# reskin state, which cannot be pushed (it mixes the owner's in-flight
# edits) and therefore is invisible to separate-VM clones. Each agent
# owns exactly one report file under docs/ui-audit/ so parallel writes
# never collide. Max 4 agents run at once (owner rule) — enforced by
# chunked barriers below.

GAME = r"C:\Users\Administrator\repos\tutienidle\.agent-worktrees\artui-c0-foundation\game"

REPORT_FORMAT = """Report file format (write in Vietnamese, Markdown):
# Panel: <name>
## 1. Mount chain — từ nav/route đến component gốc, file nào chứa gì
## 2. UI logic inventory — mọi computed/store-read/emit/directive đang feed DOM (mới lẫn cũ)
## 3. Art map — mỗi file art (đường dẫn assets/) + element vị trí dùng nó; kể cả art set qua CSS global
## 4. Conflicts / layers — nơi 2 phiên bản UI cùng tồn tại (dead DOM ẩn, suppression CSS, component trùng vai trò, global rule đè scoped)
## 5. Logic không có hình ảnh — logic tính toán/state mà không render gì ra màn hình
## 6. Hình ảnh không có logic — art/DOM trưng bày không gắn dữ liệu thật, unwired UI
## 7. Open questions — điểm mâu thuẫn cần chủ dự án quyết
Every claim must cite file:line. Verify by reading code, never from memory."""

RULES = """Hard rules:
- Audit ONLY; never edit code, never run git mutating commands, never touch the dev server, never write outside your assigned file.
- Scope covers BOTH the live/production path and any dormant/fallback/legacy UI paths reachable from this panel (dead components still mounted or imported count).
- Include global chrome that visibly affects this panel (e.g. src/assets/tien-hiep-ui.css rules matching this panel's classes).
- The repo root for this task is """ + GAME + """ — work strictly inside it.
- Write the report file FIRST, then return the structured summary."""

# (scope_id, display name, where to start looking)
SCOPES_WAVE1 = [
    ("dong-fu", "Động Phủ (home scene)", "src/components/scenes/dong-fu/ (DongFuStage.vue, fidelity/*), src/components/game/MainScene.vue + src/game/scenes/MainScene.ts, src/components/layout/GameRoot.vue"),
    ("wheel-cu", "Wheel cũ (command wheel)", "src/components/scenes/dong-fu/fidelity/DongFuWheel.vue, DongFuHomeContent.vue, dongFuUi.ts, CharacterFigureWheel.vue — trace whether still mounted anywhere"),
    ("trail-hien-tai", "Trail/navigation hiện tại", "nav rail + landscape seam inside DongFuStage.vue, FunctionOverlayPanel/overlay routing that opens panels, src/core/presentation/OverlayLayers.ts"),
    ("tu-si", "Tu Sĩ", "nav id → panel: src/components/panels/CharacterPanel.vue + src/components/scenes/character/* + pc-paper chrome"),
    ("cong-phap", "Công Pháp", "src/components/panels/SkillPathPanel.vue + skill-constellation/* + scenes/skill* (skill-sheet chrome)"),
    ("trang-bi", "Trang Bị", "src/components/panels/EquipmentHallPanel.vue + EquipmentPaperdoll.vue + panels/equipment-hall/* + scenes/equipment/*"),
    ("luyen-the", "Luyện Thể", "src/components/panels/BodyPanel.vue + scenes/body* "),
    ("tam-phap", "Tâm Pháp", "src/components/panels/TechniquePanel.vue + ScripturePavilionPanel.vue + scenes/technique* — resolve which the nav opens"),
]

SCOPES_WAVE2 = [
    ("canh-gioi", "Cảnh Giới", "src/components/panels/RealmPanel.vue + scenes/realm/* (RealmAscentTrack/Node)"),
    ("tru-vat", "Trữ Vật", "src/components/panels/InventoryPanel.vue + panels/bag-sections/* + scenes/inventory*"),
    ("luyen-dan", "Luyện Đan", "src/components/panels/PillRoomPanel.vue + scenes/alchemy* "),
    ("ban-do", "Bản Đồ", "src/components/panels/StageSelectPanel.vue + scenes/exploration/*"),
    ("nhiem-vu", "Nhiệm Vụ", "src/components/panels/QuestPanel.vue + scenes/quest*"),
    ("san-xuat", "Sản Xuất", "src/components/panels/ProductionPanel.vue + WorkerLodgePanel.vue + scenes/production*"),
    ("cai-dat", "Cài Đặt", "src/components/panels/SettingsPanel.vue + settings sections"),
    ("tro-giup-lore", "Trợ Giúp + panels khóa", "src/components/panels/LoreCodexModal.vue/Trợ Giúp + stub/locked panels (Trận Pháp, Thương Hội, Pháp Bảo, Đồng Hành, Bang Hội, Tông Môn, Bí Cảnh): enumerate what UI exists vs is gated"),
]

REPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "file": {"type": "string"},
        "logic_items": {"type": "number"},
        "art_items": {"type": "number"},
        "conflicts": {"type": "number"},
        "logic_without_visual": {"type": "number"},
        "visual_without_logic": {"type": "number"},
        "summary": {"type": "string"},
    },
    "required": ["file", "summary"],
}

REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "file": {"type": "string"},
        "verdict": {"type": "string"},
        "missing": {"type": "array", "items": {"type": "string"}},
        "wrong": {"type": "array", "items": {"type": "string"}},
        "summary": {"type": "string"},
    },
    "required": ["file", "verdict", "summary"],
}

async def in_fours(items, fn):
    """Run fn over items with at most 4 in flight; barrier per chunk."""
    results = []
    for i in range(0, len(items), 4):
        chunk = items[i:i + 4]
        results.extend(await parallel([lambda it=it: fn(it) for it in chunk]))
        log(f"chunk done ({i + len(chunk)}/{len(items)})")
    return results

def report_prompt(scope_id, name, hints):
    return f"""You are auditing the UI of the '{name}' scope in a Vue 3 idle game
whose UI is mid-reskin (old legacy vocabulary vs new tien-hiep art, so layers
overlap). Repo root: {GAME}

Your scope: {name}. Start from: {hints}
Find the real entry: locate the nav button label in locale files / FunctionOverlayPanel
mapping, then follow the mount chain to the actual components rendered on screen.
Audit every file in scope, including dormant/fallback code paths still imported.

{RULES}

{REPORT_FORMAT}

Write the report to: {GAME}\\docs\\ui-audit\\{scope_id}.md (create the dir if needed).

Then return structured output: file=<absolute path you wrote>, counts of logic items,
art files, conflicts, logic-without-visual items, visual-without-logic items, and a
3-line Vietnamese summary of the ugliest findings."""

def review_prompt(scope_id, name, hints):
    return f"""You are a skeptical reviewer. A report was just written auditing the UI
of '{name}' in repo {GAME} — file: docs/ui-audit/{scope_id}.md

Scope hints: {hints}

Your job: verify the report against the actual code. For each claim citing file:line,
spot-check it is real. Then hunt for what the report MISSED: unlisted files in scope,
art referenced that isn't mapped, global CSS rules affecting this panel, components
imported but never rendered, listeners/intervals still active. Classify each problem
as 'missing' (absent from report) or 'wrong' (reported incorrectly).

{RULES}

Write your findings to: {GAME}\\docs\\ui-audit\\review-{scope_id}.md — sections:
'## Missed', '## Wrong', '## Verified-ok'. Each finding cites file:line.

Return structured output: file, verdict ('thorough'|'has-gaps'|'unreliable'),
missing[] + wrong[] as one-line strings, summary (3 lines Vietnamese)."""

def adjudicate_prompt(scope_id, name, hints):
    return f"""You are the adjudicator for the UI audit of '{name}' in repo {GAME}.

Inputs:
- Draft report: docs/ui-audit/{scope_id}.md
- Review findings: docs/ui-audit/review-{scope_id}.md

Scope hints: {hints}

Verify every 'missing'/'wrong' finding against the code yourself (reviewers also
hallucinate). Then produce the FINAL corrected report at the same path
docs/ui-audit/{scope_id}.md (overwrite), keeping the original section format and
marking corrected lines where the review was right; reject review findings that are
wrong and say why in an '## Adjudication' appendix section.

{RULES}

Return structured output: file, counts as in the report schema, summary (3 lines
Vietnamese: what the review caught, what it got wrong)."""

async def search_agent(item):
    scope_id, name, hints = item
    try:
        return await agent(report_prompt(scope_id, name, hints), phase="wave1+2-search",
                           schema=REPORT_SCHEMA, label=f"audit-{scope_id}", vm_mode="shared")
    except Exception as e:
        log(f"audit-{scope_id} FAILED: {e}")
        return {"file": f"docs/ui-audit/{scope_id}.md", "summary": f"FAILED: {e}"}

async def review_agent(item):
    scope_id, name, hints = item
    try:
        return await agent(review_prompt(scope_id, name, hints), phase="wave3-review",
                           schema=REVIEW_SCHEMA, label=f"review-{scope_id}", vm_mode="shared")
    except Exception as e:
        log(f"review-{scope_id} FAILED: {e}")
        return {"file": f"docs/ui-audit/review-{scope_id}.md", "verdict": "unreliable",
                "summary": f"FAILED: {e}"}

async def adjudicate_agent(item):
    scope_id, name, hints = item
    try:
        return await agent(adjudicate_prompt(scope_id, name, hints), phase="wave4-adjudicate",
                           schema=REPORT_SCHEMA, label=f"fix-{scope_id}", vm_mode="shared")
    except Exception as e:
        log(f"fix-{scope_id} FAILED: {e}")
        return {"file": f"docs/ui-audit/{scope_id}.md", "summary": f"FAILED: {e}"}

async def main():
    await register_workflow({
        "name": "ui-audit-trang-bi-all-panels",
        "description": "4-wave UI audit: search reports per scope, then review, then adjudicate — max 4 agents at once, all on the shared worktree.",
        "subscribe": "refresh",
        "soft_time_limit_minutes": 25,
        "phases": [
            {"title": "wave1+2-search", "detail": "one audit report per scope -> docs/ui-audit/<scope>.md", "count": len(SCOPES_WAVE1) + len(SCOPES_WAVE2)},
            {"title": "wave3-review", "detail": "skeptical review of each report -> review-<scope>.md", "count": len(SCOPES_WAVE1) + len(SCOPES_WAVE2)},
            {"title": "wave4-adjudicate", "detail": "verify findings vs code, rewrite final report", "count": len(SCOPES_WAVE1) + len(SCOPES_WAVE2)},
        ],
    })

    log("wave1 search: dong-fu -> panels batch 1")
    r1 = await in_fours(SCOPES_WAVE1, search_agent)
    log("wave1 done: " + json.dumps([r.get("summary", "?") for r in r1]))

    log("wave2 search: remaining panels")
    r2 = await in_fours(SCOPES_WAVE2, search_agent)
    log("wave2 done: " + json.dumps([r.get("summary", "?") for r in r2]))

    all_scopes = SCOPES_WAVE1 + SCOPES_WAVE2
    log("wave3 review: skeptical pass over every report")
    rv = await in_fours(all_scopes, review_agent)
    log("wave3 verdicts: " + json.dumps([r.get("verdict", "?") for r in rv]))

    log("wave4 adjudicate: verify findings, finalize reports")
    ad = await in_fours(all_scopes, adjudicate_agent)
    for item, a in zip(all_scopes, ad):
        log(f"final {item[0]}: {a.get('summary', '?')}")

asyncio.run(main())
