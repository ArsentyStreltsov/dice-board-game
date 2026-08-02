import { randomBytes } from 'node:crypto'
import {
  createPlayers,
  defaultColorForSeat,
  botDisplayName,
  INITIATIVE_COUNTDOWN_MS,
  isValidColor,
  normalizeColor,
  PLAYER_SHAPES,
} from '../shared/game/constants.ts'
import { chooseBotAction } from '../shared/game/botAi.ts'
import { rollDice } from '../shared/game/gameLogic.ts'
import {
  allContendersRolled,
  applyInitiativeRoll,
  canRollInitiative,
  createInitiative,
  resolveInitiativeRound,
} from '../shared/game/initiative.ts'
import {
  createInitialState,
  gameReducer,
} from '../shared/game/gameReducer.ts'
import type {
  ActionResponse,
  Coordinate,
  DiceResult,
  GameState,
  InitiativeState,
  PlayerId,
  RoomJoinResponse,
  RoomMember,
  RoomPublic,
  RoomStatus,
} from '../shared/game/types.ts'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type Room = {
  code: string
  hostPlayerId: PlayerId
  playersCount: 2 | 3 | 4
  members: RoomMember[]
  status: RoomStatus
  game: GameState | null
  initiative: InitiativeState | null
}

export class RoomManager {
  private rooms = new Map<string, Room>()
  private countdownTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private botTimers = new Map<string, ReturnType<typeof setTimeout>>()

  /** Колбэк после автостарта партии — выставляет сервер index.ts */
  onCountdownFinished: ((code: string) => void) | null = null
  /** Колбэк после хода/броска бота */
  onBotUpdate: ((code: string, dice?: DiceResult) => void) | null = null

  private clearCountdownTimer(code: string): void {
    const timer = this.countdownTimers.get(code)
    if (timer) {
      clearTimeout(timer)
      this.countdownTimers.delete(code)
    }
  }

  private clearBotTimer(code: string): void {
    const timer = this.botTimers.get(code)
    if (timer) {
      clearTimeout(timer)
      this.botTimers.delete(code)
    }
  }

  scheduleBots(code: string, delayMs = 900): void {
    const normalized = normalizeCode(code)
    this.clearBotTimer(normalized)
    this.botTimers.set(
      normalized,
      setTimeout(() => {
        this.botTimers.delete(normalized)
        this.tickBots(normalized)
      }, delayMs),
    )
  }

  createRoom(
    socketId: string,
    playersCount: 2 | 3 | 4,
    rawName?: string,
  ): RoomJoinResponse {
    const code = this.generateUniqueCode()
    const token = createToken()
    const member: RoomMember = {
      socketId,
      playerId: 1,
      name: sanitizeName(rawName, 1),
      token,
      connected: true,
      color: defaultColorForSeat(0),
    }

    const room: Room = {
      code,
      hostPlayerId: 1,
      playersCount,
      members: [member],
      status: 'lobby',
      game: null,
      initiative: null,
    }

    this.rooms.set(code, room)

    return {
      ok: true,
      room: toPublic(room),
      playerId: 1,
      token,
      isHost: true,
    }
  }

  joinRoom(socketId: string, rawCode: string, rawName?: string): RoomJoinResponse {
    const code = normalizeCode(rawCode)
    const room = this.rooms.get(code)
    if (!room) {
      return { ok: false, error: 'Комната не найдена.' }
    }
    if (room.status !== 'lobby') {
      return {
        ok: false,
        error: 'Игра уже началась. Войдите через переподключение.',
      }
    }
    if (room.members.length >= room.playersCount) {
      return { ok: false, error: 'Комната заполнена.' }
    }

    const playerId = (room.members.length + 1) as PlayerId
    const taken = new Set(room.members.map((m) => m.color))
    let color = defaultColorForSeat(room.members.length)
    if (taken.has(color)) {
      color =
        [
          defaultColorForSeat(0),
          defaultColorForSeat(1),
          defaultColorForSeat(2),
          defaultColorForSeat(3),
          defaultColorForSeat(4),
          defaultColorForSeat(5),
          defaultColorForSeat(6),
          defaultColorForSeat(7),
          defaultColorForSeat(8),
          defaultColorForSeat(9),
        ].find((c) => !taken.has(c)) ?? defaultColorForSeat(playerId)
    }

    const token = createToken()
    const member: RoomMember = {
      socketId,
      playerId,
      name: sanitizeName(rawName, playerId),
      token,
      connected: true,
      color,
    }
    room.members.push(member)

    return {
      ok: true,
      room: toPublic(room),
      playerId,
      token,
      isHost: room.hostPlayerId === playerId,
    }
  }

