import { describe, expect, it } from 'vitest'
import { chooseBotAction, rankMoves } from './botAi.ts'
import { createEmptyBoard } from './constants.ts'
import type { Board, CellAction, PlayerId } from './types.ts'

function boardWith(
  placements: Array<{ row: number; column: number; player: PlayerId }>,
): Board {
  const board = createEmptyBoard()
  for (const p of placements) {
    board[p.row - 1]![p.column - 1] = p.player
  }
  return board
}

describe('botAi', () => {
  it('hard берёт победный ход постановки', () => {
    const board = boardWith([
      { row: 2, column: 1, player: 2 },
      { row: 2, column: 2, player: 2 },
    ])
    const actions: CellAction[] = [
      { coordinate: { row: 2, column: 3 }, action: 'place' },
      { coordinate: { row: 3, column: 2 }, action: 'place' },
    ]
    const choice = chooseBotAction(board, 2, actions, 2, 'hard')
    expect(choice).toEqual({ row: 2, column: 3 })
  })

  it('предпочитает ломать двойку соперника удалением', () => {
    const board = boardWith([
      { row: 1, column: 1, player: 1 },
      { row: 1, column: 2, player: 1 },
      { row: 4, column: 4, player: 1 },
    ])
    const actions: CellAction[] = [
      { coordinate: { row: 1, column: 2 }, action: 'remove' },
      { coordinate: { row: 4, column: 4 }, action: 'remove' },
    ]
    const ranked = rankMoves(board, 2, actions, 2)
    expect(ranked[0]!.action.coordinate).toEqual({ row: 1, column: 2 })
  })

  it('между победой и удалением выбирает победу', () => {
    const board = boardWith([
      { row: 3, column: 1, player: 2 },
      { row: 3, column: 2, player: 2 },
      { row: 5, column: 5, player: 1 },
      { row: 5, column: 6, player: 1 },
    ])
    const actions: CellAction[] = [
      { coordinate: { row: 3, column: 3 }, action: 'place' },
      { coordinate: { row: 5, column: 5 }, action: 'remove' },
    ]
    const choice = chooseBotAction(board, 2, actions, 2, 'hard')
    expect(choice).toEqual({ row: 3, column: 3 })
  })
})
