import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export interface ScanFeedbackOptions {
  muted?: boolean
}

type HapticsImpl = () => Promise<void>

let hapticsImpl: HapticsImpl = async () => {
  if (!Capacitor.isNativePlatform()) return
  await Haptics.impact({ style: ImpactStyle.Medium })
}

export async function playScanSuccessFeedback(
  _opts: ScanFeedbackOptions = {}
): Promise<void> {
  try {
    await hapticsImpl()
  } catch {
    // 反馈是增强，不阻断扫码
  }
}

export function __setHapticsForTest(impl: HapticsImpl): void {
  hapticsImpl = impl
}
