# QA quick - vista layer cleanup (PR #114 commit 2)

Scope: xoa lop nha vista cu khong render trong prod (owner diem 4 -
"don sach lop nha vista cu + nameplate chet").

## Deleted (38 files)

- `components/game/`: DongFuScene, DongFuBuildingSprite,
  DongFuCommandWheel, GlobalTopBar, ThienCoRail,
  HuyenKimQuestTracker (+ 5 test files)
- `scenes/dong-fu/`: DongFuHomeScene + hotspots/ (4) + vista/ (6) +
  dais/ (2) + wheel/ (5) + thien-co/ (4)
- `scenes/dong-fu/hud/`: DongFuTopBar, DongFuIdentityPlate,
  DongFuResourceCluster, DongFuUtilitySeals, DongFuQuestTracker
  (giu DongFuResourcePill - live qua CurrencyHud)

## Dangling-ref sweep

- Per-file importer census truoc khi xoa: moi file chi con importer
  nam trong deletion set hoac comment.
- Post-delete grep toan bo ten component tren src/tests/scripts: 0
  import that con lai (chi con comment da sua).
- Comment updates: useTooltip, stores/ui, GameRoot, MainScene,
  DongFuArt, ThanhVanBackdropArt, BackgroundVariant, DesignFrame,
  commandWheelCatalog, useDialogFocus, DongFuStage, CurrencyHud,
  generate-vendor-placeholder-art.mjs, useStageActive test,
  create-to-combat spec, b18ConsumerHonesty.
- Arch tests repoint: betaConsumerLeak CONSUMER-02 mount
  DongFuStage (badge `.df-node__badge` tren `data-wheel-slot`,
  cung gate canTriggerBreakthrough); betaFrontendScopeExposure +
  betaFrontendReadModels bo entry file da xoa, pin
  betaWheelSlots doi sang DongFuStage.

## Verification

- `npm run type-check`: PASS (sua them 1 latent error:
  `noticeTimer` typed `number` cho `window.setTimeout`).
- `npx vitest run` scoped (architecture + dong-fu + common +
  layout + composables + quest + game): 163 files / 1285 tests
  PASS, 7 expected-fail, 8 skipped.
- Runtime (dev server :5317, guest -> create char -> home):
  5 plaque `.df-building` render, 0 console/pageerror; seed
  realm+materials -> 2 chip `.df-building__upgrade` hien; click
  chip pill_room -> level 1->2. Upgrade affordance song sau
  cleanup.
- OCR delegate rule: 18 reviewable files - toan comment swap +
  2 code edits (timer type, arch-test repoint) - khong finding.

## Residual risk

- Low: i18n keys chi dung boi component da xoa con sot lai -
  dead keys, khong anh huong runtime.
- Dead asset PNG (silhouette-mask/locked-overlay) con trong
  DongFuBuildingArt catalog - van live qua
  useBuildingHeaderState.artPath, giu nguyen.
