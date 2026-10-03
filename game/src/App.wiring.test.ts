// Wiring guard - the test that would have caught the 2026-09-05 freeze
// (commit d6d9a1d, "lifecycle idempotence").
//
// Boi canh: refactor do extract boot/tick logic cua App.vue sang
// useAppLifecycle.ts, nhung lam rot loi goi startTickLoop() - ham van
// TON TAI, ESLint khong keu (script setup: moi top-level function coi
// nhu "co the" dung o template nen linter khong the khang dinh orphan),
// va toan bo 2651 unit test van xanh vi test goi thang
// gameManager.tickOps.update() chu khong di qua App.vue. Ket qua: game dung
// hinh vo thoi han trong browser that, zero console error (ham khong
// bao gio chay thi khong the throw). Xem
// .superpowers/sdd/2026-09-05-combat-art-roster-tranphap/freeze-rootcause.md
// de doc day du co che.
//
// File nay KHONG chung minh game chay dung (do la viec cua integration
// test/E2E ma agent khac da them) - no chi chung minh KHONG co ham nao
// trong App.vue bi "mo coi" (dinh nghia nhung zero reference that), va
// moi capability ma useAppLifecycle() tra ve deu co noi tieu thu (hoac
// duoc allowlist tuong minh kem ly do). Day la guard tinh, khong can
// browser/Playwright - chay trong `vitest` gate binh thuong.
//
// PHAM VI CO Y HEP: chi App.vue + useAppLifecycle.ts (app shell +
// lifecycle composable - dung 2 file lien quan toi regression nay).
// KHONG mo rong ra moi SFC trong repo - mot sweep toan repo se on (nhieu
// component hop le co prop/callback chi dung noi bo theo cach phuc tap
// hon heuristic o day xu ly dung) va cham, dan toi nguy co bi tat di.
// Neu mot class bug tuong tu xuat hien o composable/SFC khac trong
// tuong lai, hay viet guard rieng cho ranh gioi do thay vi noi rong
// file nay.
//
// GIOI HAN QUAN TRONG - doc truoc khi tin tuong file nay: chinh DONG SUA
// loi freeze (`startTickLoop(tick)` nam BEN TRONG bootGame() o
// useAppLifecycle.ts) KHONG duoc guard tinh nay che. Layer 1 chi soi ham
// top-level cua App.vue; Layer 2 chi hoi "member ma useAppLifecycle()
// TRA VE co ai tieu thu khong" - mot loi goi noi bo trong than composable
// khong roi vao ca hai. Neu ai xoa dong do, file nay van xanh (entry
// allowlist cua `startTickLoop` o duoi cung van xanh, vi no chua bao gio
// kiem tra loi goi ay). Thu duy nhat bat duoc la test HANH VI
// 'bootGame thanh cong -> tick loop tu khoi dong' trong
// useAppLifecycle.test.ts. Hai file phai cung ton tai moi du luoi -
// dung xoa test ben do vi nghi rang guard nay da lo.

// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readFileSync } from 'node:fs'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parse as parseSFC } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import { bindPresentationActive } from './presentation/bindPresentationActive'

const APP_VUE_PATH = fileURLToPath(new URL('./App.vue', import.meta.url))
const LIFECYCLE_TS_PATH = fileURLToPath(new URL('./composables/useAppLifecycle.ts', import.meta.url))

/** Mot function top-level ung vien, kem node AST de tinh vung "than ham" loai tru self-reference. */
interface TopLevelFunctionCandidate {
  name: string
  /** Statement bao tron declaration - dung de loai tru occurrence NAM TRONG chinh no (goi de quy, JSDoc...). */
  span: { start: number; end: number }
}

/**
 * Parse App.vue, tach rieng noi dung <script setup> va <template> tho.
 * Dung @vue/compiler-sfc thay vi regex thu cong tren toan file - bien
 * chinh xac giua script/template/style da duoc Vue tu parse, tranh
 * truong hop mot the template chua chuoi trong giong code script.
 */
