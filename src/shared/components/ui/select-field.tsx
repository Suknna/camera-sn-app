import { cn } from '@/shared/lib/utils'
import { Label } from './label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

interface SelectFieldProps {
  id: string
  label: string
  placeholder: string
  value: string
  options: { value: string; label: string }[]
  error?: string
  disabled?: boolean
  onValueChange: (value: string) => void
  triggerClassName?: string
}

export function SelectField({
  id,
  label,
  placeholder,
  value,
  options,
  error,
  disabled = false,
  onValueChange,
  triggerClassName,
}: SelectFieldProps) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} disabled={disabled} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn('min-h-12 w-full md:min-h-12', triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p id={`${id}-error`} className='text-sm text-destructive' role='alert'>
          {error}
        </p>
      ) : null}
    </div>
  )
}
