import { describe, expect, it } from 'vitest'
import { createSignatureImageHandoff, stageSignatureImage } from '../uni-app/platform/signatureImageHandoff'

describe('signature images stay outside the native event bridge', () => {
  const image = () => ({ imageBase64: 'local-only', pixels: { width: 638, height: 380, data: new Uint8ClampedArray(638 * 380 * 4) } })
  it('sends only a small JSON token while preserving the exact typed pixel buffer without copying', () => {
    const handoff = createSignatureImageHandoff(), original = image()
    const detail = JSON.parse(JSON.stringify({ __args__: [stageSignatureImage(handoff.id, original)] }))
    expect(JSON.stringify(detail).length).toBeLessThan(128)
    expect(JSON.stringify(detail)).not.toMatch(/pixels|imageBase64|local-only/)
    const received = handoff.take(detail.__args__[0].token)
    expect(received).toBe(original)
    expect(received?.pixels.data.buffer).toBe(original.pixels.data.buffer)
    expect(handoff.take(detail.__args__[0].token)).toBeUndefined()
    handoff.dispose()
  })
  it('isolates pages and discards replaced, cancelled and unmounted candidates', () => {
    const first = createSignatureImageHandoff(), second = createSignatureImageHandoff()
    expect(first.take(undefined as unknown as string)).toBeUndefined()
    const old = stageSignatureImage(first.id, image()), latest = stageSignatureImage(first.id, image())
    expect(first.take(old.token)).toBeUndefined()
    expect(second.take(latest.token)).toBeUndefined()
    first.clear()
    expect(first.take(latest.token)).toBeUndefined()
    const pending = stageSignatureImage(second.id, image())
    second.dispose()
    expect(second.take(pending.token)).toBeUndefined()
    expect(() => stageSignatureImage(second.id, image())).toThrow('signature_handoff_closed')
    first.dispose()
  })
})