function readAppVueBlocks(): { scriptSetup: string; template: string } {
  const raw = readFileSync(APP_VUE_PATH, 'utf-8')
  const { descriptor } = parseSFC(raw, { filename: APP_VUE_PATH })

  if (!descriptor.scriptSetup) {
    throw new Error('App.vue không có <script setup> — guard này giả định cấu trúc đó, cần xem lại.')
  }

  return {
    scriptSetup: descriptor.scriptSetup.content,
    // Template raw source (chua compile) - du de tim ten identifier xuat
    // hien dang @click="foo", :prop="foo", {{ foo }}, shorthand @foo...
    // ma khong can dung full template AST.
    template: descriptor.template?.content ?? '',
  }
}

/** Bo HTML comment (<!-- ... -->) khoi template tho - comment co the nhac ten ham ma khong that su dung no. */
function stripHtmlComments(template: string): string {
  return template.replace(/<!--[\s\S]*?-->/g, '')
}

function parseScript(content: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

/**
 * Thu thap function top-level trong <script setup>: ca `function foo() {}`
 * va `const foo = () => {}` / `const foo = function () {}`. CHI xet
 * statement o top level (sourceFile.statements) - khop dung thu script
 * setup expose cho template (Vue chi auto-expose binding top-level).
 */
function collectTopLevelFunctions(sourceFile: ts.SourceFile): TopLevelFunctionCandidate[] {
  const candidates: TopLevelFunctionCandidate[] = []

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      candidates.push({
        name: statement.name.text,
        span: { start: statement.getStart(sourceFile), end: statement.getEnd() },
      })
      continue
    }

    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name)
          && decl.initializer
          && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          candidates.push({
            name: decl.name.text,
            // Dung span ca VariableStatement (khong chi initializer) de
            // loai tru luon identifier lap trong cung khai bao (hiem khi
            // xay ra, nhung an toan hon khi chi dung span initializer).
            span: { start: statement.getStart(sourceFile), end: statement.getEnd() },
          })
        }
      }
    }
  }

  return candidates
}

/**
 * Tim moi Identifier node co text === name trong toan bo sourceFile, tru
 * nhung occurrence NAM TRONG excludeSpan (chinh khai bao - ke ca goi de
 * quy trong than ham). Dung AST (khong phai regex tren text) vi AST tu
 * nhien bo qua comment - comment nhac ten ham khong duoc tinh la
 * "reference", tranh false negative (bug goc: neu comment nhac ten ham
 * du de qua guard, guard se khong bat duoc orphan that).
 */
