# Whole-project engineering audit — 2026-09-14

## A. Audit Baseline

**Kết luận: REPAIR BEFORE MAJOR FEATURES.** Dự án có các primitive và owner hữu ích, nhưng một số đường sử dụng thực tế chưa tuân thủ hợp đồng của chúng. Đã tái hiện lỗi save/restore, kết quả độ kiếp, sản xuất offline, combat stats và UI điều khiển. Không cần viết lại toàn bộ dự án; cần sửa các trách nhiệm được xác định trong mục M trước khi mở rộng hệ thống lớn.

Đây là **audit**, không phải triển khai. Không sửa production, test, dependency, cấu hình hoặc gameplay data; không commit/merge/push. Những kiểm thử thất bại được ghi nhận, không sửa trong nhiệm vụ này.

| Baseline | Giá trị |
|---|---|
| Repository | `E:/tutienidle`, application root `game/` |
| Checkout gốc | `master` |
| HEAD được audit | `f2846064a4b15d4d20a94540855b6194b77eb21c` |
| Dirty state có trước audit | `game/package.json`: scripts và devDependencies đã bị loại khỏi working copy; giữ nguyên, không coi đây là nội dung HEAD |
| Worktree audit | `E:/tutienidle/.agent-worktrees/full-project-audit-2026-09-14` |
| Branch audit | `codex/full-project-audit-2026-09-14` |
| Runtime / package manager | Windows PowerShell; Node `24.19.0`; npm `11.17.0`; npm lockfile |
| Thư viện thực tế cài đặt | Vue `3.6.0-rc.3`, Pinia `4.0.2`, Phaser `4.2.1`, TypeScript `6.0.3`, Vite `8.2.2`, Vitest `4.1.10`, Playwright `1.62.1`, Electron `43.4.1`, vue-router `5.2.0`, vue-i18n `11.4.10`, Tone `15.1.22` |
| Điểm vào | `src/main.ts`, `src/App.vue`; `electron/main.ts`, `electron/preload.ts`; `index.html`; Vite/Electron build configuration |
| Cách chuẩn bị | Worktree tách từ HEAD. Copy dependency tree hiện có vào worktree rồi kiểm tra `npm ls`; không chạy clean install hoặc thay lockfile |

Đã đọc các quy tắc hiện hành: AGENTS, AstraDoctrine, architecture-worker-workflow, roadmap và các QA/spec liên quan đến combat, coordinator, stat conversion, R9/R10/R12 và beta. Thực hiện G0/G1 theo phạm vi read-only; G2/G3 implementation không áp dụng. Ba reviewer độc lập kiểm tra combat, economy/progression, lifecycle/persistence; coordinator kiểm tra map toàn repo, events/types/dependencies, static checks, browser và tổng hợp. Tài liệu lịch sử chỉ dùng tìm chủ đề cần xác minh, không dùng làm bằng chứng rằng kiến trúc đã triển khai đúng.

Các lệnh chính, chạy từ `worktree/game`:

```powershell
npm.cmd run type-check
npm.cmd run build
node scripts/check-bundle-split.mjs --dist dist
npx.cmd --no-install vitest run --reporter=default --reporter=json --outputFile.json=docs/qa/audit-vitest.json
npm.cmd run lint -- --format json --output-file docs/qa/audit-eslint.json
npm.cmd ls --depth=0 --json
npm.cmd run dev -- --host localhost --port 5984
# Actual printed URL: http://localhost:5984/
$env:DEV_PORT='5984'
$env:PLAYWRIGHT_JSON_OUTPUT_NAME='docs/qa/audit-playwright.json'
npx.cmd --no-install playwright test --workers=1 --reporter=list,json --output docs/qa/audit-playwright-artifacts
```

Đã chạy thêm diagnostic in-memory trên production modules, AST import/event/type scan, `rg` consumer/mutation searches, Git history và phiên Edge riêng qua UI thật. Không đọc secrets hoặc truy cập tài khoản/backend thật. Diagnostic script tạm được loại khỏi handoff; output và ảnh kiểm chứng giữ có chủ đích trong `docs/qa/`.

Bằng chứng kèm báo cáo:

- [Task card và phân công](2026-09-14-full-project-audit-task-card.md).
- [Combat: nguồn, output và reproduction](2026-09-14-audit-combat-review.md).
- [Economy/progression: nguồn và diagnostic bodies](2026-09-14-audit-economy-review.md).
- [Lifecycle/persistence: nguồn và diagnostic bodies](2026-09-14-audit-lifecycle-review.md).
- [Vitest JSON](audit-vitest.json), [ESLint JSON](audit-eslint.json), [dependency tree](audit-dependencies.json), [AST inventory](audit-inventory.json), [Playwright JSON](audit-playwright.json).
- [Exact Edge diagnostic and evidence notes](2026-09-14-audit-runtime-evidence.md), [Edge runtime evidence](audit-edge-evidence.json), [Home screenshot](audit-edge-home.png), [combat screenshot](audit-edge-combat.png).

**Phạm vi chứng minh:** inventory toàn repository và trace sâu các trách nhiệm quan trọng; không có nghĩa mọi tổ hợp content, mọi save lịch sử, mọi thiết bị và backend triển khai đã được chạy. Evidence type được ghi ở từng finding: EXECUTED / SOURCE / INFERRED / SPEC DRIFT. SOURCE không tự biến thành lỗi đã nhìn thấy trên UI. Không xác lập P0 trong audit này.

## B. Repository Architecture Map

Inventory có 3.571 tracked files; scan chọn 615 module TS/Vue/JS không mang tên test/spec, gồm một số fixture; 559 file test/spec. Trong đó 545 file Vitest, 14 file E2E chứa 19 ca. Scan static imports và literal dynamic imports không tìm thấy runtime cycle trong graph được phân tích; kết quả này không chứng minh graph runtime/reflection tuyệt đối không có cycle.

| Lớp / hệ thống | Owner và hướng phụ thuộc thực tế | Nhận xét |
|---|---|---|
| Bootstrap | `main.ts -> App.vue -> useAppLifecycle`; App tạo GameClock, GameManager, coordinator/adapters, đăng ký catalogs và provide bridges | Composition root hoạt động; App vẫn chứa một phần stat assembly, starter grants và lifecycle orchestration |
| Entry/auth/character | Vue entry screens -> auth/character services -> mock hoặc Supabase adapter | Không có Phaser AuthScene. Cloud save là capability khác, không suy ra từ đăng nhập |
| Vue application | 124 component modules, 30 composables; Pinia stores cho player, ui, auth, audio, notification/action feedback và các overlay | UI gọi command/query của GameManager ở phần lớn đường chính; version bridge có consumer sai |
| Primary presentation | `createGamePresentation -> GamePresentationCoordinator -> VueRouteAdapter / PhaserSceneAdapter / AssetBundleManager` | Đã có central route owner. Vue Router được cài nhưng `routes: []`; không điều hướng gameplay |
| Phaser host/scenes | `PhaserCanvas -> useDynamicRegion -> Phaser.Game`; adapter kích hoạt Home/Combat/Tribulation | Preview trận pháp có host riêng, không phải primary route thứ hai |
| Game orchestration | GameManager và khoảng 30 module `core/game`, các `*Ops`, StageWaveSystem, BattleLootSystem | Split file đã có; không thể kết luận “god object” chỉ bằng kích thước. Cần kiểm tra quyền ghi và lifecycle qua từng Ops |
| Clock | GameClock cho world/idle; CombatClock cho fixed-step combat; RafClockSource hoặc Electron main-process source cấp thời gian | Tách clock gameplay khỏi animation là nền tảng đúng; cleanup và turn phase còn lỗ hổng |
| Combat authority | `GameManagerTurnBattleOps -> TurnBattleSystem -> TurnSkillAction / CombatSystem / BuffSystem / TurnReactionManager` | Turn engine là engine sống. Legacy Battle cast và một số event listener vẫn tồn tại |
| Damage/vitals | Damage/stat resolver -> CombatSystem -> EntityVitalsSystem -> damage/death/vitals events | Primitive đã tồn tại; charged/DoT/liveness và MP/Ward consumption chưa hoàn chỉnh |
| Skills/effects | Authored SKILLS, path/node/companion kit -> SkillSystem / convertSkillToTurn -> turn actions | Adapter và production selection có thể bỏ scaling/duration; không đủ chứng minh bằng adapter unit tests |
| Stats | Player raw/base + attribute/realm/equipment/technique/path/node/passive modifiers -> StatCalculator -> resolved stats -> effective battle stats | Công thức canonical tương đối rõ. Assembly/refresh ở menu và battle chưa cùng outcome contract |
| Equipment/inventory | EquipmentBag + EquipmentSlotManager; EquipmentOpsSystem -> EquipmentSystem -> rolling/enhance/wash/refine/dissolve | Refine đã có identity/membership guard tốt; wash chưa dùng cùng mức bảo đảm |
| Resource economy | MaterialBag, PillBag; RewardSystem, VendorSystem, BattleLootSystem và domain operations qua bag APIs | Có finite/capacity checks, delivery receipts. Một số notification consumers bỏ receipt |
| World progression | CultivationSystem, RealmPassiveSystem, BodyRefinementSystem, NodeSystem, SkillSystem, ArtifactProgression | Quy tắc phần lớn ở domain; major realm cần Tribulation/Breakthrough outcome services |
| Production/crafting | BuildingManager/System; ProductionSystem + ProductionOffline + WorkerAllocator; AlchemySystem; DecomposeSystem | Worker allocation/formula có phần dùng chung, settlement clocks chưa tương đương |
| Stage/enemy | StageRegistry/StageManager/StageSystem/StageWaveSystem -> EnemyRegistry/factory -> turn participants | Real content đăng ký tại composition root. Perfect-clear feasibility chưa đạt full suite |
| Quest/companion | QuestOps -> QuestSystem; lifecycle tick/restore reconcile. CompanionOps -> gacha/progression/combat kit | Quest query hiện đã thuần đọc; companion roster hiện đã có content. Không áp lại kết luận roadmap cũ |
| Persistence | SaveSystem -> LocalCloudSaveService/CloudSaveCoordinator; player.restore + GameManagerSaveRestore -> domain managers | Schema tồn tại nhưng full-value identity/detachment/replacement chưa được thực thi xuyên suốt |
| Events/notifications/audio | EventBus; domain notification queue -> Vue rendering; combatAudioBinding -> AudioManager | Event tên string không ràng buộc payload. Audio binding chỉ quan sát, nhưng terminal producer thiếu nhánh |
| Assets/i18n/UI primitives | CombatPresentationCatalogue, asset manifests, AssetBundleManager; i18n gateway và common UI primitives | Catalog/guards là nền tảng tốt. Fallback scene preload và nội dung UI chưa đủ runtime parity |
| Tooling/distribution | Vite, Vitest, architecture guards, Playwright, asset/bundle scripts, Electron preload/main, Supabase migration | Build web đạt. Packaged Electron, backend schema thật, clean-install reproducibility chưa chạy |

