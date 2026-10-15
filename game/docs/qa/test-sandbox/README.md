# Local Test Sandbox

Branch: `codex/test-sandbox`. Base: `edcf07bae`.
Worktree: `E:\tutienidle\.agent-worktrees\test-sandbox`.
App root: `E:\tutienidle\.agent-worktrees\test-sandbox\game`.
Changes are uncommitted; no merge, push or deployment was performed.

## Use

Run `npm run dev` from the app root and use its printed URL. The current review server is `http://127.0.0.1:5188/`.

1. On the entry screen, click **Vào chế độ test**. No account or master key is required.
2. The app reloads with **TEST — lưu cục bộ** and the **Dev Power** button.
3. The first visit creates a fresh mortal through the existing character-initialization transaction. Later visits resume the separate test save automatically.
4. In Dev Power, choose **Phàm nhân** or **Pháp tu nhập môn**. Confirmation replaces the entire sandbox character and world snapshot, then reloads it. Cancel does not apply a preset.
5. **Về chế độ thường** flushes the sandbox save before changing modes. A failed write keeps the game in sandbox and displays an error.

Thể tu remains unavailable under the current release allowlist. Its button explains the restriction without changing the character. No release gates were opened to make a preset work.

This entry is available only when Vite `DEV` is true. A remembered flag cannot activate it in a release build. This change does not package or distribute a sandbox installer.

## Ownership and isolation

| Responsibility | Implementation |
| --- | --- |
| Startup mode | `services/dev/testSandbox.ts`: one immutable mode per runtime; mode changes require reload |
| Backend selection | Existing `backendBundle.ts` selects the existing mock/local bundle only in sandbox |
| Save namespace | Existing `saveKeys.ts` resolves sandbox to `local-test-sandbox-v1`, including revision/backup/envelope paths |
| Tools access | Sandbox gains the existing presentation tools; `isMasterSession()` remains false in sandbox |
| Preset construction | Separate headless GameManager; existing initializeCharacter and realm initiation owners build the snapshot |
| Save writes | Existing CloudSaveCoordinator and LocalCloudSaveService; validators and failure results remain authoritative |
| Transition admission | Auto-auth waits for `coordinator.whenIdle()` and checks admission before boot |

Ordinary admin/key behavior remains unchanged. Sandbox never uses the legacy master save-tolerance/recovery privileges. No changes to validators, backend-mode validation, online-session controller, server rules, schemas or release allowlists were made.

## Verification

Targeted command:

```powershell
npx vitest run src/services/dev src/services/save/saveKeys.test.ts src/services/master/masterAccess.test.ts src/services/backend/backendMode.test.ts src/composables/resumeSession.test.ts tests/architecture/i18nKeyParity.test.ts
```

Result: **42 tests / 7 files passed**. Covers separate namespace, local-only composition even when supabase is requested, absence of master tolerance, release refusal, failed storage switching, real-release preset admission and locale parity.

`npm run type-check`: **PASS** on the final implementation.

Additional unchanged-owner regression scope: **68 tests / 4 files passed** (`CloudSaveCoordinator.test.ts`, `LocalCloudSaveService.quota.test.ts`, `useAppLifecycle.test.ts`, `useSessionAccount.test.ts`). Total targeted tests: **110 passed**.

Browser command (run against this worktree's dev server):

```powershell
$env:TEST_SANDBOX_URL = 'http://127.0.0.1:5188'
node scripts/dev/verify-test-sandbox.mjs
```

The browser script preserves its generated screenshots and browser profiles. It checks real Edge UI entry, preset confirmation/cancellation, scope refusal, reload persistence, a forced storage-quota failure during exit, successful return to ordinary mode, preservation of an ordinary-save sentinel, and zero backend requests. Screenshots are checked visually as well as with assertions.

Final browser run: **PASS**, `browser-1792083136652/result.json`, no unhandled runtime errors and no backend requests. Screenshots: [Dev Power](browser-1792083136652/02-mortal-tools.png), [Phap Tu preset](browser-1792083136652/03-preset-spell.png), [failed save keeps sandbox](browser-1792083136652/04-save-failure-retains-sandbox.png), [ordinary mode](browser-1792083136652/05-normal-mode.png).

Earlier browser runs exposed and resolved the auto-entry transition race. The default Vitest setup also admitted all ways, so the preset suite now pins the real beta allowlist instead of using the permissive fixture baseline. Other retained failed runs include harness issues (a watched browser-profile database and an incorrect dialog-role selector); they are not successful evidence.

The user explicitly authorized a reduced project workflow while preserving the no-file-deletion constraint. No full-project QA fixed-point, production-release readiness or whole-suite result is claimed. No files were deleted.
