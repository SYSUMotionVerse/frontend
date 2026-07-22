import {
  ACTION_ANGLE_NAMES,
  type ActionAlignmentMethod,
  type ActionAngleName,
  type ActionAngleRule,
  type ActionMotion,
  type ActionScoreDirection,
  type ActionScoreResult,
  type ActionStandard,
  type AggregatedActionScoreResult,
  type ScoredActionResult
} from './actionScoringTypes'

const DEFAULT_TOLERANCE = 0.35

const angleLabels: Record<ActionAngleName, string> = {
  left_elbow: '左肘',
  right_elbow: '右肘',
  left_shoulder: '左肩',
  right_shoulder: '右肩',
  left_hip: '左髋',
  right_hip: '右髋',
  left_knee: '左膝',
  right_knee: '右膝',
  torso_rotation: '躯干旋转'
}

interface ScoreActionOptions {
  passScore?: number
  alignmentMethod?: ActionAlignmentMethod
}

interface InterpolationResult {
  values: number[][]
  unavailable: Set<ActionAngleName>
  warnings: string[]
}

function finiteNumber(value: unknown) {
  if (typeof value === 'boolean') return Number.NaN
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : Number.NaN
}

function rowsToMatrix(
  rows: unknown[],
  sourceNames: string[],
  targetNames: readonly ActionAngleName[]
) {
  const positions = new Map(sourceNames.map((name, index) => [String(name), index]))
  return rows.map(row => {
    const values = Array.isArray(row) ? row : []
    return targetNames.map(name => {
      const sourceIndex = positions.get(name)
      return sourceIndex === undefined || sourceIndex >= values.length
        ? Number.NaN
        : finiteNumber(values[sourceIndex])
    })
  })
}

function resolveFrameTimes(motion: ActionMotion) {
  const raw = motion.frames.map(frame => finiteNumber(frame.time))
  const strictlyIncreasing = raw.every((value, index) => (
    Number.isFinite(value) && (index === 0 || value > raw[index - 1])
  ))

  if (strictlyIncreasing) {
    return { times: raw, warnings: [] as string[] }
  }

  return {
    times: motion.frames.map((_, index) => index),
    warnings: ['用户帧 time 缺失、非有限或非严格递增，插值与对齐已改用帧顺序。']
  }
}

function interpolateAt(times: number[], values: number[], targetTime: number) {
  if (targetTime <= times[0]) return values[0]
  if (targetTime >= times[times.length - 1]) return values[values.length - 1]

  let rightIndex = 1
  while (rightIndex < times.length && times[rightIndex] < targetTime) {
    rightIndex += 1
  }
  const leftIndex = rightIndex - 1
  const duration = times[rightIndex] - times[leftIndex]
  if (duration <= 0) return values[leftIndex]
  const ratio = (targetTime - times[leftIndex]) / duration
  return values[leftIndex] + (values[rightIndex] - values[leftIndex]) * ratio
}

function interpolateColumns(
  values: number[][],
  times: number[],
  label: '标准' | '用户'
): InterpolationResult {
  const output = values.map(row => [...row])
  const unavailable = new Set<ActionAngleName>()
  const warnings: string[] = []

  ACTION_ANGLE_NAMES.forEach((name, columnIndex) => {
    const validIndexes = output.flatMap((row, rowIndex) => (
      Number.isFinite(row[columnIndex]) ? [rowIndex] : []
    ))
    const missingCount = output.length - validIndexes.length

    if (validIndexes.length === 0) {
      unavailable.add(name)
      warnings.push(`${label}角度 ${name} 全程无效，已从评分中排除。`)
      return
    }
    if (missingCount === 0) return

    const validTimes = validIndexes.map(index => times[index])
    const validValues = validIndexes.map(index => output[index][columnIndex])
    output.forEach((row, rowIndex) => {
      if (!Number.isFinite(row[columnIndex])) {
        row[columnIndex] = interpolateAt(validTimes, validValues, times[rowIndex])
      }
    })
    warnings.push(`${label}角度 ${name} 有 ${missingCount} 个无效值，已按时间插值修复。`)
  })

  return { values: output, unavailable, warnings }
}

