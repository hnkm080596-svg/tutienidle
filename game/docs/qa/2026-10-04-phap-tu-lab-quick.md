# Quick Adversarial QA - Phap Tu Test Lab (2026-10-04)

## Scope

- Task: DEV test environment for Phap Tu skills (fire kit + The/Phap The + constellation) without grinding to Truc Co. Branch `devin/1791114108-phap-tu-test-env` off `codex/hoa-cau-fireball-vfx`.
- Task-owned paths: `game/src/core/dev/phapTuLab.ts` (new), `game/src/core/dev/phapTuLab.test.ts` (new), `game/src/dev/PhapTuLabBridge.vue` (new), `game/src/App.vue` (modified).
- Mapper: `domains: [ui-input-lifecycle]`; `unmappedPaths: [game/src/core/dev/phapTuLab.ts]` — manually routed: dev-tooling + ui-input-lifecycle (bridge mount, panel visibility), save-field seeding (bounded by DEV+mock gating). `deepAuditCandidate: false`; cross-system breadth is bounded to mock-backend dev surfaces only.
- Exclusions: none beyond non-task-owned files (unrelated dirty paths absent).

## Invariant ledger

| ID | State/owner | Action + transition | Invariant | Attack operator | Oracle | Result |
|---|---|---|---|---|---|---|
| LAB-1 | `window.__tutienPhapTuLab` / prod bundle + real backend | poke writes on a remote-committed save | Recoverability | Degraded env (prod build, non-mock backend) | registration absent outside DEV+mock | Clean - `import.meta.env.DEV` + `backendBundle.mode === 'mock'` double gate, same seam as enemySpawnDebug; auto-run requires the poke to exist |
| LAB-2 | provisioned save fields | `setup()` twice / reload with `?lab=` | Idempotency | Repeat | attributes/insight unchanged on re-run | Fixed during OCR: deficit-only attribute grant + insight floor; repro covered by `re-running setup leaves the provisioned save unchanged` |
| LAB-3 | mortal uncommitted save | `commitFiveElementInitiation` fails after level/cast seed | Atomicity | Value mutation | save at legal mortal-lv12 state, retry proceeds | Low - bounded partial mutation, all writes idempotent; accepted (dev tooling) |
| LAB-4 | battle entry seam | `battle()` while a transition is in flight | Lifecycle | Reorder | `'rejected'` status, no crash | Fixed during OCR: `enterStage` throw wrapped; `setManualInput` side effect is a legal user-visible toggle |
| LAB-5 | `deps.getPlayerState()` | lab call after a wholesale `$state` swap | Stale state | Stale state | live `$state` always read | Fixed during QA: dep changed from captured `player.$state` to `getPlayerState()` getter |
| LAB-6 | presentation coordinator | `?lab=` auto-run during boot curtain | Concurrency | Timing boundary | settles to `idle` then enters; silent give-up after 20 tries | Low - bounded retry, manual `lab.battle()` remains available |
| LAB-7 | `resolveVictory` realm write | realm leg on a committed non-foundation save | Cross-system | Cross-system chain | realm=pipeline outcome identical to a real win | Clean - gated to mock; runtime-verified realm + mastery node + entitlement |
| LAB-9 | combat route | `openConstellation()` while a battle object exists | Synchronization | Interruption | panel renders on home chrome | Fixed during QA: exit predicate widened from `isBattleInProgress` to `getTurnBattle() !== null` (covers finished battles parked on route) |
| LAB-16 | pre-boot mount | poke called before `bootGame` completes | Reorder | Reorder | mutation lands on pre-restore state | Low/nit - auto-run is sequenced inside bootGame; manual console pre-boot call is a benign dev edge |
| LAB-17 | combat UI | cast all 3 kit skills in a real battle | Lifecycle | Runtime | skill bar + Thế pips + PHÁP THẾ + constellation visible | Clean - Playwright runtime on dev server: `?lab=phap_tu` boots, provisions, enters `foundation_floor_1`, casts, 5/5 Thế + PHÁP THẾ label lit, constellation panel renders |
| LAB-19 | prod build contents | dev code bundled | Lifecycle | Value mutation | no player-facing effect | Clean - matches enemySpawnDebug convention (eager import, internal gate) |
| LAB-20 | `skillCastCounts` write | seed `linh_bao` lv3 without a cast seam | Domain authority | Cross-system | seeded count is a legal played state | Low - direct save-field seed, no op seam exists (same class as realmLevel bump); documented in-file |
| LAB-21 | committed-but-mortal edge | `setup()` on path committed at mortal | Recoverability | Reorder | `refused: committed save is still mortal` | Clean - guard present |

## Findings

All confirmed issues were repaired through the implementation workflow and reverified:

1. (OCR-F1, Low) `enterStage` pinned zone `'thanh_van'` -> zone id now resolved via `zoneRegistry.getZoneForStage` (fallback `'thanh_van'`).
2. (OCR-F2, Nit) `enterStage` throw rejected the promise -> caught, returns `rejected: <stage> (enterStage threw)`.
3. (QA LAB-2, Medium->fixed) `setup()` stacked +90 attributePoints and +20 insight per re-run -> deficit-only grant + `Math.max` insight floor; idempotency test added.
4. (QA LAB-5, Low->fixed) captured `player.$state` could detach on a wholesale state swap -> `getPlayerState()` dep.
5. (QA LAB-9, Low->fixed) `openConstellation` skipped the exit on a finished battle -> `getTurnBattle() !== null` predicate.

Deferred (all Low/Nit, recorded with reasons):
- LAB-3 partial seed on failed initiation: bounded to legal save states, retry succeeds; dev tooling.
- LAB-6 auto-run give-up after ~6s of unsettled curtain: console-logged; manual path remains.
- LAB-16 pre-boot manual call: writes to pre-restore state; URL auto-run cannot hit it (sequenced inside bootGame).
- LAB-20 cast-count direct seed: no production seam exists; mirrors `__fixtures__` convention.
- Inline `display:none` style on `PhapTuLabBridge.vue`: dev-only mount point.

## Evidence

- `npx vitest run src/core/dev/phapTuLab.test.ts` - 8/8 pass (provisioning, idempotency, keepTalent, battle chain + zone id, cross-path refuse, in-combat refuse, constellation exit both branches).
- `npm run type-check` - clean.
- Runtime (Playwright, dev server 5788, fresh guest char): `[phap-tu-lab] ok: initiation:fire | truc_co | special:tam_muoi_chan_hoa | attributes` then `entered: foundation_floor_1`; `.turn-combat-skill-bar` visible; battle state `fighting`; kit `basic=hoa_cau_thuat empowerment=true special=tam_muoi_chan_hoa`; special/basic casts executed; seeded 4 Thế + cast -> `the=5/5 empowerment=true` with PHÁP THẾ label lit (screenshot 04); `openConstellation()` exited combat and `.constellation-panel` rendered with Hỏa Linh Ngộ purchased (screenshot 05).
- Screenshots: `/tmp/lab-shots/01..05`.

## Verdict

**PASS WITH EVIDENCE** - no unresolved Medium-or-higher on the changed surface; deferred Lows recorded above. P5 sequential review passes still run on the coordinator side.

## Learning candidates

- For a dev poke mutating a reactive store surface, capture the surface via a getter evaluated per call, never a one-time snapshot - a later wholesale `$state` replacement would silently detach it. (Novel class for this repo; candidate for `learned-defects.md` once protocol intake confirms.)
