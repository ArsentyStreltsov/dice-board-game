import type { Player } from '@shared/game/types.ts'
import { Token } from './Token'
import './PlayerList.css'

type PlayerListProps = {
  players: Player[]
  currentPlayerId: number
}

export function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  return (
    <ul className="player-list">
      {players.map((player) => (
        <li
          key={player.id}
          className={`player-list__item ${
            player.id === currentPlayerId ? 'player-list__item--active' : ''
          }`}
        >
          <Token player={player} size="sm" />
          <span className="player-list__name">{player.name}</span>
          <span className="player-list__shape">{shapeLabel(player.shape)}</span>
        </li>
      ))}
    </ul>
  )
}

function shapeLabel(shape: Player['shape']): string {
  switch (shape) {
    case 'circle':
      return 'круг'
    case 'square':
      return 'квадрат'
    case 'triangle':
      return 'треугольник'
    case 'diamond':
      return 'ромб'
  }
}
