import * as ts from 'typescript'

// Shared comment stripper for the audio architecture guards. Uses the
// real TypeScript parser for comment extraction so strings, template
// literals with `${}` interpolation, regex literals, and escapes are all
// tokenized correctly - a hand-rolled char scanner cannot (it desyncs on
// `'-'` inside `${}` and lets '<!--'/'-->' string literals pair up to
// delete real code). For .vue files only the <script> blocks are
// analyzed: template HTML comments and markup never reach the guards'
// regexes, and emit()/cue() calls in this codebase live in <script>.
export function uncommented(fileText: string, fileName = 'file.ts'): string {
  const text = scriptOf(fileName, fileText)
  // Tokenize with trivia enabled instead of walking the AST: comments in
  // "dead zones" (empty `()`, `{}`, `[]`, class/enum bodies) never attach
  // to a child node, so an AST comment-range walk leaves them in place -
  // a surviving `/* import 'tone' */` reads as real code and a surviving
  // commented `emit()` can fake the emitted-binding arm. The scanner
  // returns every comment token regardless of where it sits.
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, undefined, text)
  const ranges: Array<{ pos: number; end: number }> = []
  // Bare scan() is parser-assistive, not self-sufficient: inside a
  // template's `${...}` interpolation the `}` that closes it must be
  // re-scanned via reScanTemplateToken (the parser does this; a bare loop
  // does not). Without the rescan the following backtick opens a phantom
  // template and every comment in the file tail is swallowed. Track
  // template state: push on TemplateHead/TemplateMiddle, count braces
  // inside the interpolation, and re-scan when `}` closes a `${`.
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
    if (
      tok === ts.SyntaxKind.TemplateHead ||
      tok === ts.SyntaxKind.TemplateMiddle
    ) {
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
  // The scanner is lexer-authority, not parser-authority: a `/` the parser
  // reads as a regex literal still tokenizes `/*` inside it as a comment
  // opener (`/[/*]/`, `/a\/*/`), and the phantom comment then eats the
  // file tail. A real comment can never overlap a parsed regex node, so
  // any scanner range overlapping a RegularExpressionLiteral span is a
  // mis-lex - reject it.
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const regexSpans: Array<{ pos: number; end: number }> = []
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      regexSpans.push({ pos: node.getStart(sf), end: node.end })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  const kept = ranges.filter(
    (r) => !regexSpans.some((s) => r.pos < s.end && r.end > s.pos),
  )
  kept.sort((a, b) => a.pos - b.pos)
  ranges.length = 0
  ranges.push(...kept)
  let out = ''
  let pos = 0
  for (const r of ranges) {
    if (r.pos > pos) out += text.slice(pos, r.pos)
    pos = Math.max(pos, r.end)
  }
  return out + text.slice(pos)
}

function scriptOf(fileName: string, text: string): string {
  if (!fileName.endsWith('.vue')) return text
  // A <script> tag inside an HTML comment is dead markup and must not
  // contribute code. Decide per tag by looking only at TEMPLATE text
  // before it (script bodies are excised first so a '<!--' literal inside
  // a script string cannot corrupt the comment accounting - stripping
  // <!-- --> globally would let script-side string literals pair up and
  // delete real code).
  const blocks: string[] = []
  let searchFrom = 0
  for (const m of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const region = text
      .slice(searchFrom, m.index)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
    const open = region.lastIndexOf('<!--')
    const close = region.lastIndexOf('-->')
    if (open <= close) blocks.push(m[1]!)
    searchFrom = (m.index ?? 0) + m[0].length
  }
  return blocks.join('\n')
}
