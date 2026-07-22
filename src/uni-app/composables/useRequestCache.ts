export interface RequestCache<T> {
  get: (options?: { force?: boolean }) => Promise<T>
  invalidate: () => void
  hasFreshValue: () => boolean
}

interface CreateRequestCacheOptions<T> {
  ttlMs: number
  load: () => Promise<T>
}

export function createRequestCache<T>(options: CreateRequestCacheOptions<T>): RequestCache<T> {
  let value: T | undefined
  let updatedAt = 0
  let pending: Promise<T> | null = null
  let generation = 0

  function hasFreshValue() {
    return value !== undefined && Date.now() - updatedAt < options.ttlMs
  }

  async function get({ force = false }: { force?: boolean } = {}) {
    if (!force && hasFreshValue()) return value as T
    if (pending) return pending

    const requestGeneration = generation
    pending = options.load()
      .then(result => {
        if (requestGeneration === generation) {
          value = result
          updatedAt = Date.now()
        }
        return result
      })
      .finally(() => {
        pending = null
      })

    return pending
  }

  function invalidate() {
    generation += 1
    updatedAt = 0
  }

  return {
    get,
    invalidate,
    hasFreshValue
  }
}