function resample(values: number[][], sourceTimes: number[], targetLength: number) {
  if (values.length === targetLength) return values.map(row => [...row])
  if (values.length === 1) return Array.from({ length: targetLength }, () => [...values[0]])

  const duration = sourceTimes[sourceTimes.length - 1] - sourceTimes[0]
  const sourceProgress = duration <= 0
    ? sourceTimes.map((_, index) => index / (sourceTimes.length - 1))
    : sourceTimes.map(time => (time - sourceTimes[0]) / duration)

  return Array.from({ length: targetLength }, (_, targetIndex) => {
    const targetProgress = targetLength === 1 ? 0 : targetIndex / (targetLength - 1)
    return ACTION_ANGLE_NAMES.map((_, columnIndex) => interpolateAt(
      sourceProgress,
      values.map(row => row[columnIndex]),
      targetProgress
    ))
  })
}

function selectParent(diagonal: number, up: number, left: number) {
  if (diagonal <= up && diagonal <= left) return 0
  if (up <= left) return 1
  return 2
}

function dtwAlign(
  standard: number[][],
  user: number[][],
  angleIndices: number[],
  normalizedWeights: number[],
  tolerances: number[]
) {
  const standardCount = standard.length
  const userCount = user.length
  const stride = userCount + 1
  const parents = new Int8Array((standardCount + 1) * stride)
  parents.fill(-1)

  let previousCosts = new Float64Array(stride)
  previousCosts.fill(Number.POSITIVE_INFINITY)
  previousCosts[0] = 0

  for (let standardIndex = 1; standardIndex <= standardCount; standardIndex += 1) {
    const currentCosts = new Float64Array(stride)
    currentCosts.fill(Number.POSITIVE_INFINITY)
    for (let userIndex = 1; userIndex <= userCount; userIndex += 1) {
      let localCost = 0
      for (let selectedIndex = 0; selectedIndex < angleIndices.length; selectedIndex += 1) {
        const angleIndex = angleIndices[selectedIndex]
        localCost += (
          Math.abs(user[userIndex - 1][angleIndex] - standard[standardIndex - 1][angleIndex])
          / tolerances[selectedIndex]
        ) * normalizedWeights[selectedIndex]
      }

      const parent = selectParent(
        previousCosts[userIndex - 1],
        previousCosts[userIndex],
        currentCosts[userIndex - 1]
      )
      const previousCost = parent === 0
        ? previousCosts[userIndex - 1]
        : parent === 1
          ? previousCosts[userIndex]
          : currentCosts[userIndex - 1]
      currentCosts[userIndex] = localCost + previousCost
      parents[standardIndex * stride + userIndex] = parent
    }
    previousCosts = currentCosts
  }

  const standardIndices: number[] = []
  const userIndices: number[] = []
  let standardIndex = standardCount
  let userIndex = userCount
  while (standardIndex > 0 || userIndex > 0) {
    if (standardIndex <= 0 || userIndex <= 0) {
      throw new Error('DTW 路径回溯失败。')
    }
    standardIndices.push(standardIndex - 1)
    userIndices.push(userIndex - 1)
    const parent = parents[standardIndex * stride + userIndex]
    if (parent === 0) {
      standardIndex -= 1
      userIndex -= 1
    } else if (parent === 1) {
      standardIndex -= 1
    } else if (parent === 2) {
      userIndex -= 1
    } else {
      throw new Error('DTW 路径回溯失败。')
    }
  }

  standardIndices.reverse()
  userIndices.reverse()
  const totalCost = previousCosts[userCount]
  const pathLength = standardIndices.length

  return {
    standard: standardIndices.map(index => standard[index]),
    user: userIndices.map(index => user[index]),
    debug: {
      alignment_path_length: pathLength,
      dtw_total_cost: totalCost,
      dtw_mean_cost: totalCost / pathLength
    }
  }
}

function defaultFeedback(angleName: ActionAngleName, direction: ActionScoreDirection) {
  return `${angleLabels[angleName]}角度${direction === 'too_small' ? '偏小' : '偏大'}`
}

