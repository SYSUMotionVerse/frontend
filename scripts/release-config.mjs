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
  }

  if (!env.VITE_POSE_MODEL_VERSION?.trim()) {
    errors.push('VITE_POSE_MODEL_VERSION is required')
  }

  return errors
}

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
