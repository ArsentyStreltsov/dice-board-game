import { useMemo, useState } from 'react'
import {
  COLOR_PALETTE,
  defaultColorForSeat,
} from '@shared/game/constants.ts'
import type { PlayerId } from '@shared/game/types.ts'
import { ColorPicker } from './ColorPicker'
import './StartScreen.css'

type StartScreenProps = {
  onStartLocal: (
    playersCount: 2 | 3 | 4,
    colors: Partial<Record<PlayerId, string>>,
  ) => void
  onCreateOnline: (playersCount: 2 | 3 | 4) => void
  onJoinOnline: (code: string) => void
  onlineError?: string | null
  onlineBusy?: boolean
}

type Mode = 'choose' | 'local' | 'online-create' | 'online-join'

export function StartScreen({
  onStartLocal,
  onCreateOnline,
  onJoinOnline,
  onlineError,
  onlineBusy,
}: StartScreenProps) {
  const [mode, setMode] = useState<Mode>('choose')
  const [playersCount, setPlayersCount] = useState<2 | 3 | 4>(2)
  const [joinCode, setJoinCode] = useState('')
  const [localColors, setLocalColors] = useState<Record<number, string>>({
    1: defaultColorForSeat(0),
    2: defaultColorForSeat(1),
    3: defaultColorForSeat(2),
    4: defaultColorForSeat(3),
  })

  const localTaken = useMemo(() => {
    return Array.from({ length: playersCount }, (_, i) => localColors[i + 1]!)
  }, [localColors, playersCount])

  return (
    <section className="start-screen">
      <div className="start-screen__card">
        <p className="start-screen__eyebrow">Настольная игра</p>
        <h1 className="start-screen__title">Dice Grid</h1>
        <p className="start-screen__desc">
          Бросайте два кубика, выбирайте одну из двух координат и соберите три
          свои фишки подряд.
        </p>

        {mode === 'choose' ? (
          <div className="start-screen__mode-grid">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setMode('local')}
            >
              Локальная игра
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setMode('online-create')}
            >
              Создать онлайн-комнату
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setMode('online-join')}
            >
              Войти по коду
            </button>
          </div>
        ) : null}

        {mode === 'local' || mode === 'online-create' ? (
          <>
            <fieldset className="start-screen__players">
              <legend>Количество игроков</legend>
              <div className="start-screen__options">
                {([2, 3, 4] as const).map((count) => (
                  <label key={count} className="start-screen__option">
                    <input
                      type="radio"
                      name="players"
                      value={count}
                      checked={playersCount === count}
                      onChange={() => setPlayersCount(count)}
                    />
                    <span>{count}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {mode === 'local' ? (
              <div className="start-screen__colors">
                {Array.from({ length: playersCount }, (_, i) => {
                  const id = (i + 1) as PlayerId
                  return (
                    <ColorPicker
                      key={id}
                      label={`Игрок ${id}`}
                      value={localColors[id]!}
                      takenColors={localTaken}
                      onChange={(color) =>
                        setLocalColors((prev) => ({ ...prev, [id]: color }))
                      }
                    />
                  )
                })}
              </div>
            ) : (
              <p className="start-screen__hint">
                Цвет можно выбрать в лобби комнаты. Доступно {COLOR_PALETTE.length}{' '}
                цветов.
              </p>
            )}

            <button
              type="button"
              className="btn btn--primary"
              disabled={onlineBusy}
              onClick={() => {
                if (mode === 'local') {
                  const colors: Partial<Record<PlayerId, string>> = {}
                  for (let i = 1; i <= playersCount; i++) {
                    colors[i as PlayerId] = localColors[i]!
                  }
                  onStartLocal(playersCount, colors)
                } else {
                  onCreateOnline(playersCount)
                }
              }}
            >
              {mode === 'local' ? 'Начать игру' : 'Создать комнату'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setMode('choose')}
            >
              Назад
            </button>
          </>
        ) : null}

        {mode === 'online-join' ? (
          <>
            <label className="start-screen__join">
              Код комнаты
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
                autoCapitalize="characters"
              />
            </label>
            <p className="start-screen__hint">
              Цвет выберете в лобби после входа.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              disabled={onlineBusy || joinCode.trim().length < 4}
              onClick={() => onJoinOnline(joinCode.trim())}
            >
              Присоединиться
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setMode('choose')}
            >
              Назад
            </button>
          </>
        ) : null}

        {onlineError ? (
          <p className="start-screen__error" role="alert">
            {onlineError}
          </p>
        ) : null}
      </div>
    </section>
  )
}
