import { act, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SelectField } from './select-field'

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

async function settlePortal() {
  await new Promise((r) => setTimeout(r, 0))
}

describe('SelectField', () => {
  it('calls onValueChange when an option is selected', async () => {
    const onValueChange = vi.fn()
    await render(
      <SelectField
        id='test'
        label='选择'
        placeholder='请选择'
        value=''
        options={options}
        onValueChange={onValueChange}
      />
    )
    // 点击 trigger 打开
    await act(async () => {
      document.getElementById('test')!.click()
    })
    await settlePortal()
    // 点击选项 Beta
    const item = Array.from(document.querySelectorAll('[role="option"]')).find(
      (el) => el.textContent === 'Beta'
    ) as HTMLElement | undefined
    expect(item).toBeTruthy()
    await act(async () => {
      item!.click()
    })
    await settlePortal()
    expect(onValueChange).toHaveBeenCalledWith('b')
  })

  it('displays the selected option label after controlled value updates', async () => {
    function Harness() {
      const [val, setVal] = useState('')

      return (
        <SelectField
          id='test'
          label='选择'
          placeholder='请选择'
          value={val}
          options={options}
          onValueChange={setVal}
        />
      )
    }

    await render(<Harness />)
    const trigger = document.getElementById('test')!
    await act(async () => {
      trigger.click()
    })
    await settlePortal()
    const item = Array.from(document.querySelectorAll('[role="option"]')).find(
      (el) => el.textContent === 'Beta'
    ) as HTMLElement | undefined
    expect(item).toBeTruthy()
    await act(async () => {
      item!.click()
    })
    await settlePortal()
    expect(trigger.textContent).toContain('Beta')
  })

  it('renders error text when error is set', async () => {
    await render(
      <SelectField
        id='test'
        label='选择'
        placeholder='请选择'
        value=''
        options={options}
        error='必填'
        onValueChange={() => {}}
      />
    )
    expect(document.body.textContent).toContain('必填')
  })

  it('keeps the trigger disabled when disabled is set', async () => {
    await render(
      <SelectField
        id='test'
        label='选择'
        placeholder='请选择'
        value=''
        options={options}
        disabled
        onValueChange={() => {}}
      />
    )
    const trigger = document.getElementById('test') as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
    await act(async () => {
      trigger.click()
    })
    await settlePortal()
    expect(document.querySelector('[role="option"]')).toBeNull()
  })
})
