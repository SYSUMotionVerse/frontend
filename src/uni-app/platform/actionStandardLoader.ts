import type { ActionStandard } from '../../domain/training/actionScoringTypes'

interface ActionStandardLoaderDependencies {
  requestJson: (url: string, expectedEtag?: string) => Promise<unknown>
}

export const ACTION_STANDARD_PRELOAD_CONCURRENCY = 2
export const ACTION_STANDARD_REQUEST_TIMEOUT_MS = 15_000

export async function mapWithConcurrency<Input, Output>(
  items: readonly Input[],
  mapper: (item: Input, index: number) => Promise<Output>,
  concurrency = ACTION_STANDARD_PRELOAD_CONCURRENCY
) {
  const workerCount = Math.min(
    items.length,
    Math.max(1, Math.floor(Number.isFinite(concurrency) ? concurrency : 1))
  )
  const results = new Array<Output>(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex] as Input, currentIndex)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
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
  if (parsed.tts_cues !== undefined) {
    if (
      !Array.isArray(parsed.tts_cues)
      || parsed.tts_cues.some(cue =>
        !isRecord(cue)
        || typeof cue.time !== 'number'
        || !Number.isFinite(cue.time)
        || cue.time < 0
        || typeof cue.text !== 'string'
        || typeof cue.audio_url !== 'string'
        || cue.audio_url.trim().length === 0
      )
    ) {
      throw new Error('标准动作文件 tts_cues 无效。')
    }
  }
  if (
    parsed.countdown_audio_url !== undefined
    && (
      typeof parsed.countdown_audio_url !== 'string'
      || parsed.countdown_audio_url.trim().length === 0
    )
  ) {
    throw new Error('标准动作文件 countdown_audio_url 无效。')
  }
  if (
    parsed.countdown_audio_urls !== undefined
    && (
      !isRecord(parsed.countdown_audio_urls)
      || ['1', '2', '3'].some(key => {
        const countdownAudioUrls = parsed.countdown_audio_urls as Record<string, unknown>
        const url = countdownAudioUrls[key]
        return typeof url !== 'string' || url.trim().length === 0
      })
    )
  ) {
    throw new Error('标准动作文件 countdown_audio_urls 无效。')
  }
  if (
    parsed.transition_audio_urls !== undefined
    && (
      !isRecord(parsed.transition_audio_urls)
      || typeof parsed.transition_audio_urls.start !== 'string'
      || parsed.transition_audio_urls.start.trim().length === 0
      || typeof parsed.transition_audio_urls.end !== 'string'
      || parsed.transition_audio_urls.end.trim().length === 0
      || (
        parsed.transition_audio_urls.next_action !== undefined
        && (
          typeof parsed.transition_audio_urls.next_action !== 'string'
          || parsed.transition_audio_urls.next_action.trim().length === 0
        )
      )
      || (
        parsed.transition_audio_urls.rest_next_action !== undefined
        && (
          typeof parsed.transition_audio_urls.rest_next_action !== 'string'
          || parsed.transition_audio_urls.rest_next_action.trim().length === 0
        )
      )
    )
  ) {
    throw new Error('标准动作文件 transition_audio_urls 无效。')
  }

  return parsed as unknown as ActionStandard
}

function normalizeEtag(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^W\//i, '').replace(/^"|"$/g, '')
}

function requestJson(url: string, expectedEtag?: string) {
  return new Promise<unknown>((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      timeout: ACTION_STANDARD_REQUEST_TIMEOUT_MS,
      success(response) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`标准动作文件请求失败（${response.statusCode}）。`))
          return
        }
        const expected = normalizeEtag(expectedEtag)
        if (expected) {
          const headers = response.header ?? {}
          const actualHeader = Object.entries(headers).find(
            ([name]) => name.toLowerCase() === 'etag'
          )?.[1]
          const actual = normalizeEtag(actualHeader)
          if (!actual) {
            reject(new Error('标准动作文件响应缺少 ETag，无法验证发布版本。'))
            return
          }
          if (actual !== expected) {
            reject(new Error('标准动作文件已发生变化，请重新发布训练配置。'))
            return
          }
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
    load(url: string, expectedEtag?: string) {
      const normalizedUrl = url.trim()
      if (!normalizedUrl) {
        return Promise.reject(new Error('标准动作文件 URL 为空。'))
      }

      const normalizedEtag = normalizeEtag(expectedEtag)
      const cacheKey = `${normalizedUrl}#${normalizedEtag}`
      const cached = cache.get(cacheKey)
      if (cached) return cached

      const pending = dependencies.requestJson(normalizedUrl, normalizedEtag || undefined)
        .then(parseActionStandard)
        .catch(error => {
          cache.delete(cacheKey)
          throw error
        })
      cache.set(cacheKey, pending)
      return pending
    },
    clear() {
      cache.clear()
    }
  }
}

export const actionStandardLoader = createActionStandardLoader()
