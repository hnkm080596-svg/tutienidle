# tc-wave-2026-09-23 — Aggregate retro sweep verdict

**Run:** `tc-wave-2026-09-23` · **Scope:** AGGREGATE_REPOSITORY (report-only) · **Target:** `origin/p7/truc-co @ b76cc97b` (16 merged missions vs `origin/master`)

**Decision: QA_BLOCKED_SCOPE** — expected and honest: the sweep is review-only; no repairs are authorized on `p7/truc-co`. 21 open actionable findings remain (repairs route to follow-up missions). C2/C4/C6/C8 honestly unmet — no coverage matrix declared, no repair cycle, no clean rounds, no terminal check.

## Reviewers (sealed, all priorFindingsVisible=NO)

| review | session | lens | sealed report |
|---|---|---|---|
| REV-WAVE-A (CORRECTNESS) | devin-6e3a1a52… | correctness | reviews/sealed-A-wave.md |
| REV-WAVE-B (AUTHORITY) | devin-5d3b8537… | authority/persistence | reviews/sealed-B-wave.md |
| REV-WAVE-C (INTEGRATION) | devin-020ad272… | integration | reviews/sealed-C-wave.md |

Convergent discoveries: F-W-0 (A5+B-01+journal, ×3), F-W-2 (A1+B-02), F-W-5 (A4+C-02).

## Findings — integration-seam vs per-mission residual

### SEAM (cross-mission, new at wave tip) — 9

| id | sev | finding | owner |
|---|---|---|---|
| F-W-2 | **High** | respec refunds 100% Insight but never claws back one-shot grants — executed: free Kiem-Y forging (7001 pooled + 2 kiemDao at 0 insight cost), free skill unlocks | M-F-RESPEC |
| F-W-3 | Medium | initiation ritual skips `pourCultivationOvercharge` — Hai Nap bank pours one realm late | M-F-TALENT |
| F-W-4 | Medium | settlementError drain skips entitlement gate — stale record swallows next victory's talent entitlement | M-F-TALENT |
| F-W-5 | Medium | committed tribulation outcome + defeat cooldown never persisted — reload during deferral loses the run; mortals lose quan_khi re-entry | M-F-TALENT |
| F-W-6 | Medium | harness runs tribulations equipped vs production stripping gear (F-A-4 repair covered admission, not prep) | M-F-JOURNEY |
| F-W-8 | Low | `startTribulation` fail-open — admission rows only at composable/sim edges | M-F-JOURNEY/breakthrough |
| F-W-9 | Low | realm-passive grant markers persist apart from modifier payloads — silent orphan possible | realm-passive owner |
| F-W-10 | Low | quest claim-drop filter lacks `isDomainScopedAcquisitionEnabled` — latent artifact-domain bypass | quest/companion owner |
| F-W-13 | Nit | journey-spec doc: wrong respec tax (25% is switchRoute) + wrong save version (78 vs 81) | M-F-JOURNEY |

### RESIDUAL (per-mission / pre-existing) — 12

| id | sev | finding | owner |
|---|---|---|---|
| F-W-1 | Medium | SettingsPanel reset-save test stale after ConfirmModal→SysModalBase teleport — suite red on wave tip, green on master | M-UI-SYSTEM |
| F-W-0 | Low | `hiddenChannelCycles` persisted but undeclared on ProductionSiteStateSave (journaled Round-A F-A-6, re-verified ×3) | M-F-BODY-HIDDEN |
| F-W-7 | Low | unseeded Math.random → persisted state at 4 sites (alchemy bag, Van Dao waive, entitlement offers, beast counters) | per-site missions |
| F-W-11 | Low | Kiep Thuong defeat debuff unsaved — reload erases 60s penalty | tribulation/buff2 |
| F-W-12 | Low | mis-authored stages silently banded to qi_refining hidden-beast pool | stage owner |
| F-W-14 | Nit | `externalModifiers` stale "STATIC-ONLY" comment — double-apply trap | persistent-effect ops |
| F-W-15 | Nit | `tribulationBonusStacks` write-only counter mirroring loi_kiep sums | tribulation |
| F-W-16 | Nit | crafted-save `autoWorkerCapacity` phantom workers | save-validation |
| F-W-17 | Nit | `formationLoadout.assignments` no uniqueness/bounds check | save-validation |
| F-W-18 | Nit | `truc_co_dan` presence-checked, never consumed — dead inventory + wrong comment | tribulation |
| F-W-19 | Nit | hidden-beast counter counts auto-farm kills while substitution is active-only | BODY-HIDDEN |
| F-W-20 | Nit | harness `onAdvance` skips per-tick auto-invest — second parity gap | M-F-JOURNEY |

## Suite evidence

`npx vitest run` @ b76cc97b: **7188/7195 pass**. Failures: 2 env-only (`magick` ENOENT — same on master), 1 wave-introduced (F-W-1). Reviewer C ran 95 wave-changed files / 1557 tests green + `vue-tsc` clean.

## Judged-clean surfaces (convergent negatives)

Release-policy single authority; talent entitlement originate→reconcile→resolve; technique mirror republish; essence substitution fail-closed funnel; body-chapter modifier prefixes + registry map; hidden-channel single-registry authority; companion-gift write-if-absent + single consume; store/component boundary; respec core accounting (no over-refund); every wave-added subsystem is wired into runtime (the P13-class failure mode is absent); v73-v81 chain is a rejection chain (no migration surface to audit).

## Protocol-run friction (learning corpus additions)

1. Loose-schema record inputs accepted by `record` then rejected by `validate` — record-time schema validation gap (same class as Round A; now needs a fix note: run `validate` early).
2. `run.checkout`/`run.branch` not populated by `init` from request — had to patch ledger run block by hand.
3. Census `location.path` must literally start with the required domain string — non-obvious contract.
4. Transport truncation still ~6-8k — reviewers attach sealed .md files instead (worked cleanly this run).
5. SWE-2 cap (5) delayed reviewer C until a reviewer finished — fine for sequential chain semantics anyway.
