# M-F-CHU-THIEN quick adversarial QA (2026-09-23)

Scope: `zhou_tian` Body chapter (TC normal-Body track) — state slice,
chapter definition, sequential unlock chain (body_refinement ->
meridian -> zhou_tian), persisted coherence invariant, authored Phap
essence currency, RealmPanel column, save version 76->77.

Task-owned paths: `src/core/realm/body/{BodyChapter,BodyProgressionSystem,MeridianChapter,ZhouTianChapter}.ts`,
`src/data/realm/ZhouTian.ts`, `src/components/panels/{RealmPanel.vue,realm/MeridianSection.vue,realm/ZhouTianSection.vue}`,
`src/services/save/saveVersion.ts`, `src/locales/{en,vi}.json`, plus
task-owned `*.test.ts`. Mapper: all unmapped -> manually routed to
economy-and-progression + save-and-cloud + ui-input-lifecycle.

## Invariant ledger
1. Sequential: a chapter consumes 0 unless every authored prereq is
   complete (dispatch gate + UI mirror + persisted coherence).
2. Capacity: circulation never exceeds realm-derived capacity (0 pre-TC,
   20*realmLevel in TC, 360 absolute); isComplete iff 360.
3. Currency: invest debits tinh_hoa_phap_the / substitutes; consumed>0
   -> exact debit; consumed<=0 -> no debit, no mutation.
4. Persisted coherence: crafted incoherent current-version saves reject
   at preflight with live state untouched.
5. UI mirror: rendered state equals chapter state; invest only active.

## Hypotheses run
- Over-capacity crafted circulation (>capacity, <=360): passes
  integrity (0..360); invest returns 0 (remaining<=0) -> cannot mint,
  cannot progress. Crafted-only, Low.
- Essence path: probe->plan->debit guarded `consumed<=0 -> 0`; chapter
  `invest` clamps `min(available, remaining)`, rejects remaining<=0.
- Direct chapter.invest callers: none — dispatch is the only caller
  (sequential gate coverage total).
- Tick auto-invest bound to body_refinement only (GameManager.ts:916);
  zhou_tian manual-only per spec.
- Restore boundary: preflight at GameManagerSaveRestore.ts:291 precedes
  any mutation; boundary tests pin byte-equivalent live state.
- Runtime (P14): all four states rendered; invest click 150->165,
  essence 15->0, button disabled at 0 owned.

## Findings
- Low (crafted-only): `integrityIssues` does not bound circulation by
  the current capacity (<=360 only). Reachable only via a crafted save;
  invest is a no-op in that state — no progression or currency effect.
- Low/Nit (UX mirror): `canInvest` counts only the exact Phap stack;
  a player holding zero Phap but substitution-covering higher-grade
  essences sees a disabled button although the dispatch would invest.
  Dispatch (authority) is unaffected.
- Low/Nit: a severely malformed prereq slice surfaces as TypeError
  rather than an aggregated issue inside assertBodyProgressionIntegrity
  — still fails closed (rejects restore).

Verdict: PASS WITH EVIDENCE. No confirmed defects; all Medium+
invariants verified by unit/integration tests and live runtime
evidence. Two Low/Nit items left visible above; safe to defer.
