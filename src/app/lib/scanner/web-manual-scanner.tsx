import { useId, useState, type FormEvent } from 'react'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import type { ScannedBarcode } from './types'

interface WebManualScannerProps {
  disabled?: boolean
  onBarcode(barcode: ScannedBarcode): void
}

export function WebManualScanner({
  disabled = false,
  onBarcode,
}: WebManualScannerProps) {
  const rawValueInputId = useId()
  const formatInputId = useId()
  const [rawValue, setRawValue] = useState('')
  const [format, setFormat] = useState('manual')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return

    onBarcode({ rawValue, format })
  }

  return (
    <form className='grid max-w-[65ch] gap-4' onSubmit={handleSubmit}>
      <p
        className='rounded-md border border-border bg-muted px-3 py-2 text-base font-medium text-foreground'
        role='status'
      >
        Web 调试模式：手动输入 SN
      </p>

      <div className='grid gap-2'>
        <Label htmlFor={rawValueInputId}>SN 原始值</Label>
        <Input
          autoComplete='off'
          className='min-h-11 text-base'
          id={rawValueInputId}
          name='rawValue'
          disabled={disabled}
          onChange={(event) => setRawValue(event.target.value)}
          value={rawValue}
        />
      </div>

      <div className='grid gap-2'>
        <Label htmlFor={formatInputId}>条码格式</Label>
        <Input
          autoComplete='off'
          id={formatInputId}
          name='format'
          disabled={disabled}
          onChange={(event) => setFormat(event.target.value)}
          value={format}
        />
      </div>

      <Button type='submit' disabled={disabled}>
        加入待提交列表
      </Button>
    </form>
  )
}
