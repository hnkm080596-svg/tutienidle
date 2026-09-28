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

// Markup tokens that participate in deadness state: comment delimiters
// and element tags. Everything else - comment bodies, element text,
// interpolation bodies, foreign block contents - is not markup and must
// not flip the state machine. The tag alternative refuses to cross `<`
// or a `-->` tail: real markup ends a tag at its first `>`, and a `-->`
// embedded in would-be tag text still closes an open comment.
const MARKUP_TOKEN = /<!--|-->|<\/?[a-zA-Z][\w.-]*(?:(?!-->)[^<>])*>/g

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
} {

  // Blank quoted attribute values inside tags first: '>' inside an attr
  // value otherwise ends its tag early, and literal '<script>'/'<!--'
  // inside an attr becomes a fake token. Then blank {{ ... }} interpolation
  // bodies the same way - they are expressions (`{{ '<!--'.length }}`),
  // and a marker-looking string inside one would otherwise poison the walk.
  const attrMasked = text.replace(/<[^>]*>/g, (tag) =>
    tag.replace(/"[^"]*"|'[^']*'/g, (q) => ' '.repeat(q.length)),
  )
  const interpMasked = attrMasked.replace(/\{\{[\s\S]*?\}\}/g, (m) =>
    m.replace(/[^\n]/g, ' '),
  )
  const skel = interpMasked.split('')
  for (let i = 0; i < skel.length; i++) skel[i] = skel[i] === '\n' ? '\n' : ' '
  for (const m of interpMasked.matchAll(MARKUP_TOKEN)) {
    for (let i = m.index!; i < m.index! + m[0].length; i++) skel[i] = interpMasked[i]!
  }
  const skeleton = skel.join('')

  const blocks: ScriptBlock[] = []
  const spans: Array<{ pos: number; end: number }> = []
  const stack: string[] = []
  let inComment = false
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
  // </script> close token (browsers end scripts at the first `</script`
  // regardless of context, so this matches real parsing).
  let pendingBodyStart = -1
  let pendingLang = ''
  let pendingOpenPos = -1
  for (const m of skeleton.matchAll(MARKUP_TOKEN)) {
    const tok = m[0]
    // Inside a live script body only the </script> close is markup: every
    // other token is opaque script text (a "<script>" string literal must
    // not push the element stack or open a second block).
    if (pendingBodyStart >= 0) {
      const sc = /^<\/\s*([a-zA-Z][\w.-]*)/.exec(tok)
      if (sc && sc[1]!.toLowerCase() === 'script') {
        blocks.push({
          body: text.slice(pendingBodyStart, m.index),
          jsx: pendingLang === 'tsx' || pendingLang === 'jsx',
        })
        spans.push({ pos: pendingOpenPos, end: m.index! + tok.length })
        pendingBodyStart = -1
        pendingOpenPos = -1
        const at = stack.lastIndexOf('script')
        if (at >= 0) {
          stack.length = at
          foreignFlags.length = at
        }
      }
      continue
    }
    // Inside a markup comment every token is inert - open tags inside a
    // comment body (`<!-- <div> -->`) must not touch the stack, and a
    // `<!-- </template> -->` close is comment text, not markup.
    if (inComment) {
      if (tok === '-->') inComment = false
      continue
    }
    if (tok === '<!--') {
      if (commentAllowed()) inComment = true
      continue
    }
    if (tok === '-->') continue
    const close = /^<\/\s*([a-zA-Z][\w.-]*)/.exec(tok)
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
    const open = /^<\s*([a-zA-Z][\w.-]*)/.exec(tok)
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
    }
    continue
  }
  // An unclosed live `<script>` runs to EOF - no block is produced but
  // the span still covers the body so template-side stripping removes it.
  if (pendingBodyStart >= 0) {
    spans.push({ pos: pendingOpenPos, end: text.length })
  }
  return { blocks, spans }
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
