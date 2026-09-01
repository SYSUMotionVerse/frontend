import { BackendRequestError } from './backendClient'

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

export function formatBackendErrorMessage(error: unknown, fallback: string) {
  const message = resolveErrorMessage(error, fallback)
  if (error instanceof BackendRequestError && error.requestId) {
    return `${message}（请求编号：${error.requestId}）`
  }
  return message
}

export function reportBackendSyncError(actionLabel: string, error: unknown) {
  if (error instanceof BackendRequestError) {
    console.error(`[student-backend] ${actionLabel} failed`, {
      message: error.message,
      statusCode: error.statusCode,
      requestId: error.requestId || undefined,
      method: error.method,
      path: error.path,
      responseData: error.responseData
    })
  } else {
    console.warn(`[student-backend] ${actionLabel} failed`, error)
  }

  if (typeof uni === 'undefined' || typeof uni.showToast !== 'function') {
    return
  }

  void uni.showToast({
    title: formatBackendErrorMessage(error, `${actionLabel}失败，已保留本地进度`),
    icon: 'none'
  })
}
