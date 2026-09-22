# M-QI-01 — Meridian Invest Wiring — Spec

Status: v1
Depends on: master `7182e3be` (rulings docs committed)
Locked inputs: QI-D1 — Kinh Mạch is real Luyện Khí progression via **explicit/manual** invest through `MeridianSection` → Meridian chapter authority. Sequential nodes, monotonic page unlock (`page.realmIndex <= player.currentRealmIndex`), earlier pages remain accessible AND investable after realm advancement. **No implicit tick auto-invest.**

---

## 1. Context and intent

The Meridian (Bát Mạch) domain contract is fully built and tested (P7-M5 chapter + M-E page model): sequential `openedIds`, page-unlock gate, in-page-realm pace gate, `thong_mach_dan` + aux-material validation, permanent `bat-mach:*` modifiers, strict-prefix + page-lock save integrity, and a generic orchestration seam `realmAdvanceOps.investBodyChapter(player, chapterId)` that reads the chapter's own bag and debits only the consumed amount.

What is missing is the **production caller**: `MeridianSection.vue` is read-only ("M13-PARKED — no Thong Mach Dan gateway"), so the entire progression chain is unreachable by players. This mission wires exactly one boundary — the UI invest action → the existing authority — without touching the domain contract, data, or save shape.

Non-goals: meridian content/balance changes, `thong_mach_dan` economy tuning, Body Refinement (separate chapter, already tick-auto-invested by design), any tick wiring for meridian (explicitly forbidden by QI-D1), `thien_dia_chi_kieu` acquisition/content.

## 2. Current state — evidence map

| Concern | Today | File |
|---|---|---|
| Chapter invest | Full contract implemented: sequence → page unlock → in-page-realm pace → `thong_mach_dan` cost → aux check; returns consumed amount; `bat-mach:*` modifiers rebuilt by system dispatch | `core/realm/body/MeridianChapter.ts` |
| Orchestration seam | `investBodyChapter(player, chapterId)` resolves currency bag (`pill` for `thong_mach_dan`, `material` for `thien_dia_chi_kieu`), calls `investBodyChapterState`, debits only `consumed` | `core/game/GameManagerRealmAdvanceOps.ts` L434 |
| Aux semantics | `requiresThienDiaChiKieu` is a **possession gate** (checked `auxOwned >= 1`), NOT consumed — only the main currency is debited. Preserved as-is | `MeridianChapter.ts` L75, `GameManagerRealmAdvanceOps.ts` L445 |
| UI | `MeridianSection` renders paged rows (opened/next/locked, locked-preview pages, cost/gate labels on `next`) — **no action** | `components/panels/realm/MeridianSection.vue` |
| Tick | `GameManagerTickOps` binds `investBodyChapter` → `'body_refinement'` only (essence auto-invest, intentional). Meridian is NOT tick-bound — must stay that way | `core/game/GameManager.ts` L839, `core/game/GameManagerTickOps.ts` L119 |
| Resources | `thong_mach_dan` craftable at qi_refining (`alchemy_thong_mach_dan`); `thien_dia_chi_kieu` material exists | `data/alchemy/alchemyRecipes.ts`, `data/realm/Meridians.ts` |
| Reactivity | `useStateVersion()` exposes `{ stateVersion, bumpState }`; bag counts are non-reactive — read inside computeds gated on `stateVersion` (BuildingConstructionGate precedent); ops call → `bumpState()` on success | `composables/useGameState.ts`, `TechniqueBand.vue` L24/72 |
| Sim caller | `EarlyGameSession` already invokes `investBodyChapter` — a second caller is the designed shape, no refactor needed | `core/simulation/earlygame/EarlyGameSession.ts` L345 |

## 3. Target design

### 3.1 Flow

```
MeridianSection (next row, unlocked page)
  → click "Mở Mạch"
  → gameManager.realmAdvanceOps.investBodyChapter(player.$state, 'meridian')
  → meridianChapter.invest re-validates (sequence / page / pace / cost / aux)
  → consumed > 0 → pillBag debited, openedIds pushed
  → bumpState() → section re-renders (row becomes opened, next row becomes next)
```

`consumed === 0` → no-op, no `bumpState` (same convention as `TechniqueBand.vue`: bump only on success).

### 3.2 UI affordance

On the `next` row of an **unlocked** page render an invest button (existing `GameButton`):

