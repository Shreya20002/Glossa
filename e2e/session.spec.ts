import { expect, test } from '@playwright/test'
import { launchWithFakeMicrophone } from './support/launch'
import { createSpeechClip } from './support/speechClip'

test('a session measures talk time from the microphone', async () => {
  const clipPath = test.info().outputPath('speech.wav')
  await createSpeechClip(clipPath)
  const app = await launchWithFakeMicrophone(clipPath)

  try {
    const main = await app.firstWindow()
    const overlayOpened = app.waitForEvent('window', {
      predicate: (page) => page.url().includes('/overlay/'),
    })
    await main.getByRole('button', { name: 'Start session' }).click()
    const overlay = await overlayOpened

    // The clip starts with a sentence, then pauses: the dot should light up, then go out.
    const indicator = overlay.getByTestId('speaking-indicator')
    await expect(indicator).toHaveAttribute('data-speaking', 'true')
    await expect(indicator).toHaveAttribute('data-speaking', 'false')

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
  } finally {
    await app.close()
  }
})
