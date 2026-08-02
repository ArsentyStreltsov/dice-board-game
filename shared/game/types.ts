export type PlayerId = 1 | 2 | 3 | 4

export type CellValue = PlayerId | null

export type Coordinate = {
  row: number
  column: number
}

export type DiceResult = {
  first: number
  second: number
}

export type GamePhase =
  | 'setup'
  | 'initiative'
  | 'countdown'
  | 'waitingForRoll'
  | 'selectingCell'
  | 'turnSkipped'
  | 'gameOver'

export type ActionKind = 'place' | 'remove' | 'blocked'

export type CellAction = {
  coordinate: Coordinate
  action: ActionKind
}

export type PlayerShape = 'circle' | 'square' | 'triangle' | 'diamond'

export type Player = {
  id: PlayerId
  name: string
  color: string
  shape: PlayerShape
}

export type LogEntry = {
  id: number
  message: string
}

export type Board = CellValue[][]

export type InitiativeRollEntry = {
  playerId: PlayerId
  dice: DiceResult
  sum: number
}

export type InitiativeState = {
  contenders: PlayerId[]
  rolls: Partial<Record<PlayerId, DiceResult>>
  round: number
  /** Заполняется, когда первый игрок определён и идёт обратный отсчёт */
  winnerId?: PlayerId
  /** Unix timestamp (ms), когда начнётся партия */
  startsAt?: number
}

export type GameState = {
  phase: GamePhase
  board: Board
  players: Player[]
  playersCount: 2 | 3 | 4
  currentPlayerId: PlayerId
  dice: DiceResult | null
  possibleCoordinates: Coordinate[]
  availableActions: CellAction[]
  winner: PlayerId | null
  winningCells: Coordinate[]
  log: LogEntry[]
  logCounter: number
  initiative: InitiativeState | null
}

export type WinResult = {
  won: boolean
  cells: Coordinate[]
}

export type RoomMember = {
  socketId: string | null
  playerId: PlayerId
  name: string
  token: string
  connected: boolean
  color: string
  isBot?: boolean
}

export type RoomStatus = 'lobby' | 'initiative' | 'countdown' | 'playing' | 'finished'

export type RoomPublic = {
  code: string
  hostPlayerId: PlayerId
  playersCount: 2 | 3 | 4
  members: Array<{
    playerId: PlayerId
    name: string
    connected: boolean
    color: string
    isBot?: boolean
  }>
  status: RoomStatus
  game: GameState | null
  initiative: InitiativeState | null
}

export type ClientToServerEvents = {
  'room:create': (
    payload: { playersCount: 2 | 3 | 4; name?: string },
    callback: (response: RoomJoinResponse) => void,
  ) => void
  'room:join': (
    payload: { code: string; name?: string },
    callback: (response: RoomJoinResponse) => void,
  ) => void
  'room:rejoin': (
    payload: { code: string; token: string },
    callback: (response: RoomJoinResponse) => void,
  ) => void
  'room:setColor': (
    payload: { code: string; color: string },
    callback: (response: ActionResponse) => void,
  ) => void
  'room:setName': (
    payload: { code: string; name: string },
    callback: (response: ActionResponse) => void,
  ) => void
  'room:start': (
    payload: { code: string },
    callback: (response: ActionResponse) => void,
  ) => void
  'room:leave': (
    payload: { code: string },
    callback: (response: ActionResponse) => void,
  ) => void
  'room:returnToLobby': (
    payload: { code: string },
    callback: (response: ActionResponse) => void,
  ) => void
  'room:restartGame': (
    payload: { code: string },
    callback: (response: ActionResponse) => void,
  ) => void
  'initiative:roll': (
    payload: { code: string },
    callback: (response: ActionResponse & { dice?: DiceResult }) => void,
  ) => void
  'game:roll': (
    payload: { code: string },
    callback: (response: ActionResponse) => void,
  ) => void
  'game:selectCell': (
    payload: { code: string; coordinate: Coordinate },
    callback: (response: ActionResponse) => void,
  ) => void
  'game:completeSkip': (
    payload: { code: string },
    callback: (response: ActionResponse) => void,
  ) => void
}

export type ServerToClientEvents = {
  'room:updated': (room: RoomPublic) => void
  'game:state': (payload: { room: RoomPublic; dice?: DiceResult }) => void
  error: (payload: { message: string }) => void
}

export type RoomJoinResponse =
  | {
      ok: true
      room: RoomPublic
      playerId: PlayerId
      token: string
      isHost: boolean
    }
  | { ok: false; error: string }

export type ActionResponse = { ok: true } | { ok: false; error: string }