Hướng mong muốn `foundation -> domain mechanisms -> systems -> orchestration -> presentation` phần lớn có dấu vết thật. Core combat không cần Phaser để chạy các diagnostic này. Những boundary bị vi phạm chủ yếu là **consumer không được migrate cùng owner**, **state/version/session không đi hết chuỗi**, và **outcome thiếu lifecycle hoàn chỉnh**.

## C. Runtime Flow Map

### Startup và route

```text
main.ts
 -> Vue + Pinia + i18n + router + App
 -> intro / auth service / character service
 -> useAppLifecycle.bootGame
 -> load + validate save / create character
 -> player.restore + GameManagerSaveRestore + catalog owners
 -> start world tick / combat clock source / persistence lifecycle
 -> presentation coordinator request(home)
 -> destination bundles -> PhaserSceneAdapter -> MainScene READY
 -> Vue route commit / curtain reopen / release session hold
```

Guest character creation, Home, basic save/reload và corrupted-save recovery đã chạy trong browser. Auth thật/Supabase không chạy. Boot continuation sau teardown được tái hiện riêng ở ARCH-013.

```text
StageSelectPanel
 -> runAdmitted(combat)
 -> stage command / StageWaveSystem / turnBattleOps.startBattle
 -> session + participants + skill kit + initial snapshot
 -> coordinator resources / renderer activation / READY / route commit / release hold
 -> countdown -> fighting
 -> terminal result UI -> home / explicit refight / continuous repeat
```

Admission có một coordinator, nhưng kết quả command mang session bị loại rồi coordinator đoán lại session (ARCH-004). Refight mới và continuous repeat là hai lifecycle khác nhau; không gom thành một reset chung khi sửa.

### Combat từ input đến outcome

```text
Stage/enemy catalogs -> enemy factory / wave participants
 -> playerToCombatEntity(resolved player stats) + formation + companion kit
 -> action gauge / scheduler -> manual choice hoặc AI targeting
 -> TurnSkillAction (cooldown, MP cost, charge, target selection)
 -> runtime presentation phases (ready/cast/impact/standby, identity/ACK)
 -> CombatSystem damage resolver -> EntityVitalsSystem
 -> hit/critical/dodge/block/damage/death/vitals notifications
 -> buff/DoT/reaction processing -> effective-stat recompute
 -> BattleLootSystem per-kill delivery
 -> GameManagerBattleRewardOps terminal/stage/perfect-clear
 -> result / next wave / repeat / teardown
```

Phaser projectiles/VFX là presentation; kết quả chiến đấu được resolve ở domain. Cần phân biệt READY của scene với ACK action. Những đường damage ngoài direct skill hit cũng phải giữ cùng outcome: DoT, reaction secondary damage, reflect/thorns, enemy attack, tribulation lightning và heal-on-kill. Trace cho thấy chúng dùng các owner combat/vitals, nhưng có lỗi **thứ tự phase và liveness** (ARCH-010), không phải chỉ thiếu một damage helper. Không xác lập lỗi “Phaser đang trực tiếp quyết định HP combat” ở đường chính đã kiểm tra.

### Stats, progression và equipment

```text
raw PlayerData / attribute points
 + realm grants + body-refinement tiers
 + equipment main stats / affixes / slot enhancement
 + technique / node / path / passive modifiers
 -> player.finalStats / StatCalculator.calculateStats
 -> playerToCombatEntity -> battle baseStats
 -> TurnStatsRecompute / calculateEffectiveStats + active buffs
 -> scheduler / damage / defense / UI snapshots
```

Attribute derivation là một công thức two-pass; effective stats tránh derive attributes lần hai. Tuy nhiên runtime passive update không đi vào battle recompute, và snapshot trận sau có thể chụp modifier trận trước (ARCH-002).

```text
equipment catalog -> rolling/createInstance -> EquipmentBag
 -> Equip/Unequip -> EquipmentSystem.applyModifiers -> player store sync
 -> enhancement: cost resolver + EquipmentSlotManager
 -> wash/refine: paid domain preview -> pending ticket -> validate commit
 -> quality/affix/main-stat scale -> canonical equipment modifiers
 -> dissolve/overflow -> MaterialBag receipt / quest / notification
```

Forge budget là state trên item, enhancement là state trên slot. Không xác lập một authority “forge” khác chỉ vì tên UI. Wash ticket không giữ đủ item lifecycle (ARCH-011); refine là cơ chế hiện có để tái sử dụng.

### Persistence, production và quest

```text
world tick / pagehide / settings save
 -> buildGameSave -> schema/value -> local save coordinator
 -> load/validate -> restore identity -> player + manager restore
 -> offline production/alchemy/decompose -> delivered receipts
 -> quest reconciliation -> stateVersion -> Vue
```

Identity hiện chỉ phủ một phần payload (ARCH-001). Production offline gộp phần thời gian chưa hoàn tất của nhiều worker thành một output đã hoàn tất (ARCH-007). Quest activation đã chuyển sang lifecycle; claim vẫn revalidate trạng thái/turn-in tại owner, không dựa vào việc mở panel.

## D. Architecture Findings

Mười lăm nhóm finding dưới đây gom các biểu hiện có chung trách nhiệm; không đếm lại chúng ở những mục khác. Có **7 nhóm P1, 8 nhóm P2**, không xác lập P0. P2 remote có tác động P1 nếu bật mode remote với đúng SQL đang tracked.

| ID | Severity | Hệ thống / vấn đề chính | Evidence | Chi tiết |
|---|---|---|---|---|
| ARCH-001 | P1 | Save không phải detached full snapshot / replacement | EXECUTED, SOURCE, SPEC DRIFT | D |
| ARCH-002 | P1 | Effective stats thiếu refresh và rò modifier qua trận | EXECUTED, SOURCE | D |
| ARCH-003 | P1 | MP/Ward regeneration có dữ liệu nhưng không có consumer sống | EXECUTED, SOURCE | F |
| ARCH-004 | P1 | Accepted session bị mất giữa command/coordinator/scene | EXECUTED, SOURCE, SPEC DRIFT | E |
| ARCH-005 | P1 | Vue bridge giữ false; mất skill/manual controls trong combat | EXECUTED, SOURCE | E |
| ARCH-006 | P1 | Độ kiếp chết vẫn victory; settlement chưa độc lập visual | EXECUTED, SOURCE, SPEC DRIFT | F |
| ARCH-007 | P1 | Offline production phát thưởng trước deadline worker | EXECUTED, SOURCE | F |
| ARCH-008 | P2 | Authored content không được bảo toàn qua execution path | EXECUTED, SOURCE, SPEC DRIFT | F |
| ARCH-009 | P2 | Buff owner/source identity sai khi proc và reaction | EXECUTED, SOURCE | F |
| ARCH-010 | P2 | Actor chết do DoT vẫn được regen và đánh charged hit | EXECUTED, SOURCE | F |
| ARCH-011 | P2 | Wash ticket dùng lại trên item lifecycle khác | EXECUTED, SOURCE | F |
| ARCH-012 | P2 | Notification bỏ delivery/overflow receipt | SOURCE | E |
| ARCH-013 | P2 | Async boot tiếp tục ghi state sau teardown | EXECUTED, SOURCE | G |
| ARCH-014 | P2 | Event migration thiếu natural-defeat producer và giữ dead listeners | SOURCE, SPEC DRIFT | E |
| ARCH-015 | P2 | Client một talent không khớp SQL yêu cầu ba | SOURCE, SPEC DRIFT | E |

### ARCH-001 — P1 — Save/restore chưa có full-value boundary

**System:** Persistence / all persistent managers. **Evidence:** EXECUTED + SOURCE + SPEC DRIFT. Reviewer mapping: AUD-L01.

**Location:** `src/services/save/saveTypes.ts:204-218`; `SaveSystem.ts:319-358`; `src/stores/player.ts:347-375`; `src/core/game/GameManagerSaveRestore.ts:153-221,257-261`. Shallow getters: SkillManager:23-24, TechniqueManager:18-19, EquipmentBag:140-141, BuildingManager:28-29, ProductionSystem:119-120, AlchemySystem:182-183.

**Current behavior:** identity chỉ gồm version, player bỏ timestamp, materials và quests. Thay pills/equipment/skills/techniques/buildings/slots/production/alchemy/decompose có thể không đổi identity. Snapshot giữ live references ở nhiều slice. Restore skills/techniques/equipment còn additive/first-ID-wins; state vắng trong payload không được thay thế đầy đủ. Restore cũng giữ hoặc sửa reference đầu vào ở một số manager.

**Expected architecture:** SaveSystem tạo một detached serialized value; restore thay toàn bộ session state tương ứng, có repeat semantics cho mọi slice. Identity chỉ được ghi nhận khi áp dụng thành công. Những manager có API riêng vẫn phải tham gia cùng contract.