- **Enabled** when all presentation-mirrored preconditions hold:
  - `pillBag.getAmount('thong_mach_dan') >= meridian.thongMachDanCost`
  - pace: `player.realmId !== page.pageRealmId || player.realmLevel >= meridian.requiredRealmLevel` (cross-realm = no pace gate, per chapter semantics)
  - `!meridian.requiresThienDiaChiKieu || materialBag.getAmount('thien_dia_chi_kieu') >= 1`
- **Disabled** otherwise, with the existing gate line (`cost`/`realmGate`/`auxGate` labels already rendered on `next`) serving as the reason — no new gating text needed beyond an "owned X / cost Y" hint for the currency.
- Locked pages and `locked`/`opened` rows render **no** button (sequential contract — only `next` is actionable).
- Button click is idempotent-safe: every click re-enters the chapter which re-validates sequence — a second click simply evaluates the NEW next meridian or returns 0.

The button is presentation convenience only; `meridianChapter.invest` remains the sole authority (A-rules — UI never owns the rule).

### 3.3 Invariants preserved (unchanged domain semantics)

- Strict sequential prefix — only the flat `openedIds.length`-indexed meridian is investable.
- Page monotonicity — `pageIndex <= playerIndex` required; lower pages investable at higher realm (no pace gate cross-realm).
- Aux is a possession gate, not a consumable — unchanged.
- No tick wiring — `GameManagerTickOps` deps binding stays `body_refinement`-only.

## 4. Files

| File | Why |
|---|---|
| `components/panels/realm/MeridianSection.vue` | invest button + owned-count display on `next` rows; reads `pillBag`/`materialBag` via `useGameManager()` inside `stateVersion`-gated computeds; click → `investBodyChapter` → `bumpState` |
| `locales/vi.json` + `en.json` | button label + owned hint keys under `panels.realm.meridian.*` |
| `components/panels/realm/RealmBodySections.test.ts` (or new `MeridianSection.test.ts`) | component-level invest tests with real GameManager + provided keys (existing harness pattern) |
| `core/game/GameManager.bodyChapter.test.ts` (extend) | pin that the UI-reachable op path consumes correctly end-to-end for `meridian` (partially covered — add only gaps) |

No production core changes expected: `MeridianChapter`, `BodyProgressionSystem`, `GameManagerRealmAdvanceOps`, `Meridians` data all stay as-is. If implementation finds the op needs a presentation-safe dry-check, it is reported as a finding — not silently added.

## 5. Invariants → tests

1. Click invest on `next` row with `thong_mach_dan >= cost` → `openedIds` gains the meridian, `pillBag` debited exactly `thongMachDanCost`, row flips to `opened`, the following row becomes `next`.
2. Insufficient `thong_mach_dan` → button disabled; if invoked anyway the op returns 0 and no state changes.
3. In-page-realm pace: at `qi_refining` below `requiredRealmLevel` → disabled; at/above → enabled.
4. Post-advancement completability: at `foundation_establishment`, the qi_refining page stays unlocked and `next` remains investable (no pace disable).
5. Final meridian (`Kỳ Kinh — Thiên Địa Chi Kiều`): without `thien_dia_chi_kieu` → disabled; with ≥1 → invests; aux count unchanged after invest (possession gate).
6. Locked page (mortal) renders no button.
7. Tick regression: `GameManagerTickOps` still binds `investBodyChapter` → `'body_refinement'` only — meridian receives no implicit tick investment (already pinned by `App.wiring.test` + a meridian-specific assert if cheap).
8. Save/restore: `openedIds` persists and `bat-mach:*` modifiers re-emit after restore (chapter contract, unchanged — covered by existing tests; re-verify not rewrite).

## 6. Resolved at spec time

- **One node per click** — sequential contract makes "invest N" meaningless; the button always targets exactly the next meridian.
- **No confirmation dialog** — matches existing invest/action convention (`TechniqueBand`, `QuanKhiPanel` ops fire directly).
- **Owned-count display** — pill bag is non-reactive; count rendered inside the `stateVersion`-gated computed (same pattern as `BuildingConstructionGate`), refreshed by `bumpState`/tick version bumps.
- **Failure UX** — silent no-op on `consumed === 0` (disabled state already communicates gates); consistent with existing op-call conventions.
