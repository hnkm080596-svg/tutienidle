# Local Audit — Manifest

**Branch:** `local-audit`
**Findings commit:** `662e35f3` (`audit(local): backend/game-logic deep-QA findings — combat, economy, infra slices`)
**Base:** `master` @ `68621987`
**Audit-only:** no production files modified by this audit.

## File → slice mapping

| File | Slice | Auditor |
|---|---|---|
| `combat-progression-findings.md` | `core/{combat,battle,enemy,buff2,skill,skilldef,proc,stats,math,element,formation,cultivation,breakthrough,realm,tribulation,kiem-tu,phap-tu,the-tu,talent,technique,simulation}` + related data | subagent |
| `economy-meta-findings.md` | `core/{economy,inventory,item,equipment,artifact,alchemy,pill,material,drop,production,profession,companion,building,quest,reward,idle,events,notification,game,dev,player,world-map}` + related data | local primary |
| `infra-state-findings.md` | `stores/`, `services/` (save/cloudSave/supabase/auth), `composables/`, `game/scenes/` lifecycle, `presentation/`, `main-process/`, `App.vue` wiring | local primary |
| `frontend-findings.md` | Playthrough UI audit: onboarding, panels/overlays, command wheel, stage select, turn-combat HUD — measured contrast + DOM evidence | local primary |

## Finding format

Each finding uses `### <id> — <SEVERITY> — <title>` with fields: Severity, Location (`file:line`), Root cause, Repro, Impact. IDs: `CP-NN` (combat/progression), `EM-NN` (economy/meta), `INFRA-NN` (infra/state), `FE-NN` (frontend/UX).

## Severity totals

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 2 | CP-01, FE-01 |
| Medium | 9 | EM-01, EM-02, EM-05, INFRA-01, INFRA-02, FE-02, FE-03, FE-04, FE-05 |
| Low | 14 | CP-02, EM-03, EM-04, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, FE-06, FE-07, FE-08, FE-09, FE-10 |

## Headline items

- **CP-01 (High):** `percent` modifiers authored on zero-base stats are silent no-ops — 2 talents fully dead (`can_than`, `pha_giap`-line), 5 sites.
- **FE-01 (High):** tutorial overlay renders `--paper-text` (near-black) on dark scrim at 1.21:1 — the first screen every new player sees is illegible. Same token-family root cause as FE-02 (building headings 1.24:1 on `overlay-panel--ink`).
- **EM-01 (Medium):** spirit-spring accrual priced at claim-time realm for the whole window — ~5.6× over-grant across a breakthrough. **EM-05** is the same defect class in offline production (cycle seconds + reward band priced at login realm).
- **EM-02 (Medium):** offline cultivation grant applies the Tu Linh Tran buff's boosted `cultivationPerSecond` snapshot to the full offline window even after the buff expires.
- **INFRA-01 (Medium):** remote newest-wins compares two machines' client clocks — skew picks the wrong winner, silent rollback.
- **INFRA-02 (Medium):** `character_saves` push is an unconditional upsert — no CAS on the remote row.

## Coverage notes

- **Round 4 (this pass, no new findings):** battle terminal-edge funnel (`completeAction` defeat-before-victory ordering), talent passive sync (`syncTalentCombatPassive` iterates all effects/talents), mana-shield cap, absorb order, technique progression, talent entitlement transaction, tribulation settle/drain seam, save-versioning discipline, persistent-buff pool (Kiep Thuong session-scope is documented design), tick ordering, GameManager DI wiring, node economy atomicity, companion gacha/progression/exchange/gift/feed, drop pipeline rng ordering, artifact progression + deferred domain gate. All cleared — see "Notes reviewed and cleared" tails in each findings file.
- Prior rounds already cleared: ops layer exactly-once guards, offline-window caps, wash/refine tickets, production/alchemy event drains, restore depth, stage leases, quest internals, combat build partition, presentation sessions, timed-effect merge.
