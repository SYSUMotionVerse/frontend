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
  earnedCount: number
}

export interface SessionBadgeHistoryItem {
  id: string
  modality: TrainingModality
  date: string
  qualityScore: number | null
  earnedCount?: number
}

const MODALITY_LABELS: Record<TrainingModality, string> = {
  wushu: '传统体育养生训练',
  hiit: '自重抗阻训练',
  stair: '楼梯训练'
}

export function buildSessionBadge(session: SessionRecord): SessionBadge {
  const score = session.analysis.qualityScore === null
    ? null
    : Math.round(session.analysis.qualityScore)
  const badge = resolveBadgeDefinition(score ?? 0)

  if (score === null) {
    return {
      id: `${session.id}-badge`,
      level: 'bronze',
      title: '完成记录章',
      description: '本次训练已完成，但暂未获得可用动作评分。',
      scoreLabel: '暂无评分',
      sessionDate: session.date,
      modalityLabel: MODALITY_LABELS[session.modality],
      svgName: badge.svgName,
      shareTitle: '我完成了一次 Sport Snack 训练',
      sharePath: '/pages/access/startup',
      earnedCount: 0
    }
  }

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
    sharePath: '/pages/access/startup',
    earnedCount: 1
  }
}

export function buildSessionBadges(sessions: readonly SessionRecord[], limit = 6): SessionBadge[] {
  return dedupeBadges(sessions
    .filter(session => session.completed && session.analysis.qualityScore !== null)
    .map(buildSessionBadge)
    .sort((left, right) => right.sessionDate.localeCompare(left.sessionDate)), limit)
}

export function buildSessionBadgesFromHistory(
  sessions: readonly SessionBadgeHistoryItem[],
  limit = 6
): SessionBadge[] {
  return dedupeBadges(sessions
    .filter((session): session is SessionBadgeHistoryItem & { qualityScore: number } =>
      session.qualityScore !== null)
    .sort((left, right) => right.date.localeCompare(left.date))
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
        sharePath: '/pages/access/startup',
        earnedCount: session.earnedCount ?? 1
      }
    }), limit)
}

function dedupeBadges(badges: SessionBadge[], limit: number) {
  const unique = new Map<SessionBadgeLevel, SessionBadge>()
  for (const badge of badges) {
    const existing = unique.get(badge.level)
    if (existing) {
      existing.earnedCount += badge.earnedCount
    } else {
      unique.set(badge.level, { ...badge })
    }
  }
  return [...unique.values()].slice(0, limit)
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
