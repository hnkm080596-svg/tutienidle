# Closed Beta có kiểm soát — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` hoặc `executing-plans` để triển khai từng gói. Checklist dưới đây là công việc dự kiến, không phải bằng chứng đã chạy. Quy tắc AGENTS và Internal QA Protocol ưu tiên hơn hướng dẫn commit hay giới hạn vòng của skill.

**Goal:** Đưa candidate hiện tại từ NO-GO sang closed beta nội bộ trên Windows: tài khoản cấp sẵn, whitelist server, cập nhật installer thủ công, tiến độ có thể reset theo đợt.

**Architecture:** Sửa tại owner hiện hữu và toàn bộ consumer bị ảnh hưởng. SQL giữ quyền cho phép account/session/save; session owner giữ credential; clock/reward owner giữ thời gian và thưởng; Electron main giữ hành động cài đặt và OS. Không chuyển combat/economy sang server trong nhiệm vụ này.

**Tech Stack:** Vue 3/TypeScript/Pinia/Phaser, Vite/Vitest/Playwright, Electron/NSIS, Supabase/PostgreSQL.

**Spec:** [audit 11/10/2026](./2026-10-11-closed-beta-readiness-deep.md) và các quyết định người dùng ở mục 1. Audit là bằng chứng của baseline, không phải chứng nhận implementation mới.

## Global Constraints

- Chỉ lập kế hoạch ở lượt hiện tại; **chưa được sửa production, tạo tài khoản thật, migrate cloud, commit, push, merge hay phát hành**.
- Baseline audit: `4bd90314c3edefe1ecb54a8b97737cdf8b9b1fd9`. Worktree kế hoạch: `E:\tutienidle\.agent-worktrees\beta-readiness-audit`, branch `codex/beta-readiness-current`, app root `game/`. Plan và evidence chưa commit/push.
- Khi triển khai: đối chiếu HEAD mới, checkpoint phần bị thay đổi, tạo worktree cho từng trách nhiệm từ baseline tích hợp đã được cho phép. Không dùng checkout chính có thay đổi riêng; không coi worktree sound là source phát hành.
- Đường dẫn dưới đây tương đối với `game/`, trừ khi ghi repository root. Không đọc `.env*`, credential/key/token; dùng cơ chế cung cấp cấu hình bảo mật của operator.
- Beta giữ Pháp Tu Hỏa, 30 tầng, trần Trúc Cơ; wash/refine đang mở. Không mở companion, formation, artifact, Kiếm Tu, Thể Tu, daily quest hoặc ore decomposition chỉ để làm test xanh.
- Không coi reset được phép là cho phép mất save trong cùng đợt, xóa account ngầm hoặc tự reset khi cập nhật. Mỗi lần reset thực tế cần quyết định và thông báo riêng.
- Tuân thủ P3/P13/P14/P18 và terminal predicate của QA protocol. Không dùng pass count, ba lượt tự-review hay docs-only để cấp chứng nhận release.
- Mọi gói giữ source comments ASCII/English, UI tiếng Việt qua i18n, không thêm `any` để che bất nhất type.

## 1. Các quyết định đã chốt với người dùng

| Quyết định | Phạm vi đã được chọn | Hệ quả triển khai |
|---|---|---|
| Phát hành | Installer Windows, cập nhật thủ công | Candidate không khởi chạy provider tự cập nhật; có đường hướng dẫn thay installer |
| Account | Chỉ tài khoản đăng ký | Không có đường chơi khách/nâng cấp khách trong beta; sửa session owner dùng chung vẫn bắt buộc |
| Cấp account | Người dùng/operator cấp sẵn từng tài khoản | Không xây đăng ký tự do, mã mời tự phục vụ hoặc email onboarding mới |
| Access | Whitelist phía server | Ràng buộc theo UUID auth, kiểm trên claim và mọi session-bound RPC; không chỉ ẩn nút |
| Ký ứng dụng | Chấp nhận **unsigned chỉ cho closed beta nội bộ**; hiện chưa có certificate | Có profile nội bộ riêng, manifest/hash và kênh tin cậy; không gỡ yêu cầu ký của signed-release pipeline |
| Save | Có thể reset tiến độ | Hỗ trợ cohort/reset có chủ đích; cùng cohort vẫn phải lưu/reopen đúng |

Không còn câu hỏi sản phẩm nào cần chặn việc lập kế hoạch. Trước thao tác hạ tầng, operator vẫn phải chỉ định project beta/staging, danh sách tester, máy Windows nghiệm thu, nơi cấp installer và người nhận bug. Đây là đầu vào vận hành, không phải giá trị agent được tự đoán.

## 2. Thứ tự và điều kiện dừng

