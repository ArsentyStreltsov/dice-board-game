import { describe, expect, it } from 'vitest'
import {
  applyAction,
  getAvailableActions,
  getNextPlayer,
  getPossibleCoordinates,
  hasPlayableAction,
  rollDice,
} from './gameLogic.ts'
import { createEmptyBoard } from './constants.ts'
import { checkWinner } from './winChecker.ts'
import { createInitialState, gameReducer } from './gameReducer.ts'
import type { Board, PlayerId } from './types.ts'

function boardWith(
  placements: Array<{ row: number; column: number; player: PlayerId }>,
): Board {
  const board = createEmptyBoard()
  for (const p of placements) {
    board[p.row - 1][p.column - 1] = p.player
  }
  return board
}

describe('rollDice', () => {
  it('всегда даёт числа от 1 до 6', () => {
    for (let i = 0; i < 200; i++) {
      const dice = rollDice()
      expect(dice.first).toBeGreaterThanOrEqual(1)
      expect(dice.first).toBeLessThanOrEqual(6)
      expect(dice.second).toBeGreaterThanOrEqual(1)
      expect(dice.second).toBeLessThanOrEqual(6)
    }
  })
})

describe('getPossibleCoordinates', () => {
  it('бросок 3,5 создаёт координаты (3,5) и (5,3)', () => {
    expect(getPossibleCoordinates(3, 5)).toEqual([
      { row: 3, column: 5 },
      { row: 5, column: 3 },
    ])
  })

  it('дубль 4,4 создаёт только координату (4,4)', () => {
    expect(getPossibleCoordinates(4, 4)).toEqual([{ row: 4, column: 4 }])
  })
})

describe('applyAction', () => {
  it('на пустую клетку устанавливается фишка текущего игрока', () => {
    const board = createEmptyBoard()
    const result = applyAction(board, { row: 2, column: 3 }, 1)
    expect(result.kind).toBe('place')
    expect(result.board[1][2]).toBe(1)
  })

  it('чужая фишка удаляется, но новая не устанавливается', () => {
    const board = boardWith([{ row: 3, column: 5, player: 2 }])
    const result = applyAction(board, { row: 3, column: 5 }, 1)
    expect(result.kind).toBe('remove')
    expect(result.removedPlayer).toBe(2)
    expect(result.board[2][4]).toBeNull()
  })

  it('собственную фишку удалить нельзя', () => {
    const board = boardWith([{ row: 1, column: 1, player: 1 }])
    const result = applyAction(board, { row: 1, column: 1 }, 1)
    expect(result.kind).toBeNull()
    expect(result.board[0][0]).toBe(1)
  })
})

describe('getAvailableActions / skip turn', () => {
  it('если обе клетки заняты своими фишками, ход пропускается', () => {
    const board = boardWith([
      { row: 3, column: 5, player: 1 },
      { row: 5, column: 3, player: 1 },
    ])
    const actions = getAvailableActions(
      board,
      [
        { row: 3, column: 5 },
        { row: 5, column: 3 },
      ],
      1,
    )
    expect(actions.every((a) => a.action === 'blocked')).toBe(true)
    expect(hasPlayableAction(actions)).toBe(false)
  })
})

describe('checkWinner', () => {
  it('определяет горизонтальную победу', () => {
    const board = boardWith([
      { row: 2, column: 1, player: 1 },
      { row: 2, column: 2, player: 1 },
      { row: 2, column: 3, player: 1 },
    ])
    const result = checkWinner(board, 1)
    expect(result.won).toBe(true)
    expect(result.cells).toHaveLength(3)
  })

  it('определяет вертикальную победу', () => {
    const board = boardWith([
      { row: 1, column: 4, player: 2 },
      { row: 2, column: 4, player: 2 },
      { row: 3, column: 4, player: 2 },
    ])
    const result = checkWinner(board, 2)
    expect(result.won).toBe(true)
  })

  it('определяет диагональ слева сверху направо вниз', () => {
    const board = boardWith([
      { row: 2, column: 2, player: 1 },
      { row: 3, column: 3, player: 1 },
      { row: 4, column: 4, player: 1 },
    ])
    expect(checkWinner(board, 1).won).toBe(true)
  })

  it('определяет диагональ справа сверху налево вниз', () => {
    const board = boardWith([
      { row: 1, column: 5, player: 3 },
      { row: 2, column: 4, player: 3 },
      { row: 3, column: 3, player: 3 },
    ])
    expect(checkWinner(board, 3).won).toBe(true)
  })

  it('две фишки подряд не считаются победой', () => {
    const board = boardWith([
      { row: 1, column: 1, player: 1 },
      { row: 1, column: 2, player: 1 },
    ])
    expect(checkWinner(board, 1).won).toBe(false)
  })

  it('четыре фишки подряд считаются победой', () => {
    const board = boardWith([
      { row: 6, column: 1, player: 1 },
      { row: 6, column: 2, player: 1 },
      { row: 6, column: 3, player: 1 },
      { row: 6, column: 4, player: 1 },
    ])
    const result = checkWinner(board, 1)
    expect(result.won).toBe(true)
    expect(result.cells.length).toBeGreaterThanOrEqual(3)
  })

  it('последовательность с разрывом не считается победой', () => {
    const board = boardWith([
      { row: 1, column: 1, player: 1 },
      { row: 1, column: 2, player: 1 },
      { row: 1, column: 4, player: 1 },
    ])
    expect(checkWinner(board, 1).won).toBe(false)
  })
})

