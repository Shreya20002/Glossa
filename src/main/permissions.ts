import { app, systemPreferences } from 'electron'

/**
 * Makes sure the operating system lets Glossa use the microphone.
 *
 * macOS asks the user once ("Glossa would like to access the microphone") and
 * remembers the answer. Windows has no per-app prompt for desktop apps; if
 * microphone access is turned off in Windows privacy settings, starting the
 * capture fails and the window explains what to do.
 */
export async function ensureMicrophoneAccess(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  // End-to-end tests feed a fake microphone that needs no OS permission.
  if (app.commandLine.hasSwitch('use-fake-device-for-media-stream')) return true

  const status = systemPreferences.getMediaAccessStatus('microphone')
  if (status === 'granted') return true
  if (status === 'not-determined') return systemPreferences.askForMediaAccess('microphone')
  return false
}
