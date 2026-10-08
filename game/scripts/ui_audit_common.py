import asyncio
import os

# Shared constants + prompt builders + wave runner for the UI audit
# fan-outs. Imported by ui_audit_workflow.py (full run) and
# ui_audit_catchup.py (retry pass) — no side effects at import time.

REPO = "hnkm080596-svg/tutienidle"
BRANCH = "devin/artui-c0-foundation"
GAME = r"C:\Users\Administrator\repos\tutienidle\.agent-worktrees\artui-c0-foundation\game"
AUDIT_DIR = os.path.join(GAME, "docs", "ui-audit")
MAX_CONCURRENT = 4

REPORT_FORMAT = """Report format (Vietnamese, Markdown):
# Panel: <name>
## 1. Mount chain — từ nav/route đến component gốc, file nào chứa gì
## 2. UI logic inventory — mọi computed/store-read/emit/directive/props đang feed DOM (mới lẫn cũ)
## 3. Art map — mỗi file art (đường dẫn assets/) + element dùng nó; kể cả art qua CSS global
## 4. Conflicts / layers — nơi 2 phiên bản UI cùng tồn tại (dead DOM, suppression CSS, component trùng vai trò, global rule đè scoped)
## 5. Logic không có hình ảnh — logic/state không render ra gì
## 6. Hình ảnh không có logic — art/DOM trưng bày, unwired
## 7. Open questions — mâu thuẫn cần chủ dự án quyết
Every claim cites file:line. Read code, never guess. Cap ~500 lines."""

RULES = f"""Hard rules:
- READ-ONLY audit. Never edit code, never run mutating git commands, never start servers.
- The UI is mid-reskin: audit BOTH the live path and dormant/fallback/legacy paths still imported or reachable — dead code counts.
- Include global chrome affecting your scope (src/assets/tien-hiep-ui.css rules matching your classes).
- Checkout the audit snapshot first: `git checkout {BRANCH}` in the clone, then work inside `game/`.
- Do NOT write the report file — return it in `report_md`. Keep it under ~500 lines."""

SCOPES = [
    ("dong-fu-vista", "Động Phủ — vista/stage", "scenes/dong-fu/DongFuStage.vue (vista bg, header, resource chips, quest card) + game/MainScene.vue + game/scenes/MainScene.ts (Phaser canvas under it)"),
    ("dong-fu-nav", "Động Phủ — nav rail + overlay flow", "DongFuStage nav rail/icons/seam/collapse + FunctionOverlayPanel + core/presentation/OverlayLayers.ts + ui store open/close"),
    ("wheel-cu", "Wheel cũ", "scenes/dong-fu/fidelity/DongFuWheel.vue + DongFuHomeContent.vue + dongFuUi.ts + scenes/character/CharacterFigureWheel.vue — mounted anywhere or dead?"),
    ("trail-hien-tai", "Trail/điều hướng hiện tại", "the CURRENT navigation/trail mechanism on home (nav rail, seams, quest tracker 'Nhiệm Vụ ›', panel open flow) — enumerate whatever trail-like UI is live"),
    ("tu-si", "Tu Sĩ", "panels/CharacterPanel.vue + scenes/character/* + pc-paper chrome"),
    ("cong-phap", "Công Pháp", "panels/SkillPathPanel.vue + panels/skill-constellation/* + skill-sheet chrome"),
    ("trang-bi-doll", "Trang Bị — doll/sockets", "panels/EquipmentPaperdoll.vue + scenes/equipment/paperdoll/EquipmentPaperdollStage.vue + SlotView props used"),
    ("trang-bi-bag", "Trang Bị — túi", "panels/bag-sections/EquipmentBagSection.vue + filters/footer/grid + shared BagGrid.vue if used"),
    ("trang-bi-forge", "Trang Bị — 5 tab op", "panels/equipment-hall/* (Enhance/Wash/Refine/Dissolve/Decompose + qi-hall.css + equipmentHallDisplay.ts)"),
    ("trang-bi-shell", "Trang Bị — shell/sheet/tabs", "panels/EquipmentHallPanel.vue + scenes/equipment/EquipmentSurface.vue + scenes/equipment/fidelity/* (incl. dormant fallback)"),
    ("luyen-the", "Luyện Thể", "panels/BodyPanel.vue + scenes/body*"),
    ("tam-phap", "Tâm Pháp", "panels/TechniquePanel.vue + ScripturePavilionPanel.vue + scenes/technique*"),
    ("canh-gioi", "Cảnh Giới", "panels/RealmPanel.vue + scenes/realm/* (RealmAscentTrack, RealmAscentNode)"),
    ("tru-vat", "Trữ Vật", "panels/InventoryPanel.vue + panels/bag-sections/* (MaterialBagSection etc.) + inventory chrome"),
    ("luyen-dan", "Luyện Đan", "panels/PillRoomPanel.vue + alchemy scenes"),
    ("ban-do", "Bản Đồ", "panels/StageSelectPanel.vue + scenes/exploration/*"),
    ("nhiem-vu", "Nhiệm Vụ", "panels/QuestPanel.vue + quest tracker on home"),
    ("san-xuat", "Sản Xuất", "panels/ProductionPanel.vue + WorkerLodgePanel.vue + production scenes"),
    ("cai-dat", "Cài Đặt", "panels/SettingsPanel.vue + settings sections"),
    ("tro-giup-locked", "Trợ Giúp + panels khóa", "panels/LoreCodexModal.vue/Trợ Giúp + locked/stub nav items (Trận Pháp=TranPhapPanel?, Thương Hội=VendorPanel, Pháp Bảo=ArtifactPanel?, Đồng Hành=CompanionPanel, Bang Hội, Tông Môn, Bí Cảnh): what UI exists vs gated"),
    ("shared-chrome", "Component dùng chung", "components/common/SlotView.vue + SlotTypes.ts + common/art/* + GameButton + InkNineSlice + SceneDesignCanvas — who uses what, variant matrix"),
    ("global-css", "Global CSS/traps", "assets/tien-hiep-ui.css + tien-hiep-secondary-ui.css + huyen-kim.tokens.css + theme.css — every global rule hitting panels, --th-art-* var map"),
    ("tooltips", "Tooltip hệ thống", "composables/useTooltip.ts + useEquipmentTooltip.ts + gear-tooltip styling + all tooltip consumers in panels"),
    ("overlay-host", "Overlay/scene host", "FunctionOverlayPanel.vue + paperMode registry + scrim/transition layers + how panels get mounted/hidden"),
]

