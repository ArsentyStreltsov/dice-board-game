import type { CSSProperties } from 'react'
import type { ActionKind, CellValue, Coordinate, Player } from '@shared/game/types.ts'
import { Token } from './Token'
import './Cell.css'

type CellProps = {
  row: number
  column: number
  value: CellValue
  players: Player[]
  highlighted: boolean
  selectable: boolean
  actionKind: ActionKind | null
  accentColor: string
  isWinning: boolean
  isDimmed: boolean
  onSelect: (coordinate: Coordinate) => void
}

export function Cell({
  row,
  column,
  value,
  players,
  highlighted,
  selectable,
  actionKind,
  accentColor,
  isWinning,
  isDimmed,
  onSelect,
}: CellProps) {
  const player = value ? players.find((p) => p.id === value) : undefined
  const coordinate = { row, column }

  let hint = `Клетка (${row},${column})`
  if (highlighted && actionKind === 'place') {
    hint = selectable ? 'Поставить фишку' : 'Можно поставить фишку'
  } else if (highlighted && actionKind === 'remove') {
    hint = selectable ? 'Удалить фишку' : 'Можно удалить фишку'
  }

  const classNames = [
    'cell',
    highlighted ? 'cell--highlighted' : '',
    selectable ? 'cell--selectable' : '',
    isWinning ? 'cell--winning' : '',
    isDimmed ? 'cell--dimmed' : '',
    actionKind === 'place' && highlighted ? 'cell--place' : '',
    actionKind === 'remove' && highlighted ? 'cell--remove' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classNames}
      style={{ '--cell-accent': accentColor } as CSSProperties}
      title={hint}
      disabled={!selectable}
      aria-label={hint}
      onClick={() => {
        if (selectable) onSelect(coordinate)
      }}
    >
      {player ? <Token player={player} className="token--appear" /> : null}
    </button>
  )
}
