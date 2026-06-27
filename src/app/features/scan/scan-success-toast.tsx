import { CheckIcon } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ScanSuccessToastProps {
  sn: string
  visible: boolean
}

export function ScanSuccessToast({ sn, visible }: ScanSuccessToastProps) {
  if (!visible) return null

  return createPortal(
    <div
      className='fixed top-4 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2'
      role='status'
      aria-live='polite'
      data-testid='scan-success-toast'
    >
      <div className='flex animate-in items-center gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-md duration-200 fade-in-0 slide-in-from-top-2'>
        <CheckIcon
          className='size-5 shrink-0 text-primary'
          aria-hidden='true'
        />
        <span className='truncate font-mono text-sm'>{sn}</span>
      </div>
    </div>,
    document.body
  )
}
