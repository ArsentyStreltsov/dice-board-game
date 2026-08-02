import {
  createEmptyBoard,
  createPlayers,
  INITIATIVE_COUNTDOWN_MS,
  MAX_LOG_ENTRIES,
} from './constants.ts'
import {
  applyAction,
  checkWinner,
  formatCoordinate,
  getAvailableActions,
  getNextPlayer,
  getPossibleCoordinates,
  hasPlayableAction,
} from './gameLogic.ts'
import {
  allContendersRolled,
  applyInitiativeRoll,
  createInitiative,
  nextInitiativeRoller,
  resolveInitiativeRound,
} from './initiative.ts'
import type {
  Coordinate,
  DiceResult,
  GameState,
  LogEntry,
  Player,
  PlayerId,
} from './types.ts'

export type GameAction =
  | {
      type: 'START_GAME'
      playersCount: 2 | 3 | 4
      players?: Player[]
      /** Если задан — сразу игра без фазы инициативы */
      startingPlayerId?: PlayerId
      skipInitiative?: boolean
    }
  | { type: 'INITIATIVE_ROLL'; dice: DiceResult; playerId?: PlayerId }
  | { type: 'BEGIN_AFTER_COUNTDOWN' }
  | { type: 'ROLL_DICE'; dice: DiceResult }
  | { type: 'SELECT_CELL'; coordinate: Coordinate }
  | { type: 'COMPLETE_SKIP' }
  | { type: 'NEW_GAME' }

function createInitialState(): GameState {
  return {
    phase: 'setup',
    board: createEmptyBoard(),
    players: [],
    playersCount: 2,
    currentPlayerId: 1,
    dice: null,
    possibleCoordinates: [],
    availableActions: [],
    winner: null,
    winningCells: [],
    log: [],
    logCounter: 0,
    initiative: null,
  }
}

function addLog(
  state: GameState,
  message: string,
): Pick<GameState, 'log' | 'logCounter'> {
  const logCounter = state.logCounter + 1
  const entry: LogEntry = { id: logCounter, message }
  const log = [entry, ...state.log].slice(0, MAX_LOG_ENTRIES)
  return { log, logCounter }
}

function playerName(state: GameState, id: PlayerId): string {
  return state.players.find((p) => p.id === id)?.name ?? `Игрок ${id}`
}

function clearTurnFields(): Pick<
  GameState,
  'dice' | 'possibleCoordinates' | 'availableActions'
> {
  return {
    dice: null,
    possibleCoordinates: [],
    availableActions: [],
  }
}

function isDoubles(dice: DiceResult | null): boolean {
  return dice !== null && dice.first === dice.second
}

function passTurnAfterAction(state: GameState, nextState: GameState): GameState {
  if (isDoubles(state.dice)) {
    const withLog = {
      ...nextState,
      phase: 'waitingForRoll' as const,
      currentPlayerId: state.currentPlayerId,
      ...clearTurnFields(),
    }
    return {
      ...withLog,
      ...addLog(
        withLog,
        `Выпал дубль. ${playerName(state, state.currentPlayerId)} бросает ещё раз.`,
      ),
    }
  }

  const nextPlayer = getNextPlayer(state.currentPlayerId, state.playersCount)
  return {
    ...nextState,
    phase: 'waitingForRoll',
    currentPlayerId: nextPlayer,
    ...clearTurnFields(),
  }
}

function applyRoll(state: GameState, dice: DiceResult): GameState {
  if (state.phase !== 'waitingForRoll') {
    return state
  }

  const possibleCoordinates = getPossibleCoordinates(dice.first, dice.second)
  const availableActions = getAvailableActions(
    state.board,
    possibleCoordinates,
    state.currentPlayerId,
  )

  const doubleNote = isDoubles(dice)
    ? ' Дубль — после хода будет ещё один бросок.'
    : ''

  const afterRoll: GameState = {
    ...state,
    dice,
    possibleCoordinates,
    availableActions,
    ...addLog(
      state,
      `${playerName(state, state.currentPlayerId)} выбросил ${dice.first} и ${dice.second}.${doubleNote}`,
    ),
  }

  if (!hasPlayableAction(availableActions)) {
    return {
      ...afterRoll,
      phase: 'turnSkipped',
      ...addLog(afterRoll, 'Нет доступных действий. Ход пропущен.'),
    }
  }

  return {
    ...afterRoll,
    phase: 'selectingCell',
  }
}

