import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { chooseBotAction, type BotDifficulty } from '@shared/game/botAi.ts'
import {
  BOT_THINK_MS,
  botDisplayName,
  createPlayers,
  DICE_ANIMATION_MS,
  POST_ACTION_PAUSE_MS,
  POST_ROLL_PAUSE_MS,
} from '@shared/game/constants.ts'
import { applyAction, rollDice } from '@shared/game/gameLogic.ts'
import { nextInitiativeRoller } from '@shared/game/initiative.ts'
import {
  createInitialState,
  gameReducer,
} from '@shared/game/gameReducer.ts'
import { checkWinner } from '@shared/game/winChecker.ts'
import type {
  Coordinate,
  DiceResult,
  PlayerId,
} from '@shared/game/types.ts'
import type { MoveFlash } from '../components/MoveBanner.tsx'
import {
  playDiceLand,
  playDiceRoll,
  playPlace,
  playRemove,
  playSkip,
  playWin,
} from '../lib/sounds.ts'

export type BotConfig = {
  botIds: PlayerId[]
  difficulty: BotDifficulty
}

export type StartGameOptions = {
  botDifficulty?: BotDifficulty
  names?: Partial<Record<PlayerId, string>>
  humanPlayerId?: PlayerId
}

function isBotId(botConfig: BotConfig | null, playerId: PlayerId | null): boolean {
  if (!botConfig || playerId === null) return false
  return botConfig.botIds.includes(playerId)
}

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)
  const [isRolling, setIsRolling] = useState(false)
  const [displayDice, setDisplayDice] = useState<DiceResult | null>(null)
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null)
  const [paceLocked, setPaceLocked] = useState(false)
  const [lastMove, setLastMove] = useState<MoveFlash>(null)
  const rollingRef = useRef(false)
  const botBusyRef = useRef(false)
  const paceUntilRef = useRef(0)
  const paceTimerRef = useRef<number | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const clearPaceTimer = useCallback(() => {
    if (paceTimerRef.current !== null) {
      window.clearTimeout(paceTimerRef.current)
      paceTimerRef.current = null
    }
  }, [])

  const lockPace = useCallback(
    (ms: number) => {
      clearPaceTimer()
      const until = Date.now() + ms
      paceUntilRef.current = until
      setPaceLocked(true)
      paceTimerRef.current = window.setTimeout(() => {
        paceTimerRef.current = null
        if (Date.now() >= paceUntilRef.current) {
          setPaceLocked(false)
        }
      }, ms)
    },
    [clearPaceTimer],
  )

  const startGame = useCallback(
    (
      playersCount: 2 | 3 | 4,
      colors?: Partial<Record<PlayerId, string>>,
      options?: StartGameOptions,
    ) => {
      setDisplayDice(null)
      setIsRolling(false)
      rollingRef.current = false
      botBusyRef.current = false
      clearPaceTimer()
      paceUntilRef.current = 0
      setPaceLocked(false)
      setLastMove(null)

      const humanId = options?.humanPlayerId ?? 1
      const names = { ...(options?.names ?? {}) }

      if (options?.botDifficulty) {
        const botIds: PlayerId[] = []
        for (let i = 1; i <= playersCount; i++) {
          const id = i as PlayerId
          if (id === humanId) continue
          botIds.push(id)
        }
        botIds.forEach((id, index) => {
          names[id] = botDisplayName(index + 1, botIds.length)
        })
        const players = createPlayers(playersCount, colors, names)
        setBotConfig({ botIds, difficulty: options.botDifficulty })
        dispatch({
          type: 'START_GAME',
          playersCount,
          players,
        })
      } else {
        setBotConfig(null)
        dispatch({
          type: 'START_GAME',
          playersCount,
          players: createPlayers(playersCount, colors, names),
        })
      }
    },
    [clearPaceTimer],
  )

  const newGame = useCallback(() => {
    setDisplayDice(null)
    setIsRolling(false)
    rollingRef.current = false
    botBusyRef.current = false
    clearPaceTimer()
    paceUntilRef.current = 0
    setPaceLocked(false)
    setLastMove(null)
    setBotConfig(null)
    dispatch({ type: 'NEW_GAME' })
  }, [clearPaceTimer])

  const animateThen = useCallback((dice: DiceResult, then: () => void) => {
    if (rollingRef.current) return
    rollingRef.current = true
    setIsRolling(true)
    playDiceRoll()

    const interval = window.setInterval(() => {
      setDisplayDice({
        first: Math.floor(Math.random() * 6) + 1,
        second: Math.floor(Math.random() * 6) + 1,
      })
    }, 55)

    window.setTimeout(() => {
      window.clearInterval(interval)
      setDisplayDice(dice)
      setIsRolling(false)
      rollingRef.current = false
      playDiceLand()
      then()
    }, DICE_ANIMATION_MS)
  }, [])

  const performRoll = useCallback(
    (dice: DiceResult) => {
      if (stateRef.current.phase !== 'waitingForRoll') return
      setLastMove(null)
      animateThen(dice, () => {
        dispatch({ type: 'ROLL_DICE', dice })
        lockPace(POST_ROLL_PAUSE_MS)
      })
    },
    [animateThen, lockPace],
  )

  const roll = useCallback(() => {
    if (isBotId(botConfig, stateRef.current.currentPlayerId)) return
    if (paceUntilRef.current > Date.now()) return
    performRoll(rollDice())
  }, [botConfig, performRoll])

  const rollInitiative = useCallback(() => {
    if (stateRef.current.phase !== 'initiative' || !stateRef.current.initiative) {
      return
    }
    const playerId = nextInitiativeRoller(stateRef.current.initiative)
    if (!playerId) return
    if (isBotId(botConfig, playerId)) return
    const dice = rollDice()
    animateThen(dice, () => {
      dispatch({ type: 'INITIATIVE_ROLL', dice, playerId })
      setDisplayDice(null)
      lockPace(POST_ROLL_PAUSE_MS)
    })
  }, [animateThen, botConfig, lockPace])

  const applyCellSelection = useCallback(
    (coordinate: Coordinate, actorId: PlayerId) => {
      const before = stateRef.current
      const action = before.availableActions.find(
        (a) =>
          a.coordinate.row === coordinate.row &&
          a.coordinate.column === coordinate.column,
      )
      const kind =
        action?.action === 'place' || action?.action === 'remove'
          ? action.action
          : null
      const actor = before.players.find((p) => p.id === actorId)

      let won = false
      if (kind === 'place') {
        const applied = applyAction(before.board, coordinate, actorId)
        if (applied.kind === 'place') {
          won = checkWinner(applied.board, actorId).won
        }
      }

      dispatch({ type: 'SELECT_CELL', coordinate })
      setDisplayDice(null)

      if (kind && actor) {
        setLastMove({ player: actor, coordinate, kind })
        if (kind === 'place') playPlace()
        else playRemove()
      }

      if (won) {
        playWin()
      } else {
        lockPace(POST_ACTION_PAUSE_MS)
      }
    },
    [lockPace],
  )

  const selectCell = useCallback(
    (coordinate: Coordinate) => {
      if (rollingRef.current) return
      if (paceUntilRef.current > Date.now()) return
      if (isBotId(botConfig, stateRef.current.currentPlayerId)) return
      applyCellSelection(coordinate, stateRef.current.currentPlayerId)
    },
    [applyCellSelection, botConfig],
  )

  const completeSkip = useCallback(() => {
    if (isBotId(botConfig, stateRef.current.currentPlayerId)) return
    if (paceUntilRef.current > Date.now()) return
    playSkip()
    dispatch({ type: 'COMPLETE_SKIP' })
    setDisplayDice(null)
    setLastMove(null)
    lockPace(POST_ACTION_PAUSE_MS)
  }, [botConfig, lockPace])

  const shownDice = displayDice ?? state.dice
  const isBotTurn = isBotId(botConfig, state.currentPlayerId)
  const canAct = !isRolling && !paceLocked && !isBotTurn

  useEffect(() => {
    if (state.phase !== 'countdown' || !state.initiative?.startsAt) return

    const delay = Math.max(0, state.initiative.startsAt - Date.now())
    const timer = window.setTimeout(() => {
      setDisplayDice(null)
      dispatch({ type: 'BEGIN_AFTER_COUNTDOWN' })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [state.phase, state.initiative?.startsAt, state.initiative?.winnerId])

  useEffect(() => {
    if (state.phase === 'waitingForRoll' && !state.dice) {
      setDisplayDice(null)
    }
  }, [state.phase, state.dice])

  // Автоход ботов
  useEffect(() => {
    if (!botConfig) return
    if (rollingRef.current || botBusyRef.current || isRolling || paceLocked) {
      return
    }

    if (state.phase === 'initiative' && state.initiative) {
      const roller = nextInitiativeRoller(state.initiative)
      if (!roller || !isBotId(botConfig, roller)) return
      botBusyRef.current = true
      const timer = window.setTimeout(() => {
        const dice = rollDice()
        animateThen(dice, () => {
          dispatch({ type: 'INITIATIVE_ROLL', dice, playerId: roller })
          setDisplayDice(null)
          lockPace(POST_ROLL_PAUSE_MS)
          botBusyRef.current = false
        })
      }, BOT_THINK_MS)
      return () => {
        window.clearTimeout(timer)
        botBusyRef.current = false
      }
    }

    if (!isBotId(botConfig, state.currentPlayerId)) return
    if (state.phase === 'gameOver' || state.phase === 'countdown') return

    const botId = state.currentPlayerId

    if (state.phase === 'waitingForRoll') {
      botBusyRef.current = true
      const timer = window.setTimeout(() => {
        performRoll(rollDice())
        botBusyRef.current = false
      }, BOT_THINK_MS)
      return () => {
        window.clearTimeout(timer)
        botBusyRef.current = false
      }
    }

    if (state.phase === 'selectingCell') {
      botBusyRef.current = true
      const timer = window.setTimeout(() => {
        const choice = chooseBotAction(
          state.board,
          botId,
          state.availableActions,
          state.playersCount,
          botConfig.difficulty,
        )
        if (choice) {
          applyCellSelection(choice, botId)
        }
        botBusyRef.current = false
      }, BOT_THINK_MS)
      return () => {
        window.clearTimeout(timer)
        botBusyRef.current = false
      }
    }

    if (state.phase === 'turnSkipped') {
      botBusyRef.current = true
      const timer = window.setTimeout(() => {
        playSkip()
        dispatch({ type: 'COMPLETE_SKIP' })
        setDisplayDice(null)
        setLastMove(null)
        lockPace(POST_ACTION_PAUSE_MS)
        botBusyRef.current = false
      }, BOT_THINK_MS)
      return () => {
        window.clearTimeout(timer)
        botBusyRef.current = false
      }
    }
  }, [
    animateThen,
    applyCellSelection,
    botConfig,
    isRolling,
    lockPace,
    paceLocked,
    performRoll,
    state.availableActions,
    state.board,
    state.currentPlayerId,
    state.initiative,
    state.phase,
    state.playersCount,
  ])

  return {
    state,
    isRolling,
    shownDice,
    botConfig,
    isBotTurn,
    paceLocked,
    canAct,
    lastMove,
    startGame,
    newGame,
    roll,
    rollInitiative,
    selectCell,
    completeSkip,
  }
}
