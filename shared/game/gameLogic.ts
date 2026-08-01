import { BOARD_SIZE } from './constants.ts'
import type {
  Board,
  CellAction,
  CellValue,
  Coordinate,
  DiceResult,
  PlayerId,
} from './types.ts'

export function rollDice(): DiceResult {
  return {
    first: randomDie(),
    second: randomDie(),
  }
}

export function randomDie(): number {
  return Math.floor(Math.random() * 6) + 1
}

export function getPossibleCoordinates(
  die1: number,
  die2: number,
): Coordinate[] {
  if (die1 === die2) {
    return [{ row: die1, column: die2 }]
  }
  return [
    { row: die1, column: die2 },
    { row: die2, column: die1 },
  ]
}

export function getCellValue(board: Board, coordinate: Coordinate): CellValue {
  return board[coordinate.row - 1][coordinate.column - 1]
}

export function getAvailableActions(
  board: Board,
  coordinates: Coordinate[],
  currentPlayer: PlayerId,
): CellAction[] {
  return coordinates.map((coordinate) => {
    const value = getCellValue(board, coordinate)
    if (value === null) {
      return { coordinate, action: 'place' }
    }
    if (value === currentPlayer) {
      return { coordinate, action: 'blocked' }
    }
    return { coordinate, action: 'remove' }
  })
}

export function hasPlayableAction(actions: CellAction[]): boolean {
  return actions.some((a) => a.action === 'place' || a.action === 'remove')
}

export type ApplyActionResult = {
  board: Board
  kind: 'place' | 'remove' | null
  removedPlayer: PlayerId | null
}

export function applyAction(
  board: Board,
  coordinate: Coordinate,
  currentPlayer: PlayerId,
): ApplyActionResult {
  const value = getCellValue(board, coordinate)

  if (value === currentPlayer) {
    return { board, kind: null, removedPlayer: null }
  }

  const nextBoard = cloneBoard(board)

  if (value === null) {
    nextBoard[coordinate.row - 1][coordinate.column - 1] = currentPlayer
    return { board: nextBoard, kind: 'place', removedPlayer: null }
  }

  nextBoard[coordinate.row - 1][coordinate.column - 1] = null
  return { board: nextBoard, kind: 'remove', removedPlayer: value }
}

export function getNextPlayer(
  currentPlayer: PlayerId,
  playersCount: number,
): PlayerId {
  const next = (currentPlayer % playersCount) + 1
  return next as PlayerId
}

export function coordinatesEqual(a: Coordinate, b: Coordinate): boolean {
  return a.row === b.row && a.column === b.column
}

export function formatCoordinate(coordinate: Coordinate): string {
  return `(${coordinate.row},${coordinate.column})`
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row])
}

export function setCell(
  board: Board,
  coordinate: Coordinate,
  value: CellValue,
): Board {
  const next = cloneBoard(board)
  next[coordinate.row - 1][coordinate.column - 1] = value
  return next
}

export function isValidCoordinate(coordinate: Coordinate): boolean {
  return (
    coordinate.row >= 1 &&
    coordinate.row <= BOARD_SIZE &&
    coordinate.column >= 1 &&
    coordinate.column <= BOARD_SIZE
  )
}

export { checkWinner } from './winChecker.ts'
