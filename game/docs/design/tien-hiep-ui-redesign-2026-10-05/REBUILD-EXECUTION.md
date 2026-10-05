# PC UI reconstruction

## Current authorization: functional migration

2026-10-05: User accepted the 32 shared visual designs and explicitly instructed wiring the existing logic. No gameplay logic change is allowed. Any conflict between accepted composition and existing behavior must be raised immediately to the user; only the dependent surface pauses while independent work continues. No commit/push/merge authorized.

G0/G1 current task card: existing worktree/branch/HEAD below; all dirty UI work is task-owned. Single responsibility is migration of production presentation to the approved reusable page/controls/diagram, preserving every existing prop/emit, domain operation, eligibility, feedback and lifecycle. Current/target logic owners stay identical. Production inputs come from existing Surface adapters and panel owners, never static gallery fixtures. Shared shell owns only artwork and layout. UI selection remains current presentation state; domain writers, reset, persistence and async cleanup remain current owners. Expected surface: components/scenes, panels, onboarding/common, assets CSS/i18n; no core/data/stores/services edits.

First proof: compare the actual mounted game screen against the approved gallery and execute its existing commands; assert unchanged domain outcomes, pending/error feedback and modal/focus cleanup. Q1-Q12 below continue to bind. G2 tests and G3 consumer migration are required per slice; G4/G5 and aggregate QA remain pending until executed. Static gallery acceptance is design authorization, not runtime proof.

> Visual fidelity first, wiring second. Earlier implementation was visually rejected (1/10). The user subsequently approved the shared 32-scene design and authorized production wiring. Production pages now consume the shared family; gallery acceptance alone remains insufficient runtime evidence.

User authorization: 2026-10-05, user delegates all layout decisions and asks to implement the entire UI. This supersedes waiting for individual concept approvals. Concept images provide palette and composition only; production models and commands determine every function.

Worktree: E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx; branch codex/tien-hiep-ui-redesign; baseline f8af8007b0b6519e6aa6997fedad2cc77939538a. Existing uncommitted UI work belongs to this task and is preserved. No commit, push or merge authorized.

## Task card and construction invariants

Responsibility: presentation composition and reusable visual chrome across PC surfaces. Gameplay authorities, persistence, timing, release admission and commands remain unchanged. Current and target owners are the existing surface adapters and their domain systems. Components receive read models and emit their existing intents. No new control without an existing intent; no concept sample value in production.

Q1: every existing action remains reachable, readable and gives its current feedback. Q2/Q3: domain owners retain writes and persistence; UI selection remains local. Q4: production surface -> fidelity component -> existing emitted intent -> current command. Q5: reuse GameButton, InkNineSlice, PaperPanelNavigation and current slot components. Q6/Q7: presentation dependencies only; no domain or clock changes. Q8: preserve prop/event signatures and canonical content. Q9: no side effect from rendering. Q10: retain focus, cleanup, disabled and pending semantics. Q11: secondary/hidden surfaces remain governed by current admission. Q12: acceptance requires real PC screenshots, interaction checks, type/build/tests and current aggregate review; concept gallery is not completion evidence.

## Ordered slices

1. Scene-specific layout: body/meridian/zhou-thien, realm and technique. Horizontal chapter navigation, legible focal diagram, dark inspector, real unit count and real requirements.
2. Entry and home: opening Bắt Đầu reveals the existing auth/continue/new-game flow; ink landscape and real building/HUD/navigation targets. Dynamic character assets stay owned by the user.
3. Collections and workshops: character, equipment, inventory, skills, alchemy and exploration. Preserve real topology, sockets, filters and costs while rebuilding hierarchy and spacing.
4. Auxiliary surfaces: formations, artifact, companion, production, recruitment, vendors, lore, quests/settings, tooltip/dialog/results/error states. Inventory of all production consumers is the coverage authority.
5. Integrate shared paper/ink/gold tokens and transparent decorative art, remove obsolete conflicting visual overrides, inspect runtime at 1280x720 / 1672x941 / 1920x1080, verify and repair aggregate state.

No source image will be used as a complete clickable panel. Landscape backgrounds are opaque; ornament/frame/icon cutouts must have actual exterior alpha. All labels/data/actions are rendered by the UI.

Status: PRODUCTION WIRING IMPLEMENTED, AGGREGATE QA IN PROGRESS. No completion or integration claim. The user confirmed Linh Bao remains the only available beta starter; Tram and Huy Quyen remain locked previews and the creation payload stays name + talent IDs. Five worker G5 reports are in this directory.

Latest coordinator evidence: full type check/build/Vitest passed after archived-producer refusal repair (936 files, 8654 passing tests, 12 expected failures, 8 skipped). Eight fresh PC composition/settings/dialog browser checks passed, including 1280x720, 1672x941 and 1920x1080. Combat abandonment/re-entry and exact save/reload were exercised separately. OCR file accounting, protocol evidence registration and resulting-state reviews remain unfinished. Hidden beta surfaces are fixture-verified and fail closed in production; this does not prove successful hidden gameplay transactions. Current detailed evidence is in `docs/qa/runs/pc-ui-rebuild-2026-10-05/COORDINATOR-WIRING-CHECKPOINT.md`.
