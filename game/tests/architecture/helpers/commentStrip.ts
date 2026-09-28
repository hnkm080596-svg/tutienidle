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
  for (;;) {
    const tok = scanner.scan()
    if (tok === ts.SyntaxKind.EndOfFileToken) break
    if (
      tok === ts.SyntaxKind.SingleLineCommentTrivia ||
      tok === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      ranges.push({ pos: scanner.getTokenStart(), end: scanner.getTokenEnd() })
    }
  }
  ranges.sort((a, b) => a.pos - b.pos)
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
  // Drop HTML comments first - a <script> tag commented out in the
  // template is dead markup, not analyzable code.
  const noHtmlComments = text.replace(/<!--[\s\S]*?-->/g, '')
  const blocks: string[] = []
  for (const m of noHtmlComments.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    blocks.push(m[1]!)
  }
  return blocks.join('\n')
}
