import type { Player } from '@shared/game/types.ts'
import './GameOverModal.css'

type GameOverModalProps = {
  winner: Player
  onPlayAgain?: () => void
  playAgainLabel?: string
  playAgainDisabled?: boolean
  showPlayAgain?: boolean
  hint?: string
  onExitToMenu: () => void
}

export function GameOverModal({
  winner,
  onPlayAgain,
  playAgainLabel = 'Сыграть ещё раз',
  playAgainDisabled = false,
  showPlayAgain = true,
  hint,
  onExitToMenu,
}: GameOverModalProps) {
  return (
    <div className="game-over" role="dialog" aria-modal="true" aria-label="Победа">
      <div className="game-over__card">
        <p className="game-over__message">{winner.name} победил!</p>
        {hint ? <p className="game-over__hint">{hint}</p> : null}
        <div className="game-over__actions">
          {showPlayAgain && onPlayAgain ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={playAgainDisabled}
              onClick={onPlayAgain}
            >
              {playAgainLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onExitToMenu}
          >
            В главное меню
          </button>
        </div>
      </div>
    </div>
  )
}
