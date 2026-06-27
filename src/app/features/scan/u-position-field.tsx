import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'

interface UPositionFieldProps {
  value: string
  error?: string
  disabled?: boolean
  onChange: (value: string) => void
}

export function UPositionField({
  value,
  error,
  disabled = false,
  onChange,
}: UPositionFieldProps) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor='scan-u-position'>U 位（可选）</Label>
      <Input
        id='scan-u-position'
        type='number'
        min={1}
        max={60}
        inputMode='numeric'
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'scan-u-position-error' : undefined}
        placeholder='1-60'
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p id='scan-u-position-error' className='text-sm text-destructive'>
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function validateUPositionInput(value: string): string | undefined {
  if (value === '') return undefined

  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > 60) {
    return 'U 位必须在 1 到 60 之间'
  }

  return undefined
}
