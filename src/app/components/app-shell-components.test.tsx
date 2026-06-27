import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from './app-header'
import { AppScreen } from './app-screen'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('AppHeader', () => {
  it('renders back button and fires onBack when provided', () => {
    const onBack = vi.fn()
    act(() => root.render(<AppHeader title='扫描 SN' onBack={onBack} />))
    const backBtn = container.querySelector('button[aria-label="返回"]')
    expect(backBtn).not.toBeNull()
    expect(container.textContent).toContain('扫描 SN')
    act(() =>
      backBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    )
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('omits back button when onBack is absent', () => {
    act(() => root.render(<AppHeader title='现场扫描' />))
    expect(container.querySelector('button[aria-label="返回"]')).toBeNull()
  })
})

describe('AppScreen', () => {
  it('renders title and children inside main', () => {
    act(() =>
      root.render(
        <AppScreen title='创建扫描批次'>
          <p>内容区</p>
        </AppScreen>
      )
    )
    expect(container.textContent).toContain('创建扫描批次')
    const main = container.querySelector('main#app-main')
    expect(main?.textContent).toContain('内容区')
  })
})