| Đợt | Công việc | Có thể song song | Cổng ra |
|---|---|---|---|
| 0 — khóa baseline và chứng minh giả định | A0, first-proof account và clock | Đọc source/build preparation độc lập | Có owner, target được chỉ định và kết quả proof thật; phần chưa proof giữ DISCOVERY_REQUIRED |
| 1 — phục hồi nền kiểm chứng | A1 build; A2 scope/test fidelity; A3 refresh | A1 và A3 trên worktree khác; A2 chờ phần liên quan A1 | Repro lỗi nguyên bản chuyển xanh, không đổi nghĩa gameplay |
| 2 — quyền vào beta và thời gian | A4 account/whitelist; A5 clock | Hai trách nhiệm độc lập sau contract tương ứng | Non-member bị từ chối; revoke có hiệu lực; không thưởng nhờ chỉnh đồng hồ hoặc replay |
| 3 — candidate nội bộ | A6 manual/unsigned; A7 diagnostics; A8 dependencies | A6/A7/A8 độc lập nếu file không overlap; lockfile có một writer | Candidate đúng profile; log hữu dụng; dependency triage khép kín |
| 4 — nghiệm thu và mở nhóm nhỏ | A9 hành trình; A10 installed/backend acceptance | Runtime và operations chỉ trên cùng frozen candidate | GO có phạm vi rõ; một lỗi chặn xuất hiện thì quay về owner, không mở lời mời |

Giới hạn hiện tại: coordinator + tối đa 3 worker hoạt động; chỉ dispatch việc READY, ghi reservation đủ schema trước khi dispatch. Mỗi gói là một đơn vị review có thể bị bác bỏ độc lập. A2 có ba slice; A4 có server/client và provisioning; tách PR khi có contract ổn định, không gom tất cả thành một PR khổng lồ. Tên gói là thứ tự trách nhiệm, không phải hứa số ngày hoàn thành.

**Critical path:** A0 → A1/A2/A3 → A4/A5 → A6/A8 → A9/A10. Chuẩn bị target, account và máy sạch chạy sớm để tránh đến cuối mới phát hiện không thể đăng nhập/cài.

## 3. A0 — intake, nguồn bằng chứng và first-proof

**Owner:** coordinator, operator cho phần hạ tầng. **Writes:** task cards/QA evidence; không production ở bước này.

- [ ] Xác minh HEAD/branch/status trong worktree được giao; đối chiếu 14 finding với audit. HEAD mới làm thay đổi caller/contract thì checkpoint và re-audit đúng surface trước sửa.
- [ ] Đọc `docs/architecture/architecture-worker-workflow.md`, roadmap R5–R10 và current QA; điền G0/G1, Q1–Q12 và module S/E/U cho gói liên quan.
- [ ] Chạy `qa:internal prepare`/`preflight` theo schema hiện tại cho production run; binding source hashes, first-proof và authorized repair scope phải đủ. `init → snapshot → validate structure → schedule`; không lặp lại lịch sử schedule trước snapshot từ audit.
- [ ] Giữ 3 QA probe của audit làm nguồn counterexample. Chỉ mang probe vào worktree chịu trách nhiệm sửa nó; khi tích hợp final tất cả phải là regression thật, không `skip`, `it.fails` hoặc sửa expected thành kết quả lỗi.
- [ ] **Proof account trước A4:** trên target thử nghiệm được operator cho phép, cấp đúng một registered identity bằng đường admin hỗ trợ, đăng nhập bằng app hiện tại, xác minh auth UUID/profile. `SupabaseAuthService.accountEmail(loginId)` đang dùng `@accounts.tien-hiep-idle.invalid`; phải chứng minh mapping thực này được chấp nhận. SQL-seed user trong test không phải proof quy trình cấp account. Nếu mapping bị GoTrue từ chối, dừng A4 client và chốt identity mapping thống nhất với operator trước khi nhân rộng.
- [ ] **Proof clock trước A5:** trace owner thật `lease → clock → farm/production/alchemy → snapshot → remote cutoff/checkpoint → reload`. Phân biệt timestamp theo client epoch và duration do server cho phép. Không thay mọi `Date.now()` bằng giờ server khi chưa chứng minh rebase/restore không trả lại phần thưởng.

**Stop/replan:** provision account không đăng nhập được; thiếu project/máy kiểm chứng; thay clock làm save tự reject hoặc offline tail được trả hai lần; source mới thay scope. Hoàn tất các gói độc lập trong khi phần phụ thuộc giữ blocked, không giả lập bằng PASS local.

## 4. A1 — sửa contract tab và khôi phục build

**Finding:** BUILD-01. **Owner:** UI bag state + các consumer. **Roadmap:** R9. **P3:** full vì chạm shared store.

**Files:** `src/stores/ui.ts`; `src/components/panels/BagGrid.vue`; `src/components/scenes/inventory/InventorySurface.vue`; `src/composables/useBagSort.ts`; tests `src/stores/ui.test.ts`, `src/components/panels/InventorySort.test.ts`, `src/composables/useBagSort.test.ts`. Chỉ sửa consumer khác nếu census chứng minh cùng contract.

**Interface:** hiện `BagTab` gồm `decompose`, còn sort map/count map chỉ có bag chứa item. Giữ `setActiveBagTab(tab: BagTab)` cho điều hướng; API sort nhận key thật của `BagSortStateMap`. Decompose là operation surface, không bịa sort state/count bằng 0 để hết lỗi type.

- [ ] Liệt kê mọi `activeBagTab`, `BAG_COUNTS`, sort caller, legacy mount và fallback. Kiểm tra decompose hidden/admitted và trạng thái tab cũ khi đổi panel.
- [ ] Thêm test: material/pill/equipment vẫn sort/reset đúng; persisted/deep-linked decompose không khiến count gọi `undefined`; legacy equipment state về đúng surface theo rule hiện có.
- [ ] Thu hẹp type của sortable tabs; sửa rendering/count theo ownership thực. Không xóa union `decompose` vì nó có consumer production và master/test scope.
- [ ] Chạy test liên quan, `npm run verify`, rồi mở Kho Vật/Trang Bị, đổi tab/sort/đóng mở bằng browser trong worktree.

