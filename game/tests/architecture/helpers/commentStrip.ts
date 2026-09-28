import * as ts from 'typescript'

// Shared comment stripper for the audio architecture guards. Uses the
// real TypeScript parser + scanner for comment extraction so strings,
// template literals with `${}` interpolation, regex literals, and
// escapes are all tokenized correctly - a hand-rolled char scanner
// cannot (it desyncs on `'-'` inside `${}` and lets '<!--'/'-->' string
// literals pair up to delete real code). For .vue files only top-level
// <script> blocks are analyzed: template HTML comments, <template #slot>
// content, and markup never reach the guards' regexes.
export function uncommented(fileText: string, fileName = 'file.ts'): string {
  const text = scriptOf(fileName, fileText)
  return stripComments(text, fileName)
}

/**
 * Scan `code` for comment tokens and return the code with every comment
 * removed. Shared by uncommented() and stringLiteralRanges() so the
 * scanner state machine lives in exactly one place.
 */
function scanComments(code: string, fileName: string): Array<{ pos: number; end: number }> {
  // The scanner is lexer-authority, not parser-authority: a `/` the
  // parser reads as a regex literal still tokenizes `/*` inside it as a
  // comment opener (`/[/*]/`, `/a\/*/`), and the phantom comment then
  // eats the file tail. Parse first, blank every RegularExpressionLiteral
  // span to spaces (length-preserving, so offsets stay valid), and scan
  // THAT text - a mis-lex is impossible because the `/*` inside a regex
  // no longer exists for the scanner. Real comments in the tail keep
  // their comment status (a plain range-rejection would reintroduce them
  // as live code).
  const scriptKind = fileName.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : fileName.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : /\.(js|mjs|cjs)$/.test(fileName)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS
  const languageVariant =
    scriptKind === ts.ScriptKind.TSX || scriptKind === ts.ScriptKind.JSX
      ? ts.LanguageVariant.JSX
      : ts.LanguageVariant.Standard
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, scriptKind)
  const chars = code.split('')
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
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

function stripComments(code: string, fileName: string): string {
  const ranges = scanComments(code, fileName)
  let out = ''
  let pos = 0
  for (const r of ranges) {
    if (r.pos > pos) out += code.slice(pos, r.pos)
    pos = Math.max(pos, r.end)
  }
  return out + code.slice(pos)
}

/**
 * Ranges covered by literal text in `code` (already script-extracted for
 * .vue): string literals, template-literal TEXT spans, and regex
 * literals. `${}` interpolation interiors are real code and are NOT
 * included - only the literal characters are. Guards use this to drop
 * matches sitting inside literal data (line-local quote parity cannot
 * see multi-line literals, and a `letter\uXXXX` inside a regex is not an
 * identifier escape).
 */
export function literalRanges(code: string, fileName = 'file.ts'): Array<{ pos: number; end: number }> {
  // Reuse the same scanning pass: blank comments AND regex literals
  // first so neither produces phantom tokens; then collect literal
  // tokens. (`/[/*]/` scanned raw opens a phantom comment to EOF and
  // every real string in the tail would be missed.)
  const comments = scanComments(code, fileName)
  const scriptKind = fileName.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : fileName.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : ts.ScriptKind.TS
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, scriptKind)
  const chars = code.split('')
  for (const r of comments) {
    for (let i = r.pos; i < r.end; i++) chars[i] = ' '
  }
  const regexRanges: Array<{ pos: number; end: number }> = []
  const visitRegex = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      regexRanges.push({ pos: node.getStart(sf), end: node.end })
      for (let i = node.getStart(sf); i < node.end; i++) chars[i] = ' '
    }
    ts.forEachChild(node, visitRegex)
  }
  visitRegex(sf)
  const clean = chars.join('')
  const isJsx = /\.(tsx|jsx)$/.test(fileName)
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
      if (cont === ts.SyntaxKind.LastTemplateToken) templates.pop()
      continue
    }
  }
  return ranges.concat(regexRanges)
}

function scriptOf(fileName: string, text: string): string {
  if (!fileName.endsWith('.vue')) return text
  // A <script> tag inside an HTML comment or inside a <template> block
  // (slot content, not the module script) is dead markup. Decide per tag
  // from the full markup prefix: every <script>...</script> is excised
  // (length-preserving so offsets stay aligned) so a script's string
  // literals cannot corrupt the comment accounting for a later tag, and
  // quoted attribute values inside tags are blanked so `title="<!--"`
  // cannot masquerade as a comment opener.
  const markup = text
    .replace(/<script[^>]*>[\s\S]*?<\/script\s*>/gi, (s) => ' '.repeat(s.length))
    .replace(/<script[^>]*\/>/gi, (s) => ' '.repeat(s.length))
    .replace(/<[^>]*>/g, (tag) =>
      tag.replace(/"[^"]*"|'[^']*'/g, (q) => ' '.repeat(q.length)),
    )
  const blocks: string[] = []
  for (const m of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const region = markup.slice(0, m.index)
    // Inside an unclosed `<!--` comment -> dead markup.
    if (region.lastIndexOf('<!--') > region.lastIndexOf('-->')) continue
    // Inside an unclosed <template ...> block -> DOM markup, not the
    // SFC module script.
    if (region.lastIndexOf('<template') > region.lastIndexOf('</template')) continue
    blocks.push(m[1]!)
  }
  return blocks.join('\n')
}
