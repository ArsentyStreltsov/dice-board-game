import type { DiceResult } from '@shared/game/types.ts'
import './Dice.css'

type DiceProps = {
  dice: DiceResult | null
  isRolling: boolean
}

export function Dice({ dice, isRolling }: DiceProps) {
  return (
    <div className={`dice-pair ${isRolling ? 'dice-pair--rolling' : ''}`}>
      <DieFace value={dice?.first ?? null} />
      <DieFace value={dice?.second ?? null} />
    </div>
  )
}

function DieFace({ value }: { value: number | null }) {
  return (
    <div className="die" aria-label={value ? `Кубик: ${value}` : 'Кубик'}>
      {value ? <PipPattern value={value} /> : <span className="die-empty">?</span>}
    </div>
  )
}

function PipPattern({ value }: { value: number }) {
  const positions = PIP_MAP[value] ?? []
  return (
    <div className="die-pips">
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`die-pip ${positions.includes(i) ? 'die-pip--on' : ''}`}
        />
      ))}
    </div>
  )
}

const PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}
