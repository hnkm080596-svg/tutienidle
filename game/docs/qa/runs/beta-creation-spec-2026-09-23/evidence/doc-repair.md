# Round-A repair evidence — authorizedRepairs doc edits (commits 632ccd57 + b183c02d)

Repairs applied to the run's product files (docs/specs + docs/plans only — the
authorizedRepairs set) in response to sealed round-A findings F-SPEC-01..13.

## Amendments applied

- **§1c2 (new)** — sim economy census: PerfectionEconomy (const import,
  mortalStatBudget creationPoints term, MEASUREMENT_PROFILE), EssenceSubstitutionEconomy
  (MEASUREMENT_PROFILE literal), boundary-test v82 describe, theTuAnE2E retitle,
  INT-A-4 re-pin rule row, INT-A-1 ~24-file restore-fixture sweep row.
  (F-SPEC-01, F-SPEC-02, F-SPEC-09)
- **§1a** — in-repo Supabase migration row
  (supabase/migrations/202608240001_online_auth_character.sql signature,
  NOT NULL base_attributes, signature-scoped grants, drop-overload semantics,
  same-window deploy order). (F-SPEC-03)
- **§3 D5** — skillStep keys (kicker,title,selected,description) + named footer
  homes onboarding.creation.finish/creating/errors.rollFailed/back. (F-SPEC-04)
- **Census line cites** — 11 stale citations corrected to verified values at
  44abadfb (App.vue :548-591/:533-546, StatBlock :62-66, CastLeveling :17,
  shape :2308, contracts :4-8/:19-23, preflight :265-283 ×2, setMortalBasicSkill
  :639-655). (F-SPEC-05)
- **Plan** — pendingMortalBasicSkill → pendingCreationPick (matches impl);
  hidden-path cite prefixes normalized (core/skill/…). (F-SPEC-06, F-SPEC-07)
- **Q10** — restated: pick is consume-once via newCharacterGrantsApplied gate
  (useAppLifecycle :252-259,:340); not an open double-write gap. (F-SPEC-08)
- **§1h** — boot-fresh.spec.ts reclassified REWRITE (Bước 1/3 assertion);
  helpers row enumerates nav-testid death (creation-continue-name /
  creation-confirm-talent) + attribute-loop removal; saveShapeValidation
  absent-case kept at shape layer (pick-agnostic per file's :2260 comment),
  reject flip belongs to boundary.test. (F-SPEC-10, F-SPEC-11, F-SPEC-13)
- **§1i** — doc surfaces added: ui-components.md, m-f-journey-spec.md:100,
  superpowers early-progression plan :63,210, p7/ui-inventory.md. (F-SPEC-12)
- **Q-D** — resolved: RPC function lives in-repo; same-window deploy order
  required. (F-SPEC-03)

## Verification basis

Every amendment was cross-checked against the implementation at impl head
92b4ebaa (impl had already executed the correct surface — migration edited
527388a7, PerfectionEconomy creationPoints=0 + profile pick, EssenceSubstitution
profile pick, boundary.test v82 describe, helpers/boot-fresh rewritten,
i18n footer keys present in vi.json/en.json). The docs were behind the impl;
the repairs document reality rather than redirect it.

sha256(beta-creation-spec.md @b183c02d) = 0f7cd9f0…(see ledger artifactHash)
sha256(beta-creation-plan.md @b183c02d) = …(see ledger artifactHash)
