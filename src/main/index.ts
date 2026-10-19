import { app, BrowserWindow, session } from 'electron'
import { EngineHost } from './engine'
import { registerIpcHandlers } from './ipc'
import { blockNetworkRequests, hardenWebContents, restrictPermissions } from './security'
import { SessionController } from './session'
import { createAppWindow } from './windows'

// Entry point of the Electron main process: the "back end" that creates
// windows and is the only part of Glossa with full access to the computer.

/** Set by electron-vite during `pnpm dev`; always undefined in the packaged app. */
const devServerUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']

// Run every window's web content in Chromium's sandbox.
app.enableSandbox()

// Only one copy of Glossa at a time: a second launch focuses the first one.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  const engine = new EngineHost()
  const sessions = new SessionController(engine, devServerUrl)

  /** Opens the main window. Closing it ends any running session. */
  const openAppWindow = (): void => {
    createAppWindow(devServerUrl).on('closed', () => void sessions.stop())
  }

  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  app.on('web-contents-created', (_event, contents) => hardenWebContents(contents))

  void app.whenReady().then(() => {
    blockNetworkRequests(session.defaultSession, devServerUrl)
    restrictPermissions(session.defaultSession, devServerUrl)
    registerIpcHandlers(sessions, devServerUrl)
    openAppWindow()

    // macOS: clicking the dock icon with no windows open should open one.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) openAppWindow()
    })
  })

  // Windows/Linux apps quit when their last window closes; macOS apps don't.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => engine.dispose())
}
