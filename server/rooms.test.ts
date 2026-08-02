import { describe, expect, it } from 'vitest'
import {
  applyInitiativeRoll,
  createInitiative,
  resolveInitiativeRound,
} from '../shared/game/initiative.ts'
import { RoomManager, generateCode, normalizeCode } from './rooms.ts'

describe('RoomManager', () => {
  it('создаёт комнату с кодом и хостом', () => {
    const manager = new RoomManager()
    const result = manager.createRoom('socket-1', 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.room.code).toHaveLength(6)
    expect(result.playerId).toBe(1)
    expect(result.isHost).toBe(true)
    expect(result.room.members).toHaveLength(1)
    expect(result.room.members[0]?.color).toBeTruthy()
  })

  it('позволяет присоединиться по коду', () => {
    const manager = new RoomManager()
    const created = manager.createRoom('socket-1', 2)
    if (!created.ok) throw new Error('create failed')

    const joined = manager.joinRoom('socket-2', created.room.code)
    expect(joined.ok).toBe(true)
    if (!joined.ok) return
    expect(joined.playerId).toBe(2)
    expect(joined.room.members).toHaveLength(2)
  })

  it('отклоняет вход в полную комнату', () => {
    const manager = new RoomManager()
    const created = manager.createRoom('s1', 2)
    if (!created.ok) throw new Error('create failed')
    manager.joinRoom('s2', created.room.code)

    const third = manager.joinRoom('s3', created.room.code)
    expect(third.ok).toBe(false)
  })

  it('не даёт выбрать занятый цвет', () => {
    const manager = new RoomManager()
    const created = manager.createRoom('s1', 2)
    if (!created.ok) throw new Error('create failed')
    const color = created.room.members[0]!.color
    manager.joinRoom('s2', created.room.code)
    const conflict = manager.setColor('s2', created.room.code, color)
    expect(conflict.ok).toBe(false)
  })

  it('заполняет пустые места ботами при старте', () => {
    const manager = new RoomManager()
    const created = manager.createRoom('s1', 4, 'Хост')
    if (!created.ok) throw new Error('create failed')
    manager.joinRoom('s2', created.room.code, 'Гость')

    const started = manager.startGame('s1', created.room.code)
    expect(started.ok).toBe(true)
    const room = manager.getRoomForTests(created.room.code)!
    expect(room.members).toHaveLength(4)
    expect(room.members.filter((m) => m.isBot)).toHaveLength(2)
    expect(room.status).toBe('initiative')
  })

  it('после старта идёт инициатива, ходит победитель броска', () => {
    const manager = new RoomManager()
    const created = manager.createRoom('s1', 2)
    if (!created.ok) throw new Error('create failed')
    manager.joinRoom('s2', created.room.code)
    const started = manager.startGame('s1', created.room.code)
    expect(started.ok).toBe(true)
    const room = manager.getRoomForTests(created.room.code)!
    expect(room.status).toBe('initiative')

    manager.initiativeRoll('s1', created.room.code)
    manager.initiativeRoll('s2', created.room.code)

    for (let i = 0; i < 40; i++) {
      const current = manager.getRoomForTests(created.room.code)!
      if (current.status === 'countdown' || current.status === 'playing') break
      const pending = current.initiative!.contenders.filter(
        (id) => current.initiative!.rolls[id] === undefined,
      )
      for (const id of pending) {
        const socket = id === 1 ? 's1' : 's2'
        manager.initiativeRoll(socket, created.room.code)
      }
    }

    const afterRolls = manager.getRoomForTests(created.room.code)!
    expect(['countdown', 'playing']).toContain(afterRolls.status)

    if (afterRolls.status === 'countdown') {
      expect(afterRolls.initiative?.winnerId).toBeTruthy()
      expect(afterRolls.initiative?.startsAt).toBeGreaterThan(Date.now() - 1000)
      // Force begin like timer
      manager['beginPlaying'](afterRolls, afterRolls.initiative!.winnerId!)
    }

    const finalRoom = manager.getRoomForTests(created.room.code)!
    expect(finalRoom.status).toBe('playing')
    expect(finalRoom.game?.phase).toBe('waitingForRoll')
    expect(finalRoom.game?.dice).toBeNull()

    const starter = finalRoom.game!.currentPlayerId
    const other = starter === 1 ? 's2' : 's1'
    const starterSocket = starter === 1 ? 's1' : 's2'

    expect(manager.roll(other, created.room.code).ok).toBe(false)
    expect(manager.roll(starterSocket, created.room.code).ok).toBe(true)
  })

  it('нормализует код комнаты', () => {
    expect(normalizeCode(' ab12cd ')).toBe('AB12CD')
  })

  it('генерирует код без неоднозначных символов', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode(6)
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/)
    }
  })
})

describe('initiative resolve', () => {
  it('выбирает игрока с большей суммой', () => {
    let state = createInitiative([1, 2])
    state = applyInitiativeRoll(state, 1, { first: 1, second: 2 })
    state = applyInitiativeRoll(state, 2, { first: 6, second: 6 })
    const result = resolveInitiativeRound(state)
    expect(result.kind).toBe('winner')
    if (result.kind === 'winner') expect(result.playerId).toBe(2)
  })

  it('при ничьей устраивает переброс', () => {
    let state = createInitiative([1, 2, 3])
    state = applyInitiativeRoll(state, 1, { first: 3, second: 3 })
    state = applyInitiativeRoll(state, 2, { first: 4, second: 2 })
    state = applyInitiativeRoll(state, 3, { first: 1, second: 1 })
    const result = resolveInitiativeRound(state)
    expect(result.kind).toBe('reroll')
    if (result.kind === 'reroll') {
      expect(result.tied).toEqual([1, 2])
      expect(result.next.contenders).toEqual([1, 2])
    }
  })
})