function beginMatch(
  base: GameState,
  startingPlayerId: PlayerId,
  extraLog?: string,
): GameState {
  let next: GameState = {
    ...base,
    phase: 'waitingForRoll',
    currentPlayerId: startingPlayerId,
    initiative: null,
    ...clearTurnFields(),
  }
  if (extraLog) {
    next = { ...next, ...addLog(next, extraLog) }
  }
  return next
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const players =
        action.players ?? createPlayers(action.playersCount)
      const ids = players.map((p) => p.id)

      if (action.skipInitiative || action.startingPlayerId) {
        const starting = action.startingPlayerId ?? 1
        return beginMatch(
          {
            ...createInitialState(),
            players,
            playersCount: action.playersCount,
            board: createEmptyBoard(),
          },
          starting,
        )
      }

      const initiative = createInitiative(ids)
      const roller = nextInitiativeRoller(initiative) ?? 1
      const base: GameState = {
        ...createInitialState(),
        phase: 'initiative',
        players,
        playersCount: action.playersCount,
        currentPlayerId: roller,
        board: createEmptyBoard(),
        initiative,
      }
      return {
        ...base,
        ...addLog(
          base,
          'Определение первого хода: бросайте кубики. Ходит тот, у кого сумма больше.',
        ),
      }
    }

    case 'INITIATIVE_ROLL': {
      if (state.phase !== 'initiative' || !state.initiative) {
        return state
      }

      const playerId =
        action.playerId ?? nextInitiativeRoller(state.initiative)
      if (!playerId) return state

      const afterRoll = applyInitiativeRoll(
        state.initiative,
        playerId,
        action.dice,
      )
      if (afterRoll === state.initiative) {
        return state
      }

      const sum = action.dice.first + action.dice.second
      let nextState: GameState = {
        ...state,
        initiative: afterRoll,
        dice: action.dice,
        ...addLog(
          state,
          `${playerName(state, playerId)} (инициатива) выбросил ${action.dice.first} и ${action.dice.second} (сумма ${sum}).`,
        ),
      }

      if (!allContendersRolled(afterRoll)) {
        const nextRoller = nextInitiativeRoller(afterRoll)
        return {
          ...nextState,
          currentPlayerId: nextRoller ?? state.currentPlayerId,
        }
      }

      const resolved = resolveInitiativeRound(afterRoll)
      if (resolved.kind === 'winner') {
        const startsAt = Date.now() + INITIATIVE_COUNTDOWN_MS
        return {
          ...nextState,
          phase: 'countdown',
          currentPlayerId: resolved.playerId,
          dice: null,
          initiative: {
            ...afterRoll,
            winnerId: resolved.playerId,
            startsAt,
          },
          ...addLog(
            nextState,
            `${playerName(nextState, resolved.playerId)} ходит первым! Старт через ${Math.round(INITIATIVE_COUNTDOWN_MS / 1000)} сек.`,
          ),
        }
      }

      return {
        ...nextState,
        initiative: resolved.next,
        currentPlayerId: nextInitiativeRoller(resolved.next) ?? resolved.tied[0]!,
        dice: null,
        ...addLog(
          nextState,
          `Ничья по сумме у игроков ${resolved.tied.map((id) => id).join(', ')}. Переброс.`,
        ),
      }
    }

    case 'BEGIN_AFTER_COUNTDOWN': {
      if (state.phase !== 'countdown' || !state.initiative?.winnerId) {
        return state
      }
      return beginMatch(
        state,
        state.initiative.winnerId,
        `${playerName(state, state.initiative.winnerId)} начинает партию.`,
      )
    }

    case 'NEW_GAME': {
      return createInitialState()
    }

    case 'ROLL_DICE': {
      if (
        state.phase === 'gameOver' ||
        state.phase === 'initiative' ||
        state.phase === 'countdown'
      ) {
        return state
      }
      return applyRoll(state, action.dice)
    }

    case 'SELECT_CELL': {
      if (state.phase !== 'selectingCell') {
        return state
      }

      const cellAction = state.availableActions.find(
        (a) =>
          a.coordinate.row === action.coordinate.row &&
          a.coordinate.column === action.coordinate.column,
      )

      if (!cellAction || cellAction.action === 'blocked') {
        return state
      }

      const result = applyAction(
        state.board,
        action.coordinate,
        state.currentPlayerId,
      )

      if (result.kind === null) {
        return state
      }

      let nextState: GameState = {
        ...state,
        board: result.board,
      }

      if (result.kind === 'place') {
        nextState = {
          ...nextState,
          ...addLog(
            nextState,
            `${playerName(nextState, nextState.currentPlayerId)} поставил фишку на ${formatCoordinate(action.coordinate)}.`,
          ),
        }

        const win = checkWinner(result.board, state.currentPlayerId)
        if (win.won) {
          return {
            ...nextState,
            phase: 'gameOver',
            winner: state.currentPlayerId,
            winningCells: win.cells,
            ...clearTurnFields(),
            ...addLog(
              nextState,
              `${playerName(nextState, state.currentPlayerId)} победил!`,
            ),
          }
        }
      } else if (result.kind === 'remove' && result.removedPlayer !== null) {
        nextState = {
          ...nextState,
          ...addLog(
            nextState,
            `${playerName(nextState, nextState.currentPlayerId)} удалил фишку ${playerName(nextState, result.removedPlayer)} с ${formatCoordinate(action.coordinate)}.`,
          ),
        }
      }

      return passTurnAfterAction(state, nextState)
    }

    case 'COMPLETE_SKIP': {
      if (state.phase !== 'turnSkipped') {
        return state
      }

      return passTurnAfterAction(state, state)
    }

    default:
      return state
  }
}

export { createInitialState }
