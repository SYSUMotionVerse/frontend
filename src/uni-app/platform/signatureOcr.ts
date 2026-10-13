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

export function recognizeSignatureWithVisionKit(
  pixels: SignaturePixels,
  runtime: { createVKSession?: (options: { track: { OCR: { mode: 2 } } }) => SignatureOcrSession } =
    (globalThis as { wx?: object }).wx ?? {}
): Promise<string> {
  if (!runtime.createVKSession) return Promise.reject(new Error('当前设备不支持微信 OCR，将由服务器识别。'))
  return new Promise((resolve, reject) => {
    let session: SignatureOcrSession | undefined
    let settled = false
    const finish = (text?: string, error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try { session?.stop() } catch { /* Release even after native errors. */ }
      try { session?.destroy() } catch { /* No session may remain on retry. */ }
      if (error) reject(error)
      else resolve(text ?? '')
    }
    const timeout = setTimeout(() => finish(undefined, new Error('微信 OCR 超时，将由服务器识别。')), 6000)
    try {
      session = runtime.createVKSession!({ track: { OCR: { mode: 2 } } })
      session.on('updateAnchors', anchors => finish(anchors.map(anchor => anchor.text ?? '').join('')))
      session.start(error => {
        if (settled) return
        if (error) { finish(undefined, new Error('微信 OCR 启动失败，将由服务器识别。')); return }
        try {
          // Copy the view rather than its possibly larger backing buffer.
          session!.runOCR({ frameBuffer: pixels.data.slice().buffer, width: pixels.width, height: pixels.height })
        } catch { finish(undefined, new Error('微信 OCR 识别失败，将由服务器识别。')) }
      })
    } catch { finish(undefined, new Error('微信 OCR 不可用，将由服务器识别。')) }
  })
}
