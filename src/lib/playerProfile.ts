const NAME_KEY = 'dice-grid-player-name'
const SOUND_KEY = 'dice-grid-sound-enabled'

export function loadPlayerName(): string {
  try {
    return localStorage.getItem(NAME_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function savePlayerName(name: string): void {
  const trimmed = name.trim().slice(0, 20)
  try {
    localStorage.setItem(NAME_KEY, trimmed)
  } catch {
    /* ignore */
  }
}

export function loadSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function saveSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function sanitizePlayerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 20)
}
