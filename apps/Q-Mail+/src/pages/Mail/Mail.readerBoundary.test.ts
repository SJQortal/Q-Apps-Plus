/**
 * Mail.tsx draws its one reader inside ReaderErrorBoundary, keyed by the open
 * message. A structural check, read from the source: rendering Mail needs the
 * whole app, and taking the boundary out otherwise left every test green.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Mail.tsx and the reader', () => {
  it('wraps the only ShowMessageV2 in ReaderErrorBoundary', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/pages/Mail/Mail.tsx'), 'utf8')
    expect(source.match(/<ShowMessageV2\b/g)).toHaveLength(1)
    const boundary = /<ReaderErrorBoundary messageKey=\{`\$\{message\?\.user \|\| ""\}\|\$\{message\?\.id \|\| ""\}`\}>\s*<React\.Suspense[^\n]*\n\s*<ShowMessageV2\b[\s\S]*?\/>\s*<\/React\.Suspense>\s*<\/ReaderErrorBoundary>/
    expect(source).toMatch(boundary)
  })
})