**Root cause:** sửa boundary theo từng slice thay vì chứng minh toàn bộ GameSave. Test isolation chủ yếu cover quests; replacement test tập trung material/pill bags; identity test chủ yếu player/materials. Comment whole-payload và ý định R10 vượt quá implementation hiện tại.

**Runtime consequence / reproduction:** coordinator chạy lại với GameManager và catalogs thật: thay pills-only cho `IDENTITY_PILLS_ONLY true`; sửa skill live level 1 -> 11 làm snapshot đã tạo đổi thành 11, `sameReference:true`; restore `skills:[]` với identity khác vẫn còn một skill live. Đây là ba nghĩa vụ độc lập trong cùng boundary. Snapshot aliasing không có nghĩa mọi local autosave đều hỏng: lần ghi local đầu diễn ra đồng bộ; nguy cơ rõ ở public snapshot, retry và restore/session replacement.

**Repair direction:** phương án cục bộ là mở rộng identity, nhưng chưa xử lý alias/replacement. **Hướng lâu dài:** định nghĩa contract từng slice, clone tại boundary, validate candidate đầy đủ, replace/reset qua owner, invalidate pending operations và chỉ commit identity sau thành công. Không tự xây save migration cho dev saves cũ hoặc framework transaction tổng quát. Failure giữa restore còn cần fault injection; chưa báo là lỗi đã tái hiện riêng.

### ARCH-002 — P1 — Stat refresh contract không đi hết tới battle

**System:** Player stats / passives / buffs / combat. **Evidence:** EXECUTED + SOURCE. Mapping AUD-C01 + AUD-C03.

**Location:** `src/core/game/GameManagerTurnBattleOps.ts:741-751,798-818,950-961`; `GameManagerPersistentEffectOps.ts:74-100`; `src/App.vue:479-486`; `src/core/battle/turn/TurnStatsRecompute.ts:8-11`; `TurnBattleSystem.ts:730-736,780-792,1102-1138`; `src/core/buff/BuffSystem.ts:31-77`.

**Current behavior:** menu nhận live passive modifiers qua App/Pinia; battle recompute chỉ dùng base snapshot và buff pool. StartBattle reset passive state sau khi player entity đã được xây từ finalStats. Buff thêm vào pool không lập tức làm effective stats đúng; nhánh CC/charge có thể bỏ lần recompute, duration-one buff có thể hết trước lần áp dụng hiệu lực.

**Expected architecture:** một owner lắp ráp resolved/effective stats, có refresh policy cho modifier thay đổi và reset policy trước snapshot trận mới. Buff add/remove/expire phải cập nhật effective view trước consumer tiếp theo đọc.

**Root cause:** công thức đã canonical nhưng assembly và invalidation vẫn phân tán; xuất hiện hai thế giới menu hiện thời và battle snapshot cũ. Không cần thêm một StatCalculator nữa.

**Reproduction / consequence:** GameManager + default player + talent `tat_phong`: sau ba kill, stacks=3 nhưng speed live/base vẫn 100.15; giá trị menu tương đương 106.159. Trận kế reset stacks=0 nhưng base đã là 106.159. Với `thiet_y_tang`/`kim_giap`, buff trong pool nhưng defense vẫn 5 và thorns 0 ở counter ngay sau; đến lượt recompute mới thành defense 5.75/thorns 0.15. Kết quả damage/order khác mô tả và khác trạng thái hiển thị.

**Repair direction:** cục bộ có thể thêm refresh ở callsites đã biết. **Hướng lâu dài:** chuyển assembly + modifier provenance + invalidation về một headless owner, reset ephemeral state trước entity construction, refresh trước mọi stat-dependent phase. Characterize equipment/realm/technique/path/talent/buff với production factories. Không rebalance tốc độ hoặc thay gameplay intent trong nhiệm vụ sửa ownership.

## E. Integration Findings

### ARCH-004 — P1 — Session bị loại khỏi admitted command

**System:** Scene route / domain sessions. **Evidence:** EXECUTED + SOURCE + SPEC DRIFT. Mapping AUD-L03.

**Location:** `src/presentation/createGamePresentation.ts:124-148`; `GamePresentationCoordinator.ts:337-348,397-402`; `PhaserSceneAdapter.ts:136-157`; `src/core/game/GameManager.ts:972-990`; `src/game/scenes/CombatScene.ts:795-822,1902-1920`; `src/composables/useTribulation.ts:44-46,74-75`; `src/App.vue:221-238`.

**Current behavior:** command trả RouteRequest/session nhưng wrapper chỉ giữ success boolean và behindCurtain. Coordinator truy vấn lại một session không scoped theo command; query ưu tiên retained combat. Renderer.prepare nhận request ban đầu còn thiếu session. CombatScene rơi về fallback khi sessionId undefined.

**Expected / root cause:** accepted command phải trả đúng session identity xuyên suốt admission -> resources -> renderer -> READY. Mất typed return rồi suy đoán qua ambient state phá one-authority contract dù đã có coordinator.

**Reproduction / consequence:** stage thật `mortal_dong_1`, victory combat session 1 được giữ sau về Home, bắt đầu tribulation session 2: transition lỗi `Domain command produced no session for target route`, retry bị từ chối; Back còn bị active tribulation chặn. Đây là in-memory production integration, không phải E2E backend. Phiên Edge độc lập xác nhận domain combat session=1, CombatScene active nhưng scene sessionId undefined. Luồng khởi đầu combat vẫn có thể render nhờ fallback; không kết luận mọi lần chuyển scene đều thất bại.

**Repair direction:** truyền trực tiếp accepted result có SessionRef bắt buộc cho route combat/tribulation; renderer nhận request đã gắn session; READY validate cùng identity. Giữ coordinator hiện tại. Việc chỉ đổi thứ tự query GameManager là sửa triệu chứng và vẫn mất accepted-command provenance.

### ARCH-005 — P1 — Battle fighting nhưng skill/manual UI không xuất hiện

**System:** Vue ↔ plain domain state. **Evidence:** EXECUTED real Edge UI + SOURCE.

**Location:** `src/composables/useTurnCombatManual.ts:15-22`; `src/components/game/combat/hud/TurnCombatSkillBar.vue:60,84` (`visible` computed và root v-if); đối chiếu `src/composables/useTurnBattleInfo.ts:20-28,45-49`, `useGameState.ts`. Test consumers: `tests/e2e/combat-overlay-layout.spec.ts`, `turn-combat-hud.spec.ts:50-99`.

**Current behavior:** computed `battle` đọc stateVersion nhưng trả cùng plain object. Derived computed `isBattleFighting` chỉ đọc battle reference; khi state chuyển countdown -> fighting trên cùng object, computed value vẫn false. Skill bar bị v-if loại khỏi DOM dù các query khác đã thấy fighting. Log array có cùng dạng refresh debt: nguồn trả cùng array, downstream slice không đọc version; không gộp nó thành một reproduction độc lập.

**Expected / root cause:** mọi scalar/derived projection vào Vue phải phụ thuộc version hoặc snapshot có identity thay đổi. Core được chủ ý giữ framework-independent; đọc version ở một computed trả live object không làm các thuộc tính lồng nhau reactive.

**Reproduction / consequence:** normal guest -> create -> Home -> Truyền Tống Trận -> start; chờ ít nhất ba actor turns. Edge ghi `state:fighting`, `turns:3`, CombatScene active, MainScene inactive, dockText rỗng, skill-bar roots=0 (field controls trong JSON), TurnCombatSkillBar `isBattleFighting:false`, `visible:false`. Ảnh combat kèm báo cáo cho thấy right dock trống trong lúc sprite/HP/gauge đang hoạt động. Người chơi không truy cập được skill/manual controls qua bar.

**History:** computed ở dòng 22 có từ `2b7b90ef8` ngày 2026-09-05; file thuộc Slice 7 HUD bridge. `useTurnBattleInfo` đã ghi nhận và sửa dạng lỗi tương tự ngày 2026-09-12, nhưng consumer manual còn sót.

**Repair direction:** cục bộ cho scalar đọc stateVersion trực tiếp. **Hướng lâu dài:** một versioned/immutable projection contract dùng chung cho skill bar, log và HUD; test countdown -> fighting -> manual choice trên cùng domain object và kiểm tra button thật. Không đưa Vue reactivity vào combat domain hoặc thêm local timer.

### ARCH-012 — P2 — Delivery receipt không tới notification

**System:** Economy → UI notifications. **Evidence:** SOURCE. Mapping AUD-E04.

**Location:** `src/core/game/GameManagerTickOps.ts:170-184,198-209`; `src/core/production/ProductionSystem.ts:435-449`; `src/core/alchemy/AlchemySystem.ts:348-360`.

**Current / expected:** bag clamp và trả overflow; production trả amount/overflow, alchemy trả pills/delivered/overflow. TickOps hiển thị generated amount/pills như đã nhận. Consumer phải báo delivered và xử lý overflow theo policy hiện có.

**Root / consequence:** receipt producer được migrate, notification adapter chưa được migrate. Full stack + completed cycle/job có thể nhận zero nhưng thông báo +N/xN. Production quest dùng amount-overflow nên UI còn bất đồng với quest. Không có bằng chứng domain nhân đôi grant trong đường này.

**Call path:** GameManager.update -> TickOps -> ProductionSystem/AlchemySystem -> bag.add receipt -> notification factory bỏ receipt.

**Repair direction:** dùng delivered, route overflow qua notification mechanism hiện có; orchestration tests kiểm tra bag + quest + message khi stack đầy. Không thay chính sách mất output hoặc thiết kế transaction framework.

### ARCH-014 — P2 — Event migration chưa đóng hết terminal và legacy consumers

**System:** Combat terminal → scene/audio/cache. **Evidence:** SOURCE + SPEC DRIFT.