```text
Oracle:
supported bag tab -> count equals visible entries -> sort/reset changes only that bag
operation tab -> no bag-sort access -> admitted operation or documented fallback
```

**Reject:** chỉ thêm cast/`any`, map giả; bỏ decompose khỏi mọi nơi; tắt type-check; kích hoạt feature ẩn để đi qua test. **Done:** build/full suite thật xanh tại trạng thái này, hoặc failure khác được xác định và đưa vào đúng gói; chưa vì vậy được GO beta.

## 5. A2 — làm test phản ánh bản đang phát hành

**Findings:** GP-02, QA-UI, QA-RELEASE. **Owner:** QA + owner contract tương ứng. Mỗi slice có thể review riêng.

**A2a — scope defaults. Files:** `src/core/betaFeatureFlags.ts`, `src/core/game/__fixtures__/betaFeaturesUnlock.ts`, `tests/setup.betaScope.ts`, `src/core/simulation/earlygame/BetaJourney.test.ts`, các caller thật trong census 64 test files.

- [ ] Giữ một bảng authored defaults không bị test mutate; helper restore phải copy chính bảng đó. Giữ tên public helper nếu không cần đổi interface; không copy một bảng defaults thứ hai trong test.
- [ ] Phân loại caller: kiểm shipped scope dùng mixed defaults; kiểm post-beta machinery opt-in có chủ đích; test negative access nêu rõ flag bị khóa.
- [ ] Pin hành vi: wash/refine admitted; companion/formation/artifact/ore-decompose denied. Thử unlock rồi restore, không dựa vào import order để chụp bảng đã bị global setup mở.
- [ ] Chạy full verification vì default setup/consumer surface rộng; không tuyên bố 64 test đều lỗi chỉ từ việc gọi helper.

**A2b — UI acceptance. Files:** `tests/e2e/beta-journey.spec.ts`, `tests/e2e/save-reload.spec.ts`, `tests/e2e/create-to-combat.spec.ts`, `tests/e2e/helpers.ts`, cùng actual equipment/character surfaces nếu cần testid ổn định.

- [ ] Đổi locator sang role/semantic contract của UI hiện tại. Equipment có 5 tab hiện ở audit; expected phải dựa trên product rule chứ không lấy DOM hiện tại làm đáp án tự xác nhận.
- [ ] Tách entry transition oracle khỏi terminal battle oracle. Quan sát phase/assets/error/READY trong deadline production; không tăng timeout toàn suite để che kẹt runtime.
- [ ] Save test bắt buộc tới assertion cuối: tên/cảnh giới và **12.345** Linh Thạch seed đúng sau reload; seed chỉ chứng minh persistence, không phải pacing.
- [ ] Giữ một test mock/local cho nhanh; thêm luồng registered target ở A10. Không biến test local thành bằng chứng remote.

**A2c — CRLF. File:** `scripts/release/update-feed.test.mjs` và parser dùng chung nếu source thực có. Thêm case LF/CRLF cùng nội dung, giữ kiểm không có token/secret và đúng profile feed.

```js
// Planned line normalization in the actual YAML test parser.
const lines = text.split(/\r?\n/)
```

```powershell
npm run verify
npm run test:release
npx playwright test tests/e2e/beta-journey.spec.ts tests/e2e/save-reload.spec.ts tests/e2e/create-to-combat.spec.ts
```

Các lệnh chạy theo P3 stop-first-failure, không coi output cuối cùng che được failure trước. Browser dùng port thật, worktree riêng, artifact directory riêng mỗi run; phải có lượt normal production deadlines ngoài config contention của suite hiện hữu.

## 6. A3 — giữ credential khi retry và khi đổi phiên

**Findings:** SEC-SAVE-01, SEC-SAVE-02. **Owner:** `src/services/supabase/SupabaseSession.ts`; các async auth consumer. **Interface hiện có:** `resolveSupabaseSession(config): Promise<StoredSupabaseSession | null>`, `storeSupabaseSession(session)`, `clearSupabaseSession()`.

**Files:** owner trên, `src/services/auth/SupabaseAuthService.ts`, `src/services/supabase/SupabaseSession.test.ts`, audit probe `SupabaseSession.betaReadiness.qa.test.ts`. Sibling census: durable restore sau await, authenticate/resume/upgrade, logout finally, inflight single-flight ownership.

- [ ] Reproduce hai assertion đỏ của audit cùng hai control trước sửa.
- [ ] Phân loại lỗi bằng status + mã lỗi được provider xác nhận; 429/5xx/network retain credential. Không dùng quy tắc mọi 4xx đều là token chết; hiện contract cần giữ control token-invalid thật.
- [ ] Mọi continuation có side effect phải gắn với session generation/identity đã bắt đầu operation, gồm catch/finally. Old operation không clear/store/logout thay phiên mới; single-flight không làm B dùng kết quả của A.
- [ ] Phân biệt binding identity với token revision: refresh hợp lệ có thể xoay token nhưng không được tự làm mọi operation cùng phiên trở thành stale. Nếu cần conditional replace/clear/retire-durable primitive, đặt tại session owner và kiểm cả durable lẫn live binding.
- [ ] Test matrix: success/error của A đến trước/sau store B; logout; restore durable; retry; 400 token-invalid/429/503/network; read và durable state đều được assert.
- [ ] Registered-only UI không phải lý do bỏ sửa: owner refresh vẫn dùng chung cho registered account.

