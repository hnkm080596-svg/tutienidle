# R8.2 Slice 2 — Breakthrough Outcome Chain — Design Spec

**Status:** Draft, implementing
**Date:** 2026-09-11
**Branch:** `r8-breakthrough-outcomes` (base: master `3d689582`)
**Roadmap:** game/docs/roadmap.md §R8.2 (AR-10 + selected AR-13)
**Predecessor:** 2026-09-11-r82-progression-outcomes-design.md (Slice 1, merged)

---

## 1. Scope

Slice 1 moved the TRIBULATION outcome chain. Slice 2 moves the remaining
outcome chain AR-10 flagged: **minor-realm breakthrough consequences**
currently sequenced/owned by the Vue composable `useBreakthrough.ts`.

Current state (characterized 2026-09-11):

| Outcome rule | Location | Notes |
|---|---|---|
| Cultivation reset + level-up + attribute point | `core/cultivation/CultivationSystem.breakthrough()` | ALREADY domain (store action delegates) |
| Realm passive sync after any success | Vue (sequencing of GameManager calls) | domain calls, Vue ordering |
| phap_tu KC: learn+equip `dai_ngu_hanh_quyet_truc_co`, inherit insight | Vue (grant logic inline) | AR-10: outcome determined in Vue |
| Artifact awakening at KC | Vue (`player.artifact = createDefaultArtifactProgress(...)`) | AR-10 write |
| `advanceArtifactRealmLevel` banked-tier release | Vue (domain primitive called from Vue) | sequencing |
| Major-realm announcement | Vue | presentation, stays |

Not in scope: CultivationSystem.breakthrough itself (already domain);
tribulation chain (Slice 1, done); announcement strings i18n (backlog).

## 2. Target architecture

```text
App.vue tick (auto minor breakthrough)  ── same call site
        ↓
useBreakthrough() (thin adapter)
        ↓  facade command
GameManager.breakthroughWithConsequences(player)  [A5 orchestrator]
        ↓
CultivationSystem.breakthrough (level/points domain owner)
        ↓ on success
BreakthroughOutcomeService.resolveBreakthrough(...)  [DOMAIN, new]
        → realm passive sync (GameManager ops)
        → phap_tu KC technique grant (inherited insight)
        → artifact awakening (ARTIFACT_ID_BY_CULTIVATION_PATH)
        → banked artifact tier release
        → returns typed BreakthroughOutcomeResult
        ↓
Vue adapter: announcement only (typed result driven)
```

### 2.1 Key design decisions

- The technique/artifact grants are currently DUPLICATED in kind with
  `grantCultivationPathRealmReward` (Slice 1 service already sequences
  GameManager's idempotent path-reward). Investigation note: the phap_tu
  KC technique grant in useBreakthrough is the SAME grant the tribulation
  victory path performs via grantCultivationPathRealmReward (techniqueId
  dai_ngu_hanh_quyet_truc_co). After Slice 1, the tribulation chain owns
  it. The breakthrough chain reaching the same state through
  breakthrough() at max level cannot happen (breakthrough never crosses
  major realms — CultivationSystem returns false at maxLevel). So the
  useBreakthrough technique/artifact branches are a RETAINED PARALLEL
  PATH for historical flows. Migration keeps them, verbatim, in the new
  domain service — consolidating the two grant paths is NOT authorized
  here (P10; needs its own evidence pass).
- Writer contract: same pattern as Slice 1
  (TribulationPlayerWriter precedent). New
  `BreakthroughPlayerWriter extends PlayerData` for the artifact write.
- App.vue auto-breakthrough tick stays a tick-sequencing decision
  (runtime pacing) — unchanged.

## 3. Behavior preservation contract (A12)

Pinned by: existing `cultivationRitualFlow.integration.test.ts` (uses
`dai_ngu_hanh_quyet`), `useTribulation.artifact.test.ts`, plus new
service tests:

1. Failed breakthrough (canBreakthrough false): NO side effects at all.
2. Minor-realm success: cultivation reset, realmLevel++, attributePoints++.
3. Realm passive sync runs on EVERY success (idempotent).
4. Major-realm-id change via breakthrough() alone: impossible (domain
   returns false at maxLevel) — the technique/artifact branches are
   therefore exercised only by their own tests, kept verbatim.
5. Announcement fires only when realmId changed.
6. Banked artifact tier releases on every success when artifact exists.

## 4. Migration path (TDD)

RED: BreakthroughOutcomeService tests (service level, GameManager real).
GREEN: service + GameManager facade `breakthroughWithConsequences` +
adapter rewrite (announcement-only). App.vue call site unchanged.
Existing suites stay green with unchanged assertions.

## 5. Verification strategy

P3 full + E3 + P5 + P4 quick (same gates as Slice 1). R14 guards must
stay green (no new vitals/baseStats writers; A6 unchanged).
