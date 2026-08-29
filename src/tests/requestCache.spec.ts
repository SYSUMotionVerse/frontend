import { describe, expect, it, vi } from 'vitest'
import { createRequestCache } from '../uni-app/composables/useRequestCache'

describe('request cache', () => {
  it('deduplicates concurrent loads and serves a fresh value from memory', async () => {
    const load = vi.fn().mockResolvedValue('fresh')
    const cache = createRequestCache({ ttlMs: 60_000, load })

    const [first, second] = await Promise.all([cache.get(), cache.get()])
    const third = await cache.get()

    expect([first, second, third]).toEqual(['fresh', 'fresh', 'fresh'])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('does not recache an in-flight response after invalidation', async () => {
    let resolveFirst: ((value: string) => void) | undefined
    const load = vi.fn()
      .mockImplementationOnce(() => new Promise<string>(resolve => {
        resolveFirst = resolve
      }))
      .mockResolvedValueOnce('new')
    const cache = createRequestCache({ ttlMs: 60_000, load })

    const firstRequest = cache.get()
    cache.invalidate()
    expect(cache.hasValue()).toBe(false)
    resolveFirst?.('stale')
    expect(await firstRequest).toBe('stale')
    expect(cache.hasFreshValue()).toBe(false)
    expect(await cache.get()).toBe('new')
    expect(load).toHaveBeenCalledTimes(2)
  })
})
