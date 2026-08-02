import { type FormEvent, useState } from 'react'
import { sanitizePlayerName } from '../lib/playerProfile.ts'
import './NameGate.css'

type NameGateProps = {
  initialName?: string
  onConfirm: (name: string) => void
}

export function NameGate({ initialName = '', onConfirm }: NameGateProps) {
  const [name, setName] = useState(initialName)
  const valid = sanitizePlayerName(name).length >= 2

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const clean = sanitizePlayerName(name)
    if (clean.length < 2) return
    onConfirm(clean)
  }

  return (
    <section className="name-gate">
      <form className="name-gate__card" onSubmit={handleSubmit}>
        <p className="name-gate__eyebrow">Добро пожаловать</p>
        <h1 className="name-gate__title">Dice Grid</h1>
        <p className="name-gate__desc">
          Как вас зовут? Имя увидят другие игроки в лобби и за столом.
        </p>
        <label className="name-gate__field">
          Ваше имя
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Например, Артём"
            autoFocus
            autoComplete="nickname"
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={!valid}>
          Продолжить
        </button>
      </form>
    </section>
  )
}