```text
expired current session + HTTP 429 -> same recoverable identity retained; zero durable clear
refresh A pending -> store B -> reject A -> B unchanged; zero clear of B
current invalid token -> expected logout/re-auth state; no resurrection
```

```powershell
npm run type-check
npx vitest run src/services/supabase/SupabaseSession.test.ts src/services/supabase/SupabaseSession.betaReadiness.qa.test.ts
```

**Reject:** blanket-retain cả token vô hiệu; blanket-clear; guard chỉ success; logout finally xóa B; testcase chỉ assert return mà không assert live/durable identity. Qua gate gói, sau đó kiểm chứng refresh/relogin thật ở A10.

## 7. A4 — tài khoản cấp sẵn và whitelist server

**Owner:** server auth/session admission; UI chỉ trình bày kết quả. **Readiness:** proof account A0 trước; contract whitelist dưới đây là thiết kế mới, chưa có trong source.

**Existing files:** `src/services/auth/SupabaseAuthService.ts`, `src/services/session/OnlineSessionController.ts`, `src/services/backend/backendBundle.ts`, `src/components/scenes/login/**`, `src/App.vue`, `src/services/master/masterAccess.ts`; SQL hiện có `supabase/migrations/202609300001_beta_authority_prepare.sql`, `202610070001_deleted_character_predicates.sql`, feedback/finalize/creation migrations. **Create:** migration mới `supabase/migrations/202610110001_beta_membership_admission.sql`, contract tests `tests/integration/supabase/beta-membership.spec.ts`, operator runbook `docs/operations/beta/membership.md`. Nếu version đã được dùng khi thực thi, chọn migration ID kế tiếp, không sửa migration đã deploy.

**Proposed server contract:** một membership record theo auth user UUID; trạng thái active/revoked, cohort hiện tại và audit metadata. Client không được tự insert/update/read danh sách membership. Quyền chơi derive từ registered auth identity + active membership + current cohort + existing session/protocol/version rules. Registered verdict lấy từ Auth state phía server; không tin riêng `profiles.account_kind` vì trigger hiện nhận giá trị này từ user metadata. Login ID hoặc raw user metadata không được tự cấp quyền, kể cả chuỗi `admin`.

```text
claim / heartbeat / load / write / create / reset / talent-roll / feedback
 -> validate caller auth
 -> acquire existing profile lock
 -> authoritative registered membership check
 -> existing session/protocol/domain guards
 -> original operation

operator revoke
 -> same lock order
 -> mark membership revoked + revoke active session atomically
```

- [ ] Liệt kê mọi callable RPC/overload, shared guard, direct RLS/GRANT; chọn một admission helper dưới profile lock và migrate các consumer thật. Claim chưa có session nên không gọi vòng qua session guard.
- [ ] Giữ caller-owned logout/revoke cleanup khả dụng khi membership đã bị thu hồi. Admission guard chặn gameplay, không vô tình chặn chính thao tác giải phóng phiên; test riêng nhánh này.
- [ ] Cấp account bằng đường admin được provider hỗ trợ, xác nhận registered identity và profile, thêm membership UUID. Không tạo production account bằng cách tự insert `auth.users` như fixture; không để service-role key trong installer.
- [ ] Operator enrollment có retry/idempotency: tạo xong account nhưng lỗi membership vẫn **không chơi được**; retry tìm đúng identity đã tạo, không cấp hai account. Không log mật khẩu, không commit danh sách credential.
- [ ] UI chỉ login account đã cấp; service boundary reject guest/self-register/upgrade cho profile beta, không chỉ ẩn nút. Operator tắt public/anonymous signup ở target nếu phù hợp; server membership vẫn bắt buộc dù provider setting drift.
- [ ] Map lỗi chưa được mời/bị thu hồi/cohort cũ thành thông báo Việt qua i18n; không fallback local; lost admission phải pause mutation. Server reject ngay sau revoke commit; client pause khi nhận rejection hoặc hết lease, không hứa thu hồi tức thời trước gói mạng.
- [ ] Định nghĩa denial admission riêng trong auth/backend/cloud-save/session contracts: dừng chơi, không retry vô hạn và không nhầm với credential-invalid để xóa sai credential. Re-enable phải claim phiên mới và authoritative load lại; dirty state từ trước revoke không được upload sang phiên mới.
- [ ] Candidate nội bộ không mở quyền dev chỉ vì tên `admin`; kiểm master gate và các debug/layout tooling trong packaged build. Tool phát triển giữ ở dev profile, không biến login ID thành server role.
- [ ] Runbook: cấp mới, đổi/reset mật khẩu thủ công, revoke/reinstate, mất credential, thay cohort, reset có phê duyệt. Reset mật khẩu giữ cùng Auth UUID/character, revoke game sessions và Auth sessions qua đường admin đã chứng minh; không tạo lại user như một cách reset. Script `scripts/operations/revoke-sessions.mjs` hiện chỉ thu hồi game sessions, không thay thế membership revoke. Chứng minh trên account thử nghiệm, không gửi credential qua log/báo cáo.

