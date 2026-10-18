import { join } from 'node:path'
import { BrowserWindow, nativeTheme } from 'electron'

/** Renderer pages; each one is a folder under src/renderer/ with an index.html. */
type RendererPage = 'app'

/** The main window: start/stop sessions and (later) the report card. */
export function createAppWindow(devServerUrl: string | undefined): BrowserWindow {
  const window = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 360,
    minHeight: 560,
    title: 'Glossa',
    // Stay hidden until the page has rendered, to avoid a blank white flash.
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#14161a' : '#fbfaf7',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // These are Electron's secure defaults; spelled out so nobody turns them off by accident.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  window.once('ready-to-show', () => window.show())
  void loadPage(window, 'app', devServerUrl)
  return window
}

function loadPage(
  window: BrowserWindow,
  page: RendererPage,
  devServerUrl: string | undefined,
): Promise<void> {
  // In `pnpm dev`, pages come from Vite's dev server so edits appear instantly.
  // In the packaged app, they're plain files inside the app bundle.
  return devServerUrl
    ? window.loadURL(`${devServerUrl}/${page}/index.html`)
    : window.loadFile(join(__dirname, `../renderer/${page}/index.html`))
}
