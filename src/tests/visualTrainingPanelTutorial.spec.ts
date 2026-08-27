import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import VisualTrainingPanel from '../subpackages/training/components/VisualTrainingPanel.vue'
import { createVisualComparisonLayout } from '../subpackages/training/visualSessionLayout'
import type { VisualWorkoutState } from '../features/training/visualWorkoutTimeline'

const workoutState: VisualWorkoutState = {
  current: {
    id: 'preview-1',
    kind: 'preview',
    slot: 'preview',
    itemIndex: 0,
    actionNumber: 1,
    totalActions: 1,
    title: '准备：开合跳',
    coachCue: '准备开始',
    startSeconds: 0,
    endSeconds: 15
  },
  next: null,
  phaseNumber: 1,
  totalPhases: 1,
  actionNumber: 1,
  totalActions: 1,
  remainingSeconds: 15,
  phaseProgressPercent: 0,
  sessionProgressPercent: 0
}

const CoverViewStub = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('cover-view', attrs, slots.default?.())
  }
})

function mountTutorial(overrides: Record<string, unknown> = {}) {
  return mount(VisualTrainingPanel, {
    props: {
      videoTitle: '开合跳',
      videoUrl: 'https://example.com/demo.mp4',
      videoLoading: false,
      videoError: '',
      videoEnded: false,
      videoProgressSeconds: 0,
      completionHint: '保持节奏',
      recognitionEnabled: false,
      recognitionReady: false,
      recognitionStatus: 'idle',
      recognitionFps: 5,
      recording: false,
      recordSeconds: 0,
      recordedVideoPath: '',
      livePoseFps: 0,
      poseFallbackSampling: false,
      completing: false,
      completionError: '',
      workoutState,
      workoutTimelineReady: true,
      videoAutoplay: false,
      trainingStarted: false,
      startCountdown: 0,
      phaseKind: 'preview',
      phaseSlot: 'preview',
      phaseRemainingSeconds: 15,
      comparisonMode: false,
      tutorialMode: true,
      tutorialIndex: 0,
      tutorialText: '保持上身稳定，跟随示范完成动作。',
      tutorialRecords: [],
      tutorialLoading: false,
      tutorialVideoUrl: 'https://example.com/tutorial.mp4',
      tutorialVideoTitle: '开合跳动作讲解',
      tutorialTotalActions: 2,
      tutorialIsLast: false,
      ...overrides
    },
    global: {
      stubs: {
        PoseDetectionView: true,
        WorkoutTimeline: true,
        'cover-view': CoverViewStub,
        'scroll-view': true
      }
    }
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('VisualTrainingPanel tutorial layout', () => {
  it('keeps the portrait tutorial reading order intact', () => {
    const wrapper = mountTutorial()
    const markup = wrapper.html()

    expect(wrapper.find('.visual-session__tutorial--comparison').exists()).toBe(false)
    expect(wrapper.find('#follow-along-video').exists()).toBe(false)
    expect(wrapper.find('.visual-session__lower-grid').exists()).toBe(false)
    expect(wrapper.find('.visual-session__actions').exists()).toBe(false)
    expect(markup.indexOf('visual-session__tutorial-header')).toBeLessThan(
      markup.indexOf('visual-session__tutorial-media')
    )
    expect(markup.indexOf('visual-session__tutorial-media')).toBeLessThan(
      markup.indexOf('visual-session__tutorial-text-panel')
    )
  })

  it('restores the full follow-along training area after the tutorial', async () => {
    const wrapper = mountTutorial()

    await wrapper.setProps({
      tutorialMode: false,
      trainingStarted: true,
      phaseKind: 'demonstration',
      phaseSlot: 'pretraining',
      phaseRemainingSeconds: 30,
      videoAutoplay: true
    })

    expect(wrapper.find('.visual-session__tutorial').exists()).toBe(false)
    expect(wrapper.find('#follow-along-video').exists()).toBe(true)
    expect(wrapper.find('.visual-session__lower-grid').exists()).toBe(true)
    expect(wrapper.find('.visual-session__actions').exists()).toBe(true)
  })

  it('uses native tutorial controls while keeping replay and speed on that video only', async () => {
    const seek = vi.fn()
    const play = vi.fn()
    const pause = vi.fn()
    const playbackRate = vi.fn()
    vi.stubGlobal('uni', {
      createVideoContext: vi.fn(() => ({ seek, play, pause, playbackRate }))
    })
    const wrapper = mountTutorial()
    const controls = wrapper.get('.demonstration-video-controls')

    await controls.get('.demonstration-video-controls__button--speed').trigger('tap')
    await controls.get('.demonstration-video-controls__button').trigger('tap')
    await wrapper.get('.visual-session__tutorial-skip').trigger('click')

    expect(wrapper.get('#tutorial-video').attributes('controls')).toBeDefined()
    expect(wrapper.get('#tutorial-video').attributes('show-center-play-btn')).toBeDefined()
    expect(wrapper.get('#tutorial-video').attributes('enable-progress-gesture')).toBeDefined()
    expect(playbackRate).toHaveBeenCalledWith(1.25)
    expect(seek).toHaveBeenCalledWith(0)
    expect(play).toHaveBeenCalled()
    expect(pause).toHaveBeenCalled()
    expect(wrapper.emitted('skipTutorial')).toHaveLength(1)
  })

  it('keeps the compact 568×320 tutorial controls reachable beside an explicitly sized video', async () => {
    const comparisonMediaSize = createVisualComparisonLayout({
      pageWidth: 568,
      pageHeight: 320
    })
    const wrapper = mountTutorial({
      comparisonMode: true,
      comparisonMediaSize
    })

    expect(comparisonMediaSize).toEqual({ mediaWidth: 200, mediaHeight: 266 })
    expect(wrapper.get('.visual-session__tutorial').classes())
      .toContain('visual-session__tutorial--comparison')
    expect(wrapper.get('.visual-session__tutorial-layout').classes())
      .toContain('visual-session__tutorial-layout')
    expect(wrapper.find('.visual-session__tutorial-header--comparison').exists()).toBe(true)

    const media = wrapper.get('.visual-session__tutorial-media')
    const video = wrapper.get('.visual-session__tutorial-video')
    expect(media.attributes('style')).toContain('width: 200px')
    expect(media.attributes('style')).toContain('height: 266px')
    expect(video.attributes('style')).toContain('width: 200px')
    expect(video.attributes('style')).toContain('height: 266px')

    expect(wrapper.get('.visual-session__tutorial-btn--secondary').text()).toContain('下一个动作')
    expect(wrapper.get('.visual-session__tutorial-btn--primary').text()).toContain('开始跟练')
    expect(wrapper.get('.visual-session__tutorial-skip').text()).toContain('跳过讲解')

    await wrapper.get('.visual-session__tutorial-btn--secondary').trigger('click')
    await wrapper.get('.visual-session__tutorial-btn--primary').trigger('click')
    await wrapper.get('.visual-session__tutorial-skip').trigger('click')

    expect(wrapper.emitted('nextTutorial')).toHaveLength(1)
    expect(wrapper.emitted('startPractice')).toHaveLength(1)
    expect(wrapper.emitted('skipTutorial')).toHaveLength(1)
  })

  it('uses a compact two-column layout instead of stacking controls below the tutorial video', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).toContain('const tutorialMediaStyle = computed(() => {')
    expect(source).toMatch(
      /class="visual-session__tutorial-video"[\s\S]*?:style="tutorialMediaStyle"/
    )
    expect(source).toMatch(
      /\.visual-session__tutorial--comparison \.visual-session__tutorial-layout\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*flex-direction:\s*row;[\s\S]*gap:\s*12px;/
    )
    expect(source).toMatch(
      /\.visual-session__tutorial--comparison \.visual-session__tutorial-text-panel\s*\{[\s\S]*min-height:\s*0;[\s\S]*flex:\s*1;[\s\S]*margin-top:\s*0;/
    )
    expect(source).toMatch(
      /\.visual-session__tutorial--comparison \.visual-session__tutorial-btn\s*\{[\s\S]*min-height:\s*44px;/
    )
    expect(source).toContain("import DemonstrationVideoControls from './DemonstrationVideoControls.vue'")
    expect(source).toContain('id="tutorial-video"')
    expect(source).toContain(':controls="true"')
    expect(source).toContain(':show-center-play-btn="true"')
    expect(source).toContain(':enable-progress-gesture="true"')
  })
})