**Location:** `src/core/game/GameManagerBattleRewardOps.ts:88-126`; `GameManagerTurnBattleOps.ts:1184-1217`; `src/presentation/audio/combatAudioBinding.ts:48-52`; `src/components/game/PhaserCanvas.vue:84,122`; `src/game/scenes/CombatScene.ts:596-623`; `src/core/events/EventBus.ts:10-49`.

**Current behavior:** natural victory và defeat đều đặt battleEndEmitted=true, nhưng chỉ victory emit `battle_end`. Defeat event chỉ có ở explicit abandon; abandon từ chối battle đã terminal. Vì vậy natural defeat không tới battleDefeat audio, scene onBattleEnd và clearPositionsSnapshot listeners. Comment “victory/defeat emit exactly once” không đúng source.

**Expected / root cause:** terminal authority publish một outcome fact cho mỗi kết thúc hợp lệ; thêm/retire event phải migrate toàn bộ consumer. EventBus nhận string + generic T độc lập nên không kiểm tra quan hệ tên/payload hoặc nhánh producer còn thiếu.

**Call path / consequence:** TurnBattleSystem -> state defeat -> rewardOps.grantTurnBattleRewards -> terminal flag -> không emit; audio/background/cache consumers không được gọi ở terminal đó. Mức tác động UI từng listener chưa fault-inject qua browser, nên không báo toàn bộ cleanup mất hoặc refight luôn treo.

Ngoài ra CombatScene vẫn đăng ký `positions`, `cast_start`, `cast_complete`, `player_teleported` trong khi không còn emitter sống cho tên tương ứng trong production graph đã trace. Đây là integration debt thật: handler còn tồn tại nhưng không thể được gọi bởi engine hiện hành. `turn_battle_entity_snapshot` và `turn_cast_start` đã thay thế nhiều phần, do đó không suy ra sprite/cast mới hoàn toàn hỏng. `cast` producer còn nằm trong SkillEffectResolver không reachable ở entry graph; các dynamic passive trigger phải kiểm tra content trước khi kết luận có player-visible regression.

**Repair direction:** contract terminal event chung cho natural victory/defeat/abandon, giữ policy khác nhau của từng outcome; test producer -> consumer. Lập migration ledger các old listeners: replace, retain có producer chứng minh, hoặc retire sau consumer characterization. Typed event map giúp chặn drift tiếp theo; không dùng event bus thay domain command cho settlement.

### ARCH-015 — P2 — Tracked remote character contract không tương thích client

**System:** Auth/character client ↔ SQL/RPC. **Evidence:** SOURCE + SPEC DRIFT. Mapping AUD-L05. Tác động P1 nếu bật remote với schema tracked; không khẳng định backend đang triển khai như vậy.

**Location:** `src/services/character/CharacterCreationService.ts:7,45-52`; `src/components/onboarding/CharacterCreationScreen.vue:39-44`; `src/services/character/SupabaseCharacterCreationService.ts:58-79`; `supabase/migrations/202608240001_online_auth_character.sql:54,148-154`.

**Current / expected:** client/UI chỉ chấp nhận một talent, SQL constraint và RPC yêu cầu ba. Một draft hợp lệ ở client phải hợp lệ ở boundary server cùng phiên bản.

**Root / consequence / path:** thay đổi lựa chọn talent chưa migrate server contract; screen -> service validation -> RPC gửi một ID -> tracked SQL reject -> generic unavailable. Local mock flow không bị lỗi này. Guest qua Supabase vẫn đi qua RPC của remote mode và chịu mismatch này.

**Repair direction:** cập nhật schema/RPC/seed theo quyết định one-talent và kiểm tra trên disposable database. Kiểm chứng deployed capability trước rollout. CloudSaveServiceFactory hiện luôn chọn LocalCloudSaveService và initial remote save là `{}`; remote save chưa được wired. Đó là capability còn thiếu/đã deferred, không phải bằng chứng người dùng hiện đang mất cloud save.

### Important event inventory

| Event / protocol | Producer → consumer; payload | Registration / lifecycle / verdict |
|---|---|---|
| `presentation_session_started` | turn/tribulation session owners → createGamePresentation → coordinator.request (admission/dedupe), và combatAudioBinding; SessionRef | createGamePresentation:63-92 subscribe/adopt existing session, :178 unsubscribe; audio binding unbind trả về. Đây còn là routing consumer quan trọng của ARCH-004 |
| scene READY / action ACK | scene/animation callback → adapter/runtime; transition/session/action identity | Hai protocol khác nhau. Optional/missing session trong admitted path: ARCH-004 |
| `turn_ready`, `turn_cast_start`, `action_impact`, `turn_standby_complete` | TurnActionPresentationEvents → CombatScene/playback; actor/action/target/effect facts | Scene bindings được remove khi shutdown. Không coi no-op render là quyền thay outcome |
| `turn_battle_entity_snapshot` | TurnActionPresentationEvents.build/query → CombatScene reconciliation; participants, HP/positions/countdown | Initial snapshot phải là query thuần; normal Edge và E2E chứng minh event/sprite flow sống |
| `attack`, `hit`, `critical`, `dodge`, `block`, `damage`, `death` | combat/action owners → VFX/audio/passives; resolved actor/target/result | Nhiều domain consumer hợp lệ; audit không xác lập event loop. Payload typing còn rộng |
| `entity_vitals_changed` | EntityVitalsSystem → CombatScene/TribulationScene HUD; entity/vital values | Bind/off ở lifecycle scene; giữ healthy mutation notification boundary |
| `battle_end` | reward terminal / abandon → scene, audio, PhaserCanvas cache | Natural defeat thiếu producer: ARCH-014 |
| `tribulation_lightning`, `tribulation_outcome` | TribulationDirector → lightning scene listener; outcome fact currently has no production event subscriber found (App queries state) | Lightning listener cleanup; published defeat rồi victory mâu thuẫn: ARCH-006. Outcome publication is currently producer-only debt, not the settlement trigger |
| `cultivation_changed` | App progression tick và useBattleActions → MainScene; isCultivating boolean | MainScene:285 bind, :296 off; event origin vẫn có phần ở App composition path. Không tự kết luận domain duplication chỉ vì vị trí |
| notification queue / feedback | reward/economy operations → stores/UI | Queue canonical; output receipt không đủ ở hai consumers: ARCH-012 |
| `positions`, `cast_start`, `cast_complete`, `player_teleported` | Không có live emitter đã tìm thấy → vẫn có CombatScene listeners | Legacy integration debt, cần migrate/retire theo ledger |
| Electron `combat-clock:*`, suspend/resume, flush | main process ↔ preload ↔ App bridge | IPC không phải orphan chỉ vì producer ở process khác; unsubscribe/dispose còn gap |

AST scan chỉ là bước tìm ứng viên: DOM `click`, `resize`, `shutdown`, AbortSignal và IPC có producer ngoài module graph; chúng không bị phân loại sai thành orphan gameplay events.

## F. Gameplay Logic Findings

### ARCH-003 — P1 — MP/Ward regeneration chưa có execution consumer

**System:** Combat resources. **Evidence:** EXECUTED + SOURCE. Mapping AUD-C02.

**Location:** `src/core/battle/turn/TurnBattleSystem.ts:730-748`; `src/core/player/Player.ts:451-489`; `TurnSkillAction.ts:105-130`; `src/core/combat/CombatSystem.ts:345-366`; authored `CultivationPathKit.ts:60-81`, `ThuanHeBuffs.ts:12-24,29-41,87-103`.

**Current behavior:** turn-start chỉ hồi HP; MP được khởi tạo/spend, Ward khởi tạo zero và bị damage consume. Các stat manaRegenPerSecond/wardRegenPerSecond được tạo từ content nhưng không có nhánh refill sống tương ứng trong trace production.

**Expected / root cause:** resource owner phải thực hiện cả gain/spend/reset đúng clock policy. Migration sang turn model giữ stat/cost/content nhưng bỏ consumer regeneration.

**Reproduction / consequence:** battle có cả hai regen=10; qua mười lượt, MP vẫn 10, Ward vẫn 0. Thanh Tuyền/Băng Giáp/Địa Trụ/path resource kit không thể tạo đầy đủ lợi ích đã authored; không đủ tài nguyên cho kỹ năng dài hạn.

**Repair direction:** quy định rõ đơn vị turn/seconds theo gameplay intent trước sửa; triển khai resource gain qua vitals/resource owner dùng clock canonical và test real kit. Không tùy tiện đổi con số regen/cost để làm test xanh.

### ARCH-006 — P1 — Tribulation terminal không độc nhất

**System:** Major-realm progression / outcome lifecycle. **Evidence:** EXECUTED + SOURCE; settlement/visual concern thêm SPEC DRIFT. Mapping AUD-L02 và lifecycle note 1.

**Location:** `src/core/tribulation/TribulationDirector.ts:388-407,454-471`; settlement `src/composables/useTribulation.ts:149-176`; `src/presentation/GamePresentationCoordinator.ts:314-328`.

**Current behavior:** update áp sét lethal -> defeat; cùng update tiếp tục advance chapter -> final chapter đặt victory vô điều kiện. Outcome service chỉ được gọi từ behindCurtain sau curtain.close thành công.

**Expected / root cause:** domain state machine commit một terminal outcome duy nhất và có one-use settlement; survival phải được kiểm tra trước advance. Hiện thiếu guard sau lethal mutation; caller/visual transition đang cung cấp một phần once-only lifecycle thay cho domain owner.

**Executed reproduction:** real foundation_establishment chapters, createDefaultPlayer ở qi_refining, calculated defense=105, trả lời mind questions đúng qua query, update mỗi 0.1s. Parent tái chạy: `outcomes:[defeat,victory]`, final state victory, HP=0. Đây không phải custom chapter giả. Victory consequences có thể cấp realm/foundation/talent thay vì defeat penalty.

