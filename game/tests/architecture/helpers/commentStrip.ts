import * as ts from 'typescript'

// Shared comment stripper for the architecture guards. Uses the real
// TypeScript parser + scanner for comment extraction so strings, template
// literals with `${}` interpolation, regex literals, JSX text, and escapes
// are all tokenized correctly - a hand-rolled char scanner cannot (it
// desyncs on `'-'` inside `${}`, lets '<!--'/'-->' string literals pair up
// to delete real code, and mis-lexes `/*` inside JsxText as a comment
// opener). For .vue files only live top-level <script> blocks are
// analyzed: template HTML comments, <template #slot> content, foreign
// block bodies, and markup never reach the guards' regexes.
export function uncommented(fileText: string, fileName = 'file.ts'): string {
  if (!fileName.endsWith('.vue')) return stripComments(fileText, fileName)
  return scriptBlocksOf(fileText)
    .map((b) => stripComments(b.body, b.jsx ? 'block.tsx' : 'block.ts'))
    .join('\n')
}

export interface ScriptBlock {
  body: string
  jsx: boolean
}

/** Markup comment ranges (`<!--` through its closing `-->`/`--!>`, or
 *  to EOF when unclosed) in a .vue file, per the same live-parse the
 *  script blocks come from. Consumers that strip comments must use
 *  these - a naive `<!--[\s\S]*?-->` regex treats `<!--` inside a
 *  quoted attribute as a comment open and deletes real markup. */
export function markupCommentRanges(text: string): Array<{ pos: number; end: number }> {
  return scriptBlocksWithSpans(text).comments
}

// Markup tokens that participate in deadness state: comment delimiters
// and element tags. Everything else - comment bodies, element text,
// interpolation bodies, foreign block contents - is not markup and must
// not flip the state machine. `<!-->` and `<!--->` are abrupt-closed
// empty comments in HTML (never open a comment); they must tokenize as
// one unit BEFORE `<!--` can claim their first four chars. `--!>` closes
// a comment the same as `-->`. A tag refuses to cross `<` or a `-->`/`--!>`
// tail: real markup ends a tag at its first `>`, and a close embedded in
// would-be tag text still closes an open comment. `</` followed by a
// non-letter is a bogus comment in HTML (skipped to `>`) - consumed as
// one inert token so `</ <script>` cannot resurrect a dead block.
const MARKUP_TOKEN =
  /<!--[->]?>|--!?>|<!--|<\/?[a-zA-Z][\w.-]*(?:(?!--\!?>)[^<>])*>|<\/(?=[^a-zA-Z])(?:(?!--\!?>)[^>])*>?/g

/**
 * Live top-level <script> blocks of a .vue SFC, with JSX-ness from the
 * block's `lang` attribute. A <script> nested inside an element or an
 * unclosed `<!--` comment is dead markup, never the module script.
 *
 * The deadness decision is a positional token walk over a "skeleton" copy
 * of the file (only markup tokens survive; attribute values and all
 * non-token text are blanked length-preservingly). Marker text inside a
 * quoted attribute (`title="<script>"`), a comment body (`<!-- <template>
 * -->`), a `{{ }}` interpolation (`{{ '<!--'.length }}`), or a foreign
 * element body (e.g. a `<style>` element containing comment text)
 * cannot poison the walk -
 * those positions are spaces in the skeleton. Length preservation keeps
 * skeleton offsets aligned with the source so bodies extract verbatim.
 */
