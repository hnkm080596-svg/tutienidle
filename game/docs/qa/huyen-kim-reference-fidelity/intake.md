# Huyen Kim Reference Fidelity - Intake (Task 0)

Date: 2026-10-02. Worker: Devin (implementation + QA coordinator).
Plan: `docs/superpowers/plans/2026-10-02-huyen-kim-reference-fidelity-devin-plan.md`.

## Candidate lock

- Worktree: `C:\Users\hnkm0\.codex\worktrees\huyen-kim-ui-art\tutienidle` (pre-existing PR97 implementation worktree, reused per plan Task 0)
- Branch: `devin/huyen-kim-ui-art`
- Committed HEAD: `f3461e69124a7e72d6d5061277e95b7978baee2b` (PR #97 remote head; state OPEN, mergeable, base `devin/frontend-ready`)
- Working tree: HEAD + ~100 files of uncommitted imperial-scroll migration work from the previous session (ImperialScrollScene/ImperialNavRail/useImperialNav/TechniquePanel/BodyPanel are all UNTRACKED; ~80 modified tracked files)
- Dev server: `http://localhost:5305` (hash-derived port for this worktree)

## Baseline reality check vs plan §2 assumptions

| Plan §2 claim about PR97 head | Actual state in working tree |
|---|---|
| AuthEntryScreen diff = 3 lines (backdrop only) | Already rebuilt: HuyenKimParallaxStack + right-anchored card + chrome text-fields + divider ornament (uncommitted) |
| `huyen-kim-chrome.json` 20/20 pending, flat URLs | 43 slots, 42 `ready` with category-subfolder URLs that all resolve on disk; only `scrollbar` pending (HOLD per Ruling 03) |
| RealmPanel = substrate in hero only | Vista substrate inside scroll + 3 realm-rung cards (still NOT the ref's 18-node ascent path) |
| `InkNineSlice` chromeId wired | Yes; `chrome-id` renders ready PNG art via border-image/mask; `asset-id` renders pure-CSS chrome (PNG intentionally hidden per component comment) |

## Reference package verification

- 17 reference images present: `docs/design/references/huyen-kim/scenes/01..17-*.jpg` (Inventory derives from 12-equipment grammar)
- Specs present: `huyen-kim-scene-layout-spec.{md,json}` (1672x941 design space), `huyen-kim-reference-audit.md`, `frontend-contract.md`, `huyen-kim-component-state-matrix.md`, `huyen-kim-ui-art-manifest.json`
- Stable art on disk: `public/assets/ui/huyen-kim/scene/{auth,realm,skill,body,technique,equipment,map,tribulation}/` all `@1x/@2x` pairs present; `stable-scene-extension.json` contract mirrored in `StableSceneArt.ts`
- Chrome art on disk: all 42 ready slots resolve under `public/assets/ui/huyen-kim/{frames,slots,surfaces,buttons,...}/`

## Before-capture

`tests/e2e/huyen-kim-fidelity-capture.qa.spec.ts` drives real flows at 1280x720 and writes `evidence/before/*.png`. Reusable via `HK_FIDELITY_DIR` env for the after set.

Coverage: 16 scene states captured (login, creation, dong-fu closed+open, character, realm, technique-empty, skill-precommit, body, inventory, stage_select pending recapture, alchemy, equipment, combat, victory, defeat, tribulation, settings, quest).

## Summary of before-state findings (evidence: `evidence/before/`)

Global:
- Scroll interiors render flat beige paper everywhere; refs show painted vista interiors for world-family scenes (realm/skill/body/technique/quest) and parchment+mountain-fade for settings.
- Nav rail seals clip two-line labels ("Nhân Vật" -> "Nhân -vật").
- Dong Fu top bar clips rightmost utility seals at 1280.

Per-scene deltas recorded in `scene-matrix.md`; asset/consumer findings in `asset-consumer-census.md`; missing-art registry in `art-gaps.md`.
