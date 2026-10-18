import { app, ipcMain } from 'electron'
import { IpcChannel } from '../shared/ipc'
import { assertTrustedSender } from './security'

/** Answers requests that renderer windows send through `window.glossa`. */
export function registerIpcHandlers(devServerUrl: string | undefined): void {
  ipcMain.handle(IpcChannel.getAppVersion, (event) => {
    assertTrustedSender(event, devServerUrl)
    return app.getVersion()
  })
}