function scriptBlocksWithSpans(text: string): {
  blocks: ScriptBlock[]
  spans: Array<{ pos: number; end: number }>
  comments: Array<{ pos: number; end: number }>
} {

  // Blank quoted attribute values inside tags first: '>' inside an attr
  // value otherwise ends its tag early, and literal '<script>'/'<!--'
  // inside an attr becomes a fake token. The tag-extent scan itself must
  // be quote-aware: `<[^>]*>` truncates at a `>` inside a quoted value
  // (`<div title="a>b">`, `<div title="<script>">`), leaving the value
  // unpaired and its marker text live.
  const attrMaskChars = text.split('')
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '<') continue
    // Only a real tag open carries attribute values: `<`+letter or `</`.
    // `<!--`, `<!doctype`, `<?`, `< ` etc. are not tags - masking their
    // "quoted" regions would blank a `'-->'` literal inside a comment
    // body and hide the real close from the walk.
    if (!/[a-zA-Z/]/.test(text[i + 1] ?? '')) continue
    let j = i + 1
    let q = ''
    while (j < text.length) {
      const ch = text[j]!
      if (q) {
        if (ch === q) q = ''
      } else if (ch === '"' || ch === "'") {
        q = ch
      } else if (ch === '>') {
        break
      }
      j++
    }
    if (j >= text.length) continue // no '>' - not a tag extent
    const tag = text.slice(i, j + 1)
    let masked = tag.replace(/"[^"]*"|'[^']*'/g, (m) => ' '.repeat(m.length))
    // Unquoted attr values can carry markup-looking text (`x=<!--`,
    // `x=<div`): HTML keeps them as attr text. Blank every interior
    // `<`/`>` so only the tag's own delimiters stay live - quoted values
    // are already blanked by the pass above.
    const mEnd = masked.endsWith('>') ? masked.length - 1 : masked.length
    masked =
      masked[0]! + masked.slice(1, mEnd).replace(/[<>]/g, ' ') + masked.slice(mEnd)
    for (let k = i; k <= j; k++) if (attrMaskChars[k] !== '\n') attrMaskChars[k] = masked[k - i]!
    i = j
  }
  const attrMasked = attrMaskChars.join('')
  // {{ }} bodies are expressions (`{{ '<!--'.length }}`) - a marker-
  // looking string inside one would poison the walk. But masking order
  // cannot be a blanket regex: delimiter priority is POSITIONAL. `{{ '<!--' }}`
  // is an interp (the `<!--` inside is inert expression text), while
  // `<!-- {{ --> }}` is a comment (the `-->` inside the `{{ }}` text is
  // what closes it - blanking the interp first would erase the close and
  // deaden the rest of the file). A single lexical pass decides: text /
  // interp / comment, where each state only honors its own closer.
  let interpMasked = attrMasked
  {
    const interpRanges: Array<[number, number]> = []
    let pos = 0
    // Script bodies are opaque markup text (the walk skips them via
    // pendingBodyStart): a `{{`/`<!--` inside one must not open an
    // interp/comment here - a `{{` inside a script literal (`'{{'`,
    // `/\{\{/`, `// {{`) would otherwise swallow the real `</script>`
    // and merge the next block into this one.
    let st: 'text' | 'interp' | 'comment' | 'script' = 'text'
    let iStart = -1
    while (pos < attrMasked.length) {
      if (st === 'comment') {
        const e1 = attrMasked.indexOf('-->', pos)
        const e2 = attrMasked.indexOf('--!>', pos)
        const e =
          e1 < 0 ? (e2 < 0 ? -1 : e2) : e2 < 0 ? e1 : Math.min(e1, e2)
        pos = e < 0 ? attrMasked.length : e + (e === e2 ? 4 : 3)
        st = 'text'
        continue
      }
      if (st === 'interp') {
        // An unclosed `{{` is literal text in real Vue/HTML parsing: the
        // first markup-looking `<` (tag open `<x`, close `</x`) outside a
        // JS string aborts the interpolation and that markup parses
        // normally. Masking to EOF here hid everything after an
        // unterminated `{{`. Strings are honored so `{{ '<script>' }}`
        // still masks as one complete interpolation.
        let e = -1
        let abort = -1
        let q2 = ''
        for (let k = pos; k < attrMasked.length; k++) {
          const ch = attrMasked[k]!
          if (q2) {
            if (ch === '\\') k++
            else if (ch === q2) q2 = ''
            continue
          }
          if (ch === '"' || ch === "'" || ch === '`') {
            q2 = ch
            continue
          }
          if (ch === '}' && attrMasked[k + 1] === '}') {
            e = k
            break
          }
          if (ch === '<' && /[a-zA-Z/]/.test(attrMasked[k + 1] ?? '')) {
            abort = k
            break
          }
        }
        if (e >= 0) {
          interpRanges.push([iStart, e + 2])
          pos = e + 2
        } else {
          pos = abort < 0 ? attrMasked.length : abort
        }
        st = 'text'
        continue
      }
      if (st === 'script') {
        // Script data ends only at `</` + ASCII-letter name `script`:
        // `</ script>` (whitespace gap) and `</` + non-letter are opaque
        // body text, and `</script)>` (name `script)`) does not close -
        // matching the walk's raw-text close rule.
        const cl = attrMasked.indexOf('</', pos)
        if (cl < 0) break
        const nm = /^<\/([^\s/>]*)/.exec(attrMasked.slice(cl))
        pos = cl + 2
        if (nm && nm[1]!.toLowerCase() === 'script') st = 'text'
        continue
      }
      const c = attrMasked.indexOf('<!--', pos)
      const i2 = attrMasked.indexOf('{{', pos)
      const s = attrMasked.indexOf('<script', pos)
      const next = [c, i2, s].filter((x) => x >= 0)
      if (next.length === 0) break
      const first = Math.min(...next)
      if (first === s) {
        // `<script`/whitespace/`/`/`>` boundary required - `<script)` is
        // open tag `script)` (name ends at whitespace/`/`/`>`).
        const after = attrMasked[s + 7]
        if (after !== undefined && /[\s/>]/.test(after)) {
          // Self-closing `<script/>` carries no body state.
          const gt = attrMasked.indexOf('>', s)
          if (gt < 0) break
          if (attrMasked[gt - 1] !== '/') st = 'script'
          pos = gt + 1
          continue
        }
        pos = s + 7
        continue
      }
      if (first === c) {
        // `<!-->` / `<!--->` are abrupt-closed empty comments - not opens.
        if (
          attrMasked[c + 4] === '>' ||
          (attrMasked[c + 4] === '-' && attrMasked[c + 5] === '>')
        ) {
          pos = attrMasked[c + 4] === '>' ? c + 5 : c + 6
          continue
        }
        st = 'comment'
        pos = c + 4
        continue
      }
      iStart = i2
      st = 'interp'
      pos = i2 + 2
    }
    if (interpRanges.length) {
      const chars = attrMasked.split('')
      for (const [a, b] of interpRanges) {
        for (let k = a; k < b; k++) if (chars[k] !== '\n') chars[k] = ' '
      }
      interpMasked = chars.join('')
    }
  }
  const skel = interpMasked.split('')
  for (let i = 0; i < skel.length; i++) skel[i] = skel[i] === '\n' ? '\n' : ' '
  for (const m of interpMasked.matchAll(MARKUP_TOKEN)) {
    for (let i = m.index!; i < m.index! + m[0].length; i++) skel[i] = interpMasked[i]!
  }
  const skeleton = skel.join('')

  const blocks: ScriptBlock[] = []
  const spans: Array<{ pos: number; end: number }> = []
  const comments: Array<{ pos: number; end: number }> = []
  const stack: string[] = []
  let inComment = false
  let commentStart = -1
  // A comment body is fully inert in real HTML/Vue-SFC parsing: tags
  // inside `<!-- ... -->` are comment text, not markup - `<!-- <div> -->`
  // pushes nothing and `<!-- </template> -->` pops nothing. An unclosed
  // `<!--` therefore runs to EOF exactly like the real parser. While
  // inComment the only live token is `-->`.
  // A comment delimiter is markup wherever real HTML content lives: top
  // level, inside <template>, AND inside ordinary nested elements (a
  // commented `</template>` inside <div> must never pop the real
  // template). It is NOT markup inside a foreign top-level block
  // (<i18n>, custom blocks) or a rawtext body (<style>/<textarea>/
  // <title>/a nested <script>) - those bodies are foreign text.
  const RAWTEXT = new Set(['style', 'textarea', 'title', 'script'])
  const foreignFlags: boolean[] = []
  const inForeign = (): boolean => foreignFlags.some(Boolean)
  const commentAllowed = (): boolean =>
    !inForeign() && !RAWTEXT.has(stack[stack.length - 1] ?? '')
  // Set when a live <script> opened; its body runs until the next
  // `</script` in RAW text (browsers end scripts at the first `</script`
  // regardless of context - quoted strings included - and the name must
  // follow `</` immediately: `</ script>` is bogus-comment text, never a
  // close). Scanning raw text keeps the close immune to attr masking,
  // which may have erased a `</script` inside a JS string literal.
  let pendingBodyStart = -1
  let pendingLang = ''
  let pendingOpenPos = -1
  let pendingCloseAt = -1
  // Same rule for a nested rawtext element (<style>/<textarea>/<title>/a
  // nested <script>): once opened, only `</name` + delimiter in raw text
  // ends the body - every other token (incl. `<!--` and `</other>`) is
  // opaque body text. Top-level <script> uses pendingBodyStart instead
  // (it also produces a ScriptBlock).
  let rawtextName = ''
  let rawtextBodyStart = -1
  let rawtextCloseAt = -1
  for (const m of skeleton.matchAll(MARKUP_TOKEN)) {
    const tok = m[0]
    if (pendingBodyStart >= 0) {
      if (pendingCloseAt < 0) {
        const re = /<\/script(?=[\s/>]|$)/gi
        re.lastIndex = pendingBodyStart
        pendingCloseAt = re.exec(text)?.index ?? text.length
      }
      if (m.index! < pendingCloseAt) continue // opaque script text
      const gt = text.indexOf('>', pendingCloseAt)
      const closeEnd = gt < 0 ? text.length : gt + 1
      blocks.push({
        body: text.slice(pendingBodyStart, pendingCloseAt),
        jsx: pendingLang === 'tsx' || pendingLang === 'jsx',
      })
      spans.push({ pos: pendingOpenPos, end: closeEnd })
      pendingBodyStart = -1
      pendingOpenPos = -1
      pendingCloseAt = -1
      const at = stack.lastIndexOf('script')
      if (at >= 0) {
        stack.length = at
        foreignFlags.length = at
      }
      if (m.index! < closeEnd) continue // consume the close-tag token
      // else fall through: the token starts after the close - normal markup
    }
    if (rawtextName) {
      if (rawtextCloseAt < 0) {
        const re = new RegExp(`<\\/${rawtextName}(?=[\\s/>]|$)`, 'gi')
        re.lastIndex = rawtextBodyStart
        rawtextCloseAt = re.exec(text)?.index ?? text.length
      }
      if (m.index! < rawtextCloseAt) continue // opaque rawtext body text
      const gt = text.indexOf('>', rawtextCloseAt)
      const closeEnd = gt < 0 ? text.length : gt + 1
      const at = stack.lastIndexOf(rawtextName)
      if (at >= 0) {
        stack.length = at
        foreignFlags.length = at
      }
      rawtextName = ''
      rawtextCloseAt = -1
      rawtextBodyStart = -1
      if (m.index! < closeEnd) continue
      // else fall through to normal markup handling
    }
    // Inside a markup comment every token is inert - open tags inside a
    // comment body (`<!-- <div> -->`) must not touch the stack, and a
    // `<!-- </template> -->` close is comment text, not markup.
    if (inComment) {
      if (tok === '-->' || tok === '--!>') {
        inComment = false
        comments.push({ pos: commentStart, end: m.index! + tok.length })
        commentStart = -1
      }
      continue
    }
    if (tok === '<!--') {
      if (commentAllowed()) {
        inComment = true
        commentStart = m.index!
      }
      continue
    }
    if (tok === '-->' || tok === '--!>') continue
    // `<!-->`/`<!--->` are closed empty comments - markup-inert tokens
    // that must not reach the open/close scans below (they would push a
    // fake `!--` element).
    if (tok === '<!-->' || tok === '<!--->') continue
    // A close tag's name must follow `</` immediately: `</ div>` is a
    // bogus comment in HTML, never a close - letting `\s*` skip the gap
    // would pop a real open element (or a live script).
    const close = /^<\/([^\s/>]*)/.exec(tok)
    if (close) {
      const name = close[1]!.toLowerCase()
      // Close tags are tolerated with stray attrs (`</script foo>`,
      // `</script/>`): HTML error recovery accepts them, so the token
      // regex already matched them. Pop the stack through the name.
      const at = stack.lastIndexOf(name)
      if (at >= 0) {
        stack.length = at
        foreignFlags.length = at
      }
      continue
    }
    const open = /^<\s*([^\s/>]*)/.exec(tok)
    if (!open) continue
    const name = open[1]!.toLowerCase()
    if (name === 'script' && stack.length === 0 && !/\/>$/.test(tok)) {
      pendingBodyStart = m.index! + tok.length
      pendingOpenPos = m.index!
      const openTag = text.slice(m.index!, m.index! + tok.length)
      pendingLang = /\blang\s*=\s*['"](\w+)['"]/.exec(openTag)?.[1] ?? ''
      stack.push('script')
      foreignFlags.push(false)
      continue
    }
    const foreign = stack.length === 0 && name !== 'template'
    if (!/\/>$/.test(tok)) {
      stack.push(name)
      foreignFlags.push(foreign)
      if (RAWTEXT.has(name)) {
        rawtextName = name
        rawtextBodyStart = m.index! + tok.length
      }
    }
    continue
  }
  // An unclosed live `<script>` runs to EOF - no block is produced but
  // the span still covers the body so template-side stripping removes
  // it. A raw-scan close that no skeleton token reached (a masked
  // `</script` inside a string, or `</script` at EOF) still produces the
  // block body.
  if (pendingBodyStart >= 0) {
    if (pendingCloseAt >= 0) {
      const gt = text.indexOf('>', pendingCloseAt)
      blocks.push({
        body: text.slice(pendingBodyStart, pendingCloseAt),
        jsx: pendingLang === 'tsx' || pendingLang === 'jsx',
      })
      spans.push({
        pos: pendingOpenPos,
        end: gt < 0 ? text.length : gt + 1,
      })
    } else {
      spans.push({ pos: pendingOpenPos, end: text.length })
    }
  }
  // An unclosed `<!--` comments out the file tail.
  if (inComment && commentStart >= 0) {
    comments.push({ pos: commentStart, end: text.length })
  }
  return { blocks, spans, comments }
}

