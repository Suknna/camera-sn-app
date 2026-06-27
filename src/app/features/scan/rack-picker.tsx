import type { AppCatalogContext, AppCatalogRack } from '@app/lib/catalog/types'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@shared/components/ui/alert'
import { SelectField } from '@shared/components/ui/select-field'

interface RackPickerProps {
  catalog: AppCatalogContext
  roomId: string
  value: string
  error?: string
  disabled?: boolean
  onChange: (rackId: string) => void
}

export function RackPicker({
  catalog,
  roomId,
  value,
  error,
  disabled = false,
  onChange,
}: RackPickerProps) {
  const racks = racksForRoom(catalog, roomId)

  if (racks.length === 0) {
    return <RackUnavailableAlert />
  }

  return (
    <SelectField
      id='scan-rack'
      label='机柜'
      placeholder='请选择机柜'
      value={value}
      options={racks.map((rack) => ({
        value: rack.id,
        label: rack.name,
      }))}
      error={error}
      disabled={disabled}
      onValueChange={onChange}
    />
  )
}

export function RackUnavailableAlert() {
  return (
    <Alert variant='destructive'>
      <AlertTitle>无法继续扫描</AlertTitle>
      <AlertDescription>当前机房没有可用机柜</AlertDescription>
    </Alert>
  )
}

function racksForRoom(
  catalog: AppCatalogContext,
  roomId: string
): AppCatalogRack[] {
  for (const dataCenter of catalog.dataCenters) {
    const room = dataCenter.rooms.find((candidate) => candidate.id === roomId)
    if (room) return room.racks
  }

  return []
}
