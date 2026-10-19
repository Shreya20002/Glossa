import { expect, test } from '@playwright/test'
import { printDiagnostics } from './support/diagnostics'
import { launchWithFakeMicrophone } from './support/launch'
import { createSpeechClip } from './support/speechClip'
import { describeWav } from './support/wav'

test('a session measures talk time from the microphone', async () => {
  const clipPath = test.info().outputPath('speech.wav')
  await createSpeechClip(clipPath)
  const clipInfo = `Speech clip: ${await describeWav(clipPath)}`
  console.log(clipInfo)
  const app = await launchWithFakeMicrophone(clipPath)

  try {
    const main = await app.firstWindow()
    const overlayOpened = app.waitForEvent('window', {
      predicate: (page) => page.url().includes('/overlay/'),
    })
    await main.getByRole('button', { name: 'Start session' }).click()
    const overlay = await overlayOpened

    // The elapsed time counts audio the engine has processed, so it only
    // moves if audio is flowing from the microphone to the engine.
    await expect(overlay.getByTestId('elapsed'), 'audio should reach the engine').not.toHaveText(
      '0:00',
    )

    // The clip starts with a sentence, then pauses: the dot should light up, then go out.
    const indicator = overlay.getByTestId('speaking-indicator')
    await expect(indicator, 'speech should be detected').toHaveAttribute('data-speaking', 'true')
    await expect(indicator, 'the pause should be detected').toHaveAttribute(
      'data-speaking',
      'false',
    )

    // After 10+ seconds of audio, roughly half (or more) of it was speech.
    await expect(overlay.getByTestId('elapsed')).toHaveText(/^0:1\d$/, { timeout: 25_000 })
    const talkPercent = Number.parseInt(await overlay.getByTestId('talk-ratio').innerText(), 10)
    console.log(
      `Talk time after ${await overlay.getByTestId('elapsed').innerText()}: ${talkPercent}%`,
    )
    expect(talkPercent).toBeGreaterThanOrEqual(25)
    expect(talkPercent).toBeLessThanOrEqual(90)

    // Stopping closes the overlay and shows a summary in the main window.
    await main.getByRole('button', { name: 'Stop session' }).click()
    await expect(main.getByTestId('last-session')).toContainText('You spoke for')
    await expect.poll(() => app.windows().length).toBe(1)

    if (process.env['GLOSSA_E2E_DIAGNOSTICS']) await printDiagnostics(app, [clipInfo])
  } catch (error) {
    await printDiagnostics(app, [clipInfo])
    throw error
  } finally {
    await app.close()
  }
})