export function scriptBlocksOf(text: string): ScriptBlock[] {
  return scriptBlocksWithSpans(text).blocks
}

/** Spans (open tag through `</script>` close) of the LIVE script blocks
 *  of a .vue file - the same live-parse the block bodies come from, so
 *  stripping by spans cannot desync the way a regex
 *  `<script>...</script>` strip does (an unclosed `<script>` inside
 *  template markup used to swallow the tail through the real close). */
export function scriptBlockSpansOf(text: string): Array<{ pos: number; end: number }> {
  return scriptBlocksWithSpans(text).spans
}

/**
 * True when a .vue file's live script blocks use tsx/jsx lang. Consumers
 * that scan the JOINED body (`literalRanges`, ad-hoc `scanComments` use)
 * must dispatch on this flag - the `.vue` extension itself maps to
 * Standard TS, which mis-lexes JsxText quotes into phantom strings.
 * Mixed-lang files collapse to the jsx variant (a joined body can carry
 * only one variant; single-lang blocks dominate in practice).
 */
export function usesJsxBlocks(text: string, fileName: string): boolean {
  return fileName.endsWith('.vue') && scriptBlocksOf(text).some((b) => b.jsx)
}

function scriptKindFor(fileName: string): ts.ScriptKind {
  return fileName.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : fileName.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : /\.(js|mjs|cjs)$/.test(fileName)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS
}

