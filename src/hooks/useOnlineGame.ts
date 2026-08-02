import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DICE_ANIMATION_MS,
  POST_ACTION_PAUSE_MS,
  POST_ROLL_PAUSE_MS,
} from '@shared/game/constants.ts'
import type {
  Board,
  Coordinate,
  DiceResult,
  PlayerId,
  RoomPublic,
} from '@shared/game/types.ts'
import type { MoveFlash } from '../components/MoveBanner.tsx'
import { sanitizePlayerName } from '../lib/playerProfile.ts'
import {
  playDiceLand,
  playDiceRoll,
  playPlace,
  playRemove,
  playSkip,
  playWin,
} from '../lib/sounds.ts'
import { disconnectSocket, getSocket } from '../net/socket.ts'

const SESSION_KEY = 'dice-grid-online-session'

type Session = {
  code: string
  token: string
  playerId: PlayerId
  isHost: boolean
}

type OnlineStatus =
  | 'idle'
  | 'connecting'
  | 'lobby'
  | 'initiative'
  | 'countdown'
  | 'playing'
  | 'finished'
  | 'error'

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

function saveSession(session: Session | null): void {
  if (!session) {
    sessionStorage.removeItem(SESSION_KEY)
    return
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function findBoardDiff(
  prev: Board | null,
  next: Board,
): { coordinate: Coordinate; kind: 'place' | 'remove' } | null {
  if (!prev) return null
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r]!.length; c++) {
      const before = prev[r]![c]
      const after = next[r]![c]
      if (before === after) continue
      return {
        coordinate: { row: r + 1, column: c + 1 },
        kind: after === null ? 'remove' : 'place',
      }
    }
  }
  return null
}