describe('getNextPlayer', () => {
  it('передаёт ход по кругу', () => {
    expect(getNextPlayer(1, 2)).toBe(2)
    expect(getNextPlayer(2, 2)).toBe(1)
    expect(getNextPlayer(4, 4)).toBe(1)
  })
})

describe('gameReducer doubles extra turn', () => {
  it('после действия на дубле тот же игрок ходит снова', () => {
    let state = gameReducer(createInitialState(), {
      type: 'START_GAME',
      playersCount: 2,
      skipInitiative: true,
      startingPlayerId: 1,
    })

    state = gameReducer(state, {
      type: 'ROLL_DICE',
      dice: { first: 4, second: 4 },
    })
    expect(state.phase).toBe('selectingCell')
    expect(state.currentPlayerId).toBe(1)

    state = gameReducer(state, {
      type: 'SELECT_CELL',
      coordinate: { row: 4, column: 4 },
    })

    expect(state.phase).toBe('waitingForRoll')
    expect(state.currentPlayerId).toBe(1)
    expect(state.board[3][3]).toBe(1)
  })

  it('без дубля ход переходит следующему игроку', () => {
    let state = gameReducer(createInitialState(), {
      type: 'START_GAME',
      playersCount: 2,
      skipInitiative: true,
      startingPlayerId: 1,
    })

    state = gameReducer(state, {
      type: 'ROLL_DICE',
      dice: { first: 2, second: 3 },
    })
    state = gameReducer(state, {
      type: 'SELECT_CELL',
      coordinate: { row: 2, column: 3 },
    })

    expect(state.phase).toBe('waitingForRoll')
    expect(state.currentPlayerId).toBe(2)
  })

  it('при пропуске хода на дубле игрок бросает снова', () => {
    let state = gameReducer(createInitialState(), {
      type: 'START_GAME',
      playersCount: 2,
      skipInitiative: true,
      startingPlayerId: 1,
    })

    state = {
      ...state,
      board: boardWith([{ row: 5, column: 5, player: 1 }]),
    }

    state = gameReducer(state, {
      type: 'ROLL_DICE',
      dice: { first: 5, second: 5 },
    })
    expect(state.phase).toBe('turnSkipped')

    state = gameReducer(state, { type: 'COMPLETE_SKIP' })
    expect(state.phase).toBe('waitingForRoll')
    expect(state.currentPlayerId).toBe(1)
  })
})

describe('gameReducer after win', () => {
  it('после победы нельзя продолжить игру', () => {
    let state = gameReducer(createInitialState(), {
      type: 'START_GAME',
      playersCount: 2,
      skipInitiative: true,
      startingPlayerId: 1,
    })

    state = {
      ...state,
      board: boardWith([
        { row: 1, column: 1, player: 1 },
        { row: 1, column: 2, player: 1 },
      ]),
      phase: 'selectingCell',
      dice: { first: 1, second: 3 },
      possibleCoordinates: [
        { row: 1, column: 3 },
        { row: 3, column: 1 },
      ],
      availableActions: [
        { coordinate: { row: 1, column: 3 }, action: 'place' },
        { coordinate: { row: 3, column: 1 }, action: 'place' },
      ],
      currentPlayerId: 1,
    }

    state = gameReducer(state, {
      type: 'SELECT_CELL',
      coordinate: { row: 1, column: 3 },
    })

    expect(state.phase).toBe('gameOver')
    expect(state.winner).toBe(1)

    const afterRoll = gameReducer(state, {
      type: 'ROLL_DICE',
      dice: { first: 2, second: 3 },
    })
    expect(afterRoll.phase).toBe('gameOver')
    expect(afterRoll.dice).toBeNull()

    const afterSelect = gameReducer(state, {
      type: 'SELECT_CELL',
      coordinate: { row: 2, column: 2 },
    })
    expect(afterSelect.phase).toBe('gameOver')
  })
})
