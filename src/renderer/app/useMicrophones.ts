import { useEffect, useState } from 'react'

/** Lists the computer's microphones, updating when one is plugged in or removed. */
export function useMicrophones(): MediaDeviceInfo[] {
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    const refresh = (): void => {
      void navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => setMicrophones(devices.filter((d) => d.kind === 'audioinput')))
    }
    refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh)
  }, [])

  return microphones
}

const STORAGE_KEY = 'glossa.microphoneId'

/** The chosen microphone is remembered on this computer. Empty means "system default". */
export function loadMicrophoneChoice(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveMicrophoneChoice(deviceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, deviceId)
  } catch {
    // Storage can be unavailable; the choice just won't be remembered.
  }
}
