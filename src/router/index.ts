import { createRouter, createWebHistory } from 'vue-router'
import { resolveEntryRoute } from '../features/access/entry'
import { useStudentAppState } from '../composables/useStudentAppState'

const webPreviewRouter = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/register', name: 'register', component: () => import('../views/access/RegistrationPage.vue') },
    { path: '/questionnaires/:checkpoint', name: 'questionnaire', component: () => import('../views/access/LongQuestionnairePage.vue') },
    { path: '/questionnaire-result/:checkpoint', name: 'questionnaire-result', component: () => import('../views/access/QuestionnaireResultPage.vue') },
    { path: '/home', name: 'home', component: () => import('../views/training/HomePage.vue') },
    { path: '/training/select', name: 'training-select', component: () => import('../views/training/TrainingSelectionPage.vue') },
    { path: '/training/visual/:modality', name: 'training-visual', component: () => import('../views/training/VisualTrainingPage.vue') },
    { path: '/training/stairs', name: 'training-stairs', component: () => import('../views/training/StairTrainingPage.vue') },
    { path: '/questionnaires/short/post-training', name: 'short-questionnaire', component: () => import('../views/training/ShortQuestionnairePage.vue') },
    { path: '/feedback/:sessionId', name: 'feedback', component: () => import('../views/training/FeedbackPage.vue') },
    { path: '/growth', name: 'growth', component: () => import('../views/growth/GrowthCenterView.vue') },
    { path: '/growth/adherence', name: 'growth-adherence', component: () => import('../views/growth/GrowthAdherenceDetailView.vue') },
    { path: '/growth/achievements', name: 'growth-achievements', component: () => import('../views/growth/GrowthAchievementsDetailView.vue') },
    { path: '/growth/metrics', name: 'growth-metrics', component: () => import('../views/growth/GrowthPhysicalMetricsDetailView.vue') },
    { path: '/growth/history', name: 'growth-history', component: () => import('../views/growth/GrowthHistoryDetailView.vue') }
  ]
})

webPreviewRouter.beforeEach((to) => {
  const { state } = useStudentAppState()
  const entryRoute = resolveEntryRoute(state)

  if (to.path === '/register') {
    if (state.profile.completed) {
      return entryRoute
    }

    return true
  }

  if (to.name === 'questionnaire' || to.name === 'questionnaire-result') {
    return true
  }

  if (entryRoute !== '/home') {
    return entryRoute
  }

  return true
})

export default webPreviewRouter