**Source-only extension:** nếu curtain.close fail, permanent settlement/clear không chạy. Đây là visual-completion dependency vi phạm P17/A7, khác với policy cho phép presentation pace combat; chưa fault-inject UI để đo mất outcome khi reload. R12 mô tả behind-curtain placement nhưng không thay thế protection rule.

**Repair direction:** cục bộ guard terminal ngay sau strike. **Hướng lâu dài:** explicit terminal transition + resolved outcome identity + idempotent domain settlement; presentation chỉ trình bày receipt đã commit. Tách hai bước thành nhiệm vụ nhỏ, không viết lại tribulation content hoặc luật thưởng.

### ARCH-007 — P1 — Offline workers tạo thêm reward từ partial cycles

**System:** Production / offline time. **Evidence:** EXECUTED + SOURCE. Mapping AUD-E01.

**Location:** `src/core/production/ProductionOffline.ts:210-257`; `ProductionSystem.ts:363-376`; entry `src/core/game/GameManagerSaveRestore.ts:339-361`.

**Current / expected:** hai worker bắt đầu ở T, mỗi worker due T+100s. T+65s online chưa hoàn tất cycle nào; offline giữ cả hai future cycles nhưng còn cấp một synthesized cycle. Mỗi worker lane phải hoàn tất độc lập; tổng phần lẻ không trở thành completed item.

**Root cause:** retained future cycles chưa reserve lane capacity; `floor(windowMs * slots / cycleMs)` gộp partial work rồi backdate synthetic output.

**Reproduction / consequence:** real ProductionSystem, THANH_VAN catalog/materials, mortal level 1, capacity 2, chỉ `thanh_van_lam` auto. Clone saved state tại T, so online tick và restore/settleOffline ở T+65000: onlineRewards=[], offlineSettled=1, wood+3, offlinePending=2 với deadlines gốc. Reload thông thường sau hơn 60s làm lệch yield. Không định lượng unlimited exploit từ một diagnostic.

**Repair direction:** shared per-lane advancement semantics, bảo toàn deadline/remainder và existing work cap; parity tests qua partial windows, nhiều workers, repeated saves. Commit history chỉ xác lập công thức được giữ qua split `63fef9e6`, không quy split là thời điểm phát sinh lỗi.

### ARCH-008 — P2 — Authored content và production execution không tương đương

**System:** Skills / progression / pills. **Evidence:** EXECUTED + SOURCE; HP pill có SPEC DRIFT. Mapping AUD-C05/C07/C09 + AUD-E03. Gom theo nghĩa vụ capability parity; các biểu hiện cần sửa ở đúng owner, không tạo một “content manager” tổng quát.

| Vị trí / call path | Current behavior và bằng chứng | Nguyên nhân / hậu quả |
|---|---|---|
| `TurnBattleSystem.ts:925-958,1089-1100`; default Kiếm Tu kit/`src/data/skill/BatKiemThuat.ts:23-28,41-48` | 60 player turns với rotation Kiếm Tu và special tụ lực thật: Thế=0, ultimate count=0, charge actions=32, vẫn gây damage 5231.2 | Charge return trước gain-Thế chung; ultimate cost100 không được mở qua rotation mặc định |
| `GameManagerTurnBattleOps.ts:843-858,892-897`; `TurnBasicAttacks.ts:17-36`; `SkillSystem.ts:94-130` | Basic `tram` level3/10000exp có canonical damage1001 nhưng production dùng static multiplier1 | Production basic selection bỏ SkillSystem scaling, dù special dùng resolver. Adapter parity test không chạy entry path này |
| `PhapTuChainSkills.ts:245-253`; `SkillToTurnSkillConverter.ts:94-102`; `BuffSystem.ts:47-49`; `ThuanHeBuffs.ts:12-18` | `duong_linh_tuyen` duration8 qua adapter chỉ còn buff ID; effective duration5.988 thay vì7.984 với cùng resistance0.998 | Authored duration bị bỏ, registry default6 thắng. Không kết luận resistance design sai |
| `data/pill/pills.ts:16-24`; `alchemyRecipes.ts:18-30`; `PillSystem.ts:208-237`; `GameManagerPillOps.ts:52-83`; `PillBagSection.vue:82,169` | `hoi_xuan_dan_mortal`, recipe thật, HPregen4/60s; use ok, pill bị trừ, chỉ tạo manaRegen flat0 | HP pill regen đã bị bỏ theo quyết định người dùng ngày 2026-09-05 nhưng family/recipe/UI còn sống. Người chơi trả nguyên liệu cho zero-effect item |

**Expected architecture:** canonical skill resolution phải bảo toàn scaling, execution policy, duration và supported effects từ registry tới action thật; unsupported content phải bị từ chối/retire rõ ràng.

**Repair direction:** restore action completion contract cho charged actions; dùng canonical resolver ở production basic path; carry duration qua typed effect contract; retire/disable HP pill family hoặc xin quyết định effect thay thế. Không tự khôi phục HP-pill mechanic đã bị người dùng loại bỏ. Test mọi authored kit/pill bằng entry composition thực, thay vì chỉ kiểm tra converter shape.

### ARCH-009 — P2 — Buff pool ownership và reaction ingredient identity không được bảo toàn

**System:** Buff/debuff/reaction. **Evidence:** EXECUTED + SOURCE. Mapping AUD-C04 + AUD-C08.

**Location:** `TurnBattleSystem.ts:1049-1050`; `src/core/buff/BuffSystem.ts:363-404`; `src/core/battle/turn/TurnReactionManager.ts:48-64,95-109,134-137`; `src/core/element/ElementReaction.ts:3-11`; authored `LegacyBuffs.ts:222-240`.

**Current / expected:** on-hit proc tạo debuff cho victim nhưng add vào attacker pool; CC query của pool không lọc targetId. Reaction scan ingredients từ nhiều source nhưng remove bằng sourceId của caster mới, không bằng identity ingredient đã match. Pool phải thuộc target; consumed instance phải chính là ingredient đã dùng.

**Reproduction / consequence:** real `thach_hoa`, RNG0.2: source pool chứa choáng target enemy; target pool rỗng; source stunned=true, target=false. Real player fire + companion water hai lần: reactions=2 nhưng `bong` của player vẫn còn sau lần đầu. Sai đối tượng CC và reuse ingredient tạo sai damage/control.

**Root / repair direction:** identity đang được suy từ ambient caller thay vì giữ target/source/instance resolved. Truyền đúng target BuffSystem và giữ matched ingredient instance identities khi consume; tests self/target, nhiều sources, refresh/stack/duration. Không đổi reaction recipe hoặc elemental balance để che lỗi owner.

### ARCH-010 — P2 — DoT lethal không kết thúc lượt trước heal/charge

**System:** Combat action lifecycle / vitals. **Evidence:** EXECUTED + SOURCE. Mapping AUD-C06.

**Location:** `TurnBattleSystem.ts:635-669,733-740,781,925-944`; `src/core/combat/EntityVitalsSystem.ts:86-93`.

**Current behavior:** targets được giữ trước status tick; DoT có thể giết actor, sau đó HP regen vẫn chạy, charged branch vẫn gây hit. Normal branch có alive guard mà charge branch thiếu. Vitals healing không từ chối dead actor trong đường này.

**Expected / root cause:** death là terminal eligibility cho action; sau mỗi lethal status phase phải chặn các phase cần sống. Action variants không được có outcome contract khác nhau chỉ vì early return.

**Reproduction / consequence:** real Bạt Kiếm charging actor với `bong` thật, HP0.001 -> alive=false nhưng HP0.1 và damage-after-death301.8. Đây vừa là contradictory vitals vừa là đòn đánh không hợp lệ.

**Repair direction:** chung pre-action status/liveness boundary, quy định healing dead entity phải reject trừ explicit resurrection policy; validate charged target/liveness tại resolution. Không local-patch mỗi skill ID.

### ARCH-011 — P2 — Paid wash ticket không gắn item membership generation

**System:** Equipment random operations. **Evidence:** EXECUTED + SOURCE. Mapping AUD-E02.

**Location:** `src/core/equipment/EquipmentWash.ts:246-250,307-361`; `EquipmentBag.ts:29-31,112-140`; đối chiếu EquipmentRefine commit/snapshot guard. Production UI: `WashTab.vue:125-137 -> useEquipmentActions.ts:125-155 -> EquipmentOpsSystem`.

**Current / expected:** pending chỉ giữ ticketId/instanceId/affixes, commit kiểm tra string IDs. Paid outcome phải thuộc exact item + membership lifetime và vẫn đủ eligibility ở commit, gồm lock/favorite.

**Root / reproduction / consequence:** real factory `base_kiem` preview, remove item, add object khác cùng ID, locked/favorite=true, commit ticket cũ -> ok, replacement affixes bị ghi đè. Same-ID không phải capability của cùng item lifetime. Đây là domain API integrity defect; không khẳng định normal cloud reload hiện tạo replacement, vì restore đang additive như ARCH-001.

**Repair direction:** dùng exact-object/membership/snapshot guard đã có ở refine; clear ticket khi session reset; revalidate eligibility; reject stale once-only. Chỉ đổi ticket random string không sửa được lỗi.

## G. Scene & Lifecycle Findings

### Scene lifecycle thực tế

