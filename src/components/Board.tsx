import { BOARD_SIZE } from '@shared/game/constants.ts'
import type {
  ActionKind,
  Board as BoardType,
  CellAction,
  Coordinate,
  Player,
} from '@shared/game/types.ts'
import { Cell } from './Cell'
import './Board.css'

type BoardProps = {
  board: BoardType
  players: Player[]
  availableActions: CellAction[]
  winningCells: Coordinate[]
  /** Показывать доступные клетки всем */
  showTargets: boolean
  /** Разрешить клик по доступным клеткам */
  interactive: boolean
  /** Цвет текущего игрока для подсветки */
  accentColor?: string
  /** Последний ход — подсветка клетки */
  lastMove?: Coordinate | null
  onSelect: (coordinate: Coordinate) => void
}

export function Board({
  board,
  players,
  availableActions,
  winningCells,
  showTargets,
  interactive,
  accentColor = '#2563eb',
  lastMove = null,
  onSelect,
}: BoardProps) {
  const actionMap = new Map<string, ActionKind>()
  for (const action of availableActions) {
    actionMap.set(key(action.coordinate), action.action)
  }

  const winningSet = new Set(winningCells.map(key))
  const lastMoveKey = lastMove ? key(lastMove) : null

  return (
    <div className="board-wrap">
      <div className="board-grid" role="grid" aria-label="Игровое поле 6 на 6">
        <div className="board-corner" aria-hidden="true" />
        {Array.from({ length: BOARD_SIZE }, (_, i) => (
          <div key={`col-${i + 1}`} className="board-label board-label--col">
            {i + 1}
          </div>
        ))}

        {board.map((row, rowIndex) => (
          <div key={`row-${rowIndex + 1}`} className="board-row-contents">
            <div className="board-label board-label--row">{rowIndex + 1}</div>
            {row.map((value, colIndex) => {
              const coordinate = {
                row: rowIndex + 1,
                column: colIndex + 1,
              }
              const actionKind = actionMap.get(key(coordinate)) ?? null
              const isTarget =
                showTargets &&
                (actionKind === 'place' || actionKind === 'remove')
              const selectable = isTarget && interactive
              const isWinning = winningSet.has(key(coordinate))
              const isDimmed = showTargets && !isTarget && !isWinning
              const isLastMove = lastMoveKey === key(coordinate)

              return (
                <Cell
                  key={`${coordinate.row}-${coordinate.column}`}
                  row={coordinate.row}
                  column={coordinate.column}
                  value={value}
                  players={players}
                  highlighted={isTarget}
                  selectable={selectable}
                  actionKind={actionKind}
                  accentColor={accentColor}
                  isWinning={isWinning}
                  isDimmed={isDimmed}
                  isLastMove={isLastMove}
                  onSelect={onSelect}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function key(coordinate: Coordinate): string {
  return `${coordinate.row}:${coordinate.column}`
}
