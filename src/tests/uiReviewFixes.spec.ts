import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../composables/useStudentAppState', () => ({
  useStudentAppState: () => ({
    state: {
      reminderSource: null,
      dailyAdherence: {
        validCheckIns: 0,
        reminderEligible: true
      },
      weeklyAdherence: {
        qualifyingDays: 0
      }
    },
    refreshReminderEligibility: vi.fn(),
    setReminderSource: vi.fn()
  })
}))


describe('ui review fixes', () => {


  it('keeps stable metadata on registration inputs and uses picker selectors for miniapp fields', () => {
    const file = readFileSync(
      resolve('src/components/access/RegistrationForm.vue'),
      'utf8'
    )

    expect(file).toContain('autocomplete="username"')
    expect(file).toContain('inputmode="numeric"')
    expect(file).toContain('maxlength="8"')
    expect(file).toContain('@input="handleStudentIdInput"')
    expect(file).toContain('input v-model.trim="form.name" autocomplete="name"')
    expect(file).toContain('input v-model.trim="form.major" autocomplete="organization-title"')
    expect(file).toContain("@input=\"handleNumericFieldInput('age', $event)\"")
    expect(file).toContain("@input=\"handleNumericFieldInput('heightCm', $event)\"")
    expect(file).toContain("@input=\"handleNumericFieldInput('weightKg', $event)\"")
    expect(file).toContain("@input=\"handleNumericFieldInput('restingHeartRate', $event)\"")
    expect(file).toContain('mode="selector"')
    expect(file).toContain(':range="genderOptions"')
    expect(file).toContain(':range="gradeOptions"')
    expect(file).not.toContain('space-y-')
  })

  it('avoids peer-based selectors that compile to invalid wxss sibling syntax', () => {
    const shortQuestionnaireForm = readFileSync(
      resolve('src/components/training/ShortQuestionnaireForm.vue'),
      'utf8'
    )
    const longQuestionnaireForm = readFileSync(
      resolve('src/components/access/LongQuestionnaireForm.vue'),
      'utf8'
    )

    expect(shortQuestionnaireForm).not.toContain('peer-checked:')
    expect(shortQuestionnaireForm).not.toContain('sr-only peer')
    expect(longQuestionnaireForm).not.toContain('peer-checked:')
    expect(longQuestionnaireForm).not.toContain('sr-only peer')
  })

  it('avoids web font icon dependencies in miniapp-shared forms', () => {
    const registrationForm = readFileSync(
      resolve('src/components/access/RegistrationForm.vue'),
      'utf8'
    )
    const shortQuestionnaireForm = readFileSync(
      resolve('src/components/training/ShortQuestionnaireForm.vue'),
      'utf8'
    )

    expect(registrationForm).not.toContain('material-symbols-outlined')
    expect(registrationForm).not.toContain('font-variation-settings')
    expect(shortQuestionnaireForm).not.toContain('material-symbols-outlined')
    expect(shortQuestionnaireForm).not.toContain('font-variation-settings')
  })

  it('prefers text nodes over span tags in primary miniapp-shared components', () => {
    const files = [
      'src/components/access/AccessPageShell.vue',
      'src/components/access/RegistrationForm.vue',
      'src/components/training/TrainingModeCard.vue',
      'src/components/training/DailyProgressCard.vue',
      'src/components/training/StairTrainingPanel.vue',
      'src/components/training/VisualTrainingPanel.vue',
      'src/components/training/ShortQuestionnaireForm.vue'
    ]

    for (const filePath of files) {
      const file = readFileSync(resolve(filePath), 'utf8')

      expect(file).not.toContain('<span')
    }
  })

  it('uses miniapp form submission semantics on shared forms', () => {
    const files = [
      'src/components/access/RegistrationForm.vue',
      'src/components/access/LongQuestionnaireForm.vue',
      'src/components/training/ShortQuestionnaireForm.vue'
    ]

    for (const filePath of files) {
      const file = readFileSync(resolve(filePath), 'utf8')

      expect(file).toContain('form-type="submit"')
    }
  })


  it('uses uni-app navigation semantics for the primary access flow', () => {
    const registerPage = readFileSync(
      resolve('src/uni-app/pages/access/register.vue'),
      'utf8'
    )
    const questionnairePage = readFileSync(
      resolve('src/uni-app/pages/access/questionnaire.vue'),
      'utf8'
    )
    const resultPage = readFileSync(
      resolve('src/uni-app/pages/access/questionnaire-result.vue'),
      'utf8'
    )

    expect(registerPage).toContain('uni.redirectTo')
    expect(questionnairePage).toContain('uni.navigateTo')
    expect(resultPage).toContain('uni.redirectTo')
  })

  it('uses uni-app navigation semantics for the primary training flow', () => {
    const homePage = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )
    const selectionPage = readFileSync(
      resolve('src/uni-app/pages/training/select.vue'),
      'utf8'
    )
    const feedbackPage = readFileSync(
      resolve('src/uni-app/pages/training/feedback.vue'),
      'utf8'
    )

    expect(homePage).toContain('<navigator')
    expect(homePage).toContain('url="/pages/training/select"')
    expect(homePage).toContain('url="/pages/growth/index"')
    expect(selectionPage).toContain('uni.navigateTo')
    expect(feedbackPage).toContain('uni.redirectTo')
  })

  it('registers miniapp growth detail pages that the growth hub navigates to', () => {
    const uniPagesManifest = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages.json'),
      'utf8'
    )
    const rootPagesManifest = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/pages.json'),
      'utf8'
    )

    expect(uniPagesManifest).toContain('"path": "pages/growth/adherence"')
    expect(uniPagesManifest).toContain('"path": "pages/growth/achievements"')
    expect(uniPagesManifest).toContain('"path": "pages/growth/metrics"')
    expect(uniPagesManifest).toContain('"path": "pages/growth/history"')
    expect(rootPagesManifest).toContain('"path": "pages/growth/adherence"')
    expect(rootPagesManifest).toContain('"path": "pages/growth/achievements"')
    expect(rootPagesManifest).toContain('"path": "pages/growth/metrics"')
    expect(rootPagesManifest).toContain('"path": "pages/growth/history"')
  })

  it('keeps source wrapper pages for registered miniapp growth detail routes', () => {
    const adherenceWrapper = '/Users/pi-dal/Developer/sport-snack/src/pages/growth/adherence.vue'
    const achievementsWrapper = '/Users/pi-dal/Developer/sport-snack/src/pages/growth/achievements.vue'
    const metricsWrapper = '/Users/pi-dal/Developer/sport-snack/src/pages/growth/metrics.vue'
    const historyWrapper = '/Users/pi-dal/Developer/sport-snack/src/pages/growth/history.vue'

    expect(existsSync(adherenceWrapper)).toBe(true)
    expect(existsSync(achievementsWrapper)).toBe(true)
    expect(existsSync(metricsWrapper)).toBe(true)
    expect(existsSync(historyWrapper)).toBe(true)

    expect(readFileSync(resolve(adherenceWrapper), 'utf8')).toContain("import GrowthAdherencePage from '../../uni-app/pages/growth/adherence.vue'")
    expect(readFileSync(resolve(achievementsWrapper), 'utf8')).toContain("import GrowthAchievementsPage from '../../uni-app/pages/growth/achievements.vue'")
    expect(readFileSync(resolve(metricsWrapper), 'utf8')).toContain("import GrowthMetricsPage from '../../uni-app/pages/growth/metrics.vue'")
    expect(readFileSync(resolve(historyWrapper), 'utf8')).toContain("import GrowthHistoryPage from '../../uni-app/pages/growth/history.vue'")
  })

  it('preserves clear interactive affordance on growth detail navigation after migration', () => {
    const growthIndexPage = readFileSync(
      resolve('src/uni-app/pages/growth/index.vue'),
      'utf8'
    )
    const metricsPage = readFileSync(
      resolve('src/uni-app/pages/growth/metrics.vue'),
      'utf8'
    )

    expect(growthIndexPage).toContain('uni.navigateTo')
    expect(growthIndexPage).toContain('.growth-page__link:active')
    expect(growthIndexPage).toContain('growth-page__link--current')
    expect(metricsPage).toContain("const emptyStateHint = computed(() => metricsState.value.hasMetrics ? '' : metricsState.value.message)")
    expect(metricsPage).toContain('{{ emptyStateHint }}')
  })

  it('keeps miniapp-facing localized copy fully in Chinese on shared access and growth surfaces', () => {
    const growthIndexPage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages/growth/index.vue'),
      'utf8'
    )
    const resultCard = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/access/QuestionnaireResultCard.vue'),
      'utf8'
    )
    const registrationForm = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/access/RegistrationForm.vue'),
      'utf8'
    )
    const physicalMetricsPanel = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/growth/PhysicalMetricsPanel.vue'),
      'utf8'
    )
    const questionnaireFeature = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/features/access/questionnaire.ts'),
      'utf8'
    )
    const cameraPlatform = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/platform/camera.ts'),
      'utf8'
    )
    const sensorPlatform = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/platform/sensors.ts'),
      'utf8'
    )

    expect(growthIndexPage).toContain('体能指标')
    expect(growthIndexPage).toContain('历史记录')
    expect(growthIndexPage).toContain('查看训练与问卷历史。')
    expect(growthIndexPage).not.toContain('Physical Metrics')
    expect(growthIndexPage).not.toContain('History')
    expect(growthIndexPage).not.toContain('Open session and questionnaire history.')

    expect(resultCard).toContain('优秀势头')
    expect(resultCard).toContain('进步良好')
    expect(resultCard).toContain('需要加强')
    expect(resultCard).toContain('评估得分')
    expect(resultCard).toContain('提交时间')
    expect(resultCard).toContain('刚刚生成')
    expect(resultCard).toContain('继续前往首页 ✨')
    expect(resultCard).not.toContain('Excellent momentum')
    expect(resultCard).not.toContain('Checkpoint score')
    expect(resultCard).not.toContain('Submitted')
    expect(resultCard).not.toContain('Continue to Home')

    expect(registrationForm).toContain('基本信息')
    expect(registrationForm).toContain('填写今天加入训练的同学信息。')
    expect(registrationForm).toContain('请选择')
    expect(registrationForm).toContain('健康指标')
    expect(registrationForm).toContain('在训练开始前补充基础数据。')
    expect(registrationForm).toContain('准备好了，出发！ 🚀')
    expect(registrationForm).not.toContain('Basic Info')
    expect(registrationForm).not.toContain('Health Metrics')
    expect(registrationForm).not.toContain('Ready, Set, Go!')

    expect(physicalMetricsPanel).not.toContain(".replace('Physical metrics will appear here after body-test data is imported.'")

    expect(questionnaireFeature).toContain("baseline: '基线'")
    expect(questionnaireFeature).toContain("week4: '第4周'")
    expect(questionnaireFeature).toContain('我能在困难时刻保持冷静。')
    expect(questionnaireFeature).toContain('我的睡眠质量能够支持日常训练和恢复。')
    expect(questionnaireFeature).not.toContain("baseline: 'Baseline'")
    expect(questionnaireFeature).not.toContain('I can stay calm during difficult moments.')

    expect(cameraPlatform).toContain('力量很足，下一轮把落地再放轻一些。')
    expect(cameraPlatform).toContain('控制得很好，继续放松肩膀。')
    expect(cameraPlatform).not.toContain('Power is there')
    expect(sensorPlatform).toContain('传感器采集很稳定，下一轮可以尝试把抬膝再提高一些。')
    expect(sensorPlatform).not.toContain('Sensor capture stayed stable')
  })



  it('removes web keyboard affordances from miniapp-first action surfaces', () => {
    const resultCard = readFileSync(
      resolve('src/components/access/QuestionnaireResultCard.vue'),
      'utf8'
    )
    const trainingModeCard = readFileSync(
      resolve('src/components/training/TrainingModeCard.vue'),
      'utf8'
    )
    const miniappHomePage = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )

    expect(resultCard).not.toContain('role="button"')
    expect(resultCard).not.toContain('tabindex="0"')
    expect(resultCard).not.toContain('@keydown.enter.prevent')
    expect(resultCard).not.toContain('@keydown.space.prevent')
    expect(resultCard).toContain('<button')
    expect(resultCard).toContain('type="button"')

    expect(trainingModeCard).not.toContain('role="button"')
    expect(trainingModeCard).not.toContain('tabindex="0"')
    expect(trainingModeCard).not.toContain('@keydown.enter.prevent')
    expect(trainingModeCard).not.toContain('@keydown.space.prevent')

    expect(miniappHomePage).toContain('<navigator')
    expect(miniappHomePage).toContain('url="/pages/training/select"')
    expect(miniappHomePage).toContain('url="/pages/growth/index"')
    expect(miniappHomePage).not.toContain('role="button"')
    expect(miniappHomePage).not.toContain('tabindex="0"')
    expect(miniappHomePage).not.toContain('@keydown.enter.prevent')
    expect(miniappHomePage).not.toContain('@keydown.space.prevent')
  })

  it('avoids grid and fixed decoration on miniapp-critical shared surfaces', () => {
    const progressCard = readFileSync(
      resolve('src/components/training/DailyProgressCard.vue'),
      'utf8'
    )
    const summaryCards = readFileSync(
      resolve('src/components/growth/GrowthSummaryCards.vue'),
      'utf8'
    )
    const adherenceHeatmap = readFileSync(
      resolve('src/components/growth/AdherenceHeatmap.vue'),
      'utf8'
    )
    const accessShell = readFileSync(
      resolve('src/components/access/AccessPageShell.vue'),
      'utf8'
    )
    const unoConfig = readFileSync(
      resolve('uno.config.ts'),
      'utf8'
    )

    expect(progressCard).not.toContain('grid grid-cols-3')
    expect(summaryCards).not.toContain('display: grid;')
    expect(summaryCards).not.toContain('grid-template-columns:')
    expect(adherenceHeatmap).not.toContain('display: grid;')
    expect(adherenceHeatmap).not.toContain('grid-auto-flow:')
    expect(adherenceHeatmap).not.toContain('grid-template-rows:')
    expect(accessShell).not.toContain('class="fixed')
    expect(accessShell).not.toContain(' fixed ')
    expect(unoConfig).not.toContain("'bouncy-btn': 'transition-all")
  })

  it('keeps registration and growth shared surfaces on flex-first miniapp layouts', () => {
    const registrationForm = readFileSync(
      resolve('src/components/access/RegistrationForm.vue'),
      'utf8'
    )
    const achievementBadgeList = readFileSync(
      resolve('src/components/growth/AchievementBadgeList.vue'),
      'utf8'
    )
    const physicalMetricsPanel = readFileSync(
      resolve('src/components/growth/PhysicalMetricsPanel.vue'),
      'utf8'
    )
    const trainingHistoryList = readFileSync(
      resolve('src/components/growth/TrainingHistoryList.vue'),
      'utf8'
    )
    const assessmentHistoryList = readFileSync(
      resolve('src/components/growth/AssessmentHistoryList.vue'),
      'utf8'
    )

    expect(registrationForm).not.toContain('grid grid-cols-2')
    expect(registrationForm).toContain('form-row')
    expect(achievementBadgeList).not.toContain('display: grid;')
    expect(achievementBadgeList).not.toContain('grid-template-columns:')
    expect(physicalMetricsPanel).not.toContain('display: grid;')
    expect(trainingHistoryList).not.toContain('display: grid;')
    expect(assessmentHistoryList).not.toContain('display: grid;')
  })

  it('lets registration inputs stretch to the available card width', () => {
    const registrationForm = readFileSync(
      resolve('src/components/access/RegistrationForm.vue'),
      'utf8'
    )
    const unoConfig = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/uno.config.ts'),
      'utf8'
    )

    expect(registrationForm).toContain('registration-input-shell')
    expect(registrationForm).toContain('registration-picker-shell')
    expect(registrationForm).toContain('form-stack-field')
    expect(registrationForm).toContain('flex: 1 1 0;')
    expect(registrationForm).toContain('width: 100%;')
    expect(registrationForm).toContain('box-sizing: border-box;')
    expect(unoConfig).toContain("'input-shell': 'w-full box-border")
    expect(registrationForm).not.toContain('max-width: 480rpx;')
    expect(registrationForm).not.toContain('max-width: 520rpx;')
    expect(registrationForm).not.toContain('class="w-full"')
  })

  it('keeps training panels and miniapp shells on low-risk layout and motion primitives', () => {
    const visualTrainingPanel = readFileSync(
      resolve('src/components/training/VisualTrainingPanel.vue'),
      'utf8'
    )
    const stairTrainingPanel = readFileSync(
      resolve('src/components/training/StairTrainingPanel.vue'),
      'utf8'
    )
    const sessionFeedbackCard = readFileSync(
      resolve('src/components/training/SessionFeedbackCard.vue'),
      'utf8'
    )
    const uniGrowthShell = readFileSync(
      resolve('src/uni-app/components/growth/UniGrowthPageShell.vue'),
      'utf8'
    )
    const accessShell = readFileSync(
      resolve('src/components/access/AccessPageShell.vue'),
      'utf8'
    )

    expect(visualTrainingPanel).not.toContain('grid grid-cols[')
    expect(visualTrainingPanel).not.toContain('grid grid-cols-')
    expect(visualTrainingPanel).not.toContain('transition-all')
    expect(stairTrainingPanel).not.toContain('transition-all')
    expect(sessionFeedbackCard).not.toContain('grid grid-cols-2')
    expect(uniGrowthShell).not.toContain('display: grid;')
    expect(accessShell).not.toContain('transition-all')
    expect(accessShell).not.toContain('animate-bounce')
    expect(accessShell).not.toContain('text-shadow:')
  })


  it('brings demo-style badge and sticker treatments into shared cards', () => {
    const registrationForm = readFileSync(
      resolve('src/components/access/RegistrationForm.vue'),
      'utf8'
    )
    const dailyProgressCard = readFileSync(
      resolve('src/components/training/DailyProgressCard.vue'),
      'utf8'
    )
    const reminderBanner = readFileSync(
      resolve('src/components/training/ReminderBanner.vue'),
      'utf8'
    )
    const summaryCards = readFileSync(
      resolve('src/components/growth/GrowthSummaryCards.vue'),
      'utf8'
    )

    expect(registrationForm).toContain('form-card__sticker')
    expect(registrationForm).toContain('form-card__kicker')
    expect(dailyProgressCard).toContain('progress-card__eyebrow')
    expect(dailyProgressCard).toContain('progress-card__meter-pill')
    expect(reminderBanner).toContain('reminder-banner__eyebrow')
    expect(summaryCards).toContain('summary-card__pill')
    expect(summaryCards).toContain('summary-card--highlight')
  })


  it('routes every rounded questionnaire option through the short check-in surface only', () => {
    const shortQuestionnaireForm = readFileSync(
      resolve('src/components/training/ShortQuestionnaireForm.vue'),
      'utf8'
    )
    const longQuestionnaireForm = readFileSync(
      resolve('src/components/access/LongQuestionnaireForm.vue'),
      'utf8'
    )

    expect(shortQuestionnaireForm).toContain('rating-option rating-option--rounded')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__options')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__option')
    expect(longQuestionnaireForm).not.toContain('rating-option--rounded')
  })

  it('gives long-questionnaire prompts and actions more breathing room', () => {
    const longQuestionnaireForm = readFileSync(
      resolve('src/components/access/LongQuestionnaireForm.vue'),
      'utf8'
    )

    expect(longQuestionnaireForm).toContain('long-questionnaire-form__card')
    expect(longQuestionnaireForm).toContain('long-questionnaire-form__prompt')
    expect(longQuestionnaireForm).toContain('long-questionnaire-form__options')
    expect(longQuestionnaireForm).toContain('long-questionnaire-form__actions')
    expect(longQuestionnaireForm).toContain('gap: 40rpx;')
    expect(longQuestionnaireForm).toContain('margin-bottom: 40rpx;')
    expect(longQuestionnaireForm).toContain('padding-bottom: 72rpx;')
  })

  it('aligns the short post-training questionnaire with the shared questionnaire layout language', () => {
    const shortQuestionnaireForm = readFileSync(
      resolve('src/components/training/ShortQuestionnaireForm.vue'),
      'utf8'
    )

    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__hero')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__hero-badge')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__card')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__prompt')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__actions')
    expect(shortQuestionnaireForm).toContain('请完成全部打卡项')
    expect(shortQuestionnaireForm).toContain('提交打卡 ✨')
    expect(shortQuestionnaireForm).not.toContain('Incomplete')
    expect(shortQuestionnaireForm).not.toContain('Continue ✨')
  })

  it('relaxes shared shell and entry-page spacing across the miniapp surfaces', () => {
    const accessShell = readFileSync(
      resolve('src/components/access/AccessPageShell.vue'),
      'utf8'
    )
    const uniAccessShell = readFileSync(
      resolve('src/uni-app/components/access/UniAccessPageShell.vue'),
      'utf8'
    )
    const uniTrainingShell = readFileSync(
      resolve('src/uni-app/components/training/UniTrainingPageShell.vue'),
      'utf8'
    )
    const uniGrowthShell = readFileSync(
      resolve('src/uni-app/components/growth/UniGrowthPageShell.vue'),
      'utf8'
    )
    const miniappHomePage = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )
    const miniappGrowthPage = readFileSync(
      resolve('src/uni-app/pages/growth/index.vue'),
      'utf8'
    )

    expect(accessShell).toContain('padding: 56rpx 48rpx 216rpx;')
    expect(accessShell).toContain('gap: 56rpx;')
    expect(uniAccessShell).toContain('padding: 56rpx 48rpx 120rpx;')
    expect(uniAccessShell).toContain('gap: 40rpx;')
    expect(uniTrainingShell).toContain('padding: 56rpx 32rpx 96rpx;')
    expect(uniTrainingShell).toContain('gap: 36rpx;')
    expect(uniGrowthShell).toContain('padding: 56rpx 32rpx 96rpx;')
    expect(uniGrowthShell).toContain('gap: 40rpx;')
    expect(miniappHomePage).toContain('gap: 28rpx;')
    expect(miniappHomePage).toContain('margin-top: 44rpx;')
    expect(miniappGrowthPage).toContain('gap: 28rpx;')
    expect(miniappGrowthPage).toContain('padding: 40rpx;')
  })

  it('wires the register avatar flow to WeChat avatar and image upload APIs', () => {
    const avatarField = readFileSync(
      resolve('src/components/access/RegistrationAvatarField.vue'),
      'utf8'
    )
    const avatarComposable = readFileSync(
      resolve('src/uni-app/composables/useRegistrationAvatar.ts'),
      'utf8'
    )

    expect(avatarField).toContain('avatar-field__trigger')
    expect(avatarField).toContain('justify-content: center;')
    expect(avatarField).not.toContain('avatar-field__content')
    expect(avatarField).not.toContain('avatar-field__picker-panel')
    expect(avatarField).not.toContain('avatar-field__actions')
    expect(avatarField).toContain('open-type="chooseAvatar"')
    expect(avatarField).toContain('@chooseavatar=')
    expect(avatarComposable).toContain('detail?.avatarUrl')
    expect(avatarComposable).toContain('uni.uploadFile')
    expect(avatarComposable).toContain("name: 'file'")
    expect(avatarComposable).not.toContain('uni.chooseImage')
    expect(avatarComposable).not.toContain('selectImageSource')
  })
})
