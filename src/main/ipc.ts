import { app, BrowserWindow, clipboard, ClipboardItem, ipcMain } from 'electron'
import { IpcChannel } from '../shared/ipc'
import { toCaptureArea } from './captureArea'
import { latestReport } from './history'
import { assertTrustedSender, isTrustedSender } from './security'
import type { SessionController } from './session'

/** Largest audio chunk accepted: one second at 16 kHz. The capture sends 32 ms chunks. */
const MAX_AUDIO_CHUNK_SAMPLES = 16_000

function isAudioChunk(value: unknown): value is Float32Array {
  return (
    value instanceof Float32Array && value.length > 0 && value.length <= MAX_AUDIO_CHUNK_SAMPLES
  )
}

/** Answers requests that renderer windows send through `window.glossa`. */
export function registerIpcHandlers(
  sessions: SessionController,
  historyFile: string,
  devServerUrl: string | undefined,
): void {
  ipcMain.handle(IpcChannel.getAppVersion, (event) => {
    assertTrustedSender(event, devServerUrl)
    return app.getVersion()
  })

  ipcMain.handle(IpcChannel.startSession, (event) => {
    assertTrustedSender(event, devServerUrl)
    return sessions.start()
  })

  ipcMain.handle(IpcChannel.stopSession, (event) => {
    assertTrustedSender(event, devServerUrl)
    return sessions.stop()
  })

  ipcMain.handle(IpcChannel.latestReport, (event) => {
    assertTrustedSender(event, devServerUrl)
    return latestReport(historyFile)
  })

  // A picture of part of the asking window itself, so a page can't copy anything else.
  ipcMain.handle(IpcChannel.copyReportImage, async (event, area: unknown) => {
    assertTrustedSender(event, devServerUrl)
    const window = BrowserWindow.fromWebContents(event.sender)
    const [width = 0, height = 0] = window?.getContentSize() ?? []
    const rect = toCaptureArea(area, width, height)
    if (!rect) throw new Error('There is nothing to copy there.')
    const image = await event.sender.capturePage(rect)
    if (image.isEmpty()) throw new Error('The report card could not be copied.')
    const png = new Blob([image.toPNG()], { type: 'image/png' })
    await clipboard.write([new ClipboardItem({ 'image/png': png })])
  })

  // Audio arrives ~30 times a second, so bad messages are dropped silently
  // instead of throwing.
  ipcMain.on(IpcChannel.pushAudio, (event, samples: unknown) => {
    if (isTrustedSender(event, devServerUrl) && isAudioChunk(samples)) sessions.pushAudio(samples)
  })
}