function validateStandard(actionStandard: ActionStandard) {
  if (actionStandard.action_type !== 'repetitive') {
    throw new Error("当前评分函数只支持 action_type='repetitive'。")
  }
  if (actionStandard.angle_unit !== 'radian') {
    throw new Error("action_standard.angle_unit 必须为 'radian'。")
  }
  if (!Array.isArray(actionStandard.angle_names) || actionStandard.angle_names.length === 0) {
    throw new Error('action_standard 需要有效的 angle_names。')
  }
  if (!Array.isArray(actionStandard.standard_sequence) || actionStandard.standard_sequence.length === 0) {
    throw new Error('action_standard 需要非空 standard_sequence。')
  }
  if (!actionStandard.angle_rules || typeof actionStandard.angle_rules !== 'object') {
    throw new Error('action_standard.angle_rules 必须是对象。')
  }
}

export function scoreAction(
  actionStandard: ActionStandard,
  userMotion: ActionMotion,
  options: ScoreActionOptions = {}
): ActionScoreResult {
  validateStandard(actionStandard)
  if (!Array.isArray(userMotion.frames) || userMotion.frames.length === 0) {
    throw new Error('user_motion.frames 必须至少包含一帧。')
  }

  const passScore = finiteNumber(options.passScore ?? 80)
  if (!Number.isFinite(passScore) || passScore < 0 || passScore > 100) {
    throw new Error('pass_score 必须是 0 到 100 之间的有限数值。')
  }
  const alignmentMethod = options.alignmentMethod ?? 'resample'
  if (alignmentMethod !== 'resample' && alignmentMethod !== 'dtw') {
    throw new Error("alignment_method 只支持 'resample' 或 'dtw'。")
  }

  const standardRows = rowsToMatrix(
    actionStandard.standard_sequence,
    actionStandard.angle_names,
    ACTION_ANGLE_NAMES
  )
  const standardTimes = standardRows.map((_, index) => index)
  const standardInterpolation = interpolateColumns(standardRows, standardTimes, '标准')

  const timeResult = resolveFrameTimes(userMotion)
  const userRows = rowsToMatrix(
    userMotion.frames.map(frame => frame.angles),
    userMotion.angle_names,
    ACTION_ANGLE_NAMES
  )
  const userInterpolation = interpolateColumns(userRows, timeResult.times, '用户')
  const warnings = [
    ...standardInterpolation.warnings,
    ...timeResult.warnings,
    ...userInterpolation.warnings
  ]
  const unavailable = new Set([
    ...standardInterpolation.unavailable,
    ...userInterpolation.unavailable
  ])

  const candidates = ACTION_ANGLE_NAMES.flatMap(name => {
    const rule = actionStandard.angle_rules[name]
    return rule?.enabled === true && !unavailable.has(name)
      ? [{ name, rule }]
      : []
  })
  if (candidates.length === 0) {
    throw new Error('没有可用于评分的已启用且有效角度。')
  }

  const weights = candidates.map(({ rule }) => {
    const weight = Math.max(0, finiteNumber(rule.weight ?? 1))
    return Number.isFinite(weight) ? weight : 0
  })
  let weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  if (weightSum <= 0) {
    weights.fill(1)
    weightSum = weights.length
    warnings.push('可用角度的 weight 总和不大于 0，已按等权评分。')
  }
  const normalizedWeights = weights.map(weight => weight / weightSum)

  const tolerances = candidates.map(({ name, rule }) => {
    const tolerance = finiteNumber(rule.tolerance ?? DEFAULT_TOLERANCE)
    if (Number.isFinite(tolerance) && tolerance > 0) return tolerance
    warnings.push(`${name} 的 tolerance 无效，已使用默认值 ${DEFAULT_TOLERANCE} rad。`)
    return DEFAULT_TOLERANCE
  })

  let alignedStandard = standardInterpolation.values
  let alignedUser: number[][]
  let alignmentDebug: Partial<ActionScoreResult['debug']> = {}
  if (alignmentMethod === 'resample') {
    alignedUser = resample(userInterpolation.values, timeResult.times, alignedStandard.length)
  } else {
    const aligned = dtwAlign(
      alignedStandard,
      userInterpolation.values,
      candidates.map(({ name }) => ACTION_ANGLE_NAMES.indexOf(name)),
      normalizedWeights,
      tolerances
    )
    alignedStandard = aligned.standard
    alignedUser = aligned.user
    alignmentDebug = aligned.debug
  }

  const angleDetails: ActionScoreResult['angle_details'] = {}
  const feedback: ActionScoreResult['feedback'] = []
  const angleScores = candidates.map(({ name, rule }, candidateIndex) => {
    const angleIndex = ACTION_ANGLE_NAMES.indexOf(name)
    const signedErrors = alignedUser.map((row, rowIndex) => (
      row[angleIndex] - alignedStandard[rowIndex][angleIndex]
    ))
    const absoluteErrors = signedErrors.map(Math.abs)
    const meanSignedError = signedErrors.reduce((sum, value) => sum + value, 0) / signedErrors.length
    const meanAbsoluteError = absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length
    const maxAbsoluteError = Math.max(...absoluteErrors)
    const tolerance = tolerances[candidateIndex]
    const angleScore = Math.max(0, 100 * (1 - meanAbsoluteError / (tolerance * 3)))
    const direction: ActionScoreDirection = meanSignedError < 0 ? 'too_small' : 'too_large'
    const overTolerance = meanAbsoluteError > tolerance
    const configuredWeight = finiteNumber(rule.weight ?? 1)

    angleDetails[name] = {
      enabled: true,
      weight: Number.isFinite(configuredWeight) ? configuredWeight : 1,
      normalized_weight: normalizedWeights[candidateIndex],
      score: angleScore,
      mean_error: meanAbsoluteError,
      mean_signed_error: meanSignedError,
      max_error: maxAbsoluteError,
      tolerance,
      direction,
      over_tolerance: overTolerance
    }

    if (overTolerance) {
      const message = rule.feedback?.[direction]?.trim()
      feedback.push({
        angle: name,
        direction,
        message: message || defaultFeedback(name, direction),
        severity: 'warning'
      })
    }
    return angleScore
  })

  const score = angleScores.reduce((sum, value, index) => (
    sum + value * normalizedWeights[index]
  ), 0)
  const boundedScore = Math.min(100, Math.max(0, score))

  return {
    score: boundedScore,
    passed: boundedScore >= passScore,
    pass_score: passScore,
    feedback,
    angle_details: angleDetails,
    debug: {
      alignment_method: alignmentMethod,
      input_source: 'angles',
      standard_frames: standardInterpolation.values.length,
      user_frames: userInterpolation.values.length,
      used_angles: candidates.map(({ name }) => name),
      warnings,
      ...alignmentDebug
    }
  }
}

