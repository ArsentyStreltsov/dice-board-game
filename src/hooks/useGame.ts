import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { chooseBotAction, type BotDifficulty } from '@shared/game/botAi.ts'
import {
  createPlayers,
  DICE_ANIMATION_MS,
} from '@shared/game/constants.ts'
import { rollDice } from '@shared/game/gameLogic.ts'
import { nextInitiativeRoller } from '@shared/game/initiative.ts'
import {
  createInitialState,
  gameReducer,
} from '@shared/game/gameReducer.ts'
import type {
  Coordinate,
  DiceResult,
  Player,
  PlayerId,
} from '@shared/game/types.ts'

export type BotConfig = {
  playerId: PlayerId
  difficulty: BotDifficulty
}

const BOT_THINK_MS = 550

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)
  const [isRolling, setIsRolling] = useState(false)
  const [displayDice, setDisplayDice] = useState<DiceResult | null>(null)
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null)
  const rollingRef = useRef(false)
  const botBusyRef = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const startGame = useCallback(
    (
      playersCount: 2 | 3 | 4,
      colors?: Partial<Record<PlayerId, string>>,
      options?: { botDifficulty?: BotDifficulty },
    ) => {
      setDisplayDice(null)
      setIsRolling(false)
      rollingRef.current = false
      botBusyRef.current = false

      const players = createPlayers(playersCount, colors)
      if (options?.botDifficulty) {
        const withBotName: Player[] = players.map((p) =>
          p.id === 2 ? { ...p, name: 'Компьютер' } : p,
        )
        setBotConfig({ playerId: 2, difficulty: options.botDifficulty })
        dispatch({
          type: 'START_GAME',
          playersCount,
          players: withBotName,
        })
      } else {
        setBotConfig(null)
        dispatch({
          type: 'START_GAME',
          playersCount,
          players,
        })
      }
    },
    [],
  )

  const newGame = useCallback(() => {
    setDisplayDice(null)
    setIsRolling(false)
    rollingRef.current = false
    botBusyRef.current = false
    setBotConfig(null)
    dispatch({ type: 'NEW_GAME' })
  }, [])

  const animateThen = useCallback((dice: DiceResult, then: () => void) => {
    if (rollingRef.current) return
    rollingRef.current = true
    setIsRolling(true)

    const interval = window.setInterval(() => {
      setDisplayDice({
        first: Math.floor(Math.random() * 6) + 1,
        second: Math.floor(Math.random() * 6) + 1,
      })
    }, 50)

    window.setTimeout(() => {
      window.clearInterval(interval)
      setDisplayDice(dice)
      setIsRolling(false)
      rollingRef.current = false
      then()
    }, DICE_ANIMATION_MS)
  }, [])

  const performRoll = useCallback(
    (dice: DiceResult) => {
      if (stateRef.current.phase !== 'waitingForRoll') return
      animateThen(dice, () => {
        dispatch({ type: 'ROLL_DICE', dice })
      })
    },
    [animateThen],
  )

  const roll = useCallback(() => {
    if (botConfig && stateRef.current.currentPlayerId === botConfig.playerId) {
      return
    }
    performRoll(rollDice())
  }, [botConfig, performRoll])

  const rollInitiative = useCallback(() => {
    if (stateRef.current.phase !== 'initiative' || !stateRef.current.initiative) {
      return
    }
    const playerId = nextInitiativeRoller(stateRef.current.initiative)
    if (!playerId) return
    if (botConfig && playerId === botConfig.playerId) return
    const dice = rollDice()
    animateThen(dice, () => {
      dispatch({ type: 'INITIATIVE_ROLL', dice, playerId })
      setDisplayDice(null)
    })
  }, [animateThen, botConfig])

  const rollWithValues = useCallback(
    (first: number, second: number) => {
      if (stateRef.current.phase === 'initiative') {
        const playerId = stateRef.current.initiative
          ? nextInitiativeRoller(stateRef.current.initiative)
          : null
        if (!playerId) return
        const dice = { first, second }
        animateThen(dice, () => {
          dispatch({ type: 'INITIATIVE_ROLL', dice, playerId })
          setDisplayDice(null)
        })
        return
      }
      performRoll({ first, second })
    },
    [animateThen, performRoll],
  )

  const selectCell = useCallback(
    (coordinate: Coordinate) => {
      if (rollingRef.current) return
      if (botConfig && stateRef.current.currentPlayerId === botConfig.playerId) {
        return
      }
      dispatch({ type: 'SELECT_CELL', coordinate })
      setDisplayDice(null)
    },
    [botConfig],
  )

  const completeSkip = useCallback(() => {
    if (botConfig && stateRef.current.currentPlayerId === botConfig.playerId) {
      return
    }
    dispatch({ type: 'COMPLETE_SKIP' })
    setDisplayDice(null)
  }, [botConfig])

  const devClearBoard = useCallback(() => {
    dispatch({ type: 'DEV_CLEAR_BOARD' })
    setDisplayDice(null)
  }, [])

  const devNextPlayer = useCallback(() => {
    dispatch({ type: 'DEV_NEXT_PLAYER' })
    setDisplayDice(null)
  }, [])

  const devSetCell = useCallback(
    (coordinate: Coordinate, playerId: PlayerId | null) => {
      dispatch({ type: 'DEV_SET_CELL', coordinate, playerId })
      setDisplayDice(null)
    },
    [],
  )

  const shownDice = displayDice ?? state.dice
  const isBotTurn = Boolean(
    botConfig && state.currentPlayerId === botConfig.playerId,
  )

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

  // Автоход бота
  useEffect(() => {
    if (!botConfig) return
    if (rollingRef.current || botBusyRef.current || isRolling) return

    const botId = botConfig.playerId

    if (state.phase === 'initiative' && state.initiative) {
      const roller = nextInitiativeRoller(state.initiative)
      if (roller !== botId) return
      botBusyRef.current = true
      const timer = window.setTimeout(() => {
        const dice = rollDice()
        animateThen(dice, () => {
          dispatch({ type: 'INITIATIVE_ROLL', dice, playerId: botId })
          setDisplayDice(null)
          botBusyRef.current = false
        })
      }, BOT_THINK_MS)
      return () => {
        window.clearTimeout(timer)
        botBusyRef.current = false
      }
    }

    if (state.currentPlayerId !== botId) return
    if (state.phase === 'gameOver' || state.phase === 'countdown') return

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
          dispatch({ type: 'SELECT_CELL', coordinate: choice })
          setDisplayDice(null)
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
        dispatch({ type: 'COMPLETE_SKIP' })
        setDisplayDice(null)
        botBusyRef.current = false
      }, BOT_THINK_MS)
      return () => {
        window.clearTimeout(timer)
        botBusyRef.current = false
      }
    }
  }, [
    animateThen,
    botConfig,
    isRolling,
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
    startGame,
    newGame,
    roll,
    rollInitiative,
    rollWithValues,
    selectCell,
    completeSkip,
    devClearBoard,
    devNextPlayer,
    devSetCell,
  }
}
