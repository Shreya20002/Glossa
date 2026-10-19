// Posts the e2e diagnostics (written by diagnostics.ts) as a GitHub Actions
// annotation. Raw CI logs can only be read by signed-in admins; annotations
// show up on the run page for anyone. Run by .github/workflows/ci.yml.
import { existsSync, readFileSync } from 'node:fs'

const FILE = 'test-results/e2e-diagnostics.txt'

/** GitHub cuts off very long annotations, so keep the most recent part. */
const MAX_CHARS = 8_000

if (existsSync(FILE)) {
  const text = readFileSync(FILE, 'utf8').slice(-MAX_CHARS)
  // Workflow commands are one line, so newlines (and %) must be escaped.
  const escaped = text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
  console.log(`::notice title=E2E diagnostics (${process.platform})::${escaped}`)
} else {
  console.log(`No diagnostics file at ${FILE}.`)
}