export function useOnlineGame() {
  const [status, setStatus] = useState<OnlineStatus>('idle')
  const [room, setRoom] = useState<RoomPublic | null>(null)
  const [playerId, setPlayerId] = useState<PlayerId | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [displayDice, setDisplayDice] = useState<DiceResult | null>(null)
  const [paceLocked, setPaceLocked] = useState(false)
  const [lastMove, setLastMove] = useState<MoveFlash>(null)
  const rollingRef = useRef(false)
  const paceUntilRef = useRef(0)
  const paceTimerRef = useRef<number | null>(null)
  const prevBoardRef = useRef<Board | null>(null)
  const prevPhaseRef = useRef<string | null>(null)

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

  const applyRoom = useCallback(
    (next: RoomPublic, session?: Partial<Session>) => {
      setRoom(next)
      if (session?.playerId) setPlayerId(session.playerId)
      if (typeof session?.isHost === 'boolean') setIsHost(session.isHost)

      if (next.status === 'lobby') {
        setStatus('lobby')
        setDisplayDice(null)
        setIsRolling(false)
        rollingRef.current = false
        setLastMove(null)
        prevBoardRef.current = null
      } else if (next.status === 'initiative') {
        setStatus('initiative')
      } else if (next.status === 'countdown') {
        setStatus('countdown')
        setIsRolling(false)
        rollingRef.current = false
      } else if (next.status === 'playing') {
        setStatus('playing')
      } else if (next.status === 'finished') {
        setStatus('finished')
      }

      const game = next.game
      if (game) {
        const prevBoard = prevBoardRef.current
        const prevPhase = prevPhaseRef.current
        const diff = findBoardDiff(prevBoard, game.board)
        if (diff && game.players.length > 0) {
          const actorId =
            diff.kind === 'place'
              ? game.board[diff.coordinate.row - 1]![diff.coordinate.column - 1]
              : prevBoard?.[diff.coordinate.row - 1]?.[
                  diff.coordinate.column - 1
                ] ?? null
          const actor = game.players.find((p) => p.id === actorId)
          if (actor) {
            setLastMove({
              player: actor,
              coordinate: diff.coordinate,
              kind: diff.kind,
            })
            if (diff.kind === 'place') playPlace()
            else playRemove()
            if (game.phase === 'gameOver') playWin()
            else lockPace(POST_ACTION_PAUSE_MS)
          }
        } else if (
          prevPhase === 'turnSkipped' &&
          game.phase === 'waitingForRoll'
        ) {
          playSkip()
          setLastMove(null)
          lockPace(POST_ACTION_PAUSE_MS)
        }

        prevBoardRef.current = game.board.map((row) => [...row])
        prevPhaseRef.current = game.phase
      }
    },
    [lockPace],
  )

  const animateIncomingDice = useCallback(
    (dice: DiceResult) => {
      rollingRef.current = true
      setIsRolling(true)
      setLastMove(null)
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
        lockPace(POST_ROLL_PAUSE_MS)
      }, DICE_ANIMATION_MS)
    },
    [lockPace],
  )

  useEffect(() => {
    const socket = getSocket()

    const onUpdated = (next: RoomPublic) => {
      applyRoom(next)
    }

    const onGameState = (payload: {
      room: RoomPublic
      dice?: DiceResult
    }) => {
      applyRoom(payload.room)
      if (payload.room.status === 'playing' || payload.room.status === 'countdown') {
        if (payload.dice) {
          animateIncomingDice(payload.dice)
        } else if (payload.room.game?.phase === 'waitingForRoll') {
          setDisplayDice(null)
        }
        return
      }
      if (payload.dice) {
        animateIncomingDice(payload.dice)
      } else if (payload.room.game?.phase === 'waitingForRoll') {
        setDisplayDice(null)
      }
    }

    socket.on('room:updated', onUpdated)
    socket.on('game:state', onGameState)

    const existing = loadSession()
    if (existing) {
      setStatus('connecting')
      socket.emit(
        'room:rejoin',
        { code: existing.code, token: existing.token },
        (response) => {
          if (!response.ok) {
            saveSession(null)
            setStatus('idle')
            setError(response.error)
            return
          }
          saveSession({
            code: response.room.code,
            token: response.token,
            playerId: response.playerId,
            isHost: response.isHost,
          })
          setPlayerId(response.playerId)
          setIsHost(response.isHost)
          applyRoom(response.room, {
            playerId: response.playerId,
            isHost: response.isHost,
          })
          setError(null)
        },
      )
    }

    return () => {
      socket.off('room:updated', onUpdated)
      socket.off('game:state', onGameState)
    }
  }, [applyRoom, animateIncomingDice])

  const createRoom = useCallback(
    (playersCount: 2 | 3 | 4, name: string) => {
      setError(null)
      setStatus('connecting')
      const socket = getSocket()
      socket.emit(
        'room:create',
        { playersCount, name: sanitizePlayerName(name) },
        (response) => {
          if (!response.ok) {
            setStatus('error')
            setError(response.error)
            return
          }
          saveSession({
            code: response.room.code,
            token: response.token,
            playerId: response.playerId,
            isHost: response.isHost,
          })
          setPlayerId(response.playerId)
          setIsHost(response.isHost)
          applyRoom(response.room, {
            playerId: response.playerId,
            isHost: response.isHost,
          })
        },
      )
    },
    [applyRoom],
  )

  const joinRoom = useCallback(
    (code: string, name: string) => {
      setError(null)
      setStatus('connecting')
      const socket = getSocket()
      socket.emit(
        'room:join',
        { code, name: sanitizePlayerName(name) },
        (response) => {
          if (!response.ok) {
            setStatus('error')
            setError(response.error)
            return
          }
          saveSession({
            code: response.room.code,
            token: response.token,
            playerId: response.playerId,
            isHost: response.isHost,
          })
          setPlayerId(response.playerId)
          setIsHost(response.isHost)
          applyRoom(response.room, {
            playerId: response.playerId,
            isHost: response.isHost,
          })
        },
      )
    },
    [applyRoom],
  )

  const startGame = useCallback(() => {
    if (!room) return
    getSocket().emit('room:start', { code: room.code }, (response) => {
      if (!response.ok) setError(response.error)
    })
  }, [room])

  const setColor = useCallback(
    (color: string) => {
      if (!room) return
      getSocket().emit(
        'room:setColor',
        { code: room.code, color },
        (response) => {
          if (!response.ok) setError(response.error)
        },
      )
    },
    [room],
  )

  const setName = useCallback(
    (name: string) => {
      if (!room) return
      getSocket().emit(
        'room:setName',
        { code: room.code, name: sanitizePlayerName(name) },
        (response) => {
          if (!response.ok) setError(response.error)
        },
      )
    },
    [room],
  )

  const rollInitiative = useCallback(() => {
    if (!room || rollingRef.current) return
    if (paceUntilRef.current > Date.now()) return
    getSocket().emit('initiative:roll', { code: room.code }, (response) => {
      if (!response.ok) setError(response.error)
    })
  }, [room])

  const leaveRoom = useCallback(() => {
    if (room) {
      getSocket().emit('room:leave', { code: room.code }, () => undefined)
    }
    saveSession(null)
    setRoom(null)
    setPlayerId(null)
    setIsHost(false)
    setStatus('idle')
    setError(null)
    setDisplayDice(null)
    setLastMove(null)
    clearPaceTimer()
    setPaceLocked(false)
    disconnectSocket()
  }, [clearPaceTimer, room])

  const returnToLobby = useCallback(() => {
    if (!room) return
    getSocket().emit('room:returnToLobby', { code: room.code }, (response) => {
      if (!response.ok) setError(response.error)
    })
  }, [room])

  const restartGame = useCallback(() => {
    if (!room) return
    getSocket().emit('room:restartGame', { code: room.code }, (response) => {
      if (!response.ok) setError(response.error)
      else {
        setDisplayDice(null)
        setLastMove(null)
      }
    })
  }, [room])

  const roll = useCallback(() => {
    if (!room || rollingRef.current) return
    if (paceUntilRef.current > Date.now()) return
    getSocket().emit('game:roll', { code: room.code }, (response) => {
      if (!response.ok) setError(response.error)
    })
  }, [room])

  const selectCell = useCallback(
    (coordinate: Coordinate) => {
      if (!room || rollingRef.current) return
      if (paceUntilRef.current > Date.now()) return
      getSocket().emit(
        'game:selectCell',
        { code: room.code, coordinate },
        (response) => {
          if (!response.ok) setError(response.error)
          else setDisplayDice(null)
        },
      )
    },
    [room],
  )

  const completeSkip = useCallback(() => {
    if (!room) return
    if (paceUntilRef.current > Date.now()) return
    getSocket().emit('game:completeSkip', { code: room.code }, (response) => {
      if (!response.ok) setError(response.error)
      else setDisplayDice(null)
    })
  }, [room])

  const game = room?.game ?? null
  const isMyTurn =
    !!game && !!playerId && game.currentPlayerId === playerId
  const canRollInitiative =
    !!playerId &&
    room?.status === 'initiative' &&
    !!room.initiative &&
    room.initiative.contenders.includes(playerId) &&
    room.initiative.rolls[playerId] === undefined
  const shownDice = displayDice ?? game?.dice ?? null

  return {
    status,
    room,
    game,
    playerId,
    isHost,
    error,
    isRolling,
    shownDice,
    isMyTurn,
    canRollInitiative,
    paceLocked,
    lastMove,
    createRoom,
    joinRoom,
    startGame,
    setColor,
    setName,
    rollInitiative,
    leaveRoom,
    returnToLobby,
    restartGame,
    roll,
    selectCell,
    completeSkip,
    clearError: () => setError(null),
  }
}
