let sessionCounter = 0

export function createTrainingSessionId(prefix: 'visual' | 'stairs') {
  sessionCounter += 1
  const randomPart = Math.random().toString(36).slice(2, 12)
  return `${prefix}-${Date.now()}-${sessionCounter}-${randomPart}`
}
