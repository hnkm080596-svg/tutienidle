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

## Finding format

Each finding uses `### <id> — <SEVERITY> — <title>` with fields: Severity, Location (`file:line`), Root cause, Repro, Impact. IDs: `CP-NN` (combat/progression), `EM-NN` (economy/meta), `INFRA-NN` (infra/state).

## Severity totals

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 1 | CP-01 |
| Medium | 5 | EM-01, EM-02, EM-05, INFRA-01, INFRA-02 |
| Low | 8 | CP-02, EM-03, EM-04, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07 |

## Headline items

- **CP-01 (High):** `percent` modifiers authored on zero-base stats are silent no-ops — 2 talents fully dead (`can_than`, `pha_giap`-line), 5 sites.
- **EM-01 (Medium):** spirit-spring accrual priced at claim-time realm for the whole window — ~5.6× over-grant across a breakthrough. **EM-05** is the same defect class in offline production (cycle seconds + reward band priced at login realm).
- **EM-02 (Medium):** offline cultivation grant applies the Tu Linh Tran buff's boosted `cultivationPerSecond` snapshot to the full offline window even after the buff expires.
- **INFRA-01 (Medium):** remote newest-wins compares two machines' client clocks — skew picks the wrong winner, silent rollback.
- **INFRA-02 (Medium):** `character_saves` push is an unconditional upsert — no CAS on the remote row.
