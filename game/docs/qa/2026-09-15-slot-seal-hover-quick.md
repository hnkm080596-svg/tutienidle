# QA Review: slot seal art + equipment hover alignment

- Date: 2026-09-15
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `game/src/components/common/SlotView.vue`, `game/src/components/common/SlotTypes.ts`, `game/src/components/common/SlotView.test.ts`, `game/src/components/common/ItemCardBody.test.ts`, `game/src/core/profession/ProfessionGrade.ts`, `game/src/core/profession/ProfessionGrade.test.ts`, `game/public/assets/ui/Slot/seal-frame.png` (new)

## Scope and Risk Map

User request (2026-09-15, two supplied screenshots): (1) the Pham corner
seal was a flat red box with dark Vietnamese ordinal text — replace with
the supplied carved seal-frame art + centered Han calligraphy glyph, and
shrink it; (2) the equipment-slot gold hover frame sat visibly inside
the black slot border — enlarge it so the frames coincide.

Risk mapper: domains `economy-and-progression` + `ui-input-lifecycle`,
`deepAuditCandidate: true` ("cross-system: 2 domains"). The economy flag
is path-based (`core/profession/ProfessionGrade.ts`); the actual diff in
that file changes only the `PROFESSION_GRADE_SEAL_ORDINALS` display
string table — no realm mapping, ordering, names, or any progression
logic. One-hop consumers: `SlotView.sealOrdinal` (seal text only) and
tests asserting glyph text. Bounded from code inspection; quick mode
retained. `unmappedPaths` (new PNG asset, test files, `SlotTypes.ts`
comment-only edit) are all non-production or content; routed manually to
ui-input-lifecycle.

Learned-defects ledger: no entries match — all recorded defects concern
save/refine/battle state transitions; this change introduces no state
transition.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-SEAL-1 | `sealOrdinal` computed / SlotView | rank 1-10 -> glyph | Boundedness: every valid rank maps to exactly one glyph; out-of-range still clamps | Value mutation (0, 11, undefined, non-integer) | seal text content per rank | Vitest (ProfessionGrade table + SlotView rank cases) | High reachability (every filled graded cell) / zero persistence |
| INV-SEAL-2 | seal element / SlotView | render seal | Seal stays decorative-only; grade info remains on the slot aria-label | Degraded environment (missing asset, missing glyph font) | `aria-hidden="true"` + `aria-label` carries "Ngu Pham" | Vitest (existing assertions) | Accessibility contract |
| INV-HOVER-1 | `.slot-view--equipment` hover layer | hover/focus equipment cell | Gold stroke lands on the slot border, clipped at the cell edge | Stale state (shared CSS var leaking to other variants) | rendered pixel alignment | Browser (P14) | High visibility, presentation-only |
| INV-HOVER-2 | `.slot-view--item` hover layer | hover bag cell | Item sheen behavior unchanged | Reorder/shared state | `--slot-hover-inset` set only under `--equipment`; generic layer defaults to `0%` | Static code inspection | Regression guard |
| INV-HOVER-3 | static SlotView (item-info-card header) | mount tooltip card | Hover layer still hidden in static mode (overshoot cannot bleed into card preview) | Repeat/unexpected combination | `.slot-view--static` display:none on hover-frame | Existing test (static mode spec) | Card preview integrity |
| INV-ASSET-1 | `public/assets/ui/Slot/seal-frame.png` | first render of any sealed cell | Asset resolves at `/assets/ui/Slot/seal-frame.png`; if missing, glyph alone still renders (graceful) | Degraded environment | network 200 / visual | File presence check + browser | Weight + reachability |
| INV-SEAL-3 | `--seal-rim` CSS var removal | style binding | No dangling consumer of the removed var | Cross-system chain (grep) | zero remaining references | grep sweep + tests updated | Dead-contract guard |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (vue-tsc --build) | exit 0 | clean |
| `npx vitest run src/components/common/SlotView.test.ts src/components/common/ItemCardBody.test.ts src/core/profession/ProfessionGrade.test.ts` | 51/51 pass, exit 0 | glyph mapping (5->五, 10->仙, material 3->七, 2->八), empty/no-rank -> no seal, aria-hidden, static-mode contract all green |
| Alpha-bounds measurement of hover/backdrop PNGs | `slot-frame-hover.png` visible stroke begins ~2.8%/2.1% inboard; `slot-backdrop.png` frame ~1.6-2.4% | motivated `--slot-hover-inset: -4%` so the stroke's bright core lands on the border line; parent `overflow: hidden` clips the overshoot exactly at the padding box |
| Seal-frame alpha measurement + resize | visible ring occupies ~89% of a 1024px asset; resized to 256px (444KB -> 24KB, siblings <=31KB) | `contain` keeps ring proportional at any cqw size |
| Grep `SEAL_ORDINALS|seal-rim|sealOrdinal|sealColor` over `src/` | only intended references remain; `--seal-rim` fully removed | no dangling contract |

## Findings

None Confirmed. Two bounded residual notes:

- The Han glyph font stack prefers KaiTi-family faces with graceful
  serif fallback; on systems without any Kai/Noto-CJK face the glyph
  still renders in the display serif (legible, less calligraphic).
  Status: accepted cosmetic degradation, Low.
- `seal-frame.png` glyph/frame contrast: vermillion `#d13a24` on the
  near-black tile is ~3.4:1 — below 4.5:1 body-text guidance but the
  seal is `aria-hidden` decorative chrome whose information is fully
  duplicated in the slot `aria-label`. Status: accepted, Low.

## New or Changed QA Tests

- `ProfessionGrade.test.ts` — explicit 10-glyph table in
  `PROFESSION_GRADE_ORDER` order (replaces derived-Vietnamese-name test).
- `SlotView.test.ts` — glyph assertions updated to Han characters; the
  removed `--seal-rim` contract is dropped from assertions; the
  processing-state test now asserts the glyph still renders (`五`) so the
  seal-in-blocked-state path keeps coverage.
- `ItemCardBody.test.ts` — static-card seal assertions updated to `五`.

## Gaps and Residual Risk

- ~~P14 live-browser confirmation deferred~~ — resolved at branch
  finishing (same day, main checkout @1280x800, real guest save seeded
  with cuu_pham/ngu_pham/tien_pham equipment): carved frame + Han glyph
  render on bag cells (18.2px seal on 62.7px cell = 30cqw, KaiTi stack
  resolved, #d13a24 ink, seal-frame.png served 200) and on the
  item-info card's static SlotView; equipment hover frame now lands its
  bright stroke on the cell border. 0 console errors.

## Pre-existing Failures

None observed in the audited scope.