| Scene | Construction / init / preload / create | Resources, listener và shutdown |
|---|---|---|
| AssetLoaderScene | Scene đầu trong primary Phaser config; bootstrap host tạo game, scene giữ loader cho bundle mechanism | Global texture/cache theo lifetime host; không phải route gameplay |
| MainScene / Động Phủ | Adapter enter/restart; init lấy transition context; preload hiện không gánh combat preload; create dựng Home và READY | Dựa vào Home/core-ui bundle đã ensured. Resize/shutdown cleanup có; comment battle_start tự đổi scene đã lỗi thời |
| CombatScene | Adapter chuẩn bị/activate, init nhận transition/session; preload vẫn có fallback queueCombatAssets; create dựng sprites/HUD, đăng ký event bindings, initial snapshot, READY | One-shot shutdown remove bindings/tweens/visual state; texture chung còn trong host cache. ARCH-004 làm thiếu session, fallback che migration gap |
| TribulationScene | Adapter kích hoạt; init nhận director/player/session context; preload fallback cultivate/ink atlas; create ceremony + READY | Ba bus handlers lightning/damage/vitals và resize có off trong shutdown (`35-39,136-139`); resize chỉ cập nhật frame, chưa chứng minh mọi visual relayout |
| TranPhapCombatPreviewScene | Separate dynamic-region game; preload profile/placeholder assets; create preview + assignment listener | Listener được remove khi shutdown; đóng preview destroy independent game/cache. Không cần ép thành primary route |

**AuthScene không tồn tại.** Auth/character là Vue screens. Scene navigation thực thi ở adapter/coordinator, không ở Vue Router và không còn như một số comment MainScene/CombatScene cũ mô tả.

### ARCH-013 — P2 — Boot async ghi state sau stopAll

**System:** App lifecycle / timer ownership. **Evidence:** EXECUTED + SOURCE. Mapping AUD-L04.

**Location:** `src/composables/useAppLifecycle.ts:205-207,232-270,316-335`.

**Current / expected:** boot await load; stopAll không invalidate boot generation. Load trả về sau teardown vẫn restore, start interval và enter route. Async continuation phải xác nhận lifecycle identity còn hiện hành trước side effects.

**Root / reproduction / consequence:** thiếu generation/cancellation owner qua await. Diagnostic dependency-injected composable: deferred load -> gọi stopAll thật -> resolve -> intervals=1/restores=1/entries=1/handle=1 sau stop. Có warning vì gọi composable ngoài mounted component; không mô tả đây là real-browser unmount repro. Race local fast-load nhỏ hơn remote/delayed load nhưng contract failure đã được thực thi.

**Repair direction:** boot generation/disposal fence tại mọi await; timer/route/restore registration thuộc cùng generation và rollback cleanup. Không thêm global boolean chung cho nhiều boot sessions.

**Lifecycle gaps cùng chủ đề, chưa nâng thành user-visible defect đã chứng minh:**

- `RafClockSource.ts:43-44,51-57`: callback gọi stop vẫn bị rearm sau callback; diagnostic thấy một RAF pending. Stopped guard ngăn advancement; không kết luận nó gây refight freeze. App unmount `608-637` chưa có disposal đầy đủ combat clock; Electron bridge không trả unsubscribe cho các subscription.
- Host bootstrap retry: PhaserCanvas chỉ start region ở onMounted; failed import/construct trong useDynamicRegion teardown host, retry transition không gọi restart host. SOURCE/INFERRED, chưa inject chunk failure trong browser.
- AssetBundleManager thay loader clear maps (`100-105`) nhưng load continuation cũ có thể publish lại loadedResources (`241-279`) thiếu generation. SOURCE/INFERRED, chưa đo race thực. Dispose/prefetch signal-less cancellation cần characterization.
- Không thấy listener leak trong scene shutdown happy path đã trace; chưa chạy soak/HMR/host recreation stress. Không suy từ texture cache còn resident rằng có memory leak.

### Có cần Scene Manager mới? Có nên scene đích sở hữu resource requirements?

**Không cần thêm Scene Manager.** `GamePresentationCoordinator` đã sở hữu admission/route/transition/error; `PhaserSceneAdapter` sở hữu Phaser activation; `AssetBundleManager` tải resource. Thêm manager tổng quát sẽ tạo owner cạnh tranh. Cần sửa accepted-session handoff và lifecycle của các owner đang có.

**Nên hoàn tất destination-driven resource requirements; đã triển khai một phần.** Mapping hiện tại: entry/auth/error không cần Phaser bundles; Home cần core-ui/home; combat cần core-ui/combat; tribulation cần core-ui/tribulation. Coordinator ensure tài nguyên đích sau curtain đóng, trước deactivation renderer cũ. Điều này phù hợp “scene đích cần gì thì yêu cầu nấy”, không bắt scene trước preload hộ.

Blockers: Combat/Tribulation fallback preload còn song song; readiness có chỗ chỉ dựa texture key thay vì atlas/frame/animation contract; host generation/retry chưa đầy đủ; combat bundle còn tải cả profile batch. Migration cost vừa phải nếu giữ bundle mechanism/catalog, cao hơn nếu tách nhỏ per-enemy/per-encounter vì phải kiểm tra preload enumeration/retry/cache/READY. Không retire fallback trước khi entry trực tiếp vào destination có parity. Cache eviction chỉ nên quyết định sau memory measurement; hiện chưa có số liệu chứng minh cần eviction mỗi scene.

## H. State Authority Matrix

| State | Intended Owner | Actual Writers | Verdict |
|---|---|---|---|
| Combat HP/alive | EntityVitalsSystem dưới CombatSystem; explicit entity initialization | CombatSystem/vitals, turn HP regen, tribulation lightning thông qua combat APIs | VIOLATED: dead-heal/charge phase contract ARCH-010; không phải mọi writer đều bypass |
| MP | Combat resource/vitals operation | Player initialization, TurnSkillAction spend, damage-related mana handling | VIOLATED: regen consumer thiếu ARCH-003 |
| Ward | Combat resource/vitals operation | Player init zero, CombatSystem consume/reset; no live regen found | VIOLATED ARCH-003 |
| Damage/healing results | CombatSystem + vitals | Direct hit, DoT, reactions, thorns/reflect, tribulation, heal-on-kill gọi domain mechanisms | QUESTIONABLE phase/liveness parity; primary rendering không là authority |
| Buff instances/durations/stacks | Target BuffSystem/pool + canonical tick | apply/remove/update, reaction consumption, on-hit proc | VIOLATED target/source identity ARCH-009; refresh ARCH-002 |
| Effective stats | Canonical stat assembler + effective projection | Pinia finalStats/App provider, entity base snapshot, TurnStatsRecompute | VIOLATED refresh/reset; canonical arithmetic đã có |
| Cooldown/charge/action gauge | TurnBattleSystem/TurnSkillAction | Turn action advancement/cost/charge state | QUESTIONABLE: charge skips gain/liveness phases ARCH-008/010 |
| Turn battle/result | TurnBattleSystem, terminal reward/session ops | turn engine, explicit abandon/reset/repeat ops | QUESTIONABLE: event outcome incomplete ARCH-014; ownership không hoàn toàn mất |
| Per-kill reward flags | GameManagerBattleRewardOps + BattleLootSystem | granted ID set, per-cycle reset, domain receipt grant | Healthy intended once-per-cycle structure; full defeat consumer chain thiếu |
| Stage active/completed/perfect clear | StageManager/StageWave + terminal reward ops | start/stop/repeat; victory writes progression | Feasibility suite có 4 failing assertions, chưa chứng minh impossibility |
| Raw player/progression | PlayerData + progression/realm/cultivation owners | Domain commands, player store cultivation, App lifecycle starter grant | QUESTIONABLE framework-bound assembly; không đề nghị rewrite toàn store |
| Realm/foundation/outcome | TribulationDirector + outcome services | Director terminal, useTribulation behindCurtain invokes permanent writes | VIOLATED ARCH-006 |
| Equipment membership/equipped state | EquipmentBag/EquipmentSystem | Ops/domain mutation, restore/add, explicit UI requests | Mostly coherent; restore replacement ARCH-001 |
| Slot enhancement / pity | EquipmentSlotManager / EquipmentSystem | Enhancement operation and restore | Healthy source boundary trong scope đã trace |
| Random wash/refine preview | Domain pending-operation owner | Paid preview/commit/discard/reset | Refine stronger; wash VIOLATED ARCH-011 |
| Materials/pills | MaterialBag/PillBag | Domain production/reward/quest/vendor/equipment/companion/restore qua bag APIs | Bounded APIs có; live getters vẫn cho mutable refs; UI receipts sai ARCH-012 |
| Production worker lanes/jobs | ProductionSystem | online tick, restore/offline advancement | VIOLATED online/offline time parity ARCH-007 |
| Alchemy/decompose jobs | AlchemySystem/DecomposeSystem | Start/tick/offline restore via domain ops | Source paths tương đối coherent; notifications/replacement gaps |
| Quests/daily reset/claim | QuestSystem + tick/restore reconcile | Lifecycle commands và claim operation | Healthy current query boundary; không yêu cầu mở panel để activate |
| Companion roster/pity/currency | CompanionGacha/Progression | CompanionOps pull/exchange/feed | Coherent source boundary; không exhaustive perk-combination certification |
| Save value / applied identity | SaveSystem / complete restore boundary | Snapshot getters, player.restore, manager.restore | VIOLATED ARCH-001 |
| Scene route/session | Coordinator / session domain / Phaser adapter | admitted wrapper, current-session query, adapter READY | VIOLATED identity handoff ARCH-004 |
| UI-derived fighting/manual state | Versioned read-only projection | useTurnCombatManual computed from live object | VIOLATED ARCH-005 |
| Timers/async boot/host loads | Lifecycle generation owner | useAppLifecycle, clock sources, bundle async callbacks | VIOLATED boot cancellation ARCH-013; additional gaps marked inferred |

## I. Dead / Legacy Architecture

Reachability dùng main/Electron entry roots, static + literal dynamic imports, kiểm tra registry/callers bằng source. Type-only contracts, test fixtures và code parked không bị coi là production dead code tự động. Không xóa file nào.

