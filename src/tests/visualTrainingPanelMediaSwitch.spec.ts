import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import VisualTrainingPanel from '../subpackages/training/components/VisualTrainingPanel.vue'
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
  phaseElapsedSeconds: 0,
  sessionElapsedSeconds: 0,
  phaseProgressPercent: 0,
  sessionProgressPercent: 0
}

const CoverViewStub = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('cover-view', attrs, slots.default?.())
  }
})

function mountPanel(
  recognitionEnabled = false,
  comparisonMode = false,
  videoAutoplay = false,
  poseDetectionViewStub: object | boolean = true,
  videoUrl = 'https://example.com/demo.mp4'
) {
  return mount(VisualTrainingPanel, {
    props: {
      videoTitle: '开合跳',
      videoUrl,
      videoLoading: false,
      videoError: '',
      videoEnded: false,
      videoProgressSeconds: 0,
      completionHint: '保持节奏',
      recognitionEnabled,
      recognitionReady: false,
      recognitionStatus: recognitionEnabled ? 'preparing' : 'idle',
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
      preparingTraining: false,
      trainingPreparationLabel: '',
      startCountdown: 0,
      phaseKind: 'preview',
      phaseSlot: 'preview',
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
        WorkoutTimeline: true,
        'cover-view': CoverViewStub,
        'scroll-view': true
      }
    }
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('VisualTrainingPanel media switch', () => {
  it('loads an asynchronously resolved first video into the visible native slot', async () => {
    const play = vi.fn()
    vi.stubGlobal('uni', {
      createVideoContext: vi.fn(() => ({ seek: vi.fn(), play, pause: vi.fn() }))
    })
    const wrapper = mountPanel(false, false, true, true, '')

    await wrapper.setProps({ videoUrl: 'https://example.com/first.mp4' })
    await nextTick()

    expect(wrapper.get('#follow-along-video').attributes('src'))
      .toBe('https://example.com/first.mp4')
    expect(wrapper.get('#follow-along-video').classes())
      .toContain('visual-session__video--active')
  })

  it('keeps automatic follow-along playback muted and retries it at canplay', async () => {
    const play = vi.fn()
    vi.stubGlobal('uni', {
      createVideoContext: vi.fn(() => ({ seek: vi.fn(), play, pause: vi.fn() }))
    })
    const wrapper = mountPanel(false, false, true)
    const video = wrapper.get('#follow-along-video')

    expect((video.element as HTMLVideoElement).muted).toBe(true)
    await video.trigger('canplay')
    expect(play).toHaveBeenCalled()
  })

  it('binds media events to the token rendered on that video instance', async () => {
    const wrapper = mountPanel()

    await wrapper.setProps({ videoEventToken: 'phase-a' })
    await wrapper.get('#follow-along-video').trigger('timeupdate', {
      detail: { currentTime: 1, duration: 10 }
    })

    expect(wrapper.emitted('videoTimeUpdate')?.at(-1)?.[0]).toMatchObject({
      token: 'phase-a'
    })
  })

  it('restarts the current video when an in-session demonstration begins', async () => {
    const seek = vi.fn()
    const play = vi.fn()
    vi.stubGlobal('uni', {
      createVideoContext: vi.fn(() => ({
        seek,
        play,
        pause: vi.fn()
      }))
    })
    const wrapper = mountPanel()

    await wrapper.setProps({
      trainingStarted: true,
      phaseKind: 'demonstration',
      phaseSlot: 'pretraining',
      phaseRemainingSeconds: 30,
      videoAutoplay: true
    })
    await nextTick()

    expect(seek).toHaveBeenCalledWith(0)
    expect(play).toHaveBeenCalled()
  })

  it('keeps the phase position when an active cached video falls back to its remote source', async () => {
    const seek = vi.fn()
    vi.stubGlobal('uni', {
      createVideoContext: vi.fn(() => ({
        seek,
        play: vi.fn(),
        pause: vi.fn()
      }))
    })
    const wrapper = mountPanel(false, false, true)

    await wrapper.setProps({
      trainingStarted: true,
      phaseKind: 'active',
      phaseSlot: 'formal-training',
      phaseRemainingSeconds: 12,
      videoProgressSeconds: 0
    })
    seek.mockClear()

    await wrapper.setProps({
      phaseRemainingSeconds: 12,
      videoProgressSeconds: 7,
      videoUrl: 'https://example.com/remote-fallback.mp4'
    })
    await wrapper.get('#follow-along-video-buffer').trigger('canplay')
    await Promise.resolve()
    await nextTick()

    expect(seek).toHaveBeenCalledWith(7)
  })

  it('shows a countdown only before an action, never during its final active seconds', async () => {
    const wrapper = mountPanel()

    await wrapper.setProps({
      trainingStarted: true,
      phaseKind: 'active',
      phaseSlot: 'formal-training',
      phaseRemainingSeconds: 3,
      videoAutoplay: true
    })

    expect(wrapper.find('.visual-session__cue-overlay').exists()).toBe(false)
    expect(wrapper.get('.visual-session__active-timer-value').text()).toBe('3s')

    await wrapper.setProps({
      phaseKind: 'countdown',
      phaseSlot: 'formal-countdown',
      phaseRemainingSeconds: 3,
      videoAutoplay: false
    })

    expect(wrapper.get('.visual-session__cue-overlay').text()).toContain('开始')
    expect(wrapper.find('.visual-session__active-timer').exists()).toBe(false)

    await wrapper.setProps({
      phaseRemainingSeconds: 0,
      countdownAudioPending: true
    })

    expect(wrapper.get('.visual-session__cue-overlay').text()).toContain('1')
  })

  it('labels the configured pretraining demonstration while retaining training controls', async () => {
    const wrapper = mountPanel()

    await wrapper.setProps({
      trainingStarted: true,
      phaseKind: 'demonstration',
      phaseSlot: 'pretraining',
      phaseRemainingSeconds: 8
    })

    expect(wrapper.get('.visual-session__demonstration-label').text()).toContain('预训练示范')
    expect(wrapper.find('.visual-session__info-panel').exists()).toBe(true)
    expect(wrapper.find('.visual-session__actions').exists()).toBe(false)
  })

  it('starts automatically when the portrait camera becomes ready', async () => {
    const wrapper = mountPanel(true)

    expect(wrapper.get('.visual-session__start-overlay').text()).toContain('正在准备摄像头')

    await wrapper.setProps({
      recognitionReady: true,
      recognitionStatus: 'ready'
    })

    expect(wrapper.find('.visual-session__start-overlay').exists()).toBe(false)
    expect(wrapper.find('.visual-session__start-button').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('摄像头已就绪，轻触画面开始训练')
    expect(wrapper.emitted('startTraining')).toHaveLength(1)

    await wrapper.setProps({
      preparingTraining: true,
      trainingPreparationLabel: '正在加载动作与语音资源…'
    })

    expect(wrapper.get('.visual-session__start-overlay').text())
      .toContain('正在加载动作与语音资源')

    await wrapper.setProps({
      trainingStarted: true,
      preparingTraining: false
    })

    expect(wrapper.find('.visual-session__start-overlay').exists()).toBe(false)
  })

  it('keeps the full-body position guide visible until the first formal action starts', async () => {
    vi.useFakeTimers()
    const wrapper = mountPanel(true)

    await vi.advanceTimersByTimeAsync(500)
    expect(wrapper.find('.visual-session__position-guide').exists()).toBe(true)
    expect(wrapper.find('.visual-session__guide-image').exists()).toBe(true)
    expect(wrapper.find('.visual-session__guide-image').attributes('src')).toContain('camera-position-guide.png')

    await wrapper.setProps({
      trainingStarted: true,
      phaseKind: 'demonstration',
      phaseSlot: 'pretraining'
    })
    expect(wrapper.find('.visual-session__position-guide').exists()).toBe(true)

    await wrapper.setProps({
      phaseKind: 'countdown',
      phaseSlot: 'formal-countdown'
    })
    expect(wrapper.find('.visual-session__position-guide').exists()).toBe(true)

    await wrapper.setProps({
      phaseKind: 'active',
      phaseSlot: 'formal-training'
    })
    expect(wrapper.find('.visual-session__position-guide').exists()).toBe(false)
  })

  it('does not recreate the native video merely because the phase token changes', async () => {
    const wrapper = mountPanel()
    const initialVideo = wrapper.get('#follow-along-video').element

    await wrapper.setProps({ videoEventToken: 'next-phase-token' })

    expect(wrapper.get('#follow-along-video').element).toBe(initialVideo)
  })

  it('preloads the next action in a second native video and promotes it from frame zero', async () => {
    const contexts = new Map<string, { seek: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> }>()
    vi.stubGlobal('uni', {
      createVideoContext: vi.fn((id: string) => {
        if (!contexts.has(id)) {
          contexts.set(id, { seek: vi.fn(), play: vi.fn(), pause: vi.fn() })
        }
        return contexts.get(id)
      })
    })
    const wrapper = mountPanel(false, false, true)

    await wrapper.setProps({
      nextVideoUrl: 'https://example.com/next.mp4',
      videoResetKey: '0:formal-training'
    })
    const buffer = wrapper.get('#follow-along-video-buffer')
    expect(buffer.attributes('src')).toBe('https://example.com/next.mp4')
    expect(buffer.classes()).toContain('visual-session__video--standby')
    await buffer.trigger('canplay')

    await wrapper.setProps({
      videoUrl: 'https://example.com/next.mp4',
      videoResetKey: '1:pretraining-countdown',
      videoProgressSeconds: 9
    })
    await Promise.resolve()
    await nextTick()

    expect(wrapper.get('#follow-along-video-buffer').classes())
      .toContain('visual-session__video--active')
    expect(wrapper.get('#follow-along-video').classes())
      .toContain('visual-session__video--standby')
    expect(contexts.get('follow-along-video-buffer')?.seek).toHaveBeenCalledWith(0)
  })

  it('keeps the hand-off target when current and following actions change together', async () => {
    const contexts = new Map<string, { seek: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> }>()
    vi.stubGlobal('uni', {
      createVideoContext: vi.fn((id: string) => {
        if (!contexts.has(id)) {
          contexts.set(id, { seek: vi.fn(), play: vi.fn(), pause: vi.fn() })
        }
        return contexts.get(id)
      })
    })
    const wrapper = mountPanel(false, false, true)
    await wrapper.setProps({ nextVideoUrl: 'https://example.com/action-2.mp4' })
    await wrapper.get('#follow-along-video-buffer').trigger('canplay')

    await wrapper.setProps({
      videoUrl: 'https://example.com/action-2.mp4',
      nextVideoUrl: 'https://example.com/action-3.mp4',
      videoResetKey: '1:pretraining-countdown'
    })
    await Promise.resolve()
    await nextTick()

    expect(wrapper.get('#follow-along-video-buffer').attributes('src'))
      .toBe('https://example.com/action-2.mp4')
    expect(wrapper.get('#follow-along-video-buffer').classes())
      .toContain('visual-session__video--active')
    expect(wrapper.get('#follow-along-video').attributes('src'))
      .toBe('https://example.com/action-3.mp4')
    expect(wrapper.get('#follow-along-video').classes())
      .toContain('visual-session__video--standby')
  })

  it('identifies active buffer events even when WeChat omits native target metadata', async () => {
    vi.stubGlobal('uni', {
      createVideoContext: vi.fn(() => ({ seek: vi.fn(), play: vi.fn(), pause: vi.fn() }))
    })
    const wrapper = mountPanel(false, false, true)
    await wrapper.setProps({
      nextVideoUrl: 'https://example.com/next.mp4',
      videoEventToken: 'action-1'
    })
    const buffer = wrapper.get('#follow-along-video-buffer')
    await buffer.trigger('canplay')
    await wrapper.setProps({
      videoUrl: 'https://example.com/next.mp4',
      videoResetKey: '1:formal-training',
      videoEventToken: 'action-2'
    })
    await Promise.resolve()
    await nextTick()

    const activeBuffer = wrapper.get('#follow-along-video-buffer')
    activeBuffer.element.removeAttribute('id')
    // The native event may race Vue's dataset update and still expose the
    // preload token from before this slot became visible.
    activeBuffer.element.setAttribute('data-video-token', 'preload:https://example.com/next.mp4')
    await activeBuffer.trigger('play')
    await activeBuffer.trigger('timeupdate', {
      detail: { currentTime: 1, duration: 15 }
    })

    expect(wrapper.emitted('videoPlay')?.at(-1)?.[0]).toMatchObject({
      token: 'action-2',
      elementId: 'follow-along-video-buffer'
    })
    expect(wrapper.emitted('videoTimeUpdate')?.at(-1)?.[0]).toMatchObject({
      token: 'action-2',
      detail: { currentTime: 1, duration: 15 }
    })
  })

  it('shows the pretraining notice from the first countdown frame in the lower-left corner', async () => {
    const wrapper = mountPanel(true)

    await wrapper.setProps({
      trainingStarted: true,
      phaseKind: 'countdown',
      phaseSlot: 'pretraining-countdown',
      phaseRemainingSeconds: 3
    })

    expect(wrapper.get('.visual-session__demonstration-label').text()).toContain('预训练示范')
  })

  it('swaps the large and lower-right views and requests camera startup only once', async () => {
    const wrapper = mountPanel()

    expect(wrapper.emitted('startRecognition')).toEqual([[5]])
    expect(wrapper.find('.visual-session__demonstration-stage').classes())
      .toContain('visual-session__media-stage--primary')
    expect(wrapper.find('.visual-session__camera-stage').classes())
      .toContain('visual-session__media-stage--secondary')

    await wrapper.get('.visual-session__secondary-switch').trigger('tap')

    expect(wrapper.find('.visual-session__camera-stage').classes())
      .toContain('visual-session__media-stage--primary')
    expect(wrapper.find('.visual-session__demonstration-stage').classes())
      .toContain('visual-session__media-stage--secondary')
    expect(wrapper.emitted('startRecognition')).toEqual([[5]])

    await wrapper.get('.visual-session__secondary-switch').trigger('tap')

    expect(wrapper.find('.visual-session__demonstration-stage').classes())
      .toContain('visual-session__media-stage--primary')
    expect(wrapper.emitted('startRecognition')).toEqual([[5]])
  })

  it('keeps the mounted pose camera alive while switching views', async () => {
    vi.useFakeTimers()
    const wrapper = mountPanel(true)

    await vi.advanceTimersByTimeAsync(500)
    expect(wrapper.find('.visual-session__pose-view').exists()).toBe(true)

    await wrapper.get('.visual-session__secondary-switch').trigger('tap')
    await wrapper.get('.visual-session__secondary-switch').trigger('tap')

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

  it('shows both views and puts status in the right-side rail when entering landscape comparison', () => {
    const wrapper = mountPanel(false, true)

    expect(wrapper.classes()).toContain('visual-session--comparison')
    expect(wrapper.find('.visual-session__stage--comparison').exists()).toBe(true)
    const stage = wrapper.get('.visual-session__stage--comparison')
    const actionRail = wrapper.get('.visual-session__comparison-actions')
    expect(stage.find('.visual-session__comparison-status').exists()).toBe(false)
    expect(actionRail.find('.visual-session__comparison-status').text()).toContain('正在准备摄像头')
    expect(actionRail.find('.visual-session__comparison-status').text()).toContain('准备中')
    expect(actionRail.find('.visual-session__comparison-controls').exists()).toBe(true)
    expect(wrapper.find('.visual-session__secondary-switch').exists()).toBe(false)
    expect(wrapper.find('.visual-session__secondary-space').exists()).toBe(false)
    expect(wrapper.find('.visual-session__start-overlay').exists()).toBe(false)
    expect(wrapper.find('.visual-session__actions').exists()).toBe(false)
    expect(wrapper.find('.visual-session__comparison-actions .visual-session__landscape-start').exists()).toBe(true)
    expect(wrapper.find('.visual-session__comparison-actions .visual-session__comparison-exit').exists()).toBe(true)
    expect(wrapper.findAll('.visual-session__media-label')).toHaveLength(2)
    expect(wrapper.emitted('startRecognition')).toEqual([[5]])
  })

  it('keeps training blocked until the native pose layer reports ready', async () => {
    const wrapper = mountPanel(true, true)
    const startAction = wrapper.get('.visual-session__landscape-start')

    expect(startAction.attributes('disabled')).toBeDefined()
    expect(wrapper.get('.visual-session__comparison-status').text()).toContain('正在准备摄像头')

    await wrapper.setProps({
      recognitionReady: true,
      recognitionStatus: 'ready'
    })

    expect(wrapper.get('.visual-session__landscape-start').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('.visual-session__comparison-status').text()).not.toContain('正在准备摄像头')
  })

  it('keeps the start action disabled and explains a failed camera startup', async () => {
    const wrapper = mountPanel(true, true)

    await wrapper.setProps({ recognitionStatus: 'failed' })

    expect(wrapper.get('.visual-session__landscape-start').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.visual-session__landscape-start').text()).toContain('相机未就绪')
    expect(wrapper.get('.visual-session__comparison-status').text()).toContain('请退出训练后重试')
  })

  it('keeps the landscape countdown in the right-side status rail', async () => {
    const wrapper = mountPanel(false, true)

    await wrapper.setProps({ startCountdown: 2 })

    const actionRail = wrapper.get('.visual-session__comparison-actions')
    expect(actionRail.find('.visual-session__comparison-status').text()).toContain('即将开始')
    expect(actionRail.find('.visual-session__comparison-status').text()).toContain('2')
    expect(wrapper.find('.visual-session__start-countdown').exists()).toBe(false)
  })

  it('keeps active landscape status in its rail without non-formal video controls', async () => {
    const wrapper = mountPanel(true, true)

    await wrapper.setProps({
      trainingStarted: true,
      phaseKind: 'active',
      phaseSlot: 'formal-training',
      phaseRemainingSeconds: 14
    })

    const stage = wrapper.get('.visual-session__stage--comparison')
    const actionRail = wrapper.get('.visual-session__comparison-actions')
    expect(actionRail.find('.visual-session__comparison-status').text()).toContain('动作剩余')
    expect(actionRail.find('.visual-session__comparison-status').text()).toContain('14s')
    expect(stage.find('.visual-session__lesson-label').exists()).toBe(false)
    expect(stage.find('.visual-session__active-timer').exists()).toBe(false)
    expect(stage.get('#follow-along-video').attributes('controls')).toBeUndefined()
    expect(stage.get('#follow-along-video').attributes('show-center-play-btn')).toBe('false')
    expect(stage.get('#follow-along-video').attributes('enable-progress-gesture')).toBe('false')
    expect(stage.find('.demonstration-video-controls').exists()).toBe(false)
    expect(actionRail.find('.visual-session__comparison-playback').exists()).toBe(false)
  })

  it('keeps the second-stage pretraining demonstration automatic without tutorial controls', async () => {
    const wrapper = mountPanel(true, true)

    await wrapper.setProps({
      trainingStarted: true,
      phaseKind: 'demonstration',
      phaseSlot: 'pretraining',
      phaseRemainingSeconds: 8
    })

    const stage = wrapper.get('.visual-session__stage--comparison')
    const actionRail = wrapper.get('.visual-session__comparison-actions')
    expect(actionRail.find('.visual-session__comparison-status').exists()).toBe(true)
    expect(actionRail.find('.visual-session__comparison-exit').exists()).toBe(true)
    expect(stage.get('#follow-along-video').attributes('controls')).toBeUndefined()
    expect(stage.get('#follow-along-video').attributes('show-center-play-btn')).toBe('false')
    expect(stage.get('#follow-along-video').attributes('enable-progress-gesture')).toBe('false')
    expect(stage.find('.demonstration-video-controls').exists()).toBe(false)
    expect(stage.find('.visual-session__demonstration-label').exists()).toBe(false)
  })

  it('uses the measured comparison frame size for both landscape views', async () => {
    const wrapper = mountPanel(false, true)

    await wrapper.setProps({
      comparisonMediaSize: { mediaWidth: 378, mediaHeight: 504 }
    })

    expect(wrapper.get('.visual-session__demonstration-stage').attributes('style'))
      .toContain('width: 378px')
    expect(wrapper.get('.visual-session__camera-stage').attributes('style'))
      .toContain('height: 504px')
    expect(wrapper.get('#follow-along-video').attributes('style'))
      .toContain('width: 378px')
  })

  it('passes the measured landscape frame to the native pose camera layer', async () => {
    vi.useFakeTimers()
    const poseDetectionViewStub = defineComponent({
      props: {
        mediaSize: Object
      },
      setup(props) {
        return () => {
          const mediaSize = props.mediaSize as { width: number; height: number } | undefined
          return h('view', {
            class: 'pose-size-stub',
            'data-width': mediaSize?.width,
            'data-height': mediaSize?.height
          })
        }
      }
    })
    const wrapper = mountPanel(true, true, false, poseDetectionViewStub)

    await wrapper.setProps({
      comparisonMediaSize: { mediaWidth: 200, mediaHeight: 266 }
    })
    await vi.advanceTimersByTimeAsync(500)

    const poseView = wrapper.get('.pose-size-stub')
    expect(poseView.attributes('data-width')).toBe('200')
    expect(poseView.attributes('data-height')).toBe('266')
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
    expect(wrapper.find('.visual-session__info-panel').exists()).toBe(true)
  })
})