function hasExternalIdentifierReference(
  sourceFile: ts.SourceFile,
  name: string,
  excludeSpan: { start: number; end: number },
): boolean {
  let found = false

  const visit = (node: ts.Node): void => {
    if (found) {
      return
    }

    if (ts.isIdentifier(node) && node.text === name) {
      const pos = node.getStart(sourceFile)
      if (pos < excludeSpan.start || pos >= excludeSpan.end) {
        found = true
        return
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return found
}

/** Regex word-boundary tren template tho (da strip comment) - du bat @click="foo", :prop="foo", {{ foo() }}, shorthand @foo. */
function isReferencedInTemplate(template: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`).test(stripHtmlComments(template))
}

describe('App.vue wiring guard — no orphaned top-level functions', () => {
  const { scriptSetup, template } = readAppVueBlocks()
  const sourceFile = parseScript(scriptSetup, 'App.vue.script-setup.ts')
  const candidates = collectTopLevelFunctions(sourceFile)

  it('found at least one top-level function to check (guard sanity — file structure changed?)', () => {
    // Neu con so nay ve 0, co the App.vue da doi cau truc script setup
    // (vi du chuyen het logic ra composable) - khong phai guard fail,
    // nhung can review lai xem guard con y nghia o day khong.
    expect(candidates.length).toBeGreaterThan(0)
  })

  it.each(candidates.map((c) => [c.name, c] as const))(
    'function "%s" is referenced somewhere real (script or template), not orphaned',
    (name, candidate) => {
      const referencedInScript = hasExternalIdentifierReference(sourceFile, name, candidate.span)
      const referencedInTemplate = isReferencedInTemplate(template, name)

      expect(
        referencedInScript || referencedInTemplate,
        `Hàm "${name}" được định nghĩa ở App.vue nhưng KHÔNG có nơi nào ` +
          `khác (script hay template) tham chiếu tới nó. Đây chính xác là ` +
          `lớp bug đã gây freeze toàn bộ game 2026-09-05 (startTickLoop() ` +
          `bị extract dở dang, không còn ai gọi — xem freeze-rootcause.md). ` +
          `Vue <script setup> KHÔNG tree-shake hàm top-level không dùng và ` +
          `ESLint không thể phát hiện (mọi top-level binding coi như ` +
          `possibly-exposed-to-template), nên hàm "mồ côi" này sẽ không ` +
          `gây lỗi biên dịch/lint nào — chỉ lặng lẽ không bao giờ chạy. ` +
          `Nếu đây là cố ý (ví dụ hàm chỉ tồn tại cho mục đích tương lai ` +
          `gần), hãy xoá nó hoặc thực sự wire nó vào — đừng để mồ côi.`,
      ).toBe(true)
    },
  )
})

// --- Layer 2: moi capability useAppLifecycle() tra ve phai co consumer ---

/**
 * Tim function `useAppLifecycle` trong useAppLifecycle.ts, doc object
 * literal cua `return { ... }` cuoi cung trong than ham, tra ve danh
 * sach ten property (ca shorthand `{ foo }` lan `{ foo: bar }` - lay ten
 * property, khong phai ten bien cuc bo, vi do la ten PUBLIC API ma
 * App.vue tieu thu qua `lifecycle.<ten>`).
 */
function collectLifecycleReturnMembers(sourceFile: ts.SourceFile): string[] {
  let lifecycleFn: ts.FunctionDeclaration | undefined

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'useAppLifecycle') {
      lifecycleFn = node
    }
  })

  if (!lifecycleFn?.body) {
    throw new Error('Không tìm thấy function useAppLifecycle() ở top level — composable đã đổi cấu trúc, cần cập nhật guard này.')
  }

  // CHI xet statement top-level trong THAN cua useAppLifecycle (khong de
  // quy vao cac function long ben trong nhu bootGame()) - bootGame() cung
  // co nhieu `return { status: ... }` rieng cua no (BootOutcome), de quy
  // bua se vo nham object literal do thay vi object that su duoc
  // useAppLifecycle() tra ra cho caller.
  const returnStatement = lifecycleFn.body.statements.find(
    (s): s is ts.ReturnStatement =>
      ts.isReturnStatement(s) && s.expression !== undefined && ts.isObjectLiteralExpression(s.expression),
  )

  if (!returnStatement || !ts.isObjectLiteralExpression(returnStatement.expression!)) {
    throw new Error(
      'Không tìm thấy `return { ... }` top-level trong thân useAppLifecycle() — composable đã đổi cấu trúc, cần cập nhật guard này.',
    )
  }

  const members = returnStatement.expression.properties
    .map((prop) => {
      if (ts.isShorthandPropertyAssignment(prop)) {
        return prop.name.text
      }
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        return prop.name.text
      }
      return undefined
    })
    .filter((n): n is string => n !== undefined)

  return members
}

/**
 * Members co y KHONG duoc App.vue tieu thu truc tiep - moi entry BAT
 * BUOC kem ly do. Day la escape hatch tuong minh: roi vao danh sach nay
 * la mot QUYET DINH co the review duoc trong PR diff, khong phai mot lo
 * hong am tham cua guard.
 */
const INTENTIONALLY_UNWIRED_LIFECYCLE_MEMBERS: Record<string, string> = {
  // Fix cho chinh bug freeze 2026-09-05: bootGame() gio TU goi
  // startTickLoop(tick) ben trong no (xem useAppLifecycle.ts, comment
  // "Fix (2026-09-06)") - App.vue chi can truyen `tick` qua deps, khong
  // con tu goi startTickLoop() nua. Method van duoc export vi
  // useAppLifecycle.test.ts goi truc tiep de assert tinh idempotent
  // (goi 2 lan khong leak interval thu 2).
  startTickLoop: 'bootGame() tự gọi nội bộ (fix 2026-09-06); export chỉ để useAppLifecycle.test.ts assert idempotency trực tiếp.',
  // Getter debug/test-only (chinh composable tu chu thich "Test/mount-
  // tracing" ngay tai diem khai bao) - App.vue khong can doc handle so
  // nguyen cua interval, chi useAppLifecycle.test.ts assert qua day.
  getTickHandle: 'Debug/test-only getter — chỉ useAppLifecycle.test.ts đọc để assert interval handle tồn tại/bị clear.',
  getAutosaveHandle: 'Debug/test-only getter — chỉ useAppLifecycle.test.ts đọc để assert interval handle tồn tại/bị clear.',
  // R5 (AR-14 / Law A7) - investBodyChapter() auto-invests directly in
  // domain tick and is no longer gated on presentation particle arrival or
  // the 2,000ms headless timeout fallback.
  consumeEssenceArrival: 'R5 (AR-14 / Law A7): investBodyChapter() auto-invests directly in domain tick and is no longer gated on presentation arrival.',
  isEssenceHeadlessTimedOut: 'R5 (AR-14 / Law A7): progression no longer waits for a 2,000ms headless presentation timeout fallback.',
  clearEssenceEmitted: 'R5 (AR-14 / Law A7): retired along with essence arrival gating.',
  // B1-D - the online-authority pause flag is driven by the controller's
  // onPause/onResume wiring, not by App.vue reads; the getter exists for
  // useAppLifecycle.test.ts to assert the pause actually latched.
  isSimPaused: 'B1-D: observed via the authority controller pause/resume wiring; exported so useAppLifecycle.test.ts can assert the latch.',
}

describe('useAppLifecycle() exports have a consumer in App.vue', () => {
  const lifecycleSource = readFileSync(LIFECYCLE_TS_PATH, 'utf-8')
  const lifecycleSourceFile = parseScript(lifecycleSource, 'useAppLifecycle.ts')
  const members = collectLifecycleReturnMembers(lifecycleSourceFile)

  const { scriptSetup } = readAppVueBlocks()
  const appSourceFile = parseScript(scriptSetup, 'App.vue.script-setup.ts')

  it('found lifecycle members to check (guard sanity)', () => {
    expect(members.length).toBeGreaterThan(0)
  })

  it.each(members)('member "%s" is either consumed via lifecycle.<member>(...) in App.vue, or explicitly allowlisted', (name) => {
    if (name in INTENTIONALLY_UNWIRED_LIFECYCLE_MEMBERS) {
      // Co y bo qua - ly do da ghi trong INTENTIONALLY_UNWIRED_LIFECYCLE_MEMBERS o tren.
      return
    }

    // App.vue dung dang `const lifecycle = useAppLifecycle(...)` roi goi
    // property (lifecycle.foo), KHONG destructure - tim PropertyAccess
    // `lifecycle.<name>` bat ky dau trong script. AST-based (khong phai
    // text regex) nen comment nhac ten member khong tinh la consumer.
    let consumed = false

    const visit = (node: ts.Node): void => {
      if (consumed) {
        return
      }
      if (
        ts.isPropertyAccessExpression(node)
        && ts.isIdentifier(node.expression)
        && node.expression.text === 'lifecycle'
        && node.name.text === name
      ) {
        consumed = true
        return
      }
      ts.forEachChild(node, visit)
    }

    visit(appSourceFile)

    expect(
      consumed,
      `useAppLifecycle() trả về "${name}" nhưng App.vue không hề gọi ` +
        `lifecycle.${name}(...) ở đâu cả — capability này bị "extract ra ` +
        `composable rồi quên wire lại", đúng lớp bug đã gây freeze toàn bộ ` +
        `game 2026-09-05. Nếu member này cố ý không cần App.vue dùng ` +
        `(vd: chỉ phục vụ test), thêm nó vào ` +
        `INTENTIONALLY_UNWIRED_LIFECYCLE_MEMBERS kèm lý do rõ ràng — ` +
        `KHÔNG được lặng lẽ bỏ qua.`,
    ).toBe(true)
  })
})

