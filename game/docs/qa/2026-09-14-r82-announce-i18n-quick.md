# QA Quick — R8.2 remainder: announcement i18n migration

**Scope:** `OutcomeAnnouncement` descriptor contract (`core/presentation/`), `TribulationOutcomeService` + `BreakthroughOutcomeService` now return `announcement` (i18n keys + params) instead of hardcoded `announceTitle`/`announceBody`; `useTribulation`/`useBreakthrough` resolve via `i18n.global.t`; `announce.*` keys added to `vi.json` + `en.json`.

**Mode rationale:** quick. Presentation-surface contract change; no gameplay rules, state ownership, persistence, or economy touched. Domain writers unchanged (verified by existing parity suites).

## Hypotheses checked

| # | Hypothesis | Verdict | Evidence |
|---|-----------|---------|----------|
| H1 | Missing/misspelled i18n key → `t()` returns the raw key → broken announcement displayed | Rejected | Parity tests resolve every emitted descriptor through the real `i18n.global.t` and assert byte-identical pre-migration strings; en-fallback presence asserted per key |
| H2 | `i18n.global.t` unavailable at module level / before setup | Rejected | `i18n` instance created synchronously at module import (`createI18n` is sync); composable tests run the adapters in jsdom and pass |
| H3 | Param interpolation drift (`{label}`/`{realm}`) | Rejected | `FOUNDATION_LABELS[grade].toUpperCase()` / `realm.name` params asserted — resolved title '★ ĐẠI ĐẠO TRÚC CƠ ★' and '★ KIM ĐAN ★' match the old literals |
| H4 | Other `announceTitle`/`announceBody` consumers broken by contract rename | Rejected | Repo-wide grep: zero remaining references; type-check clean |
| H5 | `worldAnnouncement.show()` callers left with hardcoded strings | Rejected (all three callers now resolve via `t()`): QuanKhiPanel (pre-existing pattern), useTribulation, useBreakthrough |
| H6 | Breakthrough major-realm descriptor unreachable/untested | Bounded | Branch is documented-dead (CultivationSystem never crosses realms); pinned via stubbed `player.breakthrough` — contract verified, production unreachable |
| H7 | Uppercasing belongs to presentation, not domain | Accepted | `titleParams` values keep `.toUpperCase()` in the service — preserves byte parity; pure-data params (realm name) stay un-uppercased in body params |

## Residual risks

- `announce.breakthrough.major.*` keys are emitted only by the documented-dead branch; if that branch is ever removed, the keys become orphan locale entries (harmless).
- Other domain-side Vietnamese strings outside announcements (e.g. error strings thrown by realmSystem `Không tìm thấy cảnh giới`) remain hardcoded — explicitly out of scope (P16: backlog, not mandate).

## Verdict

**PASS WITH EVIDENCE** — displayed strings pinned byte-identical via i18n resolution tests; all `show()` callers go through the gateway; full suite green.
