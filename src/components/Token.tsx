import type { Player, PlayerShape } from '@shared/game/types.ts'
import './Token.css'

type TokenProps = {
  player: Player
  size?: 'sm' | 'md'
  className?: string
}

export function Token({ player, size = 'md', className = '' }: TokenProps) {
  return (
    <span
      className={`token token--${size} token--${player.shape} ${className}`}
      style={{ color: player.color }}
      aria-label={player.name}
    >
      <Shape shape={player.shape} />
    </span>
  )
}

function Shape({ shape }: { shape: PlayerShape }) {
  switch (shape) {
    case 'circle':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="currentColor" />
        </svg>
      )
    case 'square':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" />
        </svg>
      )
    case 'triangle':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="12,3 22,21 2,21" fill="currentColor" />
        </svg>
      )
    case 'diamond':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="12,2 22,12 12,22 2,12" fill="currentColor" />
        </svg>
      )
  }
}
