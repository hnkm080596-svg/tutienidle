# Census — tc-wave-2026-09-23 (aggregate sweep, origin/master..p7/truc-co @ b76cc97b)

Scope: AGGREGATE_REPOSITORY retro sweep. 417 files changed (+29,136 / −54,066). This census is coarser than
the mf-journey run by design: it inventories the *merged wave surface* — which domains the wave touched and
where persisted-field authority lives — rather than per-line mutation. Per-mission detail is out of scope
(report-only retro).

## Diff surface by domain (files changed, origin/master..b76cc97b)

| Domain | Files | Notes |
|---|---|---|
| src/core | 119 | 51 subsystems; largest: progression, tribulation, production, equipment, body (kiem-tu/the-tu/phap-tu), talent, technique, essence (economy), quest, battle |
| src/components | 39 | UI panels for new systems (body/talent/technique/essence/companion/artifact/quest/journey) |
| src/data | 28 | element skills, node trees, breakthrough pools, trúc cơ data packs |
| src/services | 10 | save/migration chain v73→v81, SaveSystem, TribulationOutcomeService |
| src/composables | 8 | UI-system wiring, lifecycle |
| src/stores | 2 | pinia store diff (small — wave mostly writes core/services) |
| docs/p7 | bulk | per-mission reports, trúc cơ spec docs |
| .c2c | 52 | historical C2C artifacts (non-binding per adoption) |
| root docs | 3 | AGENTS.md, AstraDoctrine.md, PROJECT_CONTEXT.md |
| tests | many | unit + e2e incl. TrucCoJourney.test.ts (1110 lines), tribulation-flow, technique-frozen-warning |

## Persisted-field authority census (save v81)

- Save schema types: `saveTypes.ts` (301 lines) — MaterialStackSave, PillStackSave, TalismanStackSave,
  FormationStackSave, GameSave (top-level aggregate), ProductionCycleSave, ProductionSiteStateSave,
  AlchemyJobSave.
- Writer: `SaveSystem.ts` (753 lines) — serializes per-subsystem state into GameSave; migrations live in
  `src/services/save/` + `src/core/save*` migrations chain v73→v81 (CURRENT_SAVE_VERSION=81).
- Known drift carried forward from Round A (journaled): `hiddenChannelCycles` is persisted per
  production site in SaveSystem (~line 376) but absent from `ProductionSiteStateSave`
  (saveTypes.ts ~267-283). Classification: REAL_DEFECT, RESIDUAL, pre-existing (came in via BODY-HIDDEN
  wave). Reviewer B re-verified independently at b76cc97b.
- Round A repairs landed pre-merge on the impl branch (824a57b9, ff4e3b6e): deterministic whole-drive
  draws, full-save parity oracle, widened grant census, drain committed-outcome guard, positive-GD capped
  oracle — efficacy re-checked inside the wave by reviewers.

## Sweep classification rules

- **[SEAM]** — defect only exists because two missions' code meet at the wave tip (new at aggregate level).
- **[RESIDUAL]** — per-mission residual or pre-existing defect still live on the merged base.
- Review-only run: every finding is report-only; repairs route to follow-up missions, never p7/truc-co.
