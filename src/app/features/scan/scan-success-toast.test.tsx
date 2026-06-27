import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { ScanSuccessToast } from './scan-success-toast'

describe('ScanSuccessToast', () => {
  it('renders sn and checkmark when visible', async () => {
    await render(<ScanSuccessToast sn='SN12345678' visible={true} />)
    expect(document.body.textContent).toContain('SN12345678')
    expect(document.querySelector('svg')).not.toBeNull()
  })

  it('renders nothing when not visible', async () => {
    await render(<ScanSuccessToast sn='SN12345678' visible={false} />)
    expect(document.body.textContent).not.toContain('SN12345678')
  })
})
