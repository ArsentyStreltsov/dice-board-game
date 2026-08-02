import { useMemo, useState } from 'react'
import {
  COLOR_PALETTE,
  defaultColorForSeat,
} from '@shared/game/constants.ts'
import type { BotDifficulty } from '@shared/game/botAi.ts'
import type { PlayerId } from '@shared/game/types.ts'
import { ColorPicker } from './ColorPicker'
import './StartScreen.css'

export type LocalStartConfig = {
  playersCount: 2 | 3 | 4
  colors: Partial<Record<PlayerId, string>>
  opponent: 'friends' | 'bot'
  botDifficulty?: BotDifficulty
  playerName: string
}

type StartScreenProps = {
  playerName: string
  onChangeName: () => void
  onStartLocal: (config: LocalStartConfig) => void
  onCreateOnline: (playersCount: 2 | 3 | 4) => void
  onJoinOnline: (code: string) => void
  onlineError?: string | null
  onlineBusy?: boolean
}

type Mode = 'choose' | 'local' | 'online-create' | 'online-join'

export function StartScreen({
  playerName,
  onChangeName,
  onStartLocal,
  onCreateOnline,
  onJoinOnline,
  onlineError,
  onlineBusy,
}: StartScreenProps) {
  const [mode, setMode] = useState<Mode>('choose')
  const [playersCount, setPlayersCount] = useState<2 | 3 | 4>(2)
  const [joinCode, setJoinCode] = useState('')
  const [localOpponent, setLocalOpponent] = useState<'friends' | 'bot'>('friends')
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium')
  const [localColors, setLocalColors] = useState<Record<number, string>>({
    1: defaultColorForSeat(0),
    2: defaultColorForSeat(1),
    3: defaultColorForSeat(2),
    4: defaultColorForSeat(3),
  })

  const colorSlots =
    mode === 'local' && localOpponent === 'bot' ? 1 : playersCount

  const localTaken = useMemo(() => {
    return Array.from({ length: colorSlots }, (_, i) => localColors[i + 1]!)
  }, [localColors, colorSlots])

  return (
    <section className="start-screen">
      <div className="start-screen__card">
        <p className="start-screen__eyebrow">Настольная игра</p>
        <h1 className="start-screen__title">Dice Grid</h1>
        <p className="start-screen__desc">
          Бросайте два кубика, выбирайте одну из двух координат и соберите три
          свои фишки подряд.
        </p>

        <div className="start-screen__hello">
          <span>
            Привет, <strong>{playerName}</strong>
          </span>
          <button type="button" className="btn btn--ghost" onClick={onChangeName}>
            Сменить имя
          </button>
        </div>

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
            {mode === 'local' ? (
              <fieldset className="start-screen__players">
                <legend>С кем играть</legend>
                <div className="start-screen__options start-screen__options--2">
                  <label className="start-screen__option">
                    <input
                      type="radio"
                      name="opponent"
                      checked={localOpponent === 'friends'}
                      onChange={() => setLocalOpponent('friends')}
                    />
                    <span>С друзьями</span>
                  </label>
                  <label className="start-screen__option">
                    <input
                      type="radio"
                      name="opponent"
                      checked={localOpponent === 'bot'}
                      onChange={() => setLocalOpponent('bot')}
                    />
                    <span>С компьютером</span>
                  </label>
                </div>
              </fieldset>
            ) : null}

            <fieldset className="start-screen__players">
              <legend>
                {mode === 'local' && localOpponent === 'bot'
                  ? 'Игроков за столом'
                  : 'Количество игроков'}
              </legend>
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

            {mode === 'local' && localOpponent === 'bot' ? (
              <fieldset className="start-screen__players">
                <legend>Сложность ботов</legend>
                <div className="start-screen__options">
                  {(
                    [
                      ['easy', 'Лёгкий'],
                      ['medium', 'Средний'],
                      ['hard', 'Сложный'],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="start-screen__option">
                      <input
                        type="radio"
                        name="difficulty"
                        checked={botDifficulty === value}
                        onChange={() => setBotDifficulty(value)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {mode === 'local' ? (
              <div className="start-screen__colors">
                {Array.from({ length: colorSlots }, (_, i) => {
                  const id = (i + 1) as PlayerId
                  return (
                    <ColorPicker
                      key={id}
                      label={
                        localOpponent === 'bot' && id === 1
                          ? 'Ваш цвет'
                          : `Игрок ${id}`
                      }
                      value={localColors[id]!}
                      takenColors={localTaken}
                      onChange={(color) =>
                        setLocalColors((prev) => ({ ...prev, [id]: color }))
                      }
                    />
                  )
                })}
                {localOpponent === 'bot' ? (
                  <p className="start-screen__hint">
                    Вы играете против {playersCount - 1} компьютер
                    {playersCount - 1 === 1 ? 'а' : 'ов'}. Цвета ботов
                    назначатся автоматически.
                  </p>
                ) : (
                  <p className="start-screen__hint">
                    Вы — {playerName} (игрок 1). Остальные ходят с этого же
                    устройства по очереди.
                  </p>
                )}
              </div>
            ) : (
              <p className="start-screen__hint">
                Вы войдёте как {playerName}. Цвет можно выбрать в лобби. Доступно{' '}
                {COLOR_PALETTE.length} цветов.
              </p>
            )}

            <button
              type="button"
              className="btn btn--primary"
              disabled={onlineBusy}
              onClick={() => {
                if (mode === 'local') {
                  const colors: Partial<Record<PlayerId, string>> = {}
                  const taken = new Set<string>()
                  colors[1] = localColors[1]!
                  taken.add(localColors[1]!)

                  for (let i = 2; i <= playersCount; i++) {
                    if (localOpponent === 'bot') {
                      const botColor =
                        COLOR_PALETTE.find((c) => !taken.has(c.hex))?.hex ??
                        defaultColorForSeat(i - 1)
                      colors[i as PlayerId] = botColor
                      taken.add(botColor)
                    } else {
                      colors[i as PlayerId] = localColors[i]!
                    }
                  }

                  onStartLocal({
                    playersCount,
                    colors,
                    opponent: localOpponent,
                    botDifficulty:
                      localOpponent === 'bot' ? botDifficulty : undefined,
                    playerName,
                  })
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
            <p className="start-screen__hint">
              Вы войдёте как <strong>{playerName}</strong>.
            </p>
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
