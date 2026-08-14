import { nextTick, onBeforeUnmount } from 'vue'

interface UseSubmissionHandoffOptions {
  delayMs: number
}

/**
 * Gives a submitted form one rendered frame and a short acknowledgement before
 * handing off to the following screen. A disposed page never continues its
 * pending navigation.
 */
export function useSubmissionHandoff(options: UseSubmissionHandoffOptions) {
  let isDisposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let resolvePending: ((shouldContinue: boolean) => void) | undefined

  function cancel() {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }

    if (resolvePending) {
      const resolve = resolvePending
      resolvePending = undefined
      resolve(false)
    }
  }

  async function waitForConfirmation() {
    cancel()
    await nextTick()
    if (isDisposed) return false

    return new Promise<boolean>(resolve => {
      resolvePending = resolve
      timer = setTimeout(() => {
        timer = undefined
        resolvePending = undefined
        resolve(!isDisposed)
      }, options.delayMs)
    })
  }

  onBeforeUnmount(() => {
    isDisposed = true
    cancel()
  })

  return { waitForConfirmation }
}
