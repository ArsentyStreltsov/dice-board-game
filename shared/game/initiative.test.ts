import { describe, expect, it } from 'vitest'
import {
  applyInitiativeRoll,
  createInitiative,
  resolveInitiativeRound,
} from './initiative.ts'

describe('initiative', () => {
  it('победитель — большая сумма', () => {
    let state = createInitiative([1, 2])
    state = applyInitiativeRoll(state, 1, { first: 2, second: 2 })
    state = applyInitiativeRoll(state, 2, { first: 5, second: 6 })
    const result = resolveInitiativeRound(state)
    expect(result).toEqual({ kind: 'winner', playerId: 2 })
  })

  it('ничья — новый круг только среди лидеров', () => {
    let state = createInitiative([1, 2, 3])
    state = applyInitiativeRoll(state, 1, { first: 6, second: 1 })
    state = applyInitiativeRoll(state, 2, { first: 3, second: 4 })
    state = applyInitiativeRoll(state, 3, { first: 2, second: 2 })
    const result = resolveInitiativeRound(state)
    expect(result.kind).toBe('reroll')
    if (result.kind === 'reroll') {
      expect(result.tied.sort()).toEqual([1, 2])
    }
  })
})
