import { COLOR_PALETTE } from '@shared/game/constants.ts'
import './ColorPicker.css'

type ColorPickerProps = {
  value: string
  takenColors?: string[]
  onChange: (color: string) => void
  disabled?: boolean
  label?: string
}

export function ColorPicker({
  value,
  takenColors = [],
  onChange,
  disabled,
  label = 'Цвет',
}: ColorPickerProps) {
  return (
    <fieldset className="color-picker" disabled={disabled}>
      <legend>{label}</legend>
      <div className="color-picker__grid">
        {COLOR_PALETTE.map((color) => {
          const taken =
            takenColors.includes(color.hex) && color.hex !== value
          return (
            <button
              key={color.id}
              type="button"
              className={`color-picker__swatch ${
                value === color.hex ? 'color-picker__swatch--active' : ''
              }`}
              style={{ background: color.hex }}
              title={taken ? `${color.label} (занят)` : color.label}
              disabled={taken || disabled}
              aria-label={color.label}
              onClick={() => onChange(color.hex)}
            />
          )
        })}
      </div>
    </fieldset>
  )
}