// --- RC-3: presentationActive has exactly one owner (bindPresentationActive) ---

describe('bindPresentationActive — presentationActive has exactly one owner', () => {
  it('activates combat playback exactly when the combat route is committed', () => {
    const calls: boolean[] = []
    const gameManager = { setPresentationActive: (v: boolean) => calls.push(v) }
    const listeners: Array<(s: any) => void> = []
    const coordinator = { subscribe: (l: (s: any) => void) => { listeners.push(l); return () => {} } }

    bindPresentationActive(coordinator as any, gameManager as any)

    listeners[0]!({ currentRoute: 'home', currentSession: null })
    listeners[0]!({ currentRoute: 'combat', currentSession: { kind: 'combat', sessionId: 1 } })
    listeners[0]!({ currentRoute: 'combat', currentSession: { kind: 'combat', sessionId: 1 } })
    listeners[0]!({ currentRoute: 'home', currentSession: null })

    expect(calls).toEqual([false, true, false])
  })
})

// --- Mission G Task 40: huy_quyen starter backfill has exactly one seam ---

/**
 * onRestoreOk grants starter skills to old saves. huy_quyen once had TWO
 * grant blocks (the mortal-skill loop + a second standalone block) - a
 * no-op via the has() guard, but duplicated intent. This guard pins one
 * seam: the 'huy_quyen' literal may appear at most once inside the
 * onRestoreOk callback.
 */
