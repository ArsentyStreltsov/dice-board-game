/** Звуки через Web Audio API. */

let ctx: AudioContext | null = null
let enabled = true
let unlocked = false

export function setSoundEnabled(value: boolean): void {
  enabled = value
  if (value) void unlockAudio()
}

export function getSoundEnabled(): boolean {
  return enabled
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

/** Вызывать на клике пользователя — иначе браузер глушит звук. */
export async function unlockAudio(): Promise<void> {
  const audio = getCtx()
  if (!audio) return
  if (audio.state === 'suspended') {
    try {
      await audio.resume()
    } catch {
      return
    }
  }
  if (!unlocked) {
    // Тихий «пинок», чтобы контекст точно ожил
    const g = audio.createGain()
    g.gain.value = 0.0001
    const osc = audio.createOscillator()
    osc.connect(g)
    g.connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + 0.01)
    unlocked = true
  }
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType,
  gain = 0.12,
  delay = 0,
): void {
  if (!enabled) return
  const audio = getCtx()
  if (!audio) return
  void audio.resume()

  const start = audio.currentTime + delay
  const osc = audio.createOscillator()
  const g = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, start)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), start + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(g)
  g.connect(audio.destination)
  osc.start(start)
  osc.stop(start + duration + 0.03)
}

function noiseBurst(duration: number, gain = 0.08, delay = 0): void {
  if (!enabled) return
  const audio = getCtx()
  if (!audio) return
  void audio.resume()

  const samples = Math.floor(audio.sampleRate * duration)
  const buffer = audio.createBuffer(1, samples, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < samples; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / samples)
  }
  const src = audio.createBufferSource()
  src.buffer = buffer
  const g = audio.createGain()
  const start = audio.currentTime + delay
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  src.connect(g)
  g.connect(audio.destination)
  src.start(start)
}

export function playClick(): void {
  tone(720, 0.045, 'sine', 0.07)
}

export function playDiceRoll(): void {
  noiseBurst(0.08, 0.1, 0)
  noiseBurst(0.07, 0.08, 0.06)
  noiseBurst(0.09, 0.09, 0.12)
  tone(180, 0.05, 'square', 0.04, 0.02)
  tone(140, 0.05, 'square', 0.035, 0.1)
}

export function playDiceLand(): void {
  noiseBurst(0.05, 0.12)
  tone(280, 0.1, 'triangle', 0.12)
  tone(420, 0.12, 'sine', 0.09, 0.04)
}

export function playPlace(): void {
  tone(480, 0.1, 'sine', 0.14)
  tone(720, 0.14, 'sine', 0.1, 0.05)
}

export function playRemove(): void {
  tone(260, 0.1, 'sawtooth', 0.08)
  tone(150, 0.16, 'triangle', 0.1, 0.04)
}

export function playWin(): void {
  tone(523, 0.14, 'sine', 0.12)
  tone(659, 0.14, 'sine', 0.12, 0.11)
  tone(784, 0.28, 'sine', 0.14, 0.22)
}

export function playSkip(): void {
  tone(200, 0.12, 'triangle', 0.07)
}