**Test bắt buộc:** guest; registered non-member; active member; revoked; stale cohort; forged metadata; duplicate provisioning; grant/revoke concurrent save/heartbeat; two devices; tài khoản khác không đọc/ghi/reset được character; client cũ/bypass UI vẫn bị server từ chối. Contract harness cần cập nhật seed memberships cho các test hợp lệ, giữ denied controls thật.

**Execution safety:** `npm run test:supabase` hiện apply migrations, seed user và có scratch-reset; chỉ chạy trên target disposable/staging được operator cho phép, tuyệt đối không chạy mặc định lên beta đang có tester. Đọc chỉ mục migration/status trước, tách kế hoạch deploy khỏi thao tác test.

**Done:** membership guard được bao phủ tất cả đường server đã census, actual account cấp qua operator login thành công và non-member bị chặn cả RPC trực tiếp. Không có quyền deploy suy ra từ plan.

## 8. A5 — thời gian online và offline cùng contract

**Finding:** GP-01. **Readiness:** DISCOVERY_REQUIRED ở A0; đây là gói rủi ro lớn nhất, không xử lý bằng một phép đổi `!==` sang `>`.

**Files/owners:** `src/core/idle/GameClock.ts`, `src/core/reward/SkillInsightBalance.ts`, `src/core/game/BattleLootSystem.ts`, `src/core/game/GameManagerAutoFarmOps.ts`, `src/core/game/GameManagerTickOps.ts`, `src/core/game/GameManagerTurnBattleOps.ts`, `src/core/game/GameManagerSaveRestore.ts`, `src/core/game/GameManagerAlchemyOps.ts`, `src/core/game/GameManagerBuildingOps.ts`, `src/core/production/ProductionOffline.ts`, `src/stores/player.ts`, `src/services/save/saveTypes.ts`, `src/services/cloudSave/SupabaseCloudSaveService.ts`, `src/composables/useAppLifecycle.ts`, `src/services/session/OnlineSessionController.ts`, `src/App.vue`; census timestamp owners trước khi chốt diff. Reuse remote checkpoint/cutoff, không tạo authority song song.

**Target semantics:** online elapsed từ nguồn monotonic; UTC/day accounting từ anchor server hợp lệ + elapsed monotonic; reconnect/restore dùng đúng authorized offline window một lần. Wall clock máy không tự cấp elapsed/day rollover. CombatClock và presentation pacing giữ trách nhiệm hiện hữu.

- [ ] Census và phân loại timestamp: elapsed online, UTC bucket, persisted epoch/job deadline, offline cutoff, UI-only timestamp. Lưu mapping writer/read/reset/persist để không thay hàng loạt `Date.now` gây lệch epoch.
- [ ] Trace production/alchemy skew rebasing trong `GameManagerSaveRestore.ts` và `ProductionOffline.ts`; giữ live replacement không accrual, threshold offline, cap 24h và auto-farm efficiency 0.5 hiện có.
- [ ] Reuse/inject nguồn thời gian tại owner, truyền context xuống reward/tick; mỗi consumer phải dùng cùng interval được cấp. Không thêm một clock riêng trong từng system.
- [ ] Giữ invariant quota khi ngày lùi; forward ngày hợp lệ theo UTC authority reset đúng một lần. Offline window cắt qua ngày phải phân bổ theo contract được chứng minh, không mint toàn window vào ngày mới rồi replay.
- [ ] Test `+24h wall/+1s mono`, wall rollback, normal tick, midnight, sleep/resume, expired lease, reconnect, repeat load, lost ACK, clock-skew save/restore. Assert currencies/materials/insight, checkpoint và receipts; không chỉ delta.

```text
healthy lease, exhausted quota, wall +24h, monotonic +1s
 -> no 1440-insight grant from fabricated day
offline window granted by server -> settle once -> durable cutoff advances
repeat load / replacement / lost ACK retry -> same settled balance, no second payout
```

**Tests:** audit `src/core/game/GameManager.betaReadinessClock.qa.test.ts`; `src/core/reward/SkillInsightBalance.test.ts`; `src/core/game/GameManager.autoFarmOffline.test.ts`, `GameManager.autoFarmAdversarial.test.ts`, `GameManagerSaveRestore.onceOnlySettle.test.ts`; current lifecycle/session/production/alchemy suites found by census. Full `npm run verify`, current Supabase cutoff contracts và browser/installed suspend/reconnect proof đều cần.

**Reject:** sửa quota mechanism nhưng AutoFarm/TickOps vẫn tự đọc wall time; mất real offline progress; thay epoch làm payload bị reject; receipt/cutoff chưa durable đã cho tick; tuyên bố chống cheat hoàn chỉnh từ clock fix.

## 9. A6 — bản cài nội bộ unsigned, cập nhật thủ công

**Findings:** REL-01, REL-02, REL-03, REL-04 theo phạm vi mới. **Owner:** release policy + Electron main; renderer là projection.

