// Wiring guard — the test that would have caught the 2026-09-05 freeze
// (commit d6d9a1d, "lifecycle idempotence").
//
// Bối cảnh: refactor đó extract boot/tick logic của App.vue sang
// useAppLifecycle.ts, nhưng làm rớt lời gọi startTickLoop() — hàm vẫn
// TỒN TẠI, ESLint không kêu (script setup: mọi top-level function coi
// như "có thể" dùng ở template nên linter không thể khẳng định orphan),
// và toàn bộ 2651 unit test vẫn xanh vì test gọi thẳng
// gameManager.update() chứ không đi qua App.vue. Kết quả: game đứng
// hình vô thời hạn trong browser thật, zero console error (hàm không
// bao giờ chạy thì không thể throw). Xem
// .superpowers/sdd/2026-09-05-combat-art-roster-tranphap/freeze-rootcause.md
// để đọc đầy đủ cơ chế.
//
// File này KHÔNG chứng minh game chạy đúng (đó là việc của integration
// test/E2E mà agent khác đã thêm) — nó chỉ chứng minh KHÔNG có hàm nào
// trong App.vue bị "mồ côi" (định nghĩa nhưng zero reference thật), và
// mọi capability mà useAppLifecycle() trả về đều có nơi tiêu thụ (hoặc
// được allowlist tường minh kèm lý do). Đây là guard tĩnh, không cần
// browser/Playwright — chạy trong `vitest` gate bình thường.
//
// PHẠM VI CỐ Ý HẸP: chỉ App.vue + useAppLifecycle.ts (app shell +
// lifecycle composable — đúng 2 file liên quan tới regression này).
// KHÔNG mở rộng ra mọi SFC trong repo — một sweep toàn repo sẽ ồn (nhiều
// component hợp lệ có prop/callback chỉ dùng nội bộ theo cách phức tạp
// hơn heuristic ở đây xử lý đúng) và chậm, dẫn tới nguy cơ bị tắt đi.
// Nếu một class bug tương tự xuất hiện ở composable/SFC khác trong
// tương lai, hãy viết guard riêng cho ranh giới đó thay vì nới rộng
// file này.

// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readFileSync } from 'node:fs'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parse as parseSFC } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

const APP_VUE_PATH = fileURLToPath(new URL('./App.vue', import.meta.url))
const LIFECYCLE_TS_PATH = fileURLToPath(new URL('./composables/useAppLifecycle.ts', import.meta.url))

/** Một function top-level ứng viên, kèm node AST để tính vùng "thân hàm" loại trừ self-reference. */
interface TopLevelFunctionCandidate {
  name: string
  /** Statement bao trọn declaration — dùng để loại trừ occurrence NẰM TRONG chính nó (gọi đệ quy, JSDoc...). */
  span: { start: number; end: number }
}

/**
 * Parse App.vue, tách riêng nội dung <script setup> và <template> thô.
 * Dùng @vue/compiler-sfc thay vì regex thủ công trên toàn file — biên
 * chính xác giữa script/template/style đã được Vue tự parse, tránh
 * trường hợp một thẻ template chứa chuỗi trông giống code script.
 */
function readAppVueBlocks(): { scriptSetup: string; template: string } {
  const raw = readFileSync(APP_VUE_PATH, 'utf-8')
  const { descriptor } = parseSFC(raw, { filename: APP_VUE_PATH })

  if (!descriptor.scriptSetup) {
    throw new Error('App.vue không có <script setup> — guard này giả định cấu trúc đó, cần xem lại.')
  }

  return {
    scriptSetup: descriptor.scriptSetup.content,
    // Template raw source (chưa compile) — đủ để tìm tên identifier xuất
    // hiện dạng @click="foo", :prop="foo", {{ foo }}, shorthand @foo...
    // mà không cần dựng full template AST.
    template: descriptor.template?.content ?? '',
  }
}

/** Bỏ HTML comment (<!-- ... -->) khỏi template thô — comment có thể nhắc tên hàm mà không thật sự dùng nó. */
function stripHtmlComments(template: string): string {
  return template.replace(/<!--[\s\S]*?-->/g, '')
}