| Nhóm | Phân loại và bằng chứng | Quyết định audit |
|---|---|---|
| `EnemyAttackSystem`, `KiemTranOnHitSystem`, `PhapTuBattleResourceSystem`, `SkillEffectResolver`, `TheResourceSystem`, `AttackTiming` | Không reachable trong entry import graph; old combat/resource mechanisms và tests vẫn tồn tại | Candidate retirement sau xác minh toàn consumer/content/dynamic names. Không chứng minh đang có hai battle engines chạy đồng thời |
| `GameManagerTurnBattleOps.getBattle():719-720` | Live `TurnBattle as unknown as Battle` compatibility escape | Transitional unsafe contract cần migrate real callers. TurnBattle không có toàn bộ legacy `battle.player`/artifactRuntime shape |
| Legacy pill heal/buff branches / artifact HUD consumers | Một số caller vẫn kỳ vọng Battle shape; authored ordinary pills hiện không dùng legacy heal/buff path | Dormant trap/partial migration, không báo crash mọi lần uống pill. ARCH-008 là real current pill defect khác |
| CombatScene legacy `positions/cast_start/cast_complete/player_teleported` bindings | Consumer sống nhưng không live producer; new snapshot/cast bridge hoạt động | Integration finding ARCH-014; retire handler chỉ sau mapping behavior tương đương |
| `WorldMap`, HexCoordinate/HexLayout/WorldMapValidator, MeridianSystem, ZoneDotBuffs | Parked/unreached modules; tests/content contracts có thể còn giá trị | Cần owner/roadmap label live/transitional/parked, không xóa chỉ vì không import từ main |
| `GamePanel`, `SceneHeader`, `ThemedIcon`, iconRegistry, OnboardingChapter | UI entry graph không reach | Low-priority candidates; kiểm tra templates/tooling trước retire |
| EquipmentInstance.fixture, battleLootTestSetup, startAStage, combatTestHarness | Test infrastructure nằm cạnh production | Không phải abandoned gameplay system; loại khỏi deletion recommendation |
| Buff.ts, CombatArtTier, AssetValidation helpers | Type/validation/tooling có thể không runtime reachable | Runtime graph không đủ chứng minh unused export |
| Vue Router `routes: []` | Vẫn được install; browser có no-match warning; primary navigation ở coordinator | Retained bootstrap dependency debt, P3 note; không phải router thực thi gameplay |
| Supabase schema / local save factory | Remote auth/character và persistence capability khác nhau | Không gọi remote save “đã hoàn thiện” từ interface/table; ARCH-015 và deferred capability |

Type audit tìm 156 candidate escape sites qua AST, không coi 156 lỗi. Quan trọng nhất là live `as unknown as Battle`, EventBus string/generic payload không correlated, CombatScene event-binding `any`, và optional session context che migration thiếu. `Object.fromEntries` cast trong SkillRuntimeStats và frozen empty notification array không đủ tác động để thành finding. Type-check xanh không kiểm tra được những cast đã ép compiler tin contract sai.

## J. Test & Verification Analysis

### Kết quả thực thi

| Check | Kết quả | Giới hạn / artifact |
|---|---|---|
| `npm run type-check` | PASS, exit 0 | Không chứng minh semantic contracts sau unsafe casts |
| `npm run build` | PASS, exit 0; Vite build 16.94s | Có chunk-size warning; chưa package Electron |
| bundle-split guard | PASS | Entry ~835 KiB dưới gate 900; Phaser ~1.343 KiB; 21 JS chunks |
| Full Vitest | **545 files: 544 pass, 1 fail. 3.800 tests: 3.796 pass, 4 fail, 0 skipped. 290.95s** | `GameManager.perfectClear.feasibility.test.ts` là file fail |
| Architecture subset trong full run | **29 files / 116 tests đều pass** | Findings vẫn tồn tại: các guards không chứng minh live consumer parity |
| ESLint | **FAIL: 24 errors, 178 warnings**, 1.192 files sau loại diagnostic tạm | Chủ yếu unused vars/imports và style/test anys; không nâng từng lỗi lint thành architecture finding |
| `npm ls --depth=0 --json` | PASS, exit 0, không missing/invalid top-level deps | Copy dependency tree hiện có; chưa `npm ci` sạch, vulnerability/license audit không chạy |
| Existing Playwright suite | **19 cases: 14 pass, 5 fail, 0 skipped, 0 flaky; 1.175,908s (~19.6m)** | Chạy một worker, actual port5984; không retry để biến baseline thành xanh |
| Edge independent normal-UI probe | PASS cho boot/Home, start, actual scenes và ≥3 turns; **phát hiện ARCH-005** | No uncaught page errors; Google Fonts request bị network policy chặn |
| Domain diagnostics | Reproductions trong ba reviewer reports; parent tái chạy save và lethal tribulation | Dùng current production modules/catalogs, nhiều probe cố định RNG/clock. Không phải tất cả là end-user browser actions |

Vitest JSON `numTotalTestSuites` có thể tính cả nested describes; số file ở đây lấy từ `testResults.length=545` và reporter, không dùng 1.441 suite nodes làm số file.

Bốn Vitest failures là multi-hit floor 1/5/9/10: 1/5/10 thắng nhưng không perfect-clear; floor9 không đạt victory trong 5.000 steps. QA hiện hành đã ghi fixture/calibration debt. Fixture dùng solo/no-AOE synthetic damage so với floor shape thật; kết quả này không đủ chứng minh tất cả build thật không thể perfect-clear. Không sửa budget/expectation khi chưa xác định intended feasibility oracle.

### Phân loại năm E2E failures

| Test | Failure thực tế | Điều đã/chưa chứng minh |
|---|---|---|
| accessibility | Sau keyboard journey, console-error assertion thấy `ERR_NETWORK_ACCESS_DENIED` | Đã đi đến Home bằng keyboard; Edge probe xác định URL Google Fonts. Không gán lỗi navigation cho network policy |
| create-to-combat | Không thấy result modal trong 180s | Snapshot vẫn combat round10/20, 3/10 enemies; chưa đủ chứng minh permanent freeze hoặc root cause. Completion budget/real-time pacing cần điều tra |
| presentation-routing | ActiveCombat && !ActiveMain không true trong 15s; screenshot còn loading curtain | Deadline/transition run này fail. Edge independent probe sau đó chuyển đúng scene; không kết luận scene router luôn hỏng |
| tribulation-flow | Global210s timeout tại click world-announcement dòng232 | **Đã qua director terminal, route-home mount, tribulation UI unmount và presentation idle assertions.** Ảnh ở Quán Khí path-choice. Late announcement interaction chưa hoàn tất; không dùng failure này để tuyên bố route-home chưa wired |
| turn-combat-hud | Global210s timeout chờ **kết quả trận thứ hai**, dòng121 | Trận đầu có result, snapshot assertions và refight click đã qua; snapshot trận hai round15/20, 6/10 enemies. Không chứng minh refight không khởi chạy |

14 ca pass: boot fresh; idle motion capture; ba combat overlay layouts; hai error-recovery; ba ink-wash layouts; reduced-motion; save-reload; standing-slot-panel/drag; wave-VFX capture. Pass của screenshot capture không tự chứng minh toàn bộ animation semantics; visual review đã xem Home, combat desktop/Edge, failed routing và tribulation frames. Sprite/HP/gauge và layout thực có hoạt động; skill dock rỗng được nhìn thấy.

### Những test đang chứng minh ít hơn tên gọi

- Save reload E2E kiểm tra character/cultivation/seeded stones; không kiểm tra toàn payload. Unit snapshot/identity/replacement cover một số slice nên bỏ ARCH-001.
- Skill inventory parity test chuyển basic qua converter độc lập; runtime chọn static basic bỏ converter/scaling. Cần đi qua actual GameManager kit assembly.
- Production worker tests so slot count/allocation; không so earned output/deadlines ở fractional windows.
- Wash pending tests cover wrong ticket, replay, missing item; không cover replacement cùng ID, membership generation và changed protected state.
- Combat layout tests chấp nhận dock không có nội dung miễn bounds đúng. HUD E2E chuyển oracle sang snapshot events; event stream không chứng minh buttons/slots render. ARCH-005 lọt qua cả hai loại.
- Separate boot/cleanup tests không compose deferred load -> unmount -> resolve. Separate command/coordinator tests không giữ exact accepted session xuyên chuỗi.
- Adapter content-shape tests không chứng minh charged gain-Thế, duration specialization hay meaningful pill benefit trong execution thật.
- Architecture regex/import guards hữu ích nhưng không chứng minh mutation ordering, terminal uniqueness, full-value replacement hoặc multi-source reaction consumption.

### Performance, dependency và runtime gaps

Build entry 854.76 kB, Phaser 1.375,57 kB (decimal output); warning bundle lớn tồn tại nhưng gate hiện hành pass. Dữ liệu và vendor đã tách chunks. Không có FPS/heap/long-session trace định lượng trong audit; không báo memory leak hoặc yêu cầu rewrite chỉ từ kích thước bundle. Combat preload profile batch và resident textures là ứng viên đo load/memory tiếp theo. Vue RC/major dependencies là reproducibility consideration, không phải defect chỉ vì version mới.

Chưa chạy: deployed Supabase contract, account-bound cloud save, disposable SQL integration, Electron packaged suspend/resume/quit-flush, full host recreation/HMR/asset-failure matrix, mobile touch/accessibility toàn bộ panels, gameplay hàng giờ và mọi tổ hợp late-realm content. Chrome/Edge tooling thực tế dùng được trong worktree này; không áp dụng blanket “P14 deferred”. Các gap trên được nêu cụ thể thay vì gọi mọi runtime check đã pass.

## K. Cross-System Root Causes

