import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const controls = vi.hoisted(() => ({
  onLoadHandler: null as null | ((query?: Record<string, unknown>) => void),
  listArrangements: vi.fn(),
  ensureAccess: vi.fn(),
  navigateTo: vi.fn()
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (handler: (query?: Record<string, unknown>) => void) => {
    controls.onLoadHandler = handler
  }
}))

vi.mock('../uni-app/api/studentBackend', () => ({
  studentBackendSync: {
    listVisualExerciseArrangements: controls.listArrangements
  }
}))

vi.mock('../uni-app/api/reportBackendSyncError', () => ({
  reportBackendSyncError: vi.fn()
}))

vi.mock('../uni-app/composables/useNavigationGuard', () => ({
  ensureProtectedStudentAccess: controls.ensureAccess
}))

const arrangementFixtures = [
  {
    id: 4,
    title: '自重抗阻基础套组',
    description: '深蹲与开合跳组合。',
    exercise_type: 'HIIT',
    item_count: 2,
    total_duration: 80,
    is_active: true,
    order: 1
  },
  {
    id: 8,
    title: '自重抗阻进阶套组',
    description: '连续完成三项进阶动作。',
    exercise_type: 'HIIT',
    item_count: 3,
    total_duration: 120,
    is_active: true,
    order: 2
  }
]

async function mountPage() {
  const Page = (await import('../uni-app/pages/training/exercise-sets.vue')).default
  return mount(Page, {
    global: {
      stubs: {
        UniIcons: true,
        UniTrainingPageShell: {
          props: ['pageTitle', 'showDock', 'refreshEnabled', 'refreshing'],
          emits: ['refresh'],
          template: `
            <section>
              <h1 class="test-title">{{ pageTitle }}</h1>
              <button class="test-refresh" @click="$emit('refresh')">刷新</button>
              <slot />
            </section>
          `
        }
      }
    }
  })
}

describe('exercise arrangement selection page', () => {
  beforeEach(() => {
    controls.onLoadHandler = null
    controls.listArrangements.mockReset().mockResolvedValue(arrangementFixtures)
    controls.ensureAccess.mockReset().mockResolvedValue(true)
    controls.navigateTo.mockReset()
    vi.stubGlobal('uni', { navigateTo: controls.navigateTo })
  })

  it('loads backend arrangements for the selected modality and launches the chosen set', async () => {
    const wrapper = await mountPage()
    controls.onLoadHandler?.({ modality: 'hiit' })
    await flushPromises()

    expect(controls.listArrangements).toHaveBeenCalledWith('hiit')
    expect(wrapper.get('.test-title').text()).toBe('选择自重抗阻套组')
    expect(wrapper.findAll('.exercise-sets-page__card')).toHaveLength(2)
    expect(wrapper.findAll('.exercise-sets-page__card')[0].text()).toContain('第1套')
    expect(wrapper.findAll('.exercise-sets-page__card')[0].text()).toContain('自重抗阻基础套组')
    expect(wrapper.findAll('.exercise-sets-page__card')[0].text()).toContain('深蹲与开合跳组合。')
    expect(wrapper.findAll('.exercise-sets-page__card')[0].text()).toContain('2 个动作')
    expect(wrapper.findAll('.exercise-sets-page__card')[0].text()).toContain('约 2 分钟')

    await wrapper.findAll('.exercise-sets-page__card')[1].trigger('click')
    await flushPromises()

    expect(controls.ensureAccess).toHaveBeenCalledWith('execute')
    expect(controls.navigateTo).toHaveBeenCalledWith({
      url: '/subpackages/training/visual-session?modality=hiit&arrangementId=8'
    })
  })

  it('reloads the arrangement list from pull-to-refresh', async () => {
    const wrapper = await mountPage()
    controls.onLoadHandler?.({ modality: 'wushu' })
    await flushPromises()
    controls.listArrangements.mockClear()

    await wrapper.get('.test-refresh').trigger('click')
    await flushPromises()

    expect(controls.listArrangements).toHaveBeenCalledWith('wushu')
  })

  it('registers a decorated dockless refreshable secondary route', () => {
    const pageSource = readFileSync(
      resolve('src/uni-app/pages/training/exercise-sets.vue'),
      'utf8'
    )
    const routeWrapper = readFileSync(
      resolve('src/pages/training/exercise-sets.vue'),
      'utf8'
    )
    const manifests = [
      JSON.parse(readFileSync(resolve('src/pages.json'), 'utf8')),
      JSON.parse(readFileSync(resolve('src/uni-app/pages.json'), 'utf8'))
    ]

    expect(pageSource).toContain(':show-dock="false"')
    expect(pageSource).toContain('show-decorations')
    expect(pageSource).toContain('show-back')
    expect(pageSource).toContain('refresh-enabled')
    expect(pageSource).toMatch(/\.exercise-sets-page__intro\s*\{[\s\S]*padding:\s*24rpx 32rpx 0 64rpx;/)
    expect(pageSource).toContain('{{ arrangement.title }}')
    expect(pageSource).toContain('{{ arrangement.description }}')
    expect(pageSource).toContain('{{ arrangement.item_count }} 个动作')
    expect(pageSource).toContain('formatDuration(arrangement.total_duration)')
    expect(pageSource).not.toContain('完成这套${modalityLabel}配套动作训练')
    expect(pageSource).not.toContain('<FloatingDock')
    expect(routeWrapper).toContain("../../uni-app/pages/training/exercise-sets.vue")
    for (const manifest of manifests) {
      expect(manifest.pages.map((page: { path: string }) => page.path)).toContain(
        'pages/training/exercise-sets'
      )
    }
  })
})
