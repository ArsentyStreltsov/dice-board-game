import type { PlayerId, RoomPublic } from '@shared/game/types.ts'
import { ColorPicker } from './ColorPicker'
import './LobbyScreen.css'

type LobbyScreenProps = {
  room: RoomPublic
  playerId: PlayerId
  isHost: boolean
  error?: string | null
  onStart: () => void
  onLeave: () => void
  onSetColor: (color: string) => void
}

export function LobbyScreen({
  room,
  playerId,
  isHost,
  error,
  onStart,
  onLeave,
  onSetColor,
}: LobbyScreenProps) {
  const seats = Array.from({ length: room.playersCount }, (_, i) => {
    const id = (i + 1) as PlayerId
    return room.members.find((m) => m.playerId === id) ?? null
  })

  const me = room.members.find((m) => m.playerId === playerId)
  const takenColors = room.members.map((m) => m.color)
  const full = room.members.length === room.playersCount

  return (
    <section className="lobby-screen">
      <div className="lobby-screen__card">
        <p className="lobby-screen__eyebrow">Онлайн-комната</p>
        <h1 className="lobby-screen__title">Лобби</h1>

        <div className="lobby-screen__code-block">
          <span className="lobby-screen__code-label">Код комнаты</span>
          <strong className="lobby-screen__code">{room.code}</strong>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(room.code)
            }}
          >
            Скопировать код
          </button>
        </div>

        <ul className="lobby-screen__seats">
          {seats.map((member, index) => {
            const seatId = (index + 1) as PlayerId
            return (
              <li key={seatId} className="lobby-screen__seat">
                <span
                  className="lobby-screen__color"
                  style={{ background: member?.color ?? '#cbd5e1' }}
                />
                <span>
                  {member
                    ? `${member.name}${member.playerId === playerId ? ' (вы)' : ''}${
                        member.playerId === room.hostPlayerId ? ' · хост' : ''
                      }`
                    : `Слот ${seatId} — ожидание…`}
                </span>
                <span
                  className={`lobby-screen__badge ${
                    member?.connected ? 'lobby-screen__badge--on' : ''
                  }`}
                >
                  {member ? (member.connected ? 'онлайн' : 'офлайн') : 'пусто'}
                </span>
              </li>
            )
          })}
        </ul>

        {me ? (
          <ColorPicker
            label="Ваш цвет"
            value={me.color}
            takenColors={takenColors}
            onChange={onSetColor}
          />
        ) : null}

        {isHost ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={!full}
            onClick={onStart}
          >
            Начать игру
          </button>
        ) : (
          <p className="lobby-screen__wait">Ожидайте, пока хост начнёт игру.</p>
        )}

        {!full ? (
          <p className="lobby-screen__hint">
            Нужно игроков: {room.playersCount}. Сейчас: {room.members.length}.
          </p>
        ) : null}

        {error ? (
          <p className="lobby-screen__error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="button" className="btn btn--ghost" onClick={onLeave}>
          Выйти из комнаты
        </button>
      </div>
    </section>
  )
}
