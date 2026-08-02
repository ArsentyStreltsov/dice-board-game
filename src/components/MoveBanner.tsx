import type { CSSProperties } from 'react'
import type { Coordinate, Player } from '@shared/game/types.ts'
import { formatCoordinate } from '@shared/game/gameLogic.ts'
import './MoveBanner.css'

export type MoveFlash = {
  player: Player
  coordinate: Coordinate
  kind: 'place' | 'remove'
} | null

type MoveBannerProps = {
  move: MoveFlash
}

export function MoveBanner({ move }: MoveBannerProps) {
  if (!move) return null

  const action =
    move.kind === 'place'
      ? `поставил(а) фишку на ${formatCoordinate(move.coordinate)}`
      : `убрал(а) фишку с ${formatCoordinate(move.coordinate)}`

  return (
    <div
      className="move-banner"
      style={{ '--banner-color': move.player.color } as CSSProperties}
      role="status"
    >
      <span
        className="move-banner__dot"
        style={{ background: move.player.color }}
      />
      <strong>{move.player.name}</strong>
      <span>{action}</span>
    </div>
  )
}
