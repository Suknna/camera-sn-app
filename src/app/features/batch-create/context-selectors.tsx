import type { AppCatalogContext } from '@app/lib/catalog/types'
import { SelectField } from '@shared/components/ui/select-field'

export interface ContextSelectorValues {
  dataCenterId: string
  roomId: string
}

export interface ContextSelectorErrors {
  dataCenterId?: string
  roomId?: string
}

interface ContextSelectorsProps {
  context: AppCatalogContext
  value: ContextSelectorValues
  errors?: ContextSelectorErrors
  disabled?: boolean
  onDataCenterChange: (dataCenterId: string) => void
  onRoomChange: (roomId: string) => void
}

export function ContextSelectors({
  context,
  value,
  errors = {},
  disabled = false,
  onDataCenterChange,
  onRoomChange,
}: ContextSelectorsProps) {
  const selectedDataCenter = context.dataCenters.find(
    (dataCenter) => dataCenter.id === value.dataCenterId
  )
  const rooms = selectedDataCenter?.rooms ?? []

  return (
    <div className='grid gap-4'>
      <SelectField
        id='batch-data-center'
        label='数据中心'
        placeholder='请选择数据中心'
        value={value.dataCenterId}
        options={context.dataCenters.map((dataCenter) => ({
          value: dataCenter.id,
          label: dataCenter.name,
        }))}
        error={errors.dataCenterId}
        disabled={disabled}
        onValueChange={onDataCenterChange}
      />
      <SelectField
        id='batch-room'
        label='机房'
        placeholder='请选择机房'
        value={value.roomId}
        options={rooms.map((room) => ({
          value: room.id,
          label: room.name,
        }))}
        error={errors.roomId}
        disabled={disabled || !value.dataCenterId}
        onValueChange={onRoomChange}
      />
    </div>
  )
}