**Files:** `electron/main.ts`; `src/shared/update/UpdateState.ts`; `src/main-process/UpdateService.ts`, `electronUpdater.ts`, `updateFeed.ts`; `src/components/panels/SettingsPanel.vue`; `src/App.vue`; `electron-builder.yml`; `scripts/release/{signing-preflight,manifest,inspect-package,publish-candidate}.mjs`; repo-root `.github/workflows/beta-checks.yml`, `.github/workflows/beta-release.yml`; `docs/operations/beta/{release,windows-install,compatibility-and-rollback}.md`. New internal profile/workflow chỉ tạo nếu không thể diễn đạt rõ trong composition hiện tại.

**Proposed policy:** một nguồn build/runtime policy phân biệt `internal-unsigned-manual` và signed release. Policy không phải cờ client để vượt server whitelist/protocol; server vẫn quản lý allowed build/version.

- [ ] Profile nội bộ không bind/import provider tự update lúc boot; không gọi check/download/install và từ chối direct install IPC. UI thông báo “cập nhật bằng bản cài do người quản lý cung cấp”, có build/version/report info. Forced-update gate chỉ dẫn thay installer, không nút Check không hoạt động.
- [ ] Pipeline nội bộ produce installer + manifest/hash + build identity và inspect package. Không chạy public publish tự động; không embed repo token; operator chuyển đúng bytes qua kênh đã chọn.
- [ ] **Giữ nguyên fail-closed signing preflight của signed-release lane.** Thiếu certificate làm signed lane fail; internal lane ghi trung thực unsigned. Hash giúp kiểm đúng file nhận từ kênh tin cậy, không thay chữ ký publisher.
- [ ] Docs Windows nêu rõ warning có thể xuất hiện; không yêu cầu tắt Defender/SmartScreen hay làm suy yếu máy tester. Nếu policy máy chặn unsigned, dừng cấp máy đó hoặc chuyển sang signed path riêng.
- [ ] Replace installer N→N+1 cùng cohort phải re-login/restore đúng nhân vật; reset cohort là thao tác khác có thông báo, không dùng cài lại để xóa tiến độ ngầm. Rollback incompatible dùng version admission/roll-forward theo contract, không ép downgrade bỏ schema check.
- [ ] REL-01 signer/feed và REL-04 auto-update continuity không được ghi CLOSED vì “để sau”: record scope decision của người dùng, chứng minh auto-update unreachable trong internal profile; giữ debt/acceptance signed lane ở backlog. Sửa oracle rỗng trong `tests/electron/beta-update.spec.ts` hoặc thu hẹp tên/claim của test đúng với bằng chứng thật; không giữ false PASS về continuity dù auto-update đã hoãn. Mọi continuity gate phải dùng nonempty/domain state.

```text
internal profile + missing certificate -> explicit unsigned artifact, correct manifest, no update provider
signed profile + missing certificate -> build admission fails
manual profile + renderer-forged install IPC -> reject, no updater call
manual N->N+1 + unchanged cohort -> exact remote character restore and gameplay action
```

**Tests:** release-script tests LF/CRLF và profile matrix; `UpdateService.test.ts`, `updateFeed.test.ts`, `src/shared/update/UpdateState.test.ts`; create `tests/electron/beta-manual-distribution.spec.ts` cho no-provider/no-install/manual replacement. `npm run verify`, `npm run test:release`, `npm run dist:win`, `npm run inspect:package` theo profile mới; lệnh profile cụ thể phải được package/workflow định nghĩa trong diff trước khi chạy, không dùng env ngầm làm chứng nhận.

## 10. A7 — diagnostics có giới hạn byte thật

**Finding:** REL-05. **Files:** `src/main-process/DiagnosticBundle.ts`, `DiagnosticBundle.test.ts`; `src/shared/diagnostics/DiagnosticEvent.ts` đọc contract. **Owner:** DiagnosticBundle.

- [ ] Viết case record tiếng Việt khi remaining bytes nằm giữa UTF-16 length và UTF-8 byte length; mock filesystem phải trả byte size thật.
- [ ] Reuse `byteLength()` hiện có để quyết định rotate; kiểm record quá lớn và max files/export giữ bounds.
- [ ] Assert rotation/export/redaction và permission-denied không crash game; đóng Low này thay vì để biến mất trong báo cáo.

```text
ASCII / Vietnamese / surrogate pair -> file size measured in bytes
append crosses byte cap -> rotate before append; bounded files and export
```

Quick P3 với `src/main-process/DiagnosticBundle.test.ts` và shared diagnostic tests; installed export/feedback ở A10. Không xây remote crash dashboard cho đợt này.

## 11. A8 — dependency triage và nâng có chủ đích

**Finding:** DEP-01. **Files:** `package.json`, `package-lock.json`, Vue overrides/build config nếu thay đổi yêu cầu. **Owner:** dependency/build maintainer; một writer lockfile.