| Nguyên nhân chung | Findings | Hàm ý sửa |
|---|---|---|
| Migration dừng ở primitive hoặc file extraction, chưa migrate actual consumers | ARCH-002/003/008/012/014 | Dò production entry -> resolved outcome -> downstream consumer; unit helper xanh không đủ |
| Identity chưa biểu diễn đủ lifetime/value | ARCH-001/004/009/011/013 | Full save identity, accepted SessionRef, matched buff instance, item membership generation, boot generation là các contract riêng; không gộp thành một global token |
| Outcome thiếu một terminal/settlement authority xuyên phase | ARCH-006/010/014 | Một terminal fact, explicit once-only settlement, recheck liveness sau phase có thể gây chết; audio/VFX chỉ consume |
| State refresh được ngầm giả định từ reference | ARCH-002/005 | Plain mutable domain object cần explicit versioned projection và stat invalidation, không dựa vào Vue deep tracking không tồn tại |
| Sharing formula bị nhầm với sharing semantics | ARCH-007, ARCH-002 | Shared worker allocator vẫn chưa tạo online/offline parity; shared StatCalculator vẫn chưa tạo refresh parity |
| Test oracle gần implementation hơn player invariant | Hầu hết findings | Test production factories, domain + consumer effects và race boundaries; bổ sung cùng mission sửa, không dồn tất cả sang cuối |
| Client/schema/capability chưa được kiểm tra chung | ARCH-015 và remote-save gap | Kiểm tra deployable server implementation trước claim online capability |

Không có bằng chứng đủ để kết luận phải thay GameManager hoặc EventBus toàn bộ. GameManager lớn một phần do composition; EventBus phần lớn là notification hợp lệ. Sai ở những contract cụ thể nêu trên, không ở việc dùng class/manager nói chung.

## L. Architecture Verdict

**REPAIR BEFORE MAJOR FEATURES.**

Có thể boot, tạo nhân vật, vào Home, render/chạy combat, lưu/reload cơ bản; nhiều primitive đã headlessly testable, asset catalog/coordinator/clock/vitals/bag owners hiện hữu. Vì vậy chưa đủ căn cứ gọi toàn bộ project UNSAFE hoặc đòi rewrite.

Tuy nhiên thêm major feature lúc này sẽ nhân rộng các lỗi nền: snapshot không detached/replacement, passive stats stale, MP/Ward không thực hiện regen, offline cấp output sớm, accepted session bị mất, dead tribulation có thể thắng, manual controls không hiện. Đây là sai trạng thái và contract thực thi đã xác nhận, không phải style debt có thể bỏ qua chỉ vì 3.796 test pass.

Readiness của HEAD **không đạt**: full Vitest, lint, E2E chưa xanh và findings xác nhận vẫn còn nguyên vì nhiệm vụ audit. Audit deliverable có thể hoàn tất mà game chưa PASS WITH EVIDENCE. Không áp dụng các gate “sửa xong/simplify/review production” như một claim triển khai; ba independent source reviews đều đề nghị sửa các lỗi đã nêu.

## M. Repair Roadmap

Mỗi mission tạo regression evidence trước sửa, dùng smallest coherent owner, migrate consumer thật, simplify/review/verification theo AGENTS. Không commit/merge khi chưa được người dùng cho phép. Những mission dưới là đề xuất thực thi, không phải thay đổi đã làm.

| Mission | Objective / invariant | Systems / dependency | Risk / verification | MUST NOT change |
|---|---|---|---|---|
| M1 — Complete save value | Mọi GameSave slice detached; full identity; replacement/reset; retry không skip partial apply | SaveSystem, player restore, manager owners; bắt đầu độc lập | High. Real-manager per-slice matrix; empty/changed/same-ID payload, input/output isolation, repeated restore, injected failure; full gates + save E2E | Không làm old dev-save migration hoặc sửa economy rules |
| M2 — Bind generated operations | Wash result chỉ commit đúng item lifetime/session, eligibility còn hợp lệ, once-only | EquipmentWash/Bag/Refine precedent; cùng session reset contract M1 | Medium. Same-ID replacement, remove-add, locked/favorite, changed item, replay, restore invalidation | Không đổi roll odds, forge budget/cost hoặc UI design |
| M3 — Preserve admitted session | Accepted SessionRef đến renderer và READY không bị đoán lại | createGamePresentation/coordinator/adapter; độc lập M1 | High. Terminal combat -> Home -> tribunal, stale/retry/duplicate READY, direct destination entry; full + actual Phaser E2E | Không thêm SceneManager/router mới; không thay reward semantics |
| M4 — Own boot/host lifecycle | Stop/dispose invalidate mọi async continuation, timers và pending loader publication | useAppLifecycle, clock/host owners; M3 contract giúp fault tests | Medium-high. Deferred load/unmount, double boot, host import fail/retry, loader replacement, RAF stop; browser recovery | Không tạo clock thứ hai hoặc rewrite resource policy |
| M5 — Make tribulation terminal unique | Lethal final strike chỉ có defeat, một outcome identity | TribulationDirector; độc lập | Medium. Authored chapters, defense105 repro, last-frame death, all terminal transitions | Không đổi chapter/damage/reward balance |
| M6 — Settle outcome in domain | Outcome đã resolve được commit đúng một lần độc lập curtain; presentation consume receipt | Outcome services + useTribulation/coordinator; sau M3/M5 | High. Curtain failure/retry/reload timing, duplicate settlement, reward/penalty exactness; domain + browser | Không chuyển pacing authority cho rendering, không mở rộng progression scope |
| M7 — Unify stat assembly/refresh | Runtime modifier thay đổi có effective stats đúng; reset trước start snapshot | Player/stat/equipment/passive/buff consumers; độc lập M1 nhưng coordinate restore | High. Real catalogs, equipment/realm/path/talent buffs, first counter, CC/charge turns, next-battle leakage; full | Không rebalance tốc độ, derive attributes hai lần hoặc thêm formula copy |
| M8 — Complete combat resource and turn phases | HP/MP/Ward clocks rõ; lethal status chặn action; charged completion giữ resource contract | TurnBattleSystem/TurnSkillAction/vitals; sau M7 characterization | High. Mana/Ward real kit, lethal DoT+regen+charge, normal/charged gain-Thế parity, no resurrection by ordinary heal | Không đổi cost/regen values hoặc local skill-ID patches |
| M9 — Preserve buff identity | Target pool đúng, reaction consume đúng matched instances | BuffSystem/TurnReaction; sau M7 refresh contract | Medium. Multiple sources, self/target CC, stacking/refresh/removal, repeated reaction | Không đổi element recipes/damage balance |
| M10 — Validate authored execution | Basic scaling/duration/pill support sống tới production outcome | SkillSystem/kit adapter/content pipeline; sau M8/M9 | Medium. Real kit matrix, leveled basic, specialization duration, every authored consumable meaningful or explicitly unavailable | Không tự phục hồi HP pill đã bị loại hoặc redesign skill trees |
| M11 — Advance production per lane | Online/offline bảo toàn completed cycles/deadline/remainder | ProductionSystem/Offline/WorkerAllocator; có thể chạy song song M3-M10 | High economy risk. Fractional/multilane/capped offline parity, repeated restore, exact receipt totals | Không đổi yield/cycle durations/offline cap như workaround |
| M12 — Finish UI/event consumers | UI fighting/manual projection đúng; terminal facts đủ; delivered/overflow đúng | useTurnCombatManual/log, reward terminal, audio/scene bindings, TickOps; sau owner contract tương ứng | Medium. Same-object stateVersion regression + real controls; victory/defeat/abandon listeners; full-stack notifications | Không thêm local timers, bỏ guard test, hoặc thay domain outcome từ UI |
| M13 — Retire proven compatibility | Live callers dùng TurnBattle contracts thật; legacy handlers/modules có trạng thái rõ | getBattle callers, old event/adapters; sau M3/M8/M12 | Medium. Consumer inventory + type errors thay double cast; parity before retirement | Không xóa parked/type/test-only code chỉ theo reachability |
| M14 — Reconcile remote capability | One-talent client/SQL/RPC tương thích; remote save scope được xác định rõ | Character services/SQL; chỉ trước remote rollout | High boundary risk. Disposable DB RPC + auth/account isolation + capability tests | Không chỉnh deployed DB/secrets hoặc claim cloud save từ interface |

M1, M3, M5, M7 và M11 là các đầu nhánh ưu tiên cao có thể được lập task độc lập. Mỗi task phải đem theo integration coverage của chính nó. Sau các owner repairs, chạy lại full gates, xử lý lint baseline và xác định E2E timing/interaction oracles trước readiness; không tăng timeout hoặc bỏ assertion để né lỗi chưa chẩn đoán. Feature mới chỉ mở sau các P1 liên quan được đóng với evidence và aggregate review, không đợi một rewrite toàn repo.

## N. Top 10 Highest-Leverage Actions

1. Đóng full snapshot/restore boundary cho **mọi slice**, kèm replacement và detachment tests.
2. Giữ accepted SessionRef xuyên command -> coordinator -> scene/READY; chứng minh combat-terminal -> tribunal.
3. Chặn defeat -> victory ở last tribulation strike và đưa once-only settlement về domain.
4. Hợp nhất stat assembly/refresh; reset passive trước snapshot trận mới.
5. Hoàn tất turn resource/liveness/completion contract cho HP/MP/Ward, DoT và charged attacks.
6. Sửa production theo worker lane, chứng minh exact online/offline yield parity ở partial windows.
7. Sửa versioned UI projections và assert skill/manual controls thật trong browser.
8. Bảo toàn identity của target buffs, reaction ingredients và paid equipment tickets.
9. Kiểm tra authored content qua production factories: basic scaling, specialization duration, pill support; migrate receipt/event consumers còn sót.
10. Thay các test oracle chưa đủ bằng state + consumer evidence; phân loại/fix baseline failures, retire compatibility có chứng minh và kiểm tra remote schema trước online rollout.

Không triển khai sửa nào trong audit này. Production HEAD giữ nguyên. Kiểm tra checkout gốc cuối audit thấy thêm untracked `game/home.png` và `game/panel-nhanvat.png` do hoạt động ngoài worktree audit; không sửa/xóa chúng. Reports, test outputs và ảnh ở worktree audit là handoff có chủ đích. Các đề xuất resource granularity/cache eviction, balance speed-affix, old-save compatibility và remote-save product scope phải được xác định riêng, không lén ghép vào repair missions.
