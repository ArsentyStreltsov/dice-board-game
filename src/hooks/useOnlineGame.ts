import { useCallback, useEffect, useRef, useState } from 'react'
import { DICE_ANIMATION_MS } from '@shared/game/constants.ts'
import type {
  Coordinate,
  DiceResult,
  PlayerId,
  RoomPublic,
} from '@shared/game/types.ts'
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

export function useOnlineGame() {
  const [status, setStatus] = useState<OnlineStatus>('idle')
  const [room, setRoom] = useState<RoomPublic | null>(null)
  const [playerId, setPlayerId] = useState<PlayerId | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [displayDice, setDisplayDice] = useState<DiceResult | null>(null)
  const rollingRef = useRef(false)

  const applyRoom = useCallback((next: RoomPublic, session?: Partial<Session>) => {
    setRoom(next)
    if (session?.playerId) setPlayerId(session.playerId)
    if (typeof session?.isHost === 'boolean') setIsHost(session.isHost)

    if (next.status === 'lobby') {
      setStatus('lobby')
      setDisplayDice(null)
      setIsRolling(false)
      rollingRef.current = false
    } else if (next.status === 'initiative') {
      setStatus('initiative')
    } else if (next.status === 'countdown') {
      setStatus('countdown')
      setIsRolling(false)
      rollingRef.current = false
    } else if (next.status === 'playing') {
      setStatus('playing')
      setDisplayDice(null)
      setIsRolling(false)
      rollingRef.current = false
    } else if (next.status === 'finished') {
      setStatus('finished')
    }
  }, [])

  const animateIncomingDice = useCallback((dice: DiceResult) => {
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
    }, DICE_ANIMATION_MS)
  }, [])

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
        setDisplayDice(null)
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

  const createRoom = useCallback((playersCount: 2 | 3 | 4) => {
    setError(null)
    setStatus('connecting')
    const socket = getSocket()
    socket.emit('room:create', { playersCount }, (response) => {
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
    })
  }, [applyRoom])

  const joinRoom = useCallback((code: string) => {
    setError(null)
    setStatus('connecting')
    const socket = getSocket()
    socket.emit('room:join', { code }, (response) => {
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
    })
  }, [applyRoom])

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

  const rollInitiative = useCallback(() => {
    if (!room || rollingRef.current) return
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
    disconnectSocket()
  }, [room])

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
      }
    })
  }, [room])

  const roll = useCallback(() => {
    if (!room || rollingRef.current) return
    getSocket().emit('game:roll', { code: room.code }, (response) => {
      if (!response.ok) setError(response.error)
    })
  }, [room])

  const selectCell = useCallback(
    (coordinate: Coordinate) => {
      if (!room || rollingRef.current) return
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
    createRoom,
    joinRoom,
    startGame,
    setColor,
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
