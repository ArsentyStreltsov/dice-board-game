import { BOARD_SIZE, WIN_LENGTH } from './constants.ts'
import { applyAction, cloneBoard } from './gameLogic.ts'
import type { Board, Coordinate, PlayerId } from './types.ts'
import { checkWinner } from './winChecker.ts'

const DIRECTIONS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: -1 },
] as const

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

/** Длина непрерывной линии игрока, проходящей через клетку (1-based coord). */
export function lineLengthThrough(
  board: Board,
  player: PlayerId,
  coordinate: Coordinate,
): number {
  const r = coordinate.row - 1
  const c = coordinate.column - 1
  if (board[r]?.[c] !== player) return 0

  let best = 1
  for (const { dr, dc } of DIRECTIONS) {
    let len = 1
    let nr = r + dr
    let nc = c + dc
    while (inBounds(nr, nc) && board[nr]![nc] === player) {
      len++
      nr += dr
      nc += dc
    }
    nr = r - dr
    nc = c - dc
    while (inBounds(nr, nc) && board[nr]![nc] === player) {
      len++
      nr -= dr
      nc -= dc
    }
    if (len > best) best = len
  }
  return best
}

export function longestLine(board: Board, player: PlayerId): number {
  let best = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r]![c] !== player) continue
      const len = lineLengthThrough(board, player, {
        row: r + 1,
        column: c + 1,
      })
      if (len > best) best = len
    }
  }
  return best
}

export function countPieces(board: Board, player: PlayerId): number {
  let n = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r]![c] === player) n++
    }
  }
  return n
}

export function countAdjacentOwn(
  board: Board,
  player: PlayerId,
  coordinate: Coordinate,
): number {
  const r = coordinate.row - 1
  const c = coordinate.column - 1
  let n = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (inBounds(nr, nc) && board[nr]![nc] === player) n++
    }
  }
  return n
}

/** Насколько клетка «центральная» (бот любит центр). */
export function centerScore(coordinate: Coordinate): number {
  const mid = (BOARD_SIZE + 1) / 2
  const dist =
    Math.abs(coordinate.row - mid) + Math.abs(coordinate.column - mid)
  return Math.max(0, 6 - dist)
}

export function wouldWinByPlace(
  board: Board,
  player: PlayerId,
  coordinate: Coordinate,
): boolean {
  const next = cloneBoard(board)
  next[coordinate.row - 1]![coordinate.column - 1] = player
  return checkWinner(next, player).won
}

/** Длина линии, которая получится после постановки на пустую клетку. */
export function projectedLineAfterPlace(
  board: Board,
  player: PlayerId,
  coordinate: Coordinate,
): number {
  const next = applyAction(board, coordinate, player)
  if (next.kind !== 'place') return 0
  return lineLengthThrough(next.board, player, coordinate)
}

export function countOpenTwos(board: Board, player: PlayerId): number {
  let count = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r]![c] !== player) continue
      for (const { dr, dc } of DIRECTIONS) {
        const prevR = r - dr
        const prevC = c - dc
        if (inBounds(prevR, prevC) && board[prevR]![prevC] === player) continue

        let len = 0
        let nr = r
        let nc = c
        while (inBounds(nr, nc) && board[nr]![nc] === player) {
          len++
          nr += dr
          nc += dc
        }
        if (len === WIN_LENGTH - 1) count++
      }
    }
  }
  return count
}

export { WIN_LENGTH }
