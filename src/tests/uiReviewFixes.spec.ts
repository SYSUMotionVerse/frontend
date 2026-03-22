import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import RegistrationForm from '../components/access/RegistrationForm.vue'
import HomePage from '../views/training/HomePage.vue'

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

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/home', component: HomePage },
      { path: '/training/select', component: { template: '<div>training</div>' } },
      { path: '/growth', component: { template: '<div>growth</div>' } }
    ]
  })
}

describe('ui review fixes', () => {
  it('uses links for home page navigation actions', async () => {
    const router = createTestRouter()
    await router.push('/home')
    await router.isReady()

    const wrapper = mount(HomePage, {
      global: {
        plugins: [router]
      }
    })

    const actionLinks = wrapper.findAll('a').map(link => link.attributes('href'))

    expect(actionLinks).toEqual(expect.arrayContaining(['/training/select', '/growth']))
  })

  it('keeps stable metadata on registration inputs and uses picker selectors for miniapp fields', () => {
    const file = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/access/RegistrationForm.vue'),
      'utf8'
    )

    expect(file).toContain('input v-model.trim="form.studentId" autocomplete="username"')
    expect(file).toContain('input v-model.trim="form.name" autocomplete="name"')
    expect(file).toContain('input v-model.trim="form.major" autocomplete="organization-title"')
    expect(file).toContain('input v-model.number="form.heightCm" autocomplete="off"')
    expect(file).toContain('input v-model.number="form.weightKg" autocomplete="off"')
    expect(file).toContain('input v-model.number="form.restingHeartRate" autocomplete="off"')
    expect(file).toContain('mode="selector"')
    expect(file).toContain(':range="genderOptions"')
    expect(file).toContain(':range="gradeOptions"')
    expect(file).not.toContain('space-y-')
  })

  it('avoids peer-based selectors that compile to invalid wxss sibling syntax', () => {
    const shortQuestionnaireForm = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/training/ShortQuestionnaireForm.vue'),
      'utf8'
    )
    const longQuestionnaireForm = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/access/LongQuestionnaireForm.vue'),
      'utf8'
    )

    expect(shortQuestionnaireForm).not.toContain('peer-checked:')
    expect(shortQuestionnaireForm).not.toContain('sr-only peer')
    expect(longQuestionnaireForm).not.toContain('peer-checked:')
    expect(longQuestionnaireForm).not.toContain('sr-only peer')
  })

  it('avoids web font icon dependencies in miniapp-shared forms', () => {
    const registrationForm = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/access/RegistrationForm.vue'),
      'utf8'
    )
    const shortQuestionnaireForm = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/training/ShortQuestionnaireForm.vue'),
      'utf8'
    )

    expect(registrationForm).not.toContain('material-symbols-outlined')
    expect(registrationForm).not.toContain('font-variation-settings')
    expect(shortQuestionnaireForm).not.toContain('material-symbols-outlined')
    expect(shortQuestionnaireForm).not.toContain('font-variation-settings')
  })

  it('prefers text nodes over span tags in primary miniapp-shared components', () => {
    const files = [
      '/Users/pi-dal/Developer/sport-snack/src/components/access/AccessPageShell.vue',
      '/Users/pi-dal/Developer/sport-snack/src/components/access/RegistrationForm.vue',
      '/Users/pi-dal/Developer/sport-snack/src/components/training/TrainingModeCard.vue',
      '/Users/pi-dal/Developer/sport-snack/src/components/training/DailyProgressCard.vue',
      '/Users/pi-dal/Developer/sport-snack/src/components/training/StairTrainingPanel.vue',
      '/Users/pi-dal/Developer/sport-snack/src/components/training/VisualTrainingPanel.vue',
      '/Users/pi-dal/Developer/sport-snack/src/components/training/ShortQuestionnaireForm.vue'
    ]

    for (const filePath of files) {
      const file = readFileSync(resolve(filePath), 'utf8')

      expect(file).not.toContain('<span')
    }
  })

  it('uses miniapp form submission semantics on shared forms', () => {
    const files = [
      '/Users/pi-dal/Developer/sport-snack/src/components/access/RegistrationForm.vue',
      '/Users/pi-dal/Developer/sport-snack/src/components/access/LongQuestionnaireForm.vue',
      '/Users/pi-dal/Developer/sport-snack/src/components/training/ShortQuestionnaireForm.vue'
    ]

    for (const filePath of files) {
      const file = readFileSync(resolve(filePath), 'utf8')

      expect(file).toContain('form-type="submit"')
    }
  })

  it('adds visible hover and focus states for growth detail links', () => {
    const file = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/views/growth/GrowthCenterView.vue'),
      'utf8'
    )

    expect(file).toContain('.growth-page__link:hover')
    expect(file).toContain('.growth-page__link:focus-visible')
  })

  it('uses uni-app navigation semantics for the primary access flow', () => {
    const registerPage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages/access/register.vue'),
      'utf8'
    )
    const questionnairePage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages/access/questionnaire.vue'),
      'utf8'
    )
    const resultPage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages/access/questionnaire-result.vue'),
      'utf8'
    )

    expect(registerPage).toContain('uni.redirectTo')
    expect(questionnairePage).toContain('uni.navigateTo')
    expect(resultPage).toContain('uni.redirectTo')
  })

  it('uses uni-app navigation semantics for the primary training flow', () => {
    const homePage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages/training/home.vue'),
      'utf8'
    )
    const selectionPage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages/training/select.vue'),
      'utf8'
    )
    const feedbackPage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages/training/feedback.vue'),
      'utf8'
    )

    expect(homePage).toContain('uni.navigateTo')
    expect(selectionPage).toContain('uni.navigateTo')
    expect(feedbackPage).toContain('uni.redirectTo')
  })

  it('preserves clear interactive affordance on growth detail navigation after migration', () => {
    const growthIndexPage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages/growth/index.vue'),
      'utf8'
    )
    const metricsPage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages/growth/metrics.vue'),
      'utf8'
    )

    expect(growthIndexPage).toContain('uni.navigateTo')
    expect(growthIndexPage).toContain('.growth-page__link:active')
    expect(growthIndexPage).toContain('growth-page__link--current')
    expect(metricsPage).toContain('Physical metrics will appear here after body-test data is imported.')
  })

  it('uses larger typography and stable action sizing for miniapp result and home surfaces', () => {
    const resultCard = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/access/QuestionnaireResultCard.vue'),
      'utf8'
    )
    const progressCard = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/training/DailyProgressCard.vue'),
      'utf8'
    )
    const reminderBanner = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/training/ReminderBanner.vue'),
      'utf8'
    )
    const miniappHomePage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages/training/home.vue'),
      'utf8'
    )
    const webHomePage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/views/training/HomePage.vue'),
      'utf8'
    )

    expect(resultCard).toContain('text-17 font-700 text-slate-500')
    expect(resultCard).toContain('text-18 text-slate-700')
    expect(resultCard).toContain('text-20 font-700 text-brand-ink')
    expect(resultCard).toContain('btn-primary mt-20 result-card__cta')
    expect(progressCard).toContain('text-18 leading-8 text-slate-600')
    expect(progressCard).toContain('px-16 py-10 text-16 font-700')
    expect(progressCard).toContain('gap-12 text-16 text-slate-600')
    expect(reminderBanner).toContain('text-15 font-800 tracking-[0.16em] uppercase')
    expect(reminderBanner).toContain('text-17 leading-7')
    expect(miniappHomePage).toContain('text-18 leading-8 text-slate-600')
    expect(miniappHomePage).toContain('min-height: 4rem;')
    expect(miniappHomePage).toContain('min-width: 0;')
    expect(miniappHomePage).toContain('flex: 1 1 0;')
    expect(webHomePage).toContain('text-18 leading-8 text-slate-600')
    expect(webHomePage).toContain('min-height: 4rem;')
    expect(webHomePage).toContain('min-width: 0;')
    expect(webHomePage).toContain('flex: 1 1 0;')
  })

  it('keeps result and training selection surfaces compatible with miniapp layout constraints', () => {
    const resultCard = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/access/QuestionnaireResultCard.vue'),
      'utf8'
    )
    const trainingModeCard = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/components/training/TrainingModeCard.vue'),
      'utf8'
    )
    const miniappSelectPage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/uni-app/pages/training/select.vue'),
      'utf8'
    )
    const webSelectPage = readFileSync(
      resolve('/Users/pi-dal/Developer/sport-snack/src/views/training/TrainingSelectionPage.vue'),
      'utf8'
    )

    expect(resultCard).toContain('const submittedAtLabel = computed(() => {')
    expect(resultCard).toContain("return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toLocaleString()")
    expect(resultCard).toContain('v-if="submittedAtLabel"')
    expect(resultCard).not.toContain('<button')
    expect(resultCard).toContain('role="button"')
    expect(resultCard).toContain('text-17 font-700 text-slate-500')
    expect(resultCard).toContain('text-18 text-slate-700')
    expect(resultCard).toContain('text-20 font-700 text-brand-ink')
    expect(trainingModeCard).not.toContain('<button')
    expect(trainingModeCard).toContain('role="button"')
    expect(trainingModeCard).toContain('training-mode-card')
    expect(trainingModeCard).toContain('text-20 font-700 text-brand-ink')
    expect(trainingModeCard).toContain('text-17 leading-7 text-slate-600')
    expect(trainingModeCard).toContain('min-height: 10rem;')
    expect(trainingModeCard).toContain('display: flex;')
    expect(miniappSelectPage).toContain('text-17 leading-7 text-slate-600')
    expect(webSelectPage).toContain('text-17 leading-7 text-slate-600')
  })
})