describe('onRestoreOk starter backfill — huy_quyen granted through one seam', () => {
  const { scriptSetup } = readAppVueBlocks()
  const appSourceFile = parseScript(scriptSetup, 'App.vue.script-setup.ts')

  function findOnRestoreOkBody(): ts.Node {
    let found: ts.Node | undefined
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node)
        && ts.isIdentifier(node.name)
        && node.name.text === 'onRestoreOk'
        && ts.isArrowFunction(node.initializer)
      ) {
        found = node.initializer.body
        return
      }
      ts.forEachChild(node, visit)
    }
    visit(appSourceFile)
    if (!found) throw new Error('onRestoreOk callback not found in App.vue — wiring changed?')
    return found
  }

  it("the 'huy_quyen' literal appears exactly once inside onRestoreOk", () => {
    const body = findOnRestoreOkBody()
    let count = 0
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) && node.text === 'huy_quyen') count += 1
      ts.forEachChild(node, visit)
    }
    visit(body)
    expect(count).toBe(1)
  })
})

// --- BETA-CREATION: the creation metadata is consumed exactly once ---

/**
 * pendingCreationMetadata is a module-slot bridging the creation screen's
 * emit (or the canonical character the create_character RPC committed) to
 * the boot transaction. If onNewCharacter reads it without clearing, a
 * second callback invocation would silently reuse stale metadata. This
 * guard pins the consume-once order inside onNewCharacter: read -> clear
 * -> use.
 */
describe('onNewCharacter creation metadata - consume-once', () => {
  const { scriptSetup } = readAppVueBlocks()
  const appSourceFile = parseScript(scriptSetup, 'App.vue.script-setup.ts')

  function findOnNewCharacterBody(): ts.Node {
    let found: ts.Node | undefined
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node)
        && ts.isIdentifier(node.name)
        && node.name.text === 'onNewCharacter'
        && ts.isArrowFunction(node.initializer)
      ) {
        found = node.initializer.body
        return
      }
      ts.forEachChild(node, visit)
    }
    visit(appSourceFile)
    if (!found) throw new Error('onNewCharacter callback not found in App.vue - wiring changed?')
    return found
  }

  it('clears the module slot after reading it and before the grant transaction', () => {
    const body = findOnNewCharacterBody()
    let readPos = -1
    let clearPos = -1
    let usePos = -1
    const visit = (node: ts.Node): void => {
      // read: pendingCreationMetadata referenced anywhere (the ?:
      // fallback in `const resolved = metadata ? ... : pendingCreationMetadata`)
      if (
        readPos < 0
        && ts.isIdentifier(node)
        && node.text === 'pendingCreationMetadata'
        && !(ts.isBinaryExpression(node.parent) && node.parent.left === node)
      ) readPos = node.getStart(appSourceFile)
      // clear: pendingCreationMetadata = undefined
      if (
        ts.isBinaryExpression(node)
        && ts.isIdentifier(node.left)
        && node.left.text === 'pendingCreationMetadata'
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.right)
        && node.right.text === 'undefined'
      ) clearPos = node.getStart(appSourceFile)
      // use: initializeCharacter(resolved, {...})
      if (
        ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && node.expression.text === 'initializeCharacter'
      ) usePos = node.getStart(appSourceFile)
      ts.forEachChild(node, visit)
    }
    visit(body)
    expect(readPos).toBeGreaterThanOrEqual(0)
    expect(clearPos).toBeGreaterThan(readPos)
    expect(usePos).toBeGreaterThan(clearPos)
  })
})
