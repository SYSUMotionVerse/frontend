import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('training feedback redesign', () => {
  it('uses the standard decorated shell and data-driven body and trend views', () => {
    const page = readFileSync(resolve('src/uni-app/pages/training/feedback.vue'), 'utf8')
    const bodyMap = readFileSync(resolve('src/components/training/TrainingFeedbackBodyMap.vue'), 'utf8')
    const actionCard = readFileSync(resolve('src/components/training/TrainingFeedbackActionCard.vue'), 'utf8')

    expect(page).toContain('UniTrainingPageShell')
    expect(page).toContain('show-decorations')
    expect(page).toContain('TrainingFeedbackBodyMap')
    expect(page).toContain('TrainingFeedbackTrendChart')
    expect(page).toContain('TrainingFeedbackActionCard')
    expect(page).toContain('actionResults')
    expect(bodyMap).toContain('CDN_IMAGE_URLS.trainingFeedbackBodyMap')
    expect(bodyMap).toContain('CDN_IMAGE_URLS.trainingFeedbackBodyMapFemale')
    expect(bodyMap).toContain("studentStore.state.profile.gender === '女'")
    expect(bodyMap).toContain(".filter(angle => anglePositions[angle.key])")
    expect(actionCard).toContain('本动作得分趋势')
  })

  it('replaces the camera guide drawing with the generated transparent asset', () => {
    const panel = readFileSync(resolve('src/subpackages/training/components/VisualTrainingPanel.vue'), 'utf8')
    expect(panel).toContain(':src="CDN_IMAGE_URLS.cameraPositionGuide"')
    expect(panel).not.toContain('visual-session__guide-torso')
    expect(panel).not.toContain('visual-session__guide-arm')
    expect(panel).not.toContain('visual-session__guide-leg')
  })
})
