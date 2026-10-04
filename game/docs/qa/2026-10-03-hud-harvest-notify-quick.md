# QA Review: hud-harvest-notify-fix

- Date: 2026-10-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - game/src/composables/useBuildingNavigation.ts
  - game/src/core/building/BuildingSystem.ts
  - game/src/core/game/GameManagerBuildingOps.ts
  - game/src/components/scenes/login/AuthSecondaryActions.vue
  - game/src/components/game/HomeBuildingIcons.test.ts
  - game/src/core/building/BuildingSystem.test.ts
  - game/src/locales/vi.json
  - game/src/locales/en.json

## Scope and Risk Map

Two user-reported defects, one branch:

1. 'Tiến trình dừng tại Trúc Cơ' line on the login screen
   (`onboarding.auth.guest.note`, rendered by AuthSecondaryActions.vue)
   removed per user request. The button beneath it is the wired
   guest-auth path (`startGuest` -> `authenticate('guest')` ->
   `bootGame`), required by a11y/e2e specs (data-testid
   `auth-guest-button`) — kept, not dead. Realm-CTA surfaces already
   self-hide at the beta ceiling via `betaNextRealmSurfaceFor`; no
   literally-dead button exists near the line.

2. Thiên Cơ board 'ready' entry (`home.thienCo.ready.*`) fired on
   `getStoredAmount(...) >= 1`, which is permanently true for any
   producing building — i.e. notification fires long before harvest is
   full. Old storage-full branch was unreachable: for
   `gathering_outpost`, `getEffectiveCapacity` deliberately returns
   `ceil(10h_yield - 1e-6)` = one unit above the attainable max (design:
   offline yield never hard-caps), so `stored >= capacity` can never
   fire for non-integer yields (mortal L1: yield 1269.23, capacity 1270).
   Fix: `BuildingSystem.isStorageFull` compares stored against the
   attainable accrual max `min(capacity, PRODUCTION_OFFLINE_CAP_SECONDS *
   rate)` — reachable at exactly the 10h boundary for every rate curve,
   and at integer capacity for integer-capacity buildings.

Mapper: domains economy-and-progression, pinia-phaser-sync,
ui-input-lifecycle; `deepAuditCandidate: true` ("cross-system: 3
domains"); unmapped: useBuildingNavigation, GameManagerBuildingOps,
en.json, vi.json. Escalation decision: STAY QUICK — every edge is a
pure read. `isStorageFull` mutates nothing and derives from the same
pin/rate/capacity sources `getStoredAmount`/`claim` already use;
facade mirrors existing read facades; locale removal has zero
consumers (grep + i18nKeyParity); template emits unchanged. One-hop
consumers (useThienCoEntries, DongFuBuildingPlaque, DongFuStage badge)
all consume the same unchanged 'ready' enum value.

## Invariant Ledger

| # | Hypothesis | Result |
| - | ---------- | ------ |
| H1 | isStorageFull true for non-producer buildings -> noise entries | Rejected: composable guards `producesMaterialId`; attainable<=0 early-returns false; getStoredAmount returns 0 for non-producers |
| H2 | Float boundary: `stored >= attainable` fails at exact saturation | Rejected: at elapsed>=CAP both sides compute `min(capacity, CAP*rate)` identically -> exact equality |
| H3 | accrualRealmId pin divergence between stored and attainable | Rejected: one pin resolved per call; getStoredAmount re-resolves idempotently to the same pin |
| H4 | instanceId/instance mismatch in facade | Rejected: facade resolves by instanceId, composable passes instance.instanceId |
| H5 | lastCollectedAt in future -> wrong result | Rejected: stored=0 -> not ready (safe direction) |
| H6 | 'ready' fires for locked/hidden buildings | Rejected: useThienCoEntries keeps `isBetaBuildingSurface` scope guard; plaque only renders for built instances |
| H7 | Removing locale key breaks parity/other locales | Rejected: i18nKeyParity green; vi+en both updated; zero remaining references (grep) |
| H8 | Removing the note breaks login layout/a11y | Rejected: verified visually on live login (1-button and 2-button states); buttons' emits untouched |
| H9 | Post-claim remainder re-triggers ready | Rejected: claim leaves <1 fractional remainder -> below attainable -> entry clears |
| H10 | Ticker 30s delay at boundary | Rejected: same cadence as before; acceptable staleness, unchanged mechanism |
| H11 | Mid-window level-up skews attainable | Rejected: rate/capacity/stored all resolve at current level, consistent with what claim pays |
| H12 | Per-render facade cost | Rejected: one map get + arithmetic per building per tick; trivial |
| H13 | Guest-button contract broken | Rejected: button untouched; a11y + e2e specs still target `auth-guest-button` |
| H14 | 'dung tai Truc Co' copy elsewhere | Rejected: grep confirms only the removed key produced this string |
| H15 | Other consumers of home.thienCo.ready.* | Rejected: entry keys unchanged; composable is the sole feed |
| H16 | Capacity-floor buildings regress | Rejected: min(cap, CAP*rate) == cap when cap <= CAP*rate -> fires at exact full as before |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| ---------------------- | ------ | ------------------- |
| `npm run type-check` | clean | vue-tsc --build, 0 errors |
| `npx vitest run src/core/building/BuildingSystem.test.ts` | 24/24 | incl. 3 new isStorageFull boundary tests |
| `npx vitest run src/components/game/HomeBuildingIcons.test.ts src/composables tests/architecture/asciiComments.test.ts` | 172/172 | nameplate ready/not-ready + ASCII comments |
| `npx vitest run i18nKeyParity` | 10/10 | vi/en parity after key removal |
| Live app, seeded lastCollectedAt=now-5min (partial vein) | Thiên Cơ board EMPTY | Playwright/CDP on dev server :5338 |
| Live app, seeded lastCollectedAt=now-10h+ (full vein) | board shows 'Khai Vật Đường sẵn sàng thu hoạch / Sản lượng đã đầy kho / Thu hoạch' | Playwright/CDP, screenshot /tmp/thienco-full.png |
| Live login screen (1-button + 2-button states) | note line absent, buttons work | screenshots /tmp/login-*.png |

## Findings

None confirmed in-scope.

## New or Changed QA Tests

- `BuildingSystem.test.ts` +3: `isStorageFull` at/over/under the 10h
  boundary for non-integer (mortal L1) and integer (qi L9) yield curves,
  plus non-producer false. These prove the attainable-max semantics the
  consumer badge relies on — the case the old `stored >= capacity` could
  never reach on production data.
- `HomeBuildingIcons.test.ts` +1 renamed +1 new: ready badge at full
  accrual; no badge at 42/84 partial (isolates ready-vs-default at max
  level).

## Gaps and Residual Risk

- Thiên Cơ preview page (`/ui-dong-fu.html`) is a static fixture and does
  not render the live ready-entry path; live-app verification substitutes
  (recorded above).
- No e2e coverage asserting the board entry stays absent during partial
  accrual over a live accrue cycle — covered instead by unit + live
  seeded-state evidence. Non-blocking.

## Pre-existing Failures

- Save-shape validator rejects a real seeded guest save carrying
  `hoi_linh_thao_foundation_establishment_myriad_year` (foundation-tier
  herb) in a mortal player's bag — a realm-mismatched reward drop exists
  upstream (likely offline/grant path). Out of scope for this fix;
  validator correctly flags it as forged save. Worth a follow-up task.
