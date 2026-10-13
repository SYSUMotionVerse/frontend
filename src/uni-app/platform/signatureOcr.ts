export interface SignaturePixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface SignatureOcrSession {
  on(event: 'updateAnchors', callback: (anchors: Array<{ text?: string }>) => void): void
  start(callback: (error: number | null) => void): void
  runOCR(input: { frameBuffer: ArrayBuffer, width: number, height: number }): void
  stop(): void
  destroy(): void
}

type VisionKitRuntime = { createVKSession?: (options: { track: { OCR: { mode: 2 } } }) => SignatureOcrSession }
declare const wx: VisionKitRuntime

export function normalizeSignatureName(value: string) {
  return value.normalize('NFKC').replace(/\s/g, '')
}

export function recognizeSignatureWithVisionKit(
  pixels: SignaturePixels,
  runtime: VisionKitRuntime = typeof wx === 'undefined' ? {} : wx,
  registerCancel?: (cancel: () => void) => void
): Promise<string> {
  if (!runtime.createVKSession) return Promise.reject(new Error('当前微信不支持签名识别，请更新微信后重新签名。'))
  return new Promise((resolve, reject) => {
    let session: SignatureOcrSession | undefined
    let settled = false
    const finish = (text?: string, error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve(text ?? '')
      // Do not destroy a native session while it is dispatching OCR anchors.
      // Release it on the next task, outside that native callback stack.
      setTimeout(() => {
        try { session?.stop() } catch { /* Release even after native errors. */ }
        try { session?.destroy() } catch { /* No session may remain on retry. */ }
      }, 0)
    }
    const timeout = setTimeout(() => finish(undefined, new Error('微信 OCR 超时，请重新签名并重试。')), 6000)
    registerCancel?.(() => finish(undefined, new Error('签名识别已取消。')))
    if (settled) return
    try {
      session = runtime.createVKSession!({ track: { OCR: { mode: 2 } } })
      session.on('updateAnchors', anchors => finish(anchors.map(anchor => anchor.text ?? '').join('')))
      session.start(error => {
        if (settled) return
        if (error) { finish(undefined, new Error('微信 OCR 启动失败，请更新微信后重试。')); return }
        try {
          // Copy the view rather than its possibly larger backing buffer.
          session!.runOCR({ frameBuffer: pixels.data.slice().buffer, width: pixels.width, height: pixels.height })
        } catch { finish(undefined, new Error('微信 OCR 识别失败，请用清晰楷体重新签名。')) }
      })
    } catch { finish(undefined, new Error('微信 OCR 不可用，请更新微信后重试。')) }
  })
}
