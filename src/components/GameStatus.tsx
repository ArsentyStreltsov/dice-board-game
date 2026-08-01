import type { CellAction, DiceResult, GamePhase, Player } from '@shared/game/types.ts'
import { formatCoordinate } from '@shared/game/gameLogic.ts'
import './GameStatus.css'

type GameStatusProps = {
  phase: GamePhase
  currentPlayer: Player | undefined
  dice: DiceResult | null
  availableActions: CellAction[]
  isRolling: boolean
}

export function GameStatus({
  phase,
  currentPlayer,
  dice,
  availableActions,
  isRolling,
}: GameStatusProps) {
  const playable = availableActions.filter(
    (a) => a.action === 'place' || a.action === 'remove',
  )

  let detail = 'Нажмите «Бросить кубики», чтобы начать ход.'

  if (isRolling) {
    detail = 'Бросок кубиков…'
  } else if (phase === 'selectingCell' && dice) {
    const coords = playable.map((a) => formatCoordinate(a.coordinate)).join(' или ')
    const doubleHint =
      dice.first === dice.second ? ' Дубль: после хода будет ещё один бросок.' : ''
    detail = `Выпало ${dice.first} и ${dice.second}. Доступны клетки: ${coords}.${doubleHint}`
  } else if (phase === 'turnSkipped' && dice) {
    const doubleHint =
      dice.first === dice.second
        ? ' После завершения хода будет ещё один бросок (дубль).'
        : ''
    detail = `Выпало ${dice.first} и ${dice.second}. Нет доступных действий. Ход пропущен.${doubleHint}`
  } else if (phase === 'gameOver') {
    detail = 'Игра окончена.'
  } else if (phase === 'waitingForRoll' && currentPlayer) {
    detail = `Ход: ${currentPlayer.name}. Бросьте кубики.`
  }

  return (
    <div className="game-status">
      <p className="game-status__turn">
        {currentPlayer ? `Ход: ${currentPlayer.name}` : 'Ожидание'}
      </p>
      <p className="game-status__detail">{detail}</p>
    </div>
  )
}