- [ ] Chạy lại production dependency audit lúc triển khai; ghim advisory/version đã đọc từ nguồn chính thức, ghi đường dependency và consumer. Audit cũ có 3 High package entries từ 2 advisory, chưa chứng minh exploit trong SPA.
- [ ] Với Vue, chọn exact prerelease đã vá phù hợp line 3.6 và đồng bộ toàn family/vapor overrides. Không dùng dist-tag hoặc `npm audit fix --force` để đổi major không kiểm soát.
- [ ] Với source-map-js, xác định resolved owner/patch tương thích; ghi runtime/build-only reachability. Nếu chưa nâng an toàn, chỉ human exception cụ thể mới thay cho closure; “không thấy import” một mình không đủ.
- [ ] `npm ci`, full verify, build/package, UI/combat/lifecycle checks bị ảnh hưởng. Không nâng Phaser/Electron/Pinia hàng loạt trong cùng diff nếu không phải cần thiết của fix.

**Done:** advisory đã được xử lý hoặc có exception nêu rõ lý do/phạm vi/điều kiện xem lại; không tuyên bố zero-vulnerability từ số audit thuần túy.

## 12. A9 — chơi được và đo pacing đúng nghĩa

**Finding:** RUN-01; phần còn lại QA-UI. **Owner:** QA/gameplay/presentation, mỗi bug được trả về đúng production owner, không sửa production trong QA pass.

**Files:** `tests/e2e/{boot-fresh,create-to-combat,save-reload,beta-journey,presentation-routing,feedback-intake}.spec.ts`, helpers, current realm/tribulation specs; `src/core/simulation/earlygame/{MortalChapterJourney,TrucCoJourney,StatWall,BetaJourney}.test.ts`; acceptance evidence dưới `docs/qa/`.

- [ ] Browser mock suite đúng source và normal production timing: create → home → start → thấy nhân vật/enemy/action/HP thay đổi → kết quả → home/retry. Top bar hoặc nền scene không đủ.
- [ ] Quest/craft/production/equip/enhance/wash/refine: failure atomic, cost/reward đúng, duplicate click/retry không nhân thưởng; save/reload ở ranh giới action.
- [ ] Một organic journey đủ 30 tầng với log thời gian, seed, nguồn/sink, deaths/retries và ending; không bơm HP/gear/insight để gọi là organic. Mô phỏng accelerated domain time được ghi rõ, không phải bằng chứng thời lượng chơi thực; song song dùng telemetry phiên tester để đánh giá pacing.
- [ ] Test edge case có seed/state injection giữ riêng khỏi organic acceptance. Không chờ người chơi thật một tuần chỉ để đóng plumbing; cũng không dùng simulation green để khẳng định thời lượng retention.
- [ ] Chụp/đọc ảnh các màn chính tại kích thước Windows được tuyên bố hỗ trợ; kiểm focus/tab/input blocking, audio mute/volume cơ bản, đổi scene/reconnect/reload, resource cleanup/soak theo lifecycle liên quan.

**Stop:** test green chỉ do locator xuất hiện; combat không tiến; timeout không phân loại; render thay gameplay outcome; organic đạt nhờ fixture cheat; chưa biết root của mất state. Giữ trace/screenshot gốc, rerun có mục đích, quay về gói sửa và invalidation QA.

## 13. A10 — nghiệm thu candidate thật và vận hành đợt beta

**Owner:** coordinator + operator + người giữ máy sạch. **Prerequisites:** A1–A9 gates liên quan hoàn tất; target đã được cho phép; candidate frozen với commit/hash/build/profile.

| Tình huống | Điều kiện đạt | Bằng chứng cần giữ |
|---|---|---|
| Cài mới Windows | Tải đúng hash, cài per-user, launch; nhãn unsigned đúng | Installer hash, manifest, máy/OS, ảnh warning/publisher thực tế |
| Account/whitelist | Account cấp thật login; guest/non-member/forged metadata không chơi được | Account UUID giả danh trong báo cáo, kết quả RPC/UI, không credential |
| Session concurrency | Máy B thay phiên A; A không ghi đè; revoke chặn API và client pause trong lease contract | Server receipt/revision/session evidence + video/trace |
| Lưu và mất mạng | Action→durable save→close/reopen đúng; disconnect/retry/lost ACK không mất/nhân thưởng | Before/after domain state, revision/cutoff, logs |
| Thời gian | Clock jump không mint online; offline thật đúng cap/efficiency, load lặp không trả lại | Clock matrix và balance/cutoff receipts |
| Manual update | N→N+1 cùng cohort restore chính xác, chơi tiếp; không gọi updater | Hash hai candidate, state nonempty trước/sau, hoạt động sau cài |
| Feedback/support | Tester gửi hoặc export report có build identity; operator đọc được, dữ liệu nhạy cảm được lọc | Report ID/export đã redaction và xác nhận tiếp nhận thử |
| Dừng bản lỗi | Chặn build/revoke theo policy; session đang chạy mất quyền; có đường quay lại bản sửa | Diễn tập trước/sau, log rejection, hướng dẫn liên hệ |
| Reset được thông báo | Operator thực hiện đúng cohort được duyệt; account/membership không bị xóa ngoài ý định | Dry-run inventory, scope xác nhận, kết quả reset và thông báo riêng |

**Triển khai lời mời:** đầu tiên pilot vận hành với account thử của operator và người hỗ trợ; đạt toàn bộ bảng mới mở danh sách tester đã cấp. Không ấn định số người hoặc ngày mở khi chưa có target và candidate xanh.