SEARCH_SCHEMA = {
    "type": "object",
    "properties": {
        "scope": {"type": "string"},
        "report_md": {"type": "string"},
        "summary": {"type": "string"},
    },
    "required": ["scope", "report_md", "summary"],
}
REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "scope": {"type": "string"},
        "verdict": {"type": "string"},
        "findings_md": {"type": "string"},
        "summary": {"type": "string"},
    },
    "required": ["scope", "verdict", "findings_md", "summary"],
}

def write_doc(name, text):
    os.makedirs(AUDIT_DIR, exist_ok=True)
    path = os.path.join(AUDIT_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return path

def base_ctx(item):
    scope_id, name, hints = item
    return (f"Repo {REPO}, branch {BRANCH} (run `git checkout {BRANCH}` first), "
            f"work inside `game/`. Scope: {name}. Start: {hints}\n\n{RULES}\n")

def search_prompt(item):
    scope_id, name, hints = item
    return base_ctx(item) + f"""Audit ALL UI-related logic for '{name}' — old AND new — then write the report.

{REPORT_FORMAT}

Return structured output: scope='{scope_id}', report_md=<full report>, summary=3-line Vietnamese summary of ugliest findings."""

def review_prompt(item, report_md):
    scope_id, name, hints = item
    return base_ctx(item) + f"""You are a skeptical reviewer of this UI audit report for '{name}':

<report>
{report_md}
</report>

Verify file:line claims against code. Then hunt what it MISSED: files in scope,
art not mapped, global CSS rules hitting the panel, imported-but-unrendered
components, live listeners/intervals. Output findings Markdown with sections
'## Missed' / '## Wrong' / '## Verified-ok', each finding cites file:line.

Return: scope='{scope_id}', verdict ('thorough'|'has-gaps'|'unreliable'),
findings_md=<full findings doc>, summary=3 lines Vietnamese."""

def research_prompt(item, report_md, findings_md):
    scope_id, name, hints = item
    return base_ctx(item) + f"""You are the research/adjudication pass for the '{name}' UI audit.

<report>
{report_md}
</report>

<findings>
{findings_md}
</findings>

Verify every Missed/Wrong finding against code yourself (reviewers hallucinate too),
then produce the FINAL corrected report in the ORIGINAL section format, plus an
'## Adjudication' appendix listing which findings you accepted/rejected and why.

Return: scope='{scope_id}', report_md=<full corrected report>, summary=3 lines Vietnamese."""

def final_review_prompt(item, report_md):
    scope_id, name, hints = item
    return base_ctx(item) + f"""Final review of the corrected UI audit for '{name}'. The report below went through
one review + adjudication round already:

<report>
{report_md}
</report>

Check only for material errors that remain: false file:line claims, big scope files
still missing, conflicts/logic-vs-visual items the earlier rounds did not catch.
Do NOT re-litigate adjudicated items. Output findings Markdown ('## Missed' /
'## Wrong' / '## Verified-ok'), cite file:line.

Return: scope='{scope_id}', verdict ('clean'|'minor-residual'|'still-broken'),
findings_md=<full doc>, summary=3 lines Vietnamese."""

SEM = asyncio.Semaphore(MAX_CONCURRENT)

async def wave(items, fn, phase, label_prefix, schema, retries=8, backoff=60):
    async def one(item):
        scope_id = item[0]
        last = None
        # Org caps at ~5 concurrent sessions; a 429 means 'retry when a
        # sibling finishes'. Back off OUTSIDE the semaphore so other
        # scopes can use the freed slot while this one waits.
        for attempt in range(retries):
            async with SEM:
                try:
                    return await agent(fn(item), phase=phase, label=f"{label_prefix}-{scope_id}",
                                       schema=schema, repos=[REPO], soft_time_limit_minutes=25)
                except Exception as e:
                    last = e
            await asyncio.sleep(backoff)
        log(f"{label_prefix}-{scope_id} FAILED after {retries} retries: {last}")
        return None
    return await parallel([lambda i=i: one(i) for i in items])
