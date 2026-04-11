function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

export function reportBackendSyncError(actionLabel: string, error: unknown) {
  console.warn(`[student-backend] ${actionLabel} failed`, error)

  if (typeof uni === 'undefined' || typeof uni.showToast !== 'function') {
    return
  }

  void uni.showToast({
    title: resolveErrorMessage(error, `${actionLabel}失败，已保留本地进度`),
    icon: 'none'
  })
}