/**
 * Scan `code` for comment tokens and return each comment's range.
 * Shared by stripComments() and literalRanges() so the scanner state
 * machine lives in exactly one place.
 */
function scanComments(code: string, fileName: string): Array<{ pos: number; end: number }> {
  // The scanner is lexer-authority, not parser-authority: a `/` the
  // parser reads as a regex literal still tokenizes `/*` inside it as a
  // comment opener (`/[/*]/`, `/a\/*/`), and the phantom comment then
  // eats the file tail. The same holds for JSX text - `/*` inside
  // <div>/*</div> is literal text in the grammar but the bare scan loop
  // (no reScanJsxToken) reads a comment opener. Parse first, blank every
  // RegularExpressionLiteral AND JsxText span to spaces
  // (length-preserving, so offsets stay valid), and scan THAT text - a
  // mis-lex is impossible because the offending characters no longer
  // exist for the scanner. Real comments in the tail keep their comment
  // status (a plain range-rejection would reintroduce them as live code).
  const scriptKind = scriptKindFor(fileName)
  const languageVariant =
    scriptKind === ts.ScriptKind.TSX || scriptKind === ts.ScriptKind.JSX
      ? ts.LanguageVariant.JSX
      : ts.LanguageVariant.Standard
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, scriptKind)
  const chars = code.split('')
  const visit = (node: ts.Node): void => {
    if (
      node.kind === ts.SyntaxKind.RegularExpressionLiteral ||
      node.kind === ts.SyntaxKind.JsxText
    ) {
      for (let i = node.getStart(sf); i < node.end; i++) chars[i] = ' '
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  const scanText = chars.join('')

  // Bare scan() is parser-assistive, not self-sufficient: inside a
  // template's `${...}` interpolation the `}` that closes it must be
  // re-scanned via reScanTemplateToken (the parser does this; a bare loop
  // does not). Without the rescan the following backtick opens a phantom
  // template and every comment in the file tail is swallowed. Track
  // template state: push on TemplateHead/TemplateMiddle, count braces
  // inside the interpolation, and re-scan when `}` closes a `${`.
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, languageVariant, scanText)
  const ranges: Array<{ pos: number; end: number }> = []
  const templates: number[] = []
  for (;;) {
    const tok = scanner.scan()
    if (tok === ts.SyntaxKind.EndOfFileToken) break
    if (
      tok === ts.SyntaxKind.SingleLineCommentTrivia ||
      tok === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      ranges.push({ pos: scanner.getTokenStart(), end: scanner.getTokenEnd() })
      continue
    }
    if (tok === ts.SyntaxKind.TemplateHead || tok === ts.SyntaxKind.TemplateMiddle) {
      templates.push(0)
      continue
    }
    if (tok === ts.SyntaxKind.OpenBraceToken && templates.length > 0) {
      templates[templates.length - 1]!++
      continue
    }
    if (tok === ts.SyntaxKind.CloseBraceToken && templates.length > 0) {
      if (templates[templates.length - 1]! > 0) {
        templates[templates.length - 1]!--
        continue
      }
      const cont = scanner.reScanTemplateToken(false)
      if (cont === ts.SyntaxKind.LastTemplateToken) {
        templates.pop()
      }
      // TemplateMiddle re-opens the next interpolation - braces reset.
      continue
    }
  }
  return ranges
}

