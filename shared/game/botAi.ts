import {
  centerScore,
  countAdjacentOwn,
  countOpenTwos,
  countPieces,
  lineLengthThrough,
  longestLine,
  projectedLineAfterPlace,
  wouldWinByPlace,
} from './botEval.ts'
import { applyAction } from './gameLogic.ts'
import type { Board, CellAction, Coordinate, PlayerId } from './types.ts'

export type BotDifficulty = 'easy' | 'medium' | 'hard'

export type ScoredMove = {
  action: CellAction
  score: number
}

function opponentIds(
  board: Board,
  botId: PlayerId,
  playersCount: number,
): PlayerId[] {
  const ids: PlayerId[] = []
  for (let i = 1; i <= playersCount; i++) {
    const id = i as PlayerId
    if (id !== botId) ids.push(id)
  }
  // Prefer opponents who actually have pieces
  return ids.sort(
    (a, b) => countPieces(board, b) - countPieces(board, a),
  )
}

export function scorePlace(
  board: Board,
  botId: PlayerId,
  coordinate: Coordinate,
  opponents: PlayerId[],
): number {
  if (wouldWinByPlace(board, botId, coordinate)) {
    return 100_000
  }

  const projected = projectedLineAfterPlace(board, botId, coordinate)
  let score = 0
  score += projected * 120
  score += countAdjacentOwn(board, botId, coordinate) * 28
  score += centerScore(coordinate) * 8

  const after = applyAction(board, coordinate, botId)
  if (after.kind === 'place') {
    score += countOpenTwos(after.board, botId) * 55
    score += longestLine(after.board, botId) * 25
  }

  // Бонус, если клетка «мешает» сильной линии соперника рядом
  for (const opp of opponents) {
    const threatNear = countAdjacentOwn(board, opp, coordinate)
    score += threatNear * 12
  }

  return score
}

export function scoreRemove(
  board: Board,
  botId: PlayerId,
  coordinate: Coordinate,
  victim: PlayerId,
  opponents: PlayerId[],
): number {
  const brokenLen = lineLengthThrough(board, victim, coordinate)
  let score = 40
  score += brokenLen * 90
  if (brokenLen >= 2) score += 220
  if (brokenLen >= 3) score += 800

  score += longestLine(board, victim) * 45
  score += countOpenTwos(board, victim) * 35
  score += countPieces(board, victim) * 6

  // Сильнейшего соперника бить выгоднее
  const rank = opponents.indexOf(victim)
  if (rank === 0) score += 40
  else if (rank === 1) score += 15

  // Небольшой приоритет центру (ломать контроль)
  score += centerScore(coordinate) * 4

  // Сравнение с альтернативой «поставить» не здесь — только оценка remove
  void botId
  return score
}

export function scoreAction(
  board: Board,
  botId: PlayerId,
  action: CellAction,
  playersCount: number,
): number {
  if (action.action === 'blocked') return Number.NEGATIVE_INFINITY

  const opponents = opponentIds(board, botId, playersCount)

  if (action.action === 'place') {
    return scorePlace(board, botId, action.coordinate, opponents)
  }

  const victim = board[action.coordinate.row - 1]![action.coordinate.column - 1]
  if (victim === null || victim === botId) {
    return Number.NEGATIVE_INFINITY
  }
  return scoreRemove(board, botId, action.coordinate, victim, opponents)
}

export function rankMoves(
  board: Board,
  botId: PlayerId,
  actions: CellAction[],
  playersCount: number,
): ScoredMove[] {
  return actions
    .filter((a) => a.action === 'place' || a.action === 'remove')
    .map((action) => ({
      action,
      score: scoreAction(board, botId, action, playersCount),
    }))
    .sort((a, b) => b.score - a.score)
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

/** Softmax-like: чаще лучшие, иногда хуже. */
function pickWeighted(scored: ScoredMove[], temperature: number): CellAction {
  if (scored.length === 1) return scored[0]!.action
  const max = scored[0]!.score
  const weights = scored.map((m) => {
    const shifted = (m.score - max) / Math.max(1, temperature)
    return Math.exp(shifted)
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * sum
  for (let i = 0; i < scored.length; i++) {
    r -= weights[i]!
    if (r <= 0) return scored[i]!.action
  }
  return scored[0]!.action
}

/**
 * Выбор хода бота.
 * easy — часто слабо / почти случайно среди допустимых;
 * medium — обычно хороший ход, иногда ошибка;
 * hard — всегда лучший по эвристике.
 */
export function chooseBotAction(
  board: Board,
  botId: PlayerId,
  actions: CellAction[],
  playersCount: number,
  difficulty: BotDifficulty,
): Coordinate | null {
  const ranked = rankMoves(board, botId, actions, playersCount)
  if (ranked.length === 0) return null

  // Очевидный выигрыш hard/medium почти всегда берут
  const winning = ranked.filter((m) => m.score >= 100_000)
  if (winning.length > 0) {
    if (difficulty === 'easy' && Math.random() < 0.35) {
      // иногда «не замечает» победу
    } else {
      return pickRandom(winning).action.coordinate
    }
  }

  if (difficulty === 'hard') {
    const best = ranked[0]!.score
    const top = ranked.filter((m) => m.score >= best - 1)
    return pickRandom(top).action.coordinate
  }

  if (difficulty === 'medium') {
    if (Math.random() < 0.18 && ranked.length > 1) {
      return pickWeighted(ranked.slice(0, Math.min(3, ranked.length)), 80)
        .coordinate
    }
    const best = ranked[0]!.score
    const top = ranked.filter((m) => m.score >= best - 25)
    return pickRandom(top).action.coordinate
  }

  // easy
  if (Math.random() < 0.45) {
    return pickRandom(ranked).action.coordinate
  }
  return pickWeighted(ranked.slice(0, Math.min(4, ranked.length)), 140)
    .coordinate
}
