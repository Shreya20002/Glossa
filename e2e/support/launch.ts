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
  // Chromium switches that replace the real microphone with an audio file.
  const fakeMicrophone = [
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${clipPath}`,
  ]
  const executablePath = packagedExecutable()
  const app = await electron.launch(
    executablePath ? { executablePath, args: fakeMicrophone } : { args: ['.', ...fakeMicrophone] },
  )
  // Surface errors from any window in the test output, to make failures easy to debug.
  app.on('window', (page) => {
    page.on('console', (message) => {
      if (message.type() === 'error') console.log(`[${page.url()}] ${message.text()}`)
    })
  })
  return app
}
