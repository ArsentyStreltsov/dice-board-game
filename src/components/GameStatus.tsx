import type { Player } from '@shared/game/types.ts'
import './GameStatus.css'

type GameStatusProps = {
  currentPlayer: Player | undefined
}

export function GameStatus({ currentPlayer }: GameStatusProps) {
  return (
    <div className="game-status">
      <p className="game-status__turn">
        {currentPlayer ? `Ход: ${currentPlayer.name}` : 'Ожидание'}
      </p>
    </div>
  )
}
