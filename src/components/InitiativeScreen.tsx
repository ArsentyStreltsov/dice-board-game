import { useEffect, useState, type ReactNode } from 'react'
import { diceSum } from '@shared/game/initiative.ts'
import type {
  DiceResult,
  InitiativeState,
  Player,
} from '@shared/game/types.ts'
import { Dice } from './Dice'
import './InitiativeScreen.css'

type InitiativeScreenProps = {
  players: Player[]
  initiative: InitiativeState
  canRoll: boolean
  isRolling: boolean
  shownDice: DiceResult | null
  onRoll: () => void
  onLeave?: () => void
  modeLabel?: string
  headerExtra?: ReactNode
}

export function InitiativeScreen({
  players,
  initiative,
  canRoll,
  isRolling,
  shownDice,
  onRoll,
  onLeave,
  modeLabel = 'Определение первого хода',
  headerExtra,
}: InitiativeScreenProps) {
  const winnerId = initiative.winnerId
  const startsAt = initiative.startsAt
  const inCountdown = winnerId !== undefined && startsAt !== undefined
  const [secondsLeft, setSecondsLeft] = useState(() =>
    startsAt ? Math.max(0, Math.ceil((startsAt - Date.now()) / 1000)) : 0,
  )

  useEffect(() => {
    if (!startsAt) {
      setSecondsLeft(0)
      return
    }

    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((startsAt - Date.now()) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [startsAt])

  const winner = winnerId
    ? players.find((p) => p.id === winnerId)
    : undefined

  return (
    <section className="initiative-screen">
      {headerExtra ? <div className="app-chrome">{headerExtra}</div> : null}
      <div className="initiative-screen__card">
        <p className="initiative-screen__eyebrow">{modeLabel}</p>
        <h1 className="initiative-screen__title">
          {inCountdown ? 'Первый ход определён!' : 'Кто ходит первым?'}
        </h1>
        <p className="initiative-screen__desc">
          {inCountdown
            ? `${winner?.name ?? `Игрок ${winnerId}`} ходит первым.`
            : 'Каждый бросает два кубика. Большая сумма начинает игру. При ничьей — переброс среди лидеров.'}{' '}
          {!inCountdown ? `Раунд ${initiative.round}.` : null}
        </p>

        {inCountdown ? (
          <p className="initiative-screen__countdown" aria-live="polite">
            Старт через {secondsLeft}
          </p>
        ) : null}

        <ul className="initiative-screen__list">
          {initiative.contenders.map((id) => {
            const player = players.find((p) => p.id === id)
            const roll = initiative.rolls[id]
            const isWinner = winnerId === id
            return (
              <li
                key={id}
                className={`initiative-screen__row ${
                  isWinner ? 'initiative-screen__row--winner' : ''
                }`}
              >
                <span
                  className="initiative-screen__dot"
                  style={{ background: player?.color }}
                />
                <span className="initiative-screen__name">
                  {player?.name ?? `Игрок ${id}`}
                  {isWinner ? ' · первый' : ''}
                </span>
                <span className="initiative-screen__roll">
                  {roll
                    ? `${roll.first}+${roll.second} = ${diceSum(roll)}`
                    : 'ожидание…'}
                </span>
              </li>
            )
          })}
        </ul>

        {!inCountdown ? (
          <>
            <Dice dice={shownDice} isRolling={isRolling} />
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canRoll || isRolling}
              onClick={onRoll}
            >
              Бросить кубики
            </button>
          </>
        ) : null}

        {onLeave ? (
          <button type="button" className="btn btn--ghost" onClick={onLeave}>
            Выйти
          </button>
        ) : null}
      </div>
    </section>
  )
}
