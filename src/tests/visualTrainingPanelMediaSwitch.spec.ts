import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import VisualTrainingPanel from '../subpackages/training/components/VisualTrainingPanel.vue'
import type { VisualWorkoutState } from '../features/training/visualWorkoutTimeline'

const workoutState: VisualWorkoutState = {
  current: {
    id: 'preview-1',
    kind: 'preview',
    itemIndex: 0,
    actionNumber: 1,
    totalActions: 1,
    title: '准备：开合跳',
    coachCue: '准备开始',
    startSeconds: 0,
    endSeconds: 15,
    countdownDuration: 3
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

function mountPanel(
  recognitionEnabled = false,
  comparisonMode = false,
  videoAutoplay = false,
  poseDetectionViewStub: object | boolean = true
) {
  return mount(VisualTrainingPanel, {
    props: {
      videoTitle: '开合跳',
      videoUrl: 'https://example.com/demo.mp4',
      videoLoading: false,
      videoError: '',
      videoEnded: false,
      completionHint: '保持节奏',
      recognitionEnabled,
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
      videoAutoplay,
      trainingStarted: false,
      startCountdown: 0,
      phaseKind: 'preview',
      phaseRemainingSeconds: 15,
      comparisonMode,
      tutorialMode: false,
      tutorialIndex: 0,
      tutorialText: '',
      tutorialRecords: [],
      tutorialLoading: false,
      tutorialVideoUrl: '',
      tutorialVideoTitle: '',
      tutorialTotalActions: 0,
      tutorialIsLast: false
    },
    global: {
      stubs: {
        PoseDetectionView: poseDetectionViewStub,
        WorkoutTimeline: true
      }
    }
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('VisualTrainingPanel media switch', () => {
  it('swaps the large and lower-right views and requests camera startup only once', async () => {
    const wrapper = mountPanel()

    expect(wrapper.emitted('startRecognition')).toEqual([[5]])
    expect(wrapper.find('.visual-session__demonstration-stage').classes())
      .toContain('visual-session__media-stage--primary')
    expect(wrapper.find('.visual-session__camera-stage').classes())
      .toContain('visual-session__media-stage--secondary')

    await wrapper.get('.visual-session__secondary-switch').trigger('click')

    expect(wrapper.find('.visual-session__camera-stage').classes())
      .toContain('visual-session__media-stage--primary')
    expect(wrapper.find('.visual-session__demonstration-stage').classes())
      .toContain('visual-session__media-stage--secondary')
    expect(wrapper.emitted('startRecognition')).toEqual([[5]])

    await wrapper.get('.visual-session__secondary-switch').trigger('click')

    expect(wrapper.find('.visual-session__demonstration-stage').classes())
      .toContain('visual-session__media-stage--primary')
    expect(wrapper.emitted('startRecognition')).toEqual([[5]])
  })

  it('keeps the mounted pose camera alive while switching views', async () => {
    vi.useFakeTimers()
    const wrapper = mountPanel(true)

    await vi.advanceTimersByTimeAsync(500)
    expect(wrapper.find('.visual-session__pose-view').exists()).toBe(true)

    await wrapper.get('.visual-session__secondary-switch').trigger('click')
    await wrapper.get('.visual-session__secondary-switch').trigger('click')

    expect(wrapper.find('.visual-session__pose-view').exists()).toBe(true)
  })

  it('resumes an actively playing demonstration after camera recording starts', async () => {
    vi.useFakeTimers()
    const play = vi.fn()
    const startRecord = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('uni', {
      createVideoContext: vi.fn(() => ({
        play,
        pause: vi.fn(),
        seek: vi.fn()
      }))
    })
    const poseDetectionViewStub = defineComponent({
      setup(_, { expose }) {
        expose({ startRecord })
        return () => h('view', { class: 'pose-recording-stub' })
      }
    })
    const wrapper = mountPanel(true, false, true, poseDetectionViewStub)

    await vi.advanceTimersByTimeAsync(500)
    await (wrapper.vm as unknown as { startRecord: () => Promise<void> }).startRecord()

    expect(startRecord).toHaveBeenCalledOnce()
    expect(play).toHaveBeenCalled()
  })

  it('shows both views and requests the camera when entering landscape comparison', () => {
    const wrapper = mountPanel(false, true)

    expect(wrapper.classes()).toContain('visual-session--comparison')
    expect(wrapper.find('.visual-session__stage--comparison').exists()).toBe(true)
    expect(wrapper.find('.visual-session__secondary-switch').exists()).toBe(false)
    expect(wrapper.find('.visual-session__secondary-space').exists()).toBe(false)
    expect(wrapper.find('.visual-session__start-overlay').exists()).toBe(false)
    expect(wrapper.find('.visual-session__actions').exists()).toBe(false)
    expect(wrapper.find('.visual-session__comparison-actions .visual-session__landscape-start').exists()).toBe(true)
    expect(wrapper.find('.visual-session__comparison-actions .visual-session__comparison-exit').exists()).toBe(true)
    expect(wrapper.findAll('.visual-session__media-label')).toHaveLength(2)
    expect(wrapper.emitted('startRecognition')).toEqual([[5]])
  })

  it('restores the previous portrait view after leaving landscape comparison', async () => {
    const wrapper = mountPanel()

    await wrapper.setProps({ comparisonMode: true })
    await wrapper.setProps({ recognitionEnabled: true })
    await wrapper.setProps({ comparisonMode: false })

    expect(wrapper.find('.visual-session__demonstration-stage').classes())
      .toContain('visual-session__media-stage--primary')
    expect(wrapper.find('.visual-session__camera-stage').classes())
      .toContain('visual-session__media-stage--secondary')
    expect(wrapper.find('.visual-session__secondary-space').exists()).toBe(true)
  })
})
