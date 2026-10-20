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

/**
 * On macOS, Chromium's audio system runs in its own sandboxed process, and that
 * sandbox may not read the test clip ("Failed to read … as input to the fake
 * device"), so the fake microphone plays silence. These switches let the audio
 * system read the file: either without its sandbox, or inside the main process.
 * Test-only: Glossa itself never reads audio files, and every other sandbox
 * (including the one around its windows) stays on.
 */
function macOSFakeMicrophoneArgs(): string[] {
  if (process.platform !== 'darwin') return []
  return ['--disable-features=AudioServiceSandbox,AudioServiceOutOfProcess']
}

/** Chromium switches that replace the real microphone with an audio file played on a loop. */
function fakeMicrophoneArgs(clipPath: string): string[] {
  return [
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${clipPath}`,
    ...macOSFakeMicrophoneArgs(),
  ]
}

interface LaunchOptions {
  /**
   * Glossa's data folder (session history, microphone choice). Each test
   * passes a fresh one, so it starts with no history and never touches yours.
   */
  userDataDir: string
  /** An audio file for the fake microphone to play. Without one, there's no microphone. */
  fakeMicrophoneClip?: string
}

/** Launches Glossa: the development build, or the packaged app when GLOSSA_E2E_PACKAGED=1. */
export async function launchGlossa({
  userDataDir,
  fakeMicrophoneClip,
}: LaunchOptions): Promise<ElectronApplication> {
  const args = [
    `--user-data-dir=${userDataDir}`,
    // Send Chromium's internal warnings (e.g. from its audio system) to stderr,
    // so a failing test can print them.
    '--enable-logging=stderr',
    ...(fakeMicrophoneClip ? fakeMicrophoneArgs(fakeMicrophoneClip) : []),
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
