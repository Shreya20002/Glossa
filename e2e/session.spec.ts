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

    // Pace appears once the first sentence (followed by a pause) has been
    // transcribed. Text-to-speech talks at a normal-to-brisk 140–200 WPM.
    const pace = overlay.getByTestId('pace')
    await expect(pace, 'pace should be measured').toHaveText(/^\d+$/, { timeout: 20_000 })
    const wordsPerMinute = Number(await pace.innerText())
    console.log(`Pace: ${wordsPerMinute} wpm`)
    expect(wordsPerMinute).toBeGreaterThanOrEqual(100)
    expect(wordsPerMinute).toBeLessThanOrEqual(260)

    // The first sentence contains an "um", so at least one filler is counted.
    const fillers = overlay.getByTestId('fillers')
    await expect(fillers, 'the "um" should be counted').not.toHaveText('0')
    console.log(`Fillers: ${await fillers.innerText()}`)

    // Short sentences with real pauses between them are conversation, not a monologue.
    await expect(overlay.getByTestId('pill')).toHaveAttribute('data-monologue', 'false')

    // Stopping closes the overlay and shows a summary in the main window.
    await main.getByRole('button', { name: 'Stop session' }).click()
    const summary = main.getByTestId('last-session')
    await expect(summary).toContainText('You spoke for')
    await expect(summary).toContainText('words per minute')
    await expect(summary).toContainText('um ×')
    await expect(summary).toContainText('Longest turn: 0:')
    await expect.poll(() => app.windows().length).toBe(1)

    if (process.env['GLOSSA_E2E_DIAGNOSTICS']) await printDiagnostics(app, [clipInfo])
  } catch (error) {
    await printDiagnostics(app, [clipInfo])
    throw error
  } finally {
    await app.close()
  }
})
