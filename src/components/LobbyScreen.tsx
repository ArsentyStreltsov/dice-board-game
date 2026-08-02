import { useState, type ReactNode } from 'react'
import type { PlayerId, RoomPublic } from '@shared/game/types.ts'
import { sanitizePlayerName } from '../lib/playerProfile.ts'
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
  onSetName: (name: string) => void
  soundToggle?: ReactNode
}

export function LobbyScreen({
  room,
  playerId,
  isHost,
  error,
  onStart,
  onLeave,
  onSetColor,
  onSetName,
  soundToggle,
}: LobbyScreenProps) {
  const seats = Array.from({ length: room.playersCount }, (_, i) => {
    const id = (i + 1) as PlayerId
    return room.members.find((m) => m.playerId === id) ?? null
  })

  const me = room.members.find((m) => m.playerId === playerId)
  const takenColors = room.members.map((m) => m.color)
  const humans = room.members.filter((m) => !m.isBot).length
  const emptySlots = room.playersCount - humans
  const canStart = humans >= 1
  const [nameDraft, setNameDraft] = useState(me?.name ?? '')

  return (
    <section className="lobby-screen">
      {soundToggle ? <div className="app-chrome">{soundToggle}</div> : null}
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
                    : `Слот ${seatId} — бот при старте`}
                </span>
                <span
                  className={`lobby-screen__badge ${
                    member?.connected ? 'lobby-screen__badge--on' : ''
                  }`}
                >
                  {member
                    ? member.isBot
                      ? 'бот'
                      : member.connected
                        ? 'онлайн'
                        : 'офлайн'
                    : 'пусто'}
                </span>
              </li>
            )
          })}
        </ul>

        {me ? (
          <>
            <label className="lobby-screen__name">
              Ваше имя
              <div className="lobby-screen__name-row">
                <input
                  value={nameDraft}
                  maxLength={20}
                  onChange={(e) => setNameDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={
                    sanitizePlayerName(nameDraft).length < 2 ||
                    sanitizePlayerName(nameDraft) === me.name
                  }
                  onClick={() => onSetName(sanitizePlayerName(nameDraft))}
                >
                  Сохранить
                </button>
              </div>
            </label>
            <ColorPicker
              label="Ваш цвет"
              value={me.color}
              takenColors={takenColors}
              onChange={onSetColor}
            />
          </>
        ) : null}

        {isHost ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canStart}
            onClick={onStart}
          >
            Начать игру
          </button>
        ) : (
          <p className="lobby-screen__wait">Ожидайте, пока хост начнёт игру.</p>
        )}

        {emptySlots > 0 ? (
          <p className="lobby-screen__hint">
            Игроков: {humans}/{room.playersCount}. Пустые места ({emptySlots})
            заполнятся ботами при старте.
          </p>
        ) : (
          <p className="lobby-screen__hint">Комната заполнена — можно начинать.</p>
        )}

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
