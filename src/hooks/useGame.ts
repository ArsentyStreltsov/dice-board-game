import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
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
import type { Coordinate, DiceResult, PlayerId } from '@shared/game/types.ts'

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)
  const [isRolling, setIsRolling] = useState(false)
  const [displayDice, setDisplayDice] = useState<DiceResult | null>(null)
  const rollingRef = useRef(false)

  const startGame = useCallback(
    (
      playersCount: 2 | 3 | 4,
      colors?: Partial<Record<PlayerId, string>>,
    ) => {
      setDisplayDice(null)
      setIsRolling(false)
      rollingRef.current = false
      dispatch({
        type: 'START_GAME',
        playersCount,
        players: createPlayers(playersCount, colors),
      })
    },
    [],
  )

  const newGame = useCallback(() => {
    setDisplayDice(null)
    setIsRolling(false)
    rollingRef.current = false
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
      if (state.phase !== 'waitingForRoll') return
      animateThen(dice, () => {
        dispatch({ type: 'ROLL_DICE', dice })
      })
    },
    [animateThen, state.phase],
  )

  const roll = useCallback(() => {
    performRoll(rollDice())
  }, [performRoll])

  const rollInitiative = useCallback(() => {
    if (state.phase !== 'initiative' || !state.initiative) return
    const playerId = nextInitiativeRoller(state.initiative)
    if (!playerId) return
    const dice = rollDice()
    animateThen(dice, () => {
      dispatch({ type: 'INITIATIVE_ROLL', dice, playerId })
      setDisplayDice(null)
    })
  }, [animateThen, state.initiative, state.phase])

  const rollWithValues = useCallback(
    (first: number, second: number) => {
      if (state.phase === 'initiative') {
        const playerId = state.initiative
          ? nextInitiativeRoller(state.initiative)
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
    [animateThen, performRoll, state.initiative, state.phase],
  )

  const selectCell = useCallback((coordinate: Coordinate) => {
    if (rollingRef.current) return
    dispatch({ type: 'SELECT_CELL', coordinate })
    setDisplayDice(null)
  }, [])

  const completeSkip = useCallback(() => {
    dispatch({ type: 'COMPLETE_SKIP' })
    setDisplayDice(null)
  }, [])

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

  return {
    state,
    isRolling,
    shownDice,
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
