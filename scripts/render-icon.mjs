// Draws build/icon.svg into the app icons electron-builder uses:
//
//   build/icon.png          macOS: the whole drawing, with the margin and shadow
//                           macOS's icon grid expects.
//   build/icon-windows.png  Windows: just the tile, filling the image, so the
//                           icon stays legible at taskbar size.
//
// Both are 1024 x 1024 with a transparent background; electron-builder turns
// them into the .icns and .ico files. Run `pnpm icon` after editing the SVG,
// and commit all three files.
//
// It uses Electron's own Chromium to draw the SVG, so no image library is
// needed. Nothing is downloaded: the SVG is read from disk and drawn offscreen.

import { readFile, writeFile } from 'node:fs/promises'
import { app, BrowserWindow } from 'electron'

const SIZE = 1024
const SOURCE = 'build/icon.svg'
/** Each icon, and the part of the SVG's 1024 x 1024 drawing it shows. */
const TARGETS = [
  { file: 'build/icon.png', viewBox: '0 0 1024 1024' },
  { file: 'build/icon-windows.png', viewBox: '100 100 824 824' },
]
/** How long to let Chromium draw before keeping the latest frame. */
const DRAW_TIME_MS = 1_000

// One pixel per SVG unit, whatever the screen's scaling setting.
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.disableHardwareAcceleration()
// Electron quits when its last window closes; this script quits when it's done.
app.on('window-all-closed', () => {})

/** Draws `svg` offscreen and returns the frame as a PNG. */
async function draw(svg) {
  const page = `<!doctype html><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block}</style>${svg}`
  // An offscreen window never appears on screen; Chromium hands each drawn
  // frame to the "paint" event instead.
  const window = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true },
  })
  let png = null
  window.webContents.on('paint', (_event, _dirty, frame) => {
    const { width, height } = frame.getSize()
    if (width === SIZE && height === SIZE) png = frame.toPNG()
  })
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`)
  window.webContents.invalidate()
  await new Promise((resolve) => setTimeout(resolve, DRAW_TIME_MS))
  window.destroy()
  if (!png) throw new Error(`Chromium didn't draw a ${SIZE} x ${SIZE} frame.`)
  return png
}

async function render() {
  await app.whenReady()
  const svg = await readFile(SOURCE, 'utf8')
  for (const { file, viewBox } of TARGETS) {
    await writeFile(file, await draw(svg.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`)))
    console.log(`Drew ${file} from ${SOURCE}.`)
  }
}

render()
  .then(() => app.quit())
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
