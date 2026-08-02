import type { Board, Player, PlayerId, PlayerShape } from './types.ts'

export const BOARD_SIZE = 6
export const WIN_LENGTH = 3
export const MAX_LOG_ENTRIES = 10
/** Анимация вращения кубиков */
export const DICE_ANIMATION_MS = 700
/** Пауза после выпадения кубиков, чтобы успеть увидеть результат */
export const POST_ROLL_PAUSE_MS = 450
/** Пауза после хода (постановка/удаление), чтобы увидеть изменение на поле */
export const POST_ACTION_PAUSE_MS = 650
/** Пауза после определения первого игрока перед стартом партии */
export const INITIATIVE_COUNTDOWN_MS = 5000
/** Задержка «размышления» бота перед действием */
export const BOT_THINK_MS = 400

export type ColorOption = {
  id: string
  hex: string
  label: string
}

/** Палитра доступных цветов фишек */
export const COLOR_PALETTE: ColorOption[] = [
  { id: 'blue', hex: '#2563eb', label: 'Синий' },
  { id: 'red', hex: '#dc2626', label: 'Красный' },
  { id: 'green', hex: '#16a34a', label: 'Зелёный' },
  { id: 'amber', hex: '#d97706', label: 'Янтарный' },
  { id: 'violet', hex: '#7c3aed', label: 'Фиолетовый' },
  { id: 'pink', hex: '#db2777', label: 'Розовый' },
  { id: 'cyan', hex: '#0891b2', label: 'Бирюзовый' },
  { id: 'lime', hex: '#65a30d', label: 'Лайм' },
  { id: 'orange', hex: '#ea580c', label: 'Оранжевый' },
  { id: 'slate', hex: '#475569', label: 'Серый' },
]

export const PLAYER_SHAPES: Record<PlayerId, PlayerShape> = {
  1: 'circle',
  2: 'square',
  3: 'triangle',
  4: 'diamond',
}

export function getColorHex(colorIdOrHex: string): string {
  const found = COLOR_PALETTE.find(
    (c) => c.id === colorIdOrHex || c.hex === colorIdOrHex,
  )
  return found?.hex ?? colorIdOrHex
}

export function isValidColor(color: string): boolean {
  return COLOR_PALETTE.some((c) => c.hex === color || c.id === color)
}

export function normalizeColor(color: string): string {
  const found = COLOR_PALETTE.find((c) => c.hex === color || c.id === color)
  return found?.hex ?? COLOR_PALETTE[0]!.hex
}

export function defaultColorForSeat(seatIndex: number): string {
  return COLOR_PALETTE[seatIndex % COLOR_PALETTE.length]!.hex
}

export function createPlayers(
  count: 2 | 3 | 4,
  colors?: Partial<Record<PlayerId, string>>,
  names?: Partial<Record<PlayerId, string>>,
): Player[] {
  const players: Player[] = []
  for (let i = 1; i <= count; i++) {
    const id = i as PlayerId
    const customName = names?.[id]?.trim()
    players.push({
      id,
      name: customName && customName.length > 0 ? customName : `Игрок ${id}`,
      color: colors?.[id]
        ? normalizeColor(colors[id]!)
        : defaultColorForSeat(i - 1),
      shape: PLAYER_SHAPES[id],
    })
  }
  return players
}

export function botDisplayName(botIndex: number, botCount: number): string {
  if (botCount <= 1) return 'Компьютер'
  return `Компьютер ${botIndex}`
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  )
}
