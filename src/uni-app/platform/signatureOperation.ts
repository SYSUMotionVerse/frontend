// Native canvas callbacks can be missing on a device. Every stage must release
// the UI even when neither success nor fail is called.
export function signatureOperation<T>(run: (resolve: (value: T) => void, reject: (error: unknown) => void) => void, message: string, milliseconds = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (value?: T, error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error instanceof Error ? error : new Error(message))
      else resolve(value as T)
    }
    const timer = setTimeout(() => finish(undefined, new Error(message)), milliseconds)
    try { run(value => finish(value), error => finish(undefined, error || new Error('failed'))) }
    catch (error) { finish(undefined, error) }
  })
}
