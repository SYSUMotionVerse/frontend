import { afterEach, expect, it, vi } from 'vitest'
import { BackendRequestError } from '../uni-app/api/backendClient'
import { reportBackendSyncError } from '../uni-app/api/reportBackendSyncError'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('shows the full submission error and request ID in a modal instead of a truncated toast', () => {
  const showModal = vi.fn()
  const showToast = vi.fn()
  vi.stubGlobal('uni', { showModal, showToast })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const requestId = 'b798ea-test-complete-request-id'
  const message = 'answer: 提交的选项不属于对应题目。'
  reportBackendSyncError('问卷同步', new BackendRequestError(message, 400, { requestId }), { modal: true })
  expect(showModal).toHaveBeenCalledWith(expect.objectContaining({
    content: `${message}（请求编号：${requestId}）`,
    showCancel: false
  }))
  expect(showToast).not.toHaveBeenCalled()
})
