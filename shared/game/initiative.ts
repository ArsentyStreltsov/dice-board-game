import type { DiceResult, InitiativeState, PlayerId } from './types.ts'

export function diceSum(dice: DiceResult): number {
  return dice.first + dice.second
}

export function createInitiative(contenders: PlayerId[]): InitiativeState {
  return {
    contenders: [...contenders],
    rolls: {},
    round: 1,
  }
}

export function canRollInitiative(
  state: InitiativeState,
  playerId: PlayerId,
): boolean {
  return (
    state.contenders.includes(playerId) && state.rolls[playerId] === undefined
  )
}

export function allContendersRolled(state: InitiativeState): boolean {
  return state.contenders.every((id) => state.rolls[id] !== undefined)
}

export type InitiativeResolveResult =
  | { kind: 'winner'; playerId: PlayerId }
  | { kind: 'reroll'; next: InitiativeState; tied: PlayerId[] }

/** Когда все претенденты бросили — выбрать победителя или новый круг ничьи. */
export function resolveInitiativeRound(
  state: InitiativeState,
): InitiativeResolveResult {
  const scored = state.contenders.map((playerId) => {
    const dice = state.rolls[playerId]
    if (!dice) {
      throw new Error(`Нет броска игрока ${playerId}`)
    }
    return { playerId, sum: diceSum(dice) }
  })

  const max = Math.max(...scored.map((s) => s.sum))
  const tied = scored.filter((s) => s.sum === max).map((s) => s.playerId)

  if (tied.length === 1) {
    return { kind: 'winner', playerId: tied[0]! }
  }

  return {
    kind: 'reroll',
    tied,
    next: {
      contenders: tied,
      rolls: {},
      round: state.round + 1,
    },
  }
}

export function applyInitiativeRoll(
  state: InitiativeState,
  playerId: PlayerId,
  dice: DiceResult,
): InitiativeState {
  if (!canRollInitiative(state, playerId)) {
    return state
  }
  return {
    ...state,
    rolls: {
      ...state.rolls,
      [playerId]: dice,
    },
  }
}

/** Для локального hotseat: кто сейчас должен бросать. */
export function nextInitiativeRoller(
  state: InitiativeState,
): PlayerId | null {
  return state.contenders.find((id) => state.rolls[id] === undefined) ?? null
}