  setName(socketId: string, rawCode: string, rawName: string): ActionResponse {
    const room = this.getRoom(rawCode)
    if (!room) return { ok: false, error: 'Комната не найдена.' }
    if (room.status !== 'lobby') {
      return { ok: false, error: 'Имя можно менять только в лобби.' }
    }

    const member = room.members.find((m) => m.socketId === socketId)
    if (!member) return { ok: false, error: 'Вы не в этой комнате.' }

    const name = sanitizeName(rawName, member.playerId)
    if (name.length < 2) {
      return { ok: false, error: 'Имя слишком короткое.' }
    }

    member.name = name
    return { ok: true }
  }

  setColor(
    socketId: string,
    rawCode: string,
    color: string,
  ): ActionResponse {
    const room = this.getRoom(rawCode)
    if (!room) return { ok: false, error: 'Комната не найдена.' }
    if (room.status !== 'lobby') {
      return { ok: false, error: 'Цвет можно менять только в лобби.' }
    }
    if (!isValidColor(color)) {
      return { ok: false, error: 'Некорректный цвет.' }
    }

    const hex = normalizeColor(color)
    const member = room.members.find((m) => m.socketId === socketId)
    if (!member) return { ok: false, error: 'Вы не в этой комнате.' }

    const taken = room.members.some(
      (m) => m.playerId !== member.playerId && m.color === hex,
    )
    if (taken) {
      return { ok: false, error: 'Этот цвет уже занят.' }
    }

    member.color = hex
    return { ok: true }
  }

  rejoinRoom(
    socketId: string,
    rawCode: string,
    token: string,
  ): RoomJoinResponse {
    const code = normalizeCode(rawCode)
    const room = this.rooms.get(code)
    if (!room) {
      return { ok: false, error: 'Комната не найдена.' }
    }

    const member = room.members.find((m) => m.token === token)
    if (!member) {
      return { ok: false, error: 'Сессия недействительна.' }
    }

    member.socketId = socketId
    member.connected = true

    return {
      ok: true,
      room: toPublic(room),
      playerId: member.playerId,
      token: member.token,
      isHost: room.hostPlayerId === member.playerId,
    }
  }

  leaveRoom(socketId: string, rawCode: string): ActionResponse {
    const room = this.getRoom(rawCode)
    if (!room) {
      return { ok: false, error: 'Комната не найдена.' }
    }

    const member = room.members.find((m) => m.socketId === socketId)
    if (!member) {
      return { ok: false, error: 'Вы не в этой комнате.' }
    }

    if (room.status === 'lobby') {
      room.members = room.members.filter((m) => m.socketId !== socketId)
      this.reassignPlayerIds(room)
      if (room.members.length === 0) {
        this.rooms.delete(room.code)
        return { ok: true }
      }
      if (member.playerId === room.hostPlayerId) {
        room.hostPlayerId = room.members[0]!.playerId
      }
    } else {
      member.connected = false
      member.socketId = null
    }

    return { ok: true }
  }

