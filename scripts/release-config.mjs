export function validateReleaseConfig(env = process.env) {
  const requiredUrls = [
    ['VITE_API_BASE_URL', env.VITE_API_BASE_URL],
    ['VITE_POSE_MODEL_BASE_URL', env.VITE_POSE_MODEL_BASE_URL],
  ]

  const errors = []
  for (const [name, value] of requiredUrls) {
    if (!value) {
      errors.push(`${name} is required`)
      continue
    }

    let url
    try {
      url = new URL(value)
    } catch {
      errors.push(`${name} must be a valid URL`)
      continue
    }

    if (url.protocol !== 'https:') {
      errors.push(`${name} must use HTTPS for a production mini-program`)
    }
    if (isIpAddress(url.hostname)) {
      errors.push(
        `${name} must use a registrable domain instead of an IP address`,
      )
    }
    if (['localhost', '127.0.0.1'].includes(url.hostname)) {
      errors.push(`${name} must not point to a local host`)
    }
    if (
      url.hostname === 'example.com' ||
      url.hostname.endsWith('.example.com')
    ) {
      errors.push(`${name} must not use the example placeholder domain`)
    }
    if (
      isReservedPlaceholderDomain(url.hostname) &&
      !allowsCiPlaceholders(env)
    ) {
      errors.push(
        `${name} must not use a reserved placeholder domain outside an explicit CI build`,
      )
    }
  }

  if (!env.VITE_POSE_MODEL_VERSION?.trim()) {
    errors.push('VITE_POSE_MODEL_VERSION is required')
  }

  const shortQuestionnaireEndpoint = env.VITE_SHORT_QUESTIONNAIRE_ENDPOINT?.trim() ?? ''
  if (shortQuestionnaireEndpoint) {
    errors.push(...validateShortQuestionnaireEndpoint(shortQuestionnaireEndpoint))
  }

  return errors
}

export function validateProductionManifest(manifest) {
  const miniProgram = manifest?.['mp-weixin']
  const errors = []

  if (!miniProgram?.appid?.trim() || miniProgram.appid === 'touristappid') {
    errors.push('mp-weixin.appid must be a real release AppID')
  } else if (!WECHAT_APPID_PATTERN.test(miniProgram.appid.trim())) {
    errors.push('mp-weixin.appid must match the WeChat format wx followed by 16 hex characters')
  }
  if (miniProgram?.setting?.urlCheck !== true) {
    errors.push('mp-weixin.setting.urlCheck must be true for production')
  }
  if (miniProgram?.setting?.minified !== true) {
    errors.push('mp-weixin.setting.minified must be true for production')
  }
  if (miniProgram?.setting?.minifyWXSS !== true) {
    errors.push('mp-weixin.setting.minifyWXSS must be true for production')
  }
  if (miniProgram?.setting?.minifyWXML !== true) {
    errors.push('mp-weixin.setting.minifyWXML must be true for production')
  }
  if (miniProgram?.setting?.uploadWithSourceMap !== false) {
    errors.push('mp-weixin.setting.uploadWithSourceMap must be false for production')
  }

  return errors
}

export function validateGeneratedProjectConfig(projectConfig) {
  const errors = []

  if (!projectConfig?.appid?.trim() || projectConfig.appid === 'touristappid') {
    errors.push('generated project.config.json must contain a real release AppID')
  } else if (!WECHAT_APPID_PATTERN.test(projectConfig.appid.trim())) {
    errors.push('generated project.config.json appid must match the WeChat format wx followed by 16 hex characters')
  }
  if (projectConfig?.setting?.urlCheck !== true) {
    errors.push(
      'generated project.config.json must enable setting.urlCheck',
    )
  }
  if (projectConfig?.setting?.minified !== true) {
    errors.push('generated project.config.json must enable setting.minified')
  }
  if (projectConfig?.setting?.minifyWXSS !== true) {
    errors.push('generated project.config.json must enable setting.minifyWXSS')
  }
  if (projectConfig?.setting?.minifyWXML !== true) {
    errors.push('generated project.config.json must enable setting.minifyWXML')
  }
  if (projectConfig?.setting?.uploadWithSourceMap !== false) {
    errors.push(
      'generated project.config.json must disable setting.uploadWithSourceMap',
    )
  }

  return errors
}

const WECHAT_APPID_PATTERN = /^wx[0-9a-fA-F]{16}$/

function isIpAddress(hostname) {
  const ipv4 = hostname.split('.')
  if (
    ipv4.length === 4 &&
    ipv4.every((part) => /^\d+$/.test(part) && Number(part) <= 255)
  ) {
    return true
  }
  return hostname.includes(':')
}

function isReservedPlaceholderDomain(hostname) {
  return (
    hostname === 'invalid' ||
    hostname.endsWith('.invalid') ||
    hostname === 'test' ||
    hostname.endsWith('.test')
  )
}

/**
 * Validate VITE_SHORT_QUESTIONNAIRE_ENDPOINT when it is set.
 *
 * The endpoint must be a same-backend relative path beginning with exactly one
 * slash, with no scheme, host, query, fragment, path traversal, or backslash.
 * It is optional because the backend endpoint does not exist yet.
 */
export function validateShortQuestionnaireEndpoint(endpoint) {
  const errors = []
  const trimmed = endpoint.trim()

  if (!trimmed.startsWith('/')) {
    errors.push('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must begin with a single slash')
  }
  if (trimmed.startsWith('//')) {
    errors.push('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not start with a double slash (scheme-relative URL)')
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    errors.push('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include a scheme')
  }
  if (trimmed.includes('://')) {
    errors.push('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include a host')
  }
  if (trimmed.includes('?')) {
    errors.push('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include a query string')
  }
  if (trimmed.includes('#')) {
    errors.push('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include a fragment')
  }
  if (trimmed.includes('\\')) {
    errors.push('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include a backslash')
  }
  if (trimmed.includes('..')) {
    errors.push('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include path traversal')
  }
  // Reject empty path (just '/' or slashes only)
  if (trimmed.replace(/^\/+|\/+$/g, '') === '') {
    errors.push('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not be an empty path ("/")')
  }
  // Reject whitespace or control characters
  if (/[\s\x00-\x1f\x7f]/.test(trimmed)) {
    errors.push('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not contain whitespace or control characters')
  }
  // Reject percent-encoded traversal/backslash variants that could bypass checks
  if (/%2e|%2f|%5c/i.test(trimmed)) {
    errors.push('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include percent-encoded path traversal or backslash')
  }

  return errors
}

function allowsCiPlaceholders(env) {
  return env.CI === 'true' && env.ALLOW_CI_RELEASE_PLACEHOLDERS === 'true'
}
