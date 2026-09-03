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
    expect(file).toContain('input v-model.trim="form.name" aria-label="姓名" autocomplete="name"')
    expect(file).toContain('input v-model.trim="form.major" aria-label="专业" autocomplete="organization-title"')
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
      'src/subpackages/training/components/VisualTrainingPanel.vue',
      'src/components/training/ShortQuestionnaireForm.vue'
    ]

    for (const filePath of files) {
      const file = readFileSync(resolve(filePath), 'utf8')

      expect(file).not.toContain('<span')
    }
  })

  it('keeps native form submits within their owning components', () => {
    const files = [
      'src/components/access/RegistrationForm.vue',
      'src/components/training/ShortQuestionnaireForm.vue'
    ]

    for (const filePath of files) {
      const file = readFileSync(resolve(filePath), 'utf8')

      expect(file).toContain('form-type="submit"')
    }

    const questionnaireNavigation = readFileSync(
      resolve('src/components/access/QuestionnaireBottomNavigation.vue'),
      'utf8'
    )

    expect(questionnaireNavigation).toContain('@click="emit(\'submit\')"')
    expect(questionnaireNavigation).not.toContain('form-type="submit"')
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

    expect(registerPage).toContain('uni.reLaunch')
    expect(questionnairePage).toContain('uni.redirectTo')
    expect(resultPage).toContain('uni.reLaunch')
  })

  it('keeps the home training view progress-first and uses uni-app navigation elsewhere', () => {
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

    expect(homePage).not.toContain('<navigator')
    expect(homePage).not.toContain('url="/pages/training/select"')
    expect(homePage).not.toContain('url="/pages/growth/index"')
    expect(selectionPage).toContain('uni.navigateTo')
    expect(feedbackPage).toContain('uni.switchTab')
  })

  it('uses unified, stateful training rows in the playground', () => {
    const selectionPage = readFileSync(
      resolve('src/uni-app/pages/training/select.vue'),
      'utf8'
    )

    expect(selectionPage).toContain('mini-tag="选择今天要完成的训练"')
    expect(selectionPage).toContain('推荐先做${recommendedMode.title}，完成后点亮今日进度。')
    expect(selectionPage).toContain('问卷未解锁')
    expect(selectionPage).toContain('进度同步中')
    expect(selectionPage).toContain('完成任一训练后，将更新今日达标状态。')
    expect(selectionPage).not.toContain('type="info"')
    expect(selectionPage).toContain('trainingModes')
    expect(selectionPage).toContain("title: '自重抗阻'")
    expect(selectionPage).toContain('/pages/training/exercise-sets?modality=${modality}')
    expect(selectionPage).toContain('select-page__launch-list')
    expect(selectionPage).toContain('@click="chooseMode(mode.modality)"')
    expect(selectionPage).toContain(':type="mode.icon"')
    expect(selectionPage).toContain('select-page__launch-status')
    expect(selectionPage).toContain('const hasAuthoritativeStatus = completed !== undefined')
    expect(selectionPage).toContain("!progress.value || !hasAuthoritativeStatus")
    expect(selectionPage).toContain("`select-page__launch-action--${mode.status}`")
    expect(selectionPage).not.toContain('TrainingProgressSnapshot')
    expect(selectionPage).not.toContain('select-page__launch-trail')
    expect(selectionPage).not.toContain('select-page__launch-action--wushu')
    expect(selectionPage).toContain('min-height: 164rpx;')
    expect(selectionPage).toContain('border: 2rpx solid rgba(196, 151, 78, 0.42);')
    expect(selectionPage).toContain('0 10rpx 24rpx rgba(71, 56, 39, 0.1)')
    expect(selectionPage).not.toContain('width: 112rpx;')
    expect(selectionPage).not.toContain('TrainingModeCard')
    expect(selectionPage).toContain('select-page__streak-note')
    expect(selectionPage).not.toContain('<uni-icons type="info-filled"')
  })

  it('adds a profile greeting header to the training playground', () => {
    const selectionPage = readFileSync(
      resolve('src/uni-app/pages/training/select.vue'),
      'utf8'
    )

    expect(selectionPage).toContain("const displayName = computed(() => store.state.profile.name.trim() || '同学')")
    expect(selectionPage).toContain('TrainingHomeHeader')
    expect(selectionPage).toContain('mini-tag="选择今天要完成的训练"')
    expect(selectionPage).toContain('variant="home"')
    expect(selectionPage).toContain('mini-tag-tone="muted"')
    expect(selectionPage).toContain(':unread-count="stationNotifications.unreadCount.value"')
  })

  it('wires a shared floating dock across training and growth shells while excluding rating pages', () => {
    const trainingShell = readFileSync(
      resolve('src/uni-app/components/training/UniTrainingPageShell.vue'),
      'utf8'
    )
    const growthShell = readFileSync(
      resolve('src/uni-app/components/growth/UniGrowthPageShell.vue'),
      'utf8'
    )
    const floatingDock = readFileSync(
      resolve('src/uni-app/components/navigation/FloatingDock.vue'),
      'utf8'
    )
    const trainingHomePage = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )
    const trainingSelectPage = readFileSync(
      resolve('src/uni-app/pages/training/select.vue'),
      'utf8'
    )
    const growthIndexPage = readFileSync(
      resolve('src/uni-app/pages/growth/index.vue'),
      'utf8'
    )
    const shortQuestionnairePage = readFileSync(
      resolve('src/uni-app/pages/training/short-questionnaire.vue'),
      'utf8'
    )
    const feedbackPage = readFileSync(
      resolve('src/uni-app/pages/training/feedback.vue'),
      'utf8'
    )

    expect(trainingShell).toContain('FloatingDock')
    expect(growthShell).toContain('FloatingDock')
    expect(floatingDock).toContain('open-type="switchTab"')
    expect(trainingHomePage).toContain('dock-tab="home"')
    expect(trainingSelectPage).toContain('dock-tab="playground"')
    expect(growthIndexPage).toContain('dock-tab="growth"')
    expect(growthIndexPage).toContain('TrainingHomeHeader')
    expect(shortQuestionnairePage).toContain(':show-dock="false"')
    expect(feedbackPage).toContain('page-title="训练反馈"')
    expect(feedbackPage).toContain('UniTrainingPageShell')
    expect(feedbackPage).toContain('show-decorations')
  })

  it('keeps home high-level and reserves modality details for the playground', () => {
    const homePage = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )

    expect(homePage).toContain('TrainingHomeHeader')
    expect(homePage).toContain('TrainingHomeCoachCard')
    expect(homePage).toContain('TrainingHomeProgressOverview')
    expect(homePage).not.toContain('教练建议')
    expect(homePage).not.toContain('需要时回看，保持动作和恢复节奏。')
    expect(homePage).toContain('useTrainingProgress')
    expect(homePage).not.toContain('TrainingHomeQuestPanel')
    expect(homePage).not.toContain('选择训练')
    expect(homePage).not.toContain('DailyProgressCard')
    expect(homePage).not.toContain('TrainingHomeFeatureCard')
    expect(homePage).not.toContain('动作提示')
    expect(homePage).not.toContain('url="/pages/growth/index"')
  })

  it('registers miniapp growth detail pages that the growth hub navigates to', () => {
    const uniPagesManifest = readFileSync(
      resolve('src/uni-app/pages.json'),
      'utf8'
    )
    const rootPagesManifest = readFileSync(
      resolve('src/pages.json'),
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

  it('keeps secondary growth and stair-training pages free of the primary navigator', () => {
    const secondaryPages = [
      'src/uni-app/pages/growth/achievements.vue',
      'src/uni-app/pages/growth/metrics.vue',
      'src/uni-app/pages/growth/history.vue',
      'src/uni-app/pages/growth/adherence.vue',
      'src/uni-app/pages/training/stair-session.vue'
    ]

    for (const page of secondaryPages) {
      expect(readFileSync(resolve(page), 'utf8')).toContain(':show-dock="false"')
    }
  })

  it('uses the shared ambient decoration treatment on the training reminder shell', () => {
    const accessShell = readFileSync(
      resolve('src/uni-app/components/access/UniAccessPageShell.vue'),
      'utf8'
    )
    const reminderPage = readFileSync(
      resolve('src/uni-app/pages/access/reminder-consent.vue'),
      'utf8'
    )

    expect(reminderPage).toContain('UniAccessPageShell')
    expect(accessShell).toContain('access-entry__halo--coral')
    expect(accessShell).toContain('access-entry__halo--gold')
    expect(accessShell).toContain('access-entry__halo--teal')
    expect(accessShell).toContain('access-entry__halo--coral-soft')
    expect(accessShell).toContain('access-entry__halo--gold-soft')
  })

  it('keeps ambient decorations visible on dockless training secondary pages', () => {
    const notificationsPage = readFileSync(
      resolve('src/uni-app/pages/notifications/index.vue'),
      'utf8'
    )
    const stairPage = readFileSync(
      resolve('src/uni-app/pages/training/stair-session.vue'),
      'utf8'
    )
    const stairPanel = readFileSync(
      resolve('src/components/training/StairTrainingPanel.vue'),
      'utf8'
    )

    expect(notificationsPage).toContain('show-decorations')
    expect(stairPage).toContain('show-decorations')
    expect(stairPanel).not.toMatch(/\.stair-panel__hero\s*\{[^}]*background:/)
    expect(stairPanel).not.toMatch(/\.stair-panel__hero\s*\{[^}]*border:/)
    expect(stairPanel).not.toMatch(/\.stair-panel__hero\s*\{[^}]*border-radius:/)
  })

  it('uses readable supporting type sizes on the training selection page', () => {
    const selectPage = readFileSync(
      resolve('src/uni-app/pages/training/select.vue'),
      'utf8'
    )

    expect(selectPage).toMatch(/\.select-page__hero-copy\s*\{[\s\S]*font-size:\s*25rpx;/)
    expect(selectPage).toMatch(/\.select-page__launch-hint\s*\{[\s\S]*font-size:\s*24rpx;/)
    expect(selectPage).toMatch(/\.select-page__launch-route\s*\{[\s\S]*font-size:\s*23rpx;/)
    expect(selectPage).toMatch(/\.select-page__streak-note\s*\{[\s\S]*justify-content:\s*center;[\s\S]*color:\s*rgba\(113, 128, 150, 0\.72\);[\s\S]*font-size:\s*22rpx;[\s\S]*text-align:\s*center;/)
  })

  it('keeps source wrapper pages for registered miniapp growth detail routes', () => {
    const adherenceWrapper = resolve('src/pages/growth/adherence.vue')
    const achievementsWrapper = resolve('src/pages/growth/achievements.vue')
    const metricsWrapper = resolve('src/pages/growth/metrics.vue')
    const historyWrapper = resolve('src/pages/growth/history.vue')

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

    expect(growthIndexPage).toContain('<navigator')
    expect(growthIndexPage).toContain('.growth-page__link:active')
    expect(growthIndexPage).toContain('growth-page__overview')
    expect(growthIndexPage).not.toContain('growth-page__buddy')
    expect(growthIndexPage).toContain('--growth-space-4: 26rpx;')
    expect(growthIndexPage).toContain('border-radius: 30rpx;')
    expect(growthIndexPage).toContain(':color="stat.iconColor"')
    expect(growthIndexPage).toContain(':color="link.iconColor"')
    expect(metricsPage).toContain('physicalMetricsState.value.hasMetrics')
    expect(metricsPage).toContain('physicalMetricsState.value.message')
    expect(metricsPage).toContain('{{ emptyStateHint }}')
  })

  it('keeps miniapp-facing localized copy fully in Chinese on shared access and growth surfaces', () => {
    const growthIndexPage = readFileSync(
      resolve('src/uni-app/pages/growth/index.vue'),
      'utf8'
    )
    const resultCard = readFileSync(
      resolve('src/components/access/QuestionnaireResultCard.vue'),
      'utf8'
    )
    const registrationForm = readFileSync(
      resolve('src/components/access/RegistrationForm.vue'),
      'utf8'
    )
    const physicalMetricsPanel = readFileSync(
      resolve('src/components/growth/PhysicalMetricsPanel.vue'),
      'utf8'
    )
    const questionnaireFeature = readFileSync(
      resolve('src/features/access/questionnaire.ts'),
      'utf8'
    )
    const cameraPlatform = readFileSync(
      resolve('src/uni-app/platform/camera.ts'),
      'utf8'
    )
    const sensorPlatform = readFileSync(
      resolve('src/uni-app/platform/sensors.ts'),
      'utf8'
    )

    expect(growthIndexPage).toContain('体能指标')
    expect(growthIndexPage).toContain('训练与评估历史')
    expect(growthIndexPage).toContain('完整记录')
    expect(growthIndexPage).not.toContain('查看训练与问卷历史。')
    expect(growthIndexPage).not.toContain('Physical Metrics')
    expect(growthIndexPage).not.toMatch(/>\s*History\s*</)
    expect(growthIndexPage).not.toMatch(/>\s*Open session and questionnaire history\.\s*</)

    expect(resultCard).toContain('全部完成')
    expect(resultCard).toContain('太棒了，你已经完成本次问卷！')
    expect(resultCard).toContain('先去首页')
    expect(resultCard).toContain('直接开练')
    expect(resultCard).not.toContain('Excellent momentum')
    expect(resultCard).not.toContain('Checkpoint score')
    expect(resultCard).not.toContain('Submitted')
    expect(resultCard).not.toContain('Continue to Home')

    expect(registrationForm).toContain('基本信息')
    expect(registrationForm).not.toContain('填写今天加入训练的同学信息。')
    expect(registrationForm).toContain('请选择')
    expect(registrationForm).toContain('健康指标')
    expect(registrationForm).not.toContain('在训练开始前补充基础数据。')
    expect(registrationForm).toContain('我同意上传这些信息以建立初始训练档案。')
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

  it('uses user-facing copy and centered controls in questionnaire preview mode', () => {
    const banner = readFileSync(
      resolve('src/components/access/QuestionnaireUnlockBanner.vue'),
      'utf8'
    )

    expect(banner).toContain('先逛一逛，完成问卷后就能开练')
    expect(banner).toContain('填写完问卷后，就能开始训练并查看自己的成长记录。')
    expect(banner).toContain('去完成问卷')
    expect(banner).not.toContain('为保证评估顺序')
    expect(banner).not.toContain('功能暂时锁定')
    expect(banner).toMatch(/\.questionnaire-unlock__action\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/)
    expect(banner).toMatch(/\.questionnaire-unlock__action\s*\{[\s\S]*line-height:\s*1\.2;/)
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

    expect(miniappHomePage).not.toContain('<navigator')
    expect(miniappHomePage).not.toContain('url="/pages/training/select"')
    expect(miniappHomePage).not.toContain('url="/pages/growth/index"')
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
      resolve('uno.config.ts'),
      'utf8'
    )

    expect(registrationForm).toContain('registration-input-shell')
    expect(registrationForm).toContain('registration-picker-shell')
    expect(registrationForm).toContain('registration-label')
    expect(registrationForm).toContain('form-stack-field')
    expect(registrationForm).toContain('flex: 1 1 0;')
    expect(registrationForm).toContain('gap: 16rpx;')
    expect(registrationForm).toContain('margin-left: 24rpx;')
    expect(registrationForm).not.toContain('ml-[12rpx]')
    expect(registrationForm).not.toContain('gap-[16rpx]')
    expect(registrationForm).toContain('width: 100%;')
    expect(registrationForm).toContain('box-sizing: border-box;')
    expect(registrationForm).toContain('display: block;')
    expect(registrationForm).toContain('flex: 1 1 auto;')
    expect(registrationForm).toMatch(/\.registration-consent\s*\{[\s\S]*justify-content:\s*center;/)
    expect(registrationForm).toMatch(/\.registration-consent__label\s*\{[\s\S]*align-items:\s*center;[\s\S]*gap:\s*8rpx;/)
    expect(registrationForm).toMatch(/\.registration-consent__control\s*\{[\s\S]*transform-origin:\s*center;/)
    expect(unoConfig).toContain("'input-shell': 'w-full box-border")
    expect(registrationForm).not.toContain('max-width: 480rpx;')
    expect(registrationForm).not.toContain('max-width: 520rpx;')
    expect(registrationForm).not.toContain('class="w-full"')
  })

  it('keeps training panels and miniapp shells on low-risk layout and motion primitives', () => {
    const visualTrainingPanel = readFileSync(
      resolve('src/subpackages/training/components/VisualTrainingPanel.vue'),
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


  it('brings demo-style badge treatments into shared cards', () => {
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

    expect(registrationForm).not.toContain('form-card__sticker')
    expect(registrationForm).toContain('form-card__kicker')
    expect(dailyProgressCard).toContain('progress-card__eyebrow')
    expect(dailyProgressCard).toContain('progress-card__meter-pill')
    expect(reminderBanner).toContain('reminder-banner__eyebrow')
    expect(summaryCards).toContain('summary-card__pill')
    expect(summaryCards).toContain('summary-card--highlight')
  })

  it('keeps coach guidance quiet after the current training task', () => {
    const featureCard = readFileSync(
      resolve('src/components/training/TrainingHomeFeatureCard.vue'),
      'utf8'
    )
    const coachCard = readFileSync(
      resolve('src/components/training/TrainingHomeCoachCard.vue'),
      'utf8'
    )

    expect(featureCard).toContain('feature-card__frame')
    expect(featureCard).toContain('feature-card__screen-glow')
    expect(featureCard).toContain('feature-card__poster-stripe')
    expect(coachCard).toContain('coach-card__footer')
    expect(coachCard).not.toContain('coach-card__bubble-tail')
    expect(coachCard).not.toContain('coach-card__avatar')
    expect(coachCard).not.toContain('linear-gradient')
  })

  it('keeps the home header aligned with the playground language without oversizing it', () => {
    const headerCard = readFileSync(
      resolve('src/components/training/TrainingHomeHeader.vue'),
      'utf8'
    )
    const questPanel = readFileSync(
      resolve('src/components/training/TrainingHomeQuestPanel.vue'),
      'utf8'
    )

    expect(headerCard).toContain('home-header__mini-tag')
    expect(headerCard).toContain('home-header__bell-badge')
    expect(headerCard).toContain('home-header__reminder-action')
    expect(headerCard).toContain("variant?: 'home' | 'compact'")
    expect(headerCard).toContain('width: 88rpx;')
    expect(headerCard).toContain('font-size: 36rpx;')
    expect(headerCard).toContain('font-size: 16rpx;')
    expect(questPanel).toContain('quest-panel__item-status')
    expect(questPanel).toContain('quest-panel__item--done')
    expect(questPanel).toContain('quest-panel__item--highlight')
    expect(questPanel).toContain('进行中')
  })

  it('uses one shared header size across home, playground, and growth', () => {
    const headerCard = readFileSync(
      resolve('src/components/training/TrainingHomeHeader.vue'),
      'utf8'
    )
    const homePage = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )
    const selectionPage = readFileSync(
      resolve('src/uni-app/pages/training/select.vue'),
      'utf8'
    )
    const growthPage = readFileSync(
      resolve('src/uni-app/pages/growth/index.vue'),
      'utf8'
    )

    expect(homePage).toContain('TrainingHomeHeader')
    expect(homePage).toContain('variant="home"')
    expect(homePage).toContain(':show-status="false"')
    expect(selectionPage).toContain('TrainingHomeHeader')
    expect(selectionPage).toContain('variant="home"')
    expect(selectionPage).toContain(':show-headline="false"')
    expect(growthPage).toContain('TrainingHomeHeader')
    expect(growthPage).toContain('variant="home"')
    expect(growthPage).toContain(':show-headline="false"')
    expect(headerCard).toContain('width: 88rpx;')
    expect(headerCard).toContain('font-size: 36rpx;')
  })

  it('keeps the home header informational and leaves task hierarchy to the training panel', () => {
    const headerCard = readFileSync(
      resolve('src/components/training/TrainingHomeHeader.vue'),
      'utf8'
    )
    const questPanel = readFileSync(
      resolve('src/components/training/TrainingHomeQuestPanel.vue'),
      'utf8'
    )
    const homePage = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )

    expect(homePage).toContain(':show-headline="false"')
    expect(homePage).not.toContain('ReminderAuthorizationStatus')
    expect(homePage).not.toContain('show-reminder-control')
    expect(homePage).toContain('TrainingReminderAuthorizationCard')
    expect(homePage.indexOf('<TrainingReminderAuthorizationCard')).toBeGreaterThan(
      homePage.indexOf('home-next-action--complete')
    )
    expect(homePage.indexOf('<TrainingReminderAuthorizationCard')).toBeLessThan(
      homePage.indexOf('<TrainingHomeProgressOverview')
    )
    expect(headerCard).toContain('showHeadline?: boolean')
    expect(headerCard).toContain('v-if="props.showHeadline"')
    expect(questPanel).not.toContain('quest-panel__item-kicker')
    expect(questPanel).not.toContain('quest-panel__item-cta')
    expect(questPanel).toContain('进行中')
  })

  it('uses restrained typography for supporting home sections', () => {
    const homePage = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )
    const featureCard = readFileSync(
      resolve('src/components/training/TrainingHomeFeatureCard.vue'),
      'utf8'
    )
    const coachCard = readFileSync(
      resolve('src/components/training/TrainingHomeCoachCard.vue'),
      'utf8'
    )

    expect(homePage).not.toContain('home-page__section-kicker')
    expect(homePage).toContain('font-size: 32rpx;')
    expect(featureCard).toContain('feature-card__eyebrow')
    expect(featureCard).toContain('font-size: 18rpx;')
    expect(featureCard).toContain('letter-spacing: 0.14em;')
    expect(coachCard).toContain('coach-card__eyebrow')
    expect(coachCard).toContain('font-size: 20rpx;')
    expect(coachCard).toContain('letter-spacing: 0.08em;')
  })

  it('keeps today training as the only prominent task heading', () => {
    const questPanel = readFileSync(
      resolve('src/components/training/TrainingHomeQuestPanel.vue'),
      'utf8'
    )

    expect(questPanel).toContain('quest-panel__head-copy')
    expect(questPanel).not.toContain("TODAY'S QUEST")
    expect(questPanel).toContain('font-size: 40rpx;')
    expect(questPanel).toContain('font-size: 22rpx;')
  })

  it('gives the first unfinished training the homepage primary action', () => {
    const homePage = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )
    const questPanel = readFileSync(
      resolve('src/components/training/TrainingHomeQuestPanel.vue'),
      'utf8'
    )

    expect(homePage).toContain('home-next-action')
    expect(homePage).toContain('startNextTraining')
    expect(homePage).toContain("ensureProtectedStudentAccess('execute')")
    expect(homePage).not.toContain('选择训练')
    expect(questPanel).toContain('min-height: 34rpx;')
    expect(questPanel).toContain('padding: 6rpx 10rpx;')
    expect(questPanel).toContain('font-size: 18rpx;')
  })

  it('keeps the home-page content stack compact without crowding', () => {
    const homePage = readFileSync(
      resolve('src/uni-app/pages/training/home.vue'),
      'utf8'
    )

    expect(homePage).toContain('class="home-page"')
    expect(homePage).toContain('--home-card-gap: 38rpx;')
    expect(homePage).toContain('gap: var(--home-card-gap);')
  })


  it('keeps the short check-in rating control distinct from the long questionnaire options', () => {
    const shortQuestionnaireForm = readFileSync(
      resolve('src/components/training/ShortQuestionnaireForm.vue'),
      'utf8'
    )
    const longQuestionnaireForm = readFileSync(
      resolve('src/components/access/LongQuestionnaireForm.vue'),
      'utf8'
    )

    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__scale')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__slider')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__tick')
    expect(shortQuestionnaireForm).not.toContain('rating-option')
    expect(longQuestionnaireForm).not.toContain('rating-option--rounded')
  })

  it('uses a restrained single-question layout with contextual navigation', () => {
    const progressHeader = readFileSync(
      resolve('src/components/access/QuestionnaireProgressHeader.vue'),
      'utf8'
    )
    const questionPanel = readFileSync(
      resolve('src/components/access/QuestionnaireQuestionPanel.vue'),
      'utf8'
    )
    const runner = readFileSync(
      resolve('src/components/access/LongQuestionnaireForm.vue'),
      'utf8'
    )
    const navigation = readFileSync(
      resolve('src/components/access/QuestionnaireBottomNavigation.vue'),
      'utf8'
    )
    const instructions = readFileSync(
      resolve('src/components/access/QuestionnaireInstructionsCard.vue'),
      'utf8'
    )

    expect(progressHeader).toContain('border: 4rpx solid rgba(255, 211, 132, 0.24);')
    expect(progressHeader).not.toContain('rgba(137, 207, 255')
    expect(questionPanel).toContain('questionnaire-question__prompt')
    expect(questionPanel).toContain('questionnaire-question__progress')
    expect(questionPanel).toContain('{{ questionNumber }} / {{ questionCount }}')
    expect(questionPanel).toContain('questionnaire-runner__options')
    expect(questionPanel).toMatch(/\.questionnaire-runner__field-label\s*\{[\s\S]*margin-left:\s*32rpx;/)
    expect(questionPanel).toMatch(/\.questionnaire-runner__input-wrap\s*\{[\s\S]*padding:\s*0 36rpx;/)
    expect(questionPanel).toContain('min-height: 92rpx;')
    expect(questionPanel).toContain('border-radius: 24rpx;')
    expect(questionPanel).toContain('border-color: #FF8B8B;')
    expect(questionPanel).toContain('border: 4rpx solid #E9E2DE;')
    expect(questionPanel).toContain('background: #FFFCF8;')
    expect(questionPanel).toContain('color: #FF8B8B;')
    expect(questionPanel).not.toContain('#E5A2C0')
    expect(questionPanel).not.toContain('#A84369')
    expect(questionPanel).not.toContain('background: #FFF0F7;')
    expect(questionPanel).not.toContain('background: #FFF5FA;')
    expect(questionPanel).not.toContain('background: #F4BDD5;')
    expect(questionPanel).not.toContain('questionnaire-runner__option-indicator')
    expect(questionPanel).not.toContain("'✓'")
    expect(questionPanel).not.toContain('background: rgba(255, 139, 139, 0.18);')
    expect(questionPanel).not.toContain('#2563EB')
    expect(runner).toContain('QuestionnaireInstructionsCard')
    expect(runner).toContain('questionnaire-runner__block--spaced')
    expect(runner).toContain('margin-top: 32rpx;')
    expect(runner).not.toContain('gap: 32rpx;')
    expect(instructions).toContain('questionnaire-instructions__legend')
    expect(questionPanel).not.toContain('questionnaire-question__instructions')
    expect(questionPanel).not.toContain('questionnaire-question__legend')
    expect(navigation).toContain('questionnaire-runner__actions')
    expect(navigation).not.toContain('已保存在本机')
    expect(navigation).toContain('questionnaire-runner__navigation-button--secondary')
    expect(navigation).toContain('questionnaire-runner__navigation-button--submit')
    expect(navigation).toContain('gap: 30rpx;')
    expect(navigation).toContain(':disabled="!canGoBack"')
    expect(navigation).toContain(':disabled="!canContinue"')
    expect(navigation).toContain('questionnaire-runner__navigation-button--disabled')
    expect(navigation).not.toContain('#F7C948')
    expect(navigation).not.toContain('UniIcons')
    expect(navigation).toContain('margin-top: 24rpx;')
    expect(navigation).toContain('padding: 0;')
    expect(navigation).toContain('background: #ff8b8b;')
    expect(navigation).toContain('box-shadow: 0 10rpx 0 #de7272;')
    expect(navigation).toContain('color: #1a202c;')
  })

  it('keeps the short post-training questionnaire as one calm, continuous check-in surface', () => {
    const shortQuestionnaireForm = readFileSync(
      resolve('src/components/training/ShortQuestionnaireForm.vue'),
      'utf8'
    )

    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__intro')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__questions')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__question')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__status')
    expect(shortQuestionnaireForm).toContain('short-questionnaire-form__actions')
    expect(shortQuestionnaireForm).toContain('完成 ${completedCount.value}/2 项后提交')
    expect(shortQuestionnaireForm).toContain('提交并查看反馈')
    expect(shortQuestionnaireForm).not.toContain('chunky-shadow')
    expect(shortQuestionnaireForm).not.toContain('🙂')
    expect(shortQuestionnaireForm).not.toContain('rating-option--rounded')
    expect(shortQuestionnaireForm).not.toContain('Incomplete')
    expect(shortQuestionnaireForm).not.toContain('Continue')
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
    expect(uniAccessShell).toContain('padding: 40rpx 48rpx calc(120rpx + env(safe-area-inset-bottom));')
    expect(uniAccessShell).toContain('gap: 32rpx;')
    expect(uniTrainingShell).toContain('padding: 16rpx 32rpx 0;')
    expect(uniTrainingShell).toContain('class="training-shell__dock-clearance"')
    expect(uniTrainingShell).toContain('gap: 36rpx;')
    expect(uniGrowthShell).toContain('padding: 16rpx 32rpx 0;')
    expect(uniGrowthShell).toContain('class="growth-shell__dock-clearance"')
    expect(uniGrowthShell).toContain('gap: 40rpx;')
    expect(miniappHomePage).toContain('--home-card-gap: 38rpx;')
    expect(miniappHomePage).toContain('gap: var(--home-card-gap);')
    expect(miniappGrowthPage).toContain('--growth-space-4: 26rpx;')
    expect(miniappGrowthPage).toContain('padding: 24rpx;')
  })

  it('uses one built-in default user icon without personal avatar controls', () => {
    const registrationForm = readFileSync(
      resolve('src/components/access/RegistrationForm.vue'),
      'utf8'
    )
    const homeHeader = readFileSync(
      resolve('src/components/training/TrainingHomeHeader.vue'),
      'utf8'
    )

    expect(homeHeader).toContain('DEFAULT_AVATAR_URL')
    expect(homeHeader).toContain('aria-label="默认用户头像"')
    expect(homeHeader).not.toContain('chooseAvatar')
    expect(registrationForm).not.toContain('RegistrationAvatarField')
    expect(existsSync(resolve('src/components/access/RegistrationAvatarField.vue'))).toBe(false)
    expect(existsSync(resolve('src/uni-app/composables/useRegistrationAvatar.ts'))).toBe(false)
    expect(existsSync(resolve('src/uni-app/composables/useProfileAvatarEditor.ts'))).toBe(false)
  })
})
