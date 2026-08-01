import { useState } from 'react'
import type { Coordinate, Player, PlayerId } from '@shared/game/types.ts'
import './DevPanel.css'

type DevPanelProps = {
  open: boolean
  onToggle: () => void
  players: Player[]
  canAct: boolean
  canRoll: boolean
  onRollWithValues: (first: number, second: number) => void
  onClearBoard: () => void
  onNextPlayer: () => void
  onSetCell: (coordinate: Coordinate, playerId: PlayerId | null) => void
}

export function DevPanel({
  open,
  onToggle,
  players,
  canAct,
  canRoll,
  onRollWithValues,
  onClearBoard,
  onNextPlayer,
  onSetCell,
}: DevPanelProps) {
  const [die1, setDie1] = useState(1)
  const [die2, setDie2] = useState(1)
  const [row, setRow] = useState(1)
  const [column, setColumn] = useState(1)
  const [fillPlayer, setFillPlayer] = useState<PlayerId | 0>(1)

  return (
    <aside className="dev-panel">
      <button type="button" className="btn btn--ghost" onClick={onToggle}>
        Режим тестирования
      </button>

      {open ? (
        <div className="dev-panel__body">
          <p className="dev-panel__note">Только для локального прототипа</p>

          <div className="dev-panel__row">
            <label>
              Кубик 1
              <select
                value={die1}
                onChange={(e) => setDie1(Number(e.target.value))}
              >
                {dieOptions()}
              </select>
            </label>
            <label>
              Кубик 2
              <select
                value={die2}
                onChange={(e) => setDie2(Number(e.target.value))}
              >
                {dieOptions()}
              </select>
            </label>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!canRoll}
              onClick={() => onRollWithValues(die1, die2)}
            >
              Бросок с заданными значениями
            </button>
          </div>

          <div className="dev-panel__row">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!canAct}
              onClick={onClearBoard}
            >
              Очистить поле
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!canAct}
              onClick={onNextPlayer}
            >
              Следующий игрок
            </button>
          </div>

          <div className="dev-panel__row">
            <label>
              Строка
              <select
                value={row}
                onChange={(e) => setRow(Number(e.target.value))}
              >
                {dieOptions()}
              </select>
            </label>
            <label>
              Столбец
              <select
                value={column}
                onChange={(e) => setColumn(Number(e.target.value))}
              >
                {dieOptions()}
              </select>
            </label>
            <label>
              Фишка
              <select
                value={fillPlayer}
                onChange={(e) =>
                  setFillPlayer(Number(e.target.value) as PlayerId | 0)
                }
              >
                <option value={0}>Пусто</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!canAct}
              onClick={() =>
                onSetCell(
                  { row, column },
                  fillPlayer === 0 ? null : fillPlayer,
                )
              }
            >
              Заполнить клетку
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  )
}

function dieOptions() {
  return [1, 2, 3, 4, 5, 6].map((n) => (
    <option key={n} value={n}>
      {n}
    </option>
  ))
}
