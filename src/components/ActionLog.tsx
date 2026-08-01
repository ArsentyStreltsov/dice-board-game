import type { LogEntry } from '@shared/game/types.ts'
import './ActionLog.css'

type ActionLogProps = {
  entries: LogEntry[]
}

export function ActionLog({ entries }: ActionLogProps) {
  return (
    <section className="action-log" aria-label="Журнал действий">
      <h2 className="action-log__title">Журнал</h2>
      {entries.length === 0 ? (
        <p className="action-log__empty">Пока нет действий.</p>
      ) : (
        <ul className="action-log__list">
          {entries.map((entry) => (
            <li key={entry.id}>{entry.message}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
