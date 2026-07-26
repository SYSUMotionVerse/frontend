import type { SessionRecord, TrainingModality } from './types'

export type SessionBadgeLevel = 'platinum' | 'gold' | 'silver' | 'bronze'

export type SessionBadgeSvgName = 'full-power' | 'stable-star' | 'rhythm-spark' | 'steady-seed'

export interface SessionBadge {
  id: string
  level: SessionBadgeLevel
  title: string
  description: string
  scoreLabel: string
  sessionDate: string
  modalityLabel: string
  svgName: SessionBadgeSvgName
  shareTitle: string
  sharePath: string
}

export interface SessionBadgeHistoryItem {
  id: string
  modality: TrainingModality
  date: string
  qualityScore: number | null
}

const MODALITY_LABELS: Record<TrainingModality, string> = {
  wushu: '武术训练',
  hiit: 'HIIT 训练',
  stair: '楼梯训练'
}

export function buildSessionBadge(session: SessionRecord): SessionBadge {
  const score = Math.round(session.analysis.qualityScore)
  const badge = resolveBadgeDefinition(score)

  return {
    id: `${session.id}-badge`,
    level: badge.level,
    title: badge.title,
    description: `本次质量考评 ${score} 分，${badge.description}`,
    scoreLabel: `${score} 分`,
    sessionDate: session.date,
    modalityLabel: MODALITY_LABELS[session.modality],
    svgName: badge.svgName,
    shareTitle: `我在 Sport Snack 获得了「${badge.title}」`,
    sharePath: `/pages/training/feedback?sessionId=${encodeURIComponent(session.id)}`
  }
}

export function buildSessionBadges(sessions: readonly SessionRecord[], limit = 6): SessionBadge[] {
  return sessions
    .filter(session => session.completed)
    .map(buildSessionBadge)
    .sort((left, right) => right.sessionDate.localeCompare(left.sessionDate))
    .slice(0, limit)
}

export function buildSessionBadgesFromHistory(
  sessions: readonly SessionBadgeHistoryItem[],
  limit = 6
): SessionBadge[] {
  return sessions
    .filter((session): session is SessionBadgeHistoryItem & { qualityScore: number } =>
      session.qualityScore !== null)
    .map(session => {
      const score = Math.round(session.qualityScore)
      const badge = resolveBadgeDefinition(score)

      return {
        id: `${session.id}-badge`,
        level: badge.level,
        title: badge.title,
        description: `本次质量考评 ${score} 分，${badge.description}`,
        scoreLabel: `${score} 分`,
        sessionDate: session.date,
        modalityLabel: MODALITY_LABELS[session.modality],
        svgName: badge.svgName,
        shareTitle: `我在 Sport Snack 获得了「${badge.title}」`,
        sharePath: '/pages/growth/history'
      }
    })
    .sort((left, right) => right.sessionDate.localeCompare(left.sessionDate))
    .slice(0, limit)
}

export function resolveModalityLabel(modality: TrainingModality): string {
  return MODALITY_LABELS[modality]
}

function resolveBadgeDefinition(score: number): {
  level: SessionBadgeLevel
  title: string
  description: string
  svgName: SessionBadgeSvgName
} {
  if (score >= 90) {
    return {
      level: 'platinum',
      title: '满格表现章',
      description: '训练表现接近满格，节奏和动作质量都很突出。',
      svgName: 'full-power'
    }
  }

  if (score >= 80) {
    return {
      level: 'gold',
      title: '动作稳定星',
      description: '动作控制和完成度都很稳定。',
      svgName: 'stable-star'
    }
  }

  if (score >= 65) {
    return {
      level: 'silver',
      title: '节奏火花章',
      description: '已经找到训练节奏，继续稳定会更完整。',
      svgName: 'rhythm-spark'
    }
  }

  return {
    level: 'bronze',
    title: '坚持种子章',
    description: '完成记录已经种下，下一次优先放慢动作。',
    svgName: 'steady-seed'
  }
}