export function aggregateActionScores(
  actionScores: ScoredActionResult[],
  scoringWarnings: string[] = []
): AggregatedActionScoreResult {
  if (actionScores.length === 0) {
    return {
      score: undefined,
      summary: '教学视频已完成，但未获得可用于动作评分的标准数据或姿态数据。',
      dimensions: [],
      highlights: [],
      warnings: [...new Set(scoringWarnings)]
    }
  }

  const weightedDuration = actionScores.reduce(
    (sum, action) => sum + Math.max(1, action.expectedDuration),
    0
  )
  const score = Number((actionScores.reduce((sum, action) => (
    sum + action.score * Math.max(1, action.expectedDuration)
  ), 0) / weightedDuration).toFixed(2))
  const feedbackWarnings = actionScores.flatMap(action => (
    action.feedback.map(item => `${action.title}：${item.message}`)
  ))
  const summary = score >= 90
    ? `教学视频已完成，本次动作评分 ${Math.round(score)} 分，整体动作完成稳定。`
    : score >= 80
      ? `教学视频已完成，本次动作评分 ${Math.round(score)} 分，动作基本到位。`
      : `教学视频已完成，本次动作评分 ${Math.round(score)} 分，建议根据动作提示继续练习。`

  return {
    score,
    summary,
    dimensions: actionScores.map(action => ({
      key: action.actionId,
      label: action.title,
      score: Number(action.score.toFixed(2))
    })),
    highlights: actionScores
      .filter(action => action.score >= 90)
      .map(action => `${action.title}完成稳定`),
    warnings: [...new Set([...feedbackWarnings, ...scoringWarnings])]
  }
}