**Dừng cohort ngay:** mất/corrupt tiến độ ngoài reset được thông báo; vượt whitelist/đọc ghi chéo user; duplicate economy ngoài hạn chế đã chấp nhận; crash/không chơi được không có cách hồi phục; operator không thể thu hồi quyền/dừng bản lỗi. Bảo trì đơn thuần không được mô tả là kill switch tức thời.

## 14. Gate chung cho mỗi gói và final aggregate

Gói production: G0/G1 + prepare/preflight → repro đúng owner/production chain → sửa trách nhiệm + sibling census → simplify → P3 phù hợp → OCR delegation trên task diff (new files đọc đầy đủ) → P13/P14 khi liên quan → deep adversarial → các lượt review tuần tự trên resulting state. Sửa từ vòng sau làm evidence liên quan stale; quay về verification/OCR tương ứng.

- Full P3 bắt buộc khi chạm root store, test/build config, package/lock, clock/lifecycle/architecture hoặc final milestone. Quick chỉ dùng nơi đúng điều kiện.
- Full aggregate cuối dùng `npm run verify`, browser required suite, release/operations tests, designated Supabase/Electron/runtime proof và assets/simulation gates được task manifest yêu cầu. Một suite không tới vì failure trước phải ghi NOT RUN.
- Closure của High, Clean A, Clean B và terminal check cần fresh independent contexts theo protocol; P5 coordinator reasoning không giả là independence.
- Findings actionable kể cả Low phải CLOSED hoặc HUMAN_EXCEPTION cụ thể trước unqualified fixed point. Việc user chọn manual/unsigned/registered-only thay acceptance scope của các tính năng bị loại; không tự miễn defect còn reachable trong scope.
- Mỗi gói trả worktree/branch/SHA, file→owner mapping, Q1–Q12 + module, repro/control, sibling dispositions, command/exit/log/ảnh, missing evidence. Coordinator đọc aggregate diff và code, không nối các câu “done” để nghiệm thu.
- Chỉ QA protocol cho phép trạng thái fixed point. Commit/merge/push/deploy/phát installer vẫn cần user authorization riêng, kể cả mọi gate xanh.

## 15. Mapping toàn bộ audit và việc để sau

| Finding | Gói giải quyết | Điều kiện không được quên |
|---|---|---|
| BUILD-01 | A1 | Build thật, không cast/fake map |
| SEC-SAVE-01 | A3 + A10 | Transient refresh failure giữ credential recoverable |
| SEC-SAVE-02 | A3 + A10 | Response cũ không clear/replace live và durable binding mới |
| GP-01 | A0/A5 + A10 | Online, offline, epoch/rebase, replay cùng một proof chain |
| GP-02 | A2a | Shipped mixed flags, giữ opt-in post-beta tests |
| QA-UI | A2b + A9 | Assertion cuối và domain result |
| QA-RELEASE | A2c/A6 | CRLF và profile contract cùng đúng |
| RUN-01 | A9/A10 | Không suy full battle từ topbar/frame chuyển cảnh |
| REL-01 | A6 | Không reachable trong manual profile; signed pin/feed vẫn là debt có tên |
| REL-02 | A6/A10 | Tester tải đúng candidate qua đường phân phối thật |
| REL-03 | A6/A10 | Candidate hiện tại qua nghiệm thu Windows sạch |
| REL-04 | A6/A10 | Nonempty save/domain oracle cho manual replacement; auto-update claim không được dùng |
| REL-05 | A7 | Unicode bytes, không defer mất dấu |
| DEP-01 | A8 | Reachability + intentional upgrade hoặc exception thật |
| Scope mới từ user | A4/A6 | Server whitelist; provisioned-only; unsigned/manual có enforcement và docs |

**Để sau đợt này:** self-service signup/invite redemption, guest/upgrade, tự cập nhật có chữ ký/feed, server-authoritative combat/economy, bảng xếp hạng/giao dịch/nạp tiền nếu muốn bổ sung, remote crash dashboard, thêm OS, tính năng hậu beta đang đóng, hoàn thiện toàn bộ music/ambient/art. Nếu bổ sung cạnh tranh hoặc giao dịch có giá trị, mở lại threat model; bảo vệ save cấu trúc hiện tại không đủ cho scope đó.

Pack sound ở worktree `ui-sound-pack` có thể tích hợp bằng gói riêng sau khi runtime ổn. Việc tạo/listen file trước đây không phải proof sound đã chạy trong game; tích hợp phải có actual cue mapping, mute/volume, chống spam và audition trên scene thật.

## 16. Tình trạng bàn giao kế hoạch

Phạm vi sản phẩm đã được người dùng chốt qua 6 câu hỏi; không cần hỏi lại khi bắt đầu những bước tương ứng. A1/A2/A3/A7 có counterexample và owner rõ. A4 phụ thuộc first-proof provisioning/target; A5 phụ thuộc clock/epoch trace; A6 phụ thuộc thiết lập profile nội bộ; A10 phụ thuộc candidate và máy sạch. Kế hoạch không hứa các phần discovery đã implementation-ready.

Đây là Markdown/planning trong worktree hiện có; không đổi production, dependency hoặc hạ tầng. Kiểm tra lượt này chỉ gồm source/reference consistency, audit coverage và plan review; không chạy lại test game không đổi để tạo cảm giác mới có bằng chứng. Mọi command/test trong A0–A10 là PLANNED cho lượt được giao triển khai.
