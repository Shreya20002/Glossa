import { app, ipcMain } from 'electron'
import { IpcChannel } from '../shared/ipc'
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

  // Audio arrives ~30 times a second, so bad messages are dropped silently
  // instead of throwing.
  ipcMain.on(IpcChannel.pushAudio, (event, samples: unknown) => {
    if (isTrustedSender(event, devServerUrl) && isAudioChunk(samples)) sessions.pushAudio(samples)
  })
}
