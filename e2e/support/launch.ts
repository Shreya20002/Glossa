import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'

/**
 * The packaged app built by `pnpm build:unpack`, when GLOSSA_E2E_PACKAGED=1
 * (CI does this, to test exactly what users install). Otherwise undefined,
 * and tests run the development build in out/.
 */
function packagedExecutable(): string | undefined {
  if (!process.env['GLOSSA_E2E_PACKAGED']) return undefined
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
  const releaseDir = join('release', version)
  if (process.platform === 'win32') return join(releaseDir, 'win-unpacked', 'Glossa.exe')
  if (process.platform === 'darwin') {
    return join(releaseDir, 'mac-arm64', 'Glossa.app', 'Contents', 'MacOS', 'Glossa')
  }
  throw new Error(`No packaged app to test on ${process.platform}`)
}

/** Launches Glossa with a fake microphone that plays `clipPath` on a loop. */
export async function launchWithFakeMicrophone(clipPath: string): Promise<ElectronApplication> {
  const args = [
    // Chromium switches that replace the real microphone with an audio file.
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${clipPath}`,
    // Send Chromium's internal warnings (e.g. from its audio system) to stderr,
    // so a failing test can print them.
    '--enable-logging=stderr',
  ]
  const executablePath = packagedExecutable()
  const app = await electron.launch(
    executablePath ? { executablePath, args } : { args: ['.', ...args] },
  )

  const output: string[] = []
  const collect = (chunk: Buffer): void => {
    output.push(...chunk.toString().split('\n').filter(Boolean))
    if (output.length > MAX_OUTPUT_LINES) output.splice(0, output.length - MAX_OUTPUT_LINES)
  }
  app.process().stdout?.on('data', collect)
  app.process().stderr?.on('data', collect)
  processOutput.set(app, output)

  // Surface errors from any window in the test output, to make failures easy to debug.
  app.on('window', (page) => {
    page.on('console', (message) => {
      if (message.type() === 'error') console.log(`[${page.url()}] ${message.text()}`)
    })
  })
  return app
}

/** Lines of the app's own output kept for diagnostics (the most recent ones). */
const MAX_OUTPUT_LINES = 60
const processOutput = new WeakMap<ElectronApplication, string[]>()

/** The app process's recent stdout/stderr, including Chromium's internal log. */
export function recentProcessOutput(app: ElectronApplication): string[] {
  return processOutput.get(app) ?? []
}