function parseScript(content: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

/**
 * Thu thập function top-level trong <script setup>: cả `function foo() {}`
 * và `const foo = () => {}` / `const foo = function () {}`. CHỈ xét
 * statement ở top level (sourceFile.statements) — khớp đúng thứ script
 * setup expose cho template (Vue chỉ auto-expose binding top-level).
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
            // Dùng span cả VariableStatement (không chỉ initializer) để
            // loại trừ luôn identifier lặp trong cùng khai báo (hiếm khi
            // xảy ra, nhưng an toàn hơn khi chỉ dùng span initializer).
            span: { start: statement.getStart(sourceFile), end: statement.getEnd() },
          })
        }
      }
    }
  }

  return candidates
}

/**
 * Tìm mọi Identifier node có text === name trong toàn bộ sourceFile, trừ
 * những occurrence NẰM TRONG excludeSpan (chính khai báo — kể cả gọi đệ
 * quy trong thân hàm). Dùng AST (không phải regex trên text) vì AST tự
 * nhiên bỏ qua comment — comment nhắc tên hàm không được tính là
 * "reference", tránh false negative (bug gốc: nếu comment nhắc tên hàm
 * đủ để qua guard, guard sẽ không bắt được orphan thật).
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

/** Regex word-boundary trên template thô (đã strip comment) — đủ bắt @click="foo", :prop="foo", {{ foo() }}, shorthand @foo. */
function isReferencedInTemplate(template: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`).test(stripHtmlComments(template))
}

describe('App.vue wiring guard — no orphaned top-level functions', () => {
  const { scriptSetup, template } = readAppVueBlocks()
  const sourceFile = parseScript(scriptSetup, 'App.vue.script-setup.ts')
  const candidates = collectTopLevelFunctions(sourceFile)

  it('found at least one top-level function to check (guard sanity — file structure changed?)', () => {
    // Nếu con số này về 0, có thể App.vue đã đổi cấu trúc script setup
    // (ví dụ chuyển hết logic ra composable) — không phải guard fail,
    // nhưng cần review lại xem guard còn ý nghĩa ở đây không.
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

// --- Layer 2: mọi capability useAppLifecycle() trả về phải có consumer ---

/**
 * Tìm function `useAppLifecycle` trong useAppLifecycle.ts, đọc object
 * literal của `return { ... }` cuối cùng trong thân hàm, trả về danh
 * sách tên property (cả shorthand `{ foo }` lẫn `{ foo: bar }` — lấy tên
 * property, không phải tên biến cục bộ, vì đó là tên PUBLIC API mà
 * App.vue tiêu thụ qua `lifecycle.<tên>`).
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

  // CHỈ xét statement top-level trong THÂN của useAppLifecycle (không đệ
  // quy vào các function lồng bên trong như bootGame()) — bootGame() cũng
  // có nhiều `return { status: ... }` riêng của nó (BootOutcome), đệ quy
  // bừa sẽ vớ nhầm object literal đó thay vì object thật sự được
  // useAppLifecycle() trả ra cho caller.
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
 * Members cố ý KHÔNG được App.vue tiêu thụ trực tiếp — mỗi entry BẮT
 * BUỘC kèm lý do. Đây là escape hatch tường minh: rơi vào danh sách này
 * là một QUYẾT ĐỊNH có thể review được trong PR diff, không phải một lỗ
 * hổng âm thầm của guard.
 */
const INTENTIONALLY_UNWIRED_LIFECYCLE_MEMBERS: Record<string, string> = {
  // Fix cho chính bug freeze 2026-09-05: bootGame() giờ TỰ gọi
  // startTickLoop(tick) bên trong nó (xem useAppLifecycle.ts, comment
  // "Fix (2026-09-06)") — App.vue chỉ cần truyền `tick` qua deps, không
  // còn tự gọi startTickLoop() nữa. Method vẫn được export vì
  // useAppLifecycle.test.ts gọi trực tiếp để assert tính idempotent
  // (gọi 2 lần không leak interval thứ 2).
  startTickLoop: 'bootGame() tự gọi nội bộ (fix 2026-09-06); export chỉ để useAppLifecycle.test.ts assert idempotency trực tiếp.',
  // Getter debug/test-only (chính composable tự chú thích "Test/mount-
  // tracing" ngay tại điểm khai báo) — App.vue không cần đọc handle số
  // nguyên của interval, chỉ useAppLifecycle.test.ts assert qua đây.
  getTickHandle: 'Debug/test-only getter — chỉ useAppLifecycle.test.ts đọc để assert interval handle tồn tại/bị clear.',
  getAutosaveHandle: 'Debug/test-only getter — chỉ useAppLifecycle.test.ts đọc để assert interval handle tồn tại/bị clear.',
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
      // Cố ý bỏ qua — lý do đã ghi trong INTENTIONALLY_UNWIRED_LIFECYCLE_MEMBERS ở trên.
      return
    }

    // App.vue dùng dạng `const lifecycle = useAppLifecycle(...)` rồi gọi
    // property (lifecycle.foo), KHÔNG destructure — tìm PropertyAccess
    // `lifecycle.<name>` bất kỳ đâu trong script. AST-based (không phải
    // text regex) nên comment nhắc tên member không tính là consumer.
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
