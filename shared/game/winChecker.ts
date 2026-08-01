import { BOARD_SIZE, WIN_LENGTH } from './constants.ts'
import type { Board, Coordinate, PlayerId, WinResult } from './types.ts'

const DIRECTIONS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: -1 },
] as const

export function checkWinner(
  board: Board,
  currentPlayer: PlayerId,
): WinResult {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== currentPlayer) continue

      for (const { dr, dc } of DIRECTIONS) {
        const prevR = r - dr
        const prevC = c - dc
        if (
          inBounds(prevR, prevC) &&
          board[prevR][prevC] === currentPlayer
        ) {
          continue
        }

        const cells: Coordinate[] = []
        let nr = r
        let nc = c

        while (
          inBounds(nr, nc) &&
          board[nr][nc] === currentPlayer
        ) {
          cells.push({ row: nr + 1, column: nc + 1 })
          nr += dr
          nc += dc
        }

        if (cells.length >= WIN_LENGTH) {
          return { won: true, cells }
        }
      }
    }
  }

  return { won: false, cells: [] }
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}