/**
 * `code` with every comment blanked to spaces. Length-preserving (line
 * breaks kept): offsets in the result stay aligned with the source, and
 * a block comment between two identifiers becomes a run of spaces -
 * the tokens can never merge across a removed comment (a zero-width
 * splice would read `import`+`x` as `importx` for some matchers and
 * hide comment-separated smuggles).
 */
function stripComments(code: string, fileName: string): string {
  const chars = code.split('')
  for (const r of scanComments(code, fileName)) {
    for (let i = r.pos; i < r.end; i++) if (chars[i] !== '\n') chars[i] = ' '
  }
  return chars.join('')
}

/**
 * Ranges covered by literal text in `code` (already script-extracted for
 * .vue): string literals, template-literal TEXT spans (heads, middles AND
 * tails), and regex literals. `${}` interpolation interiors are real code
 * and are NOT included - only the literal characters are. Guards use this
 * to drop matches sitting inside literal data (line-local quote parity
 * cannot see multi-line literals, and a `letter\uXXXX` inside a regex is
 * not an identifier escape). `jsx` forces the JSX language variant for
 * `<script lang="tsx">` blocks extracted from .vue files.
 */
export function literalRanges(
  code: string,
  fileName = 'file.ts',
  jsx?: boolean,
): Array<{ pos: number; end: number }> {
  // Reuse the same scanning pass: blank comments AND regex literals first
  // so neither produces phantom tokens; then collect literal tokens.
  // (`/[/*]/` scanned raw opens a phantom comment to EOF and every real
  // string in the tail would be missed.)
  const comments = scanComments(code, fileName)
  // The jsx flag must drive the PARSER kind too, not only the scanner:
  // a .vue file whose live blocks are lang="tsx" parses its joined body
  // as TSX - otherwise JSX text parses as broken generics and JsxText
  // ranges never appear.
  const jsxFlag = jsx ?? /\.(tsx|jsx)$/.test(fileName)
  const scriptKind = scriptKindFor(jsxFlag && !/\.(tsx|jsx)$/.test(fileName) ? 'joined.tsx' : fileName)
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, scriptKind)
  const chars = code.split('')
  for (const r of comments) {
    for (let i = r.pos; i < r.end; i++) chars[i] = ' '
  }
  const regexRanges: Array<{ pos: number; end: number }> = []
  const jsxTextRanges: Array<{ pos: number; end: number }> = []
  const visitRegex = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      regexRanges.push({ pos: node.getStart(sf), end: node.end })
      for (let i = node.getStart(sf); i < node.end; i++) chars[i] = ' '
    }
    // JsxText (the text between JSX tags) is display text, not code -
    // `cue('x')` inside <div>...</div> must not satisfy a call arm.
    if (node.kind === ts.SyntaxKind.JsxText) {
      jsxTextRanges.push({ pos: node.getStart(sf), end: node.end })
    }
    ts.forEachChild(node, visitRegex)
  }
  visitRegex(sf)
  const clean = chars.join('')
  const isJsx = jsxFlag
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    isJsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard,
    clean,
  )
  const ranges: Array<{ pos: number; end: number }> = []
  const templates: number[] = []
  for (;;) {
    const tok = scanner.scan()
    if (tok === ts.SyntaxKind.EndOfFileToken) break
    if (
      tok === ts.SyntaxKind.StringLiteral ||
      tok === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
      tok === ts.SyntaxKind.TemplateHead ||
      tok === ts.SyntaxKind.TemplateMiddle ||
      tok === ts.SyntaxKind.TemplateTail
    ) {
      ranges.push({ pos: scanner.getTokenStart(), end: scanner.getTokenEnd() })
      if (tok === ts.SyntaxKind.TemplateHead || tok === ts.SyntaxKind.TemplateMiddle) {
        templates.push(0)
      }
      if (tok === ts.SyntaxKind.TemplateTail) templates.pop()
      continue
    }
    if (tok === ts.SyntaxKind.OpenBraceToken && templates.length > 0) {
      templates[templates.length - 1]!++
      continue
    }
    if (tok === ts.SyntaxKind.CloseBraceToken && templates.length > 0) {
      if (templates[templates.length - 1]! > 0) {
        templates[templates.length - 1]!--
        continue
      }
      const cont = scanner.reScanTemplateToken(false)
      // The rescanned token IS the TemplateMiddle (`}text${`) or
      // TemplateTail (`}text\``) continuation - its literal text must be
      // marked too, or mid-template text stays invisible to inLit (a
      // spoofed `emit('x')` in middle text would satisfy a bound name).
      ranges.push({ pos: scanner.getTokenStart(), end: scanner.getTokenEnd() })
      if (cont === ts.SyntaxKind.LastTemplateToken) {
        templates.pop()
      } else {
        // TemplateMiddle re-opens the next interpolation - braces reset.
        templates[templates.length - 1]! = 0
      }
      continue
    }
  }
  return ranges.concat(regexRanges, jsxTextRanges)
}
