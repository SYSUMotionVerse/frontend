import type { ActionStandard } from '../../domain/training/actionScoringTypes'

interface ActionStandardLoaderDependencies {
  requestJson: (url: string) => Promise<unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseActionStandard(value: unknown): ActionStandard {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  if (!isRecord(parsed)) {
    throw new Error('标准动作文件必须是 JSON 对象。')
  }
  if (typeof parsed.action_id !== 'string' || parsed.action_id.trim().length === 0) {
    throw new Error('标准动作文件缺少 action_id。')
  }
  if (parsed.action_type !== 'repetitive') {
    throw new Error("标准动作文件只支持 action_type='repetitive'。")
  }
  if (parsed.angle_unit !== 'radian') {
    throw new Error("标准动作文件 angle_unit 必须为 'radian'。")
  }
  if (!Array.isArray(parsed.angle_names) || parsed.angle_names.some(name => typeof name !== 'string')) {
    throw new Error('标准动作文件 angle_names 无效。')
  }
  if (
    !Array.isArray(parsed.standard_sequence)
    || parsed.standard_sequence.length === 0
    || parsed.standard_sequence.some(row => !Array.isArray(row))
  ) {
    throw new Error('标准动作文件 standard_sequence 无效。')
  }
  if (!isRecord(parsed.angle_rules)) {
    throw new Error('标准动作文件 angle_rules 无效。')
  }

  return parsed as unknown as ActionStandard
}

function requestJson(url: string) {
  return new Promise<unknown>((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      success(response) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`标准动作文件请求失败（${response.statusCode}）。`))
          return
        }
        resolve(response.data)
      },
      fail(error) {
        reject(new Error(error.errMsg || '标准动作文件请求失败。'))
      }
    })
  })
}

export function createActionStandardLoader(
  dependencies: ActionStandardLoaderDependencies = { requestJson }
) {
  const cache = new Map<string, Promise<ActionStandard>>()

  return {
    load(url: string) {
      const normalizedUrl = url.trim()
      if (!normalizedUrl) {
        return Promise.reject(new Error('标准动作文件 URL 为空。'))
      }

      const cached = cache.get(normalizedUrl)
      if (cached) return cached

      const pending = dependencies.requestJson(normalizedUrl)
        .then(parseActionStandard)
        .catch(error => {
          cache.delete(normalizedUrl)
          throw error
        })
      cache.set(normalizedUrl, pending)
      return pending
    },
    clear() {
      cache.clear()
    }
  }
}

export const actionStandardLoader = createActionStandardLoader()