  markDisconnected(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      const member = room.members.find((m) => m.socketId === socketId)
      if (!member) continue
      member.connected = false
      member.socketId = null
      return room
    }
    return null
  }

  /** Хост запускает фазу определения первого хода */
  startGame(socketId: string, rawCode: string): ActionResponse {
    const room = this.getRoom(rawCode)
    if (!room) return { ok: false, error: 'Комната не найдена.' }

    const member = this.requireMember(room, socketId)
    if (!member.ok) return member

    if (member.playerId !== room.hostPlayerId) {
      return { ok: false, error: 'Только хост может начать игру.' }
    }
    if (room.status !== 'lobby') {
      return { ok: false, error: 'Игра уже запущена.' }
    }

    const humans = room.members.filter((m) => !m.isBot)
    if (humans.length < 1) {
      return { ok: false, error: 'Нужен хотя бы один игрок.' }
    }

    this.stripBots(room)
    this.fillEmptySeatsWithBots(room)

    const colors = Object.fromEntries(
      room.members.map((m) => [m.playerId, m.color]),
    ) as Partial<Record<PlayerId, string>>

    room.game = null
    room.initiative = createInitiative(
      room.members.map((m) => m.playerId),
    )
    room.status = 'initiative'
    room.game = {
      ...createInitialState(),
      phase: 'initiative',
      players: createPlayers(room.playersCount, colors).map((p) => ({
        ...p,
        name: room.members.find((m) => m.playerId === p.id)?.name ?? p.name,
        shape: PLAYER_SHAPES[p.id],
      })),
      playersCount: room.playersCount,
      initiative: room.initiative,
    }

    this.scheduleBots(room.code, 700)
    return { ok: true }
  }

  initiativeRoll(
    socketId: string,
    rawCode: string,
  ): ActionResponse & { dice?: DiceResult; countdown?: boolean } {
    const room = this.getRoom(rawCode)
    if (!room) return { ok: false, error: 'Комната не найдена.' }
    if (room.status !== 'initiative' || !room.initiative) {
      return { ok: false, error: 'Сейчас не фаза определения первого хода.' }
    }

    const member = this.requireMember(room, socketId)
    if (!member.ok) return member

    if (!canRollInitiative(room.initiative, member.playerId)) {
      return { ok: false, error: 'Вы уже бросили или сейчас не ваш черёд.' }
    }

    const dice = rollDice()
    room.initiative = applyInitiativeRoll(
      room.initiative,
      member.playerId,
      dice,
    )

    if (room.game) {
      room.game = {
        ...room.game,
        initiative: room.initiative,
        dice,
      }
    }

    if (!allContendersRolled(room.initiative)) {
      return { ok: true, dice }
    }

    const resolved = resolveInitiativeRound(room.initiative)
    if (resolved.kind === 'reroll') {
      room.initiative = resolved.next
      if (room.game) {
        room.game = {
          ...room.game,
          initiative: resolved.next,
          dice: null,
        }
      }
      return { ok: true, dice }
    }

    const startsAt = Date.now() + INITIATIVE_COUNTDOWN_MS
    room.initiative = {
      ...room.initiative,
      winnerId: resolved.playerId,
      startsAt,
    }
    room.status = 'countdown'
    if (room.game) {
      room.game = {
        ...room.game,
        phase: 'countdown',
        currentPlayerId: resolved.playerId,
        dice: null,
        initiative: room.initiative,
      }
    }

    this.clearCountdownTimer(room.code)
    this.countdownTimers.set(
      room.code,
      setTimeout(() => {
        this.countdownTimers.delete(room.code)
        const current = this.rooms.get(room.code)
        if (!current || current.status !== 'countdown') return
        this.beginPlaying(current, resolved.playerId)
        this.onCountdownFinished?.(current.code)
        this.scheduleBots(current.code, 800)
      }, INITIATIVE_COUNTDOWN_MS),
    )

    return { ok: true, dice, countdown: true }
  }

  returnToLobby(socketId: string, rawCode: string): ActionResponse {
    const room = this.getRoom(rawCode)
    if (!room) return { ok: false, error: 'Комната не найдена.' }

    const member = this.requireMember(room, socketId)
    if (!member.ok) return member
    if (member.playerId !== room.hostPlayerId) {
      return { ok: false, error: 'Только хост может вернуться в лобби.' }
    }

    this.clearCountdownTimer(room.code)
    this.clearBotTimer(room.code)
    room.game = null
    room.initiative = null
    room.status = 'lobby'
    this.stripBots(room)
    return { ok: true }
  }

  restartGame(socketId: string, rawCode: string): ActionResponse {
    const room = this.getRoom(rawCode)
    if (!room) return { ok: false, error: 'Комната не найдена.' }

    const member = this.requireMember(room, socketId)
    if (!member.ok) return member
    if (member.playerId !== room.hostPlayerId) {
      return { ok: false, error: 'Только хост может начать новую партию.' }
    }

    this.clearCountdownTimer(room.code)
    this.clearBotTimer(room.code)
    room.status = 'lobby'
    room.game = null
    room.initiative = null
    this.stripBots(room)
    return this.startGame(socketId, rawCode)
  }

  roll(
    socketId: string,
    rawCode: string,
  ): ActionResponse & { dice?: DiceResult } {
    const gated = this.gateTurn(socketId, rawCode, 'waitingForRoll')
    if (!gated.ok) return gated

    const dice = rollDice()
    const prev = gated.room.game!
    const next = gameReducer(prev, { type: 'ROLL_DICE', dice })
    if (next === prev && next.phase === prev.phase) {
      return { ok: false, error: 'Нельзя бросить кубики сейчас.' }
    }

    gated.room.game = next
    if (next.phase === 'gameOver') {
      gated.room.status = 'finished'
    }
    return { ok: true, dice }
  }

  selectCell(
    socketId: string,
    rawCode: string,
    coordinate: Coordinate,
  ): ActionResponse {
    const gated = this.gateTurn(socketId, rawCode, 'selectingCell')
    if (!gated.ok) return gated

    const prev = gated.room.game!
    const next = gameReducer(prev, { type: 'SELECT_CELL', coordinate })
    if (next === prev) {
      return { ok: false, error: 'Нельзя выбрать эту клетку.' }
    }

    gated.room.game = next
    if (next.phase === 'gameOver') {
      gated.room.status = 'finished'
    }
    return { ok: true }
  }

  completeSkip(socketId: string, rawCode: string): ActionResponse {
    const gated = this.gateTurn(socketId, rawCode, 'turnSkipped')
    if (!gated.ok) return gated

    const prev = gated.room.game!
    const next = gameReducer(prev, { type: 'COMPLETE_SKIP' })
    if (next === prev) {
      return { ok: false, error: 'Нельзя завершить ход сейчас.' }
    }

    gated.room.game = next
    return { ok: true }
  }

  getPublic(rawCode: string): RoomPublic | null {
    const room = this.getRoom(rawCode)
    return room ? toPublic(room) : null
  }

  getRoomBySocket(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.members.some((m) => m.socketId === socketId)) {
        return room
      }
    }
    return null
  }

  getRoomForTests(code: string): Room | undefined {
    return this.rooms.get(normalizeCode(code))
  }

  private beginPlaying(room: Room, startingPlayerId: PlayerId): void {
    this.clearCountdownTimer(room.code)
    const colors = Object.fromEntries(
      room.members.map((m) => [m.playerId, m.color]),
    ) as Partial<Record<PlayerId, string>>

    const players = createPlayers(room.playersCount, colors).map((p) => ({
      ...p,
      name: room.members.find((m) => m.playerId === p.id)?.name ?? p.name,
    }))

    room.game = gameReducer(createInitialState(), {
      type: 'START_GAME',
      playersCount: room.playersCount,
      players,
      startingPlayerId,
      skipInitiative: true,
    })
    room.game = {
      ...room.game,
      dice: null,
    }
    room.initiative = null
    room.status = 'playing'
  }

  private stripBots(room: Room): void {
    room.members = room.members.filter((m) => !m.isBot)
  }

  private fillEmptySeatsWithBots(room: Room): void {
    const takenColors = new Set(room.members.map((m) => m.color))
    const botsToAdd = room.playersCount - room.members.length
    if (botsToAdd <= 0) return

    let botIndex = 0
    while (room.members.length < room.playersCount) {
      botIndex++
      const playerId = (room.members.length + 1) as PlayerId
      let color = defaultColorForSeat(room.members.length)
      if (takenColors.has(color)) {
        color =
          [
            defaultColorForSeat(0),
            defaultColorForSeat(1),
            defaultColorForSeat(2),
            defaultColorForSeat(3),
            defaultColorForSeat(4),
            defaultColorForSeat(5),
            defaultColorForSeat(6),
            defaultColorForSeat(7),
            defaultColorForSeat(8),
            defaultColorForSeat(9),
          ].find((c) => !takenColors.has(c)) ?? defaultColorForSeat(playerId)
      }
      takenColors.add(color)
      room.members.push({
        socketId: null,
        playerId,
        name: botDisplayName(botIndex, botsToAdd),
        token: createToken(),
        connected: true,
        color,
        isBot: true,
      })
    }
  }

  private isBotPlayer(room: Room, playerId: PlayerId): boolean {
    return Boolean(room.members.find((m) => m.playerId === playerId)?.isBot)
  }

  private tickBots(code: string): void {
    const room = this.rooms.get(normalizeCode(code))
    if (!room) return

    if (room.status === 'initiative' && room.initiative) {
      const pendingBot = room.initiative.contenders.find(
        (id) =>
          room.initiative!.rolls[id] === undefined && this.isBotPlayer(room, id),
      )
      if (pendingBot === undefined) return

      const dice = rollDice()
      room.initiative = applyInitiativeRoll(room.initiative, pendingBot, dice)
      if (room.game) {
        room.game = {
          ...room.game,
          initiative: room.initiative,
          dice,
        }
      }

      if (!allContendersRolled(room.initiative)) {
        this.onBotUpdate?.(room.code, dice)
        this.scheduleBots(room.code, 750)
        return
      }

      const resolved = resolveInitiativeRound(room.initiative)
      if (resolved.kind === 'reroll') {
        room.initiative = resolved.next
        if (room.game) {
          room.game = {
            ...room.game,
            initiative: resolved.next,
            dice: null,
          }
        }
        this.onBotUpdate?.(room.code, dice)
        this.scheduleBots(room.code, 750)
        return
      }

      const startsAt = Date.now() + INITIATIVE_COUNTDOWN_MS
      room.initiative = {
        ...room.initiative,
        winnerId: resolved.playerId,
        startsAt,
      }
      room.status = 'countdown'
      if (room.game) {
        room.game = {
          ...room.game,
          phase: 'countdown',
          currentPlayerId: resolved.playerId,
          dice: null,
          initiative: room.initiative,
        }
      }

      this.clearCountdownTimer(room.code)
      this.countdownTimers.set(
        room.code,
        setTimeout(() => {
          this.countdownTimers.delete(room.code)
          const current = this.rooms.get(room.code)
          if (!current || current.status !== 'countdown') return
          this.beginPlaying(current, resolved.playerId)
          this.onCountdownFinished?.(current.code)
          this.scheduleBots(current.code, 800)
        }, INITIATIVE_COUNTDOWN_MS),
      )

      this.onBotUpdate?.(room.code, dice)
      return
    }

    if (room.status !== 'playing' || !room.game) return
    if (room.game.phase === 'gameOver') return
    if (!this.isBotPlayer(room, room.game.currentPlayerId)) return

    const botId = room.game.currentPlayerId

    if (room.game.phase === 'waitingForRoll') {
      const dice = rollDice()
      const next = gameReducer(room.game, { type: 'ROLL_DICE', dice })
      room.game = next
      this.onBotUpdate?.(room.code, dice)
      this.scheduleBots(room.code, 1600)
      return
    }

    if (room.game.phase === 'selectingCell') {
      const choice = chooseBotAction(
        room.game.board,
        botId,
        room.game.availableActions,
        room.game.playersCount,
        'medium',
      )
      if (!choice) return
      const next = gameReducer(room.game, {
        type: 'SELECT_CELL',
        coordinate: choice,
      })
      room.game = next
      if (next.phase === 'gameOver') {
        room.status = 'finished'
      }
      this.onBotUpdate?.(room.code)
      if (next.phase !== 'gameOver') {
        this.scheduleBots(room.code, 1800)
      }
      return
    }

    if (room.game.phase === 'turnSkipped') {
      const next = gameReducer(room.game, { type: 'COMPLETE_SKIP' })
      room.game = next
      this.onBotUpdate?.(room.code)
      this.scheduleBots(room.code, 1200)
    }
  }

  private gateTurn(
    socketId: string,
    rawCode: string,
    expectedPhase: GameState['phase'],
  ):
    | { ok: true; room: Room; playerId: PlayerId }
    | { ok: false; error: string } {
    const room = this.getRoom(rawCode)
    if (!room) return { ok: false, error: 'Комната не найдена.' }
    if (!room.game || (room.status !== 'playing' && room.status !== 'finished')) {
      if (!room.game) return { ok: false, error: 'Игра ещё не началась.' }
    }
    if (room.status === 'finished' && room.game?.phase === 'gameOver') {
      return { ok: false, error: 'Игра уже окончена.' }
    }

    const member = this.requireMember(room, socketId)
    if (!member.ok) return member

    if (!room.game) {
      return { ok: false, error: 'Игра ещё не началась.' }
    }
    if (room.game.phase !== expectedPhase) {
      return { ok: false, error: 'Сейчас нельзя выполнить это действие.' }
    }
    if (room.game.currentPlayerId !== member.playerId) {
      return { ok: false, error: 'Сейчас не ваш ход.' }
    }

    return { ok: true, room, playerId: member.playerId }
  }

  private requireMember(
    room: Room,
    socketId: string,
  ):
    | { ok: true; playerId: PlayerId }
    | { ok: false; error: string } {
    const member = room.members.find((m) => m.socketId === socketId)
    if (!member) {
      return { ok: false, error: 'Вы не в этой комнате.' }
    }
    return { ok: true, playerId: member.playerId }
  }

  private getRoom(rawCode: string): Room | null {
    return this.rooms.get(normalizeCode(rawCode)) ?? null
  }

  private generateUniqueCode(): string {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateCode(6)
      if (!this.rooms.has(code)) return code
    }
    throw new Error('Не удалось создать код комнаты.')
  }

  private reassignPlayerIds(room: Room): void {
    room.members = room.members.map((member, index) => {
      const playerId = (index + 1) as PlayerId
      return {
        ...member,
        playerId,
      }
    })
  }
}

export function sanitizeName(raw: string | undefined, playerId: PlayerId): string {
  const cleaned = (raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 20)
  if (cleaned.length >= 2) return cleaned
  return `Игрок ${playerId}`
}

export function generateCode(length: number): string {
  let code = ''
  const bytes = randomBytes(length)
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]
  }
  return code
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

export function createToken(): string {
  return randomBytes(16).toString('hex')
}

export function toPublic(room: Room): RoomPublic {
  return {
    code: room.code,
    hostPlayerId: room.hostPlayerId,
    playersCount: room.playersCount,
    members: room.members.map((m) => ({
      playerId: m.playerId,
      name: m.name,
      connected: m.connected,
      color: m.color,
      isBot: m.isBot,
    })),
    status: room.status,
    game: room.game,
    initiative: room.initiative,
  }
}
