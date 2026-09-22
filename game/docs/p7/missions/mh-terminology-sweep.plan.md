# M-H — Terminology sweep (plan v2, matches spec v6)

Pure rename/reword sweep — no gameplay, ids, or persisted shape. Type-check is the primary gate; the §4 acceptance oracles are the regression oracle.

## Order

1. `git mv src/composables/useLoadoutActions.ts src/composables/useProgressionActions.ts`; rename export `useLoadoutActions`→`useProgressionActions`; fix header comment; update 4 importers (`CharacterPanel.vue`, `NodeInspector.vue`, `NodeTreePanel.vue`, `SkillRoleStrip.vue`).
2. `git mv src/components/panels/skill-path/SkillLoadoutStrip.vue src/components/panels/skill-path/SkillRoleStrip.vue`; rename component + `SkillPathPanel.vue` import/usage; CSS `.skill-loadout-strip`→`.skill-role-strip`, `.loadout-specializations*`→`.role-specializations*`; header comment reword.
3. `TechniqueSlotCard.vue`: `equipped`→`technique` (all refs); CSS `.loadout-card*`→`.technique-card*`. `TechniqueBand.vue`: `equippedTechnique`→`currentTechnique`.
4. i18n keys (values unchanged): `panels.skillPath.colTitles.loadoutActive`→`activeArts`; `combat.rewards.techniqueInsight`→`techniqueMastery` (en+vi + `RewardList.vue:16` + `SkillPathPanel.vue:251`).
5. Bucket-A comment rewords (spec §3.5): stale loadout semantics (`SkillPathPanel:11,16,151`, `QuanKhiPanel:76`, `App:752`, `Companions:3`, `CoreSkills×5`, `PhapTuChainSkills:825`, `Skill:142`, `BalanceBaselines:84`, `CharacterPanel:57`, `theme.css:6`); stale `equipped` model (`GameManagerPersistentEffectOps:29,52,92,103,235-237`, `BattleSimulation:35`, `TurnSkillAction:211,392,399-400`, `TurnBattleSystem:1793`, `SkillResolver:276-278`, `PhapTuEmpoweredUlts:15`, `CultivationPathRegistry:160`); retired `insight` (`Technique:9`, `Reward:3`, `Player:584`, `Enemy:34`, `FoundationEnemies:136` local var); `GameManagerSaveRestore:307-315` preserved-state list.
6. `terminology.md`: fix `tier` row inline (insight arithmetic retired, `TechniqueTier` = rank-band vocabulary); append post-sweep KEEP record + deferred display question.
7. Verify: `npm run type-check`; `npx vitest run src/components/panels src/components/common`; all 5 acceptance oracles per spec §4.
8. Gates: P3 quick → P18 OCR → P4 QA (quick) → P5 sequential ×3 → external impl review → merge.

## Guardrails

- Buckets B (retirement history + rejection sentinels), C (formation domain + false positives), D (equipment `equipped`) — NEVER touched. `equippedElements` = Bucket B only.
- i18n VALUES untouched — key names only.
- No `tierEffects`/`TechniqueTier` code changes — only the one stale comment at `GameManagerPersistentEffectOps:237`.
