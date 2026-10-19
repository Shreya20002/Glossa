import { join } from 'node:path'
import { BrowserWindow, nativeTheme, screen } from 'electron'
import type { WebPreferences } from 'electron'

/** Renderer pages; each one is a folder under src/renderer/ with an index.html. */
type RendererPage = 'app' | 'overlay'

/** Overlay size in pixels. The pill inside is smaller, leaving room for its shadow. */
const OVERLAY_WIDTH = 460
const OVERLAY_HEIGHT = 72

/** Gap between the overlay and the screen edge. */
const OVERLAY_MARGIN = 16

function securePreferences(extra: WebPreferences = {}): WebPreferences {
  return {
    preload: join(__dirname, '../preload/index.js'),
    // These are Electron's secure defaults; spelled out so nobody turns them off by accident.
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    ...extra,
  }
}

/** The main window: pick a microphone, start/stop sessions, see the result. */
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
    // This window captures the microphone, so keep it running at full speed
    // even when minimized or hidden behind the meeting app.
    webPreferences: securePreferences({ backgroundThrottling: false }),
  })
  window.once('ready-to-show', () => window.show())
  void loadPage(window, 'app', devServerUrl)
  return window
}

/**
 * The live coaching overlay: a small, frameless pill that floats above every
 * other window (including full-screen apps) in the top-right corner.
 */
export function createOverlayWindow(devServerUrl: string | undefined): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const window = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: Math.round(workArea.x + workArea.width - OVERLAY_WIDTH - OVERLAY_MARGIN),
    y: Math.round(workArea.y + OVERLAY_MARGIN),
    title: 'Glossa overlay',
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: securePreferences(),
  })
  // 'screen-saver' is the highest level, so the overlay stays above full-screen meeting apps.
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // The "invisible" part: ask the OS to leave this window out of screenshots and
  // screen sharing. Works on Windows 10 (2004+); on macOS it depends on the
  // version and on how the meeting app captures the screen.
  window.setContentProtection(true)
  // Appear without stealing keyboard focus from the meeting.
  window.once('ready-to-show', () => window.showInactive())
  void loadPage(window, 'overlay', devServerUrl)
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
