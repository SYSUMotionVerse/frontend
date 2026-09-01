import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('VisualTrainingPanel mini-program styles', () => {
  it('does not use attribute selectors forbidden in component WXSS', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).not.toMatch(/\.[\w-]+\[disabled\]/)
  })

  it('keeps a single native camera lifecycle instead of replacing a preview camera', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).not.toMatch(/<camera\s+[\s\S]*?v-else/)
  })

  it('starts the camera automatically without adding redundant recording controls', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).not.toContain('visual-session__recognition-actions')
    expect(source).not.toContain('visual-session__recognition-button')
    expect(source).toContain('function requestCameraStart()')
    expect(source).toContain('onMounted(requestCameraStart)')
    expect(source).not.toContain('function handleRecordAction()')
    expect(source).not.toContain('visual-session__record')
    expect(source).not.toContain('recordActionDisabled')
  })

  it('keeps both media views mounted and allows the lower-right view to become primary', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    const videoIndex = source.indexOf('class="visual-session__video"')
    const cameraIndex = source.indexOf('class="visual-session__camera-stage"')
    const infoIndex = source.indexOf('class="visual-session__info-panel"')

    expect(videoIndex).toBeGreaterThan(-1)
    expect(cameraIndex).toBeGreaterThan(videoIndex)
    expect(infoIndex).toBeGreaterThan(cameraIndex)
    expect(source).toContain("type ActiveMedia = 'demonstration' | 'camera'")
    expect(source).toContain("const activeMedia = shallowRef<ActiveMedia>('demonstration')")
    expect(source).toContain('function selectMedia(media: ActiveMedia)')
    expect(source).toContain('动作演示')
    expect(source).toContain('我的画面')
    expect(source).toContain("emit('startRecognition', 5)")
    expect(source).toContain('visual-session__media-stage--primary')
    expect(source).toContain('visual-session__media-stage--secondary')
    expect(source).toContain('visual-session__secondary-switch')
    expect(source).toContain("@tap.stop=\"selectMedia('camera')\"")
    expect(source).toContain("@tap.stop=\"selectMedia('demonstration')\"")
    expect(source).toContain('visual-session__secondary-space')
    expect(source).not.toContain('visual-session__media-switch')
    expect(source).not.toContain('visual-session__recording-badge')
    expect(source).toContain('defineExpose({ startRecord, stopRecord, startDetect, stopDetect })')
    expect(source).not.toContain("phaseKind === 'rest'")
    expect(source).not.toContain('visual-session__rest-overlay')
    expect(source).not.toContain('下一训练步骤：{{ restNextTitle }}')
    expect(source).toContain('动作剩余')
    expect(source).toContain('visual-session__start-overlay')
    expect(source).not.toContain("'visual-session__start-overlay--ready'")
    expect(source).toContain('border-radius: 30rpx;')
    expect(source).toContain('font-size: 30rpx;')
    expect(source).toContain("phaseSlot === 'pretraining-countdown'")
    expect(source).not.toMatch(/class="visual-session__start-button"/)
    expect(source).toContain('startCountdown > 0')
    expect(source).toContain(':controls="false"')
    expect(source).toContain(':show-center-play-btn="false"')
    expect(source).toContain(':enable-progress-gesture="false"')
    expect(source).toContain("import DemonstrationVideoControls from './DemonstrationVideoControls.vue'")
    expect(source).toContain('const showTutorialDemonstrationControls = computed(() =>')
    expect(source).not.toContain('visual-session__playback-control')
    expect(source).toContain('visual-session__position-guide')
    expect(source).toContain('const showPositionGuide = computed(() => (')
    expect(source).toContain("props.phaseSlot === 'pretraining'")
    expect(source).toContain("props.phaseSlot === 'formal-countdown'")
    expect(source).toContain("props.workoutState.current.itemIndex === 0")
    expect(source).toMatch(/\.visual-session__position-guide\s*\{[\s\S]*width:\s*180rpx;[\s\S]*height:\s*360rpx;/)
    expect(source).toMatch(/\.visual-session__guide-arm,[\s\S]*?\.visual-session__guide-leg\s*\{[\s\S]*width:\s*6rpx;[\s\S]*background:\s*rgba\(255, 250, 244, 0\.84\);/)
    expect(source).toContain('站在框内')
    expect(source).toMatch(/<cover-view[\s\S]*class="visual-session__media-label"/)
    expect(source).toMatch(/<cover-view[\s\S]*class="visual-session__start-overlay"/)
    expect(source).toMatch(/<cover-view[\s\S]*class="visual-session__position-guide"/)
    expect(source).toContain('class="visual-session__tutorial-skip"')
  })

  it('uses a stable portrait 4:3 media stage followed by the training information', () => {
    const panelSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/visual-session.vue'),
      'utf8'
    )
    const shellSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/training/UniTrainingPageShell.vue'),
      'utf8'
    )
    expect(pageSource).toContain(':fit-viewport="true"')
    expect(shellSource).toContain("'training-shell--fit-viewport': props.fitViewport")
    expect(shellSource).toMatch(
      /<view[\s\S]*?v-if="props\.fitViewport" class="training-shell__content"/
    )
    expect(shellSource).toContain('<transition v-else name="shell-enter" appear>')
    expect(pageSource).toContain('class="visual-session-page"')
    expect(pageSource).toContain('class="visual-session-page__panel"')
    expect(pageSource).toMatch(
      /\.visual-session-page\s*\{[\s\S]*display:\s*flex;[\s\S]*height:\s*auto;[\s\S]*min-height:\s*calc\(100vh - 24rpx\);/
    )
    expect(pageSource).toMatch(
      /\.visual-session-page__panel\s*\{[\s\S]*display:\s*block;[\s\S]*height:\s*auto;[\s\S]*min-height:\s*calc\(100vh - 24rpx\);/
    )
    expect(panelSource).toMatch(
      /\.visual-session\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*calc\(100vh - 24rpx\);/
    )
    expect(panelSource).toMatch(
      /\.visual-session__stage\s*\{[\s\S]*height:\s*936rpx;[\s\S]*aspect-ratio:\s*3\s*\/\s*4;[\s\S]*flex:\s*0\s+0\s+auto;[\s\S]*min-height:\s*0;/
    )
    expect(panelSource).toMatch(
      /\.visual-session__tutorial-media\s*\{[\s\S]*width:\s*100%;[\s\S]*aspect-ratio:\s*4\s*\/\s*3;/
    )
    expect(panelSource).toMatch(
      /\.visual-session__tutorial-video\s*\{[\s\S]*width:\s*100%;[\s\S]*height:\s*514rpx;/
    )
    expect(panelSource).toMatch(
      /\.visual-session__lower-grid\s*\{[\s\S]*display:\s*flex;[\s\S]*height:\s*430rpx;[\s\S]*min-height:\s*430rpx;[\s\S]*flex:\s*0 0 430rpx;[\s\S]*gap:\s*24rpx;/
    )
    expect(panelSource).toMatch(
      /\.visual-session__media-stage--secondary\s*\{[\s\S]*top:\s*calc\(100% \+ 30rpx\);[\s\S]*right:\s*0;[\s\S]*width:\s*330rpx;[\s\S]*height:\s*430rpx;/
    )
    expect(panelSource).toMatch(
      /\.visual-session__secondary-space\s*\{[\s\S]*width:\s*330rpx;[\s\S]*height:\s*430rpx;[\s\S]*flex:\s*0 0 330rpx;/
    )
    expect(panelSource).toContain('object-fit="cover"')
    expect(panelSource).toMatch(/\.visual-session__secondary[\s\S]*border-radius:\s*9999px;/)
    expect(panelSource).not.toContain('.visual-session__record')
    expect(panelSource).toContain('hover-class="visual-session__action--pressed"')
    expect(shellSource).toContain('overflow-y: auto;')
  })

  it('keeps landscape status in the right-side rail without adding tutorial controls to training', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).toContain('v-if="showStartAction && !comparisonMode && (startActionDisabled || recognitionStatus === \'failed\')"')
    expect(source).toContain("'visual-session--comparison': comparisonMode")
    expect(source).toContain("'visual-session--tutorial': tutorialMode && !comparisonMode")
    expect(source).not.toContain('@media (orientation: landscape)')
    expect(source).toContain('class="visual-session__comparison-layout"')
    expect(source).toContain('class="visual-session__comparison-actions"')
    expect(source).toContain('class="visual-session__comparison-status"')
    expect(source).toContain('class="visual-session__comparison-controls"')
    expect(source).toContain('const comparisonStatus = computed(() => {')
    expect(source).toContain('const comparisonMediaStyle = computed(() => {')
    expect(source).toContain('const comparisonPoseMediaSize = computed(() => {')
    expect(source).toContain(':media-size="comparisonPoseMediaSize"')
    expect(source).toContain("label: '正在准备摄像头'")
    expect(source).toContain("value: '准备中'")
    expect(source).toContain(':style="comparisonMediaStyle"')
    expect(source).toMatch(/\.visual-session__video,[\s\S]*?\.visual-session__video-state\s*\{[\s\S]*display:\s*block;/)
    expect(source).toContain('v-if="startCountdown > 0 && !comparisonMode"')
    expect(source).toContain('v-if="phaseCueCount && !comparisonMode"')
    expect(source).toContain("phaseKind === 'active' && !comparisonMode")
    expect(source).not.toContain('先观看完整动作，倒计时后开始跟练')
    expect(source).not.toContain('v-if="!comparisonMode && !tutorialMode" class="visual-session__actions"')
    expect(source).toContain('class="visual-session__landscape-start"')
    expect(source).toContain('<DemonstrationVideoControls')
    expect(source).not.toContain('showTrainingDemonstrationControls')
    expect(source).not.toContain('visual-session__comparison-playback')
    expect(source).toContain('class="visual-session__comparison-exit"')
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__comparison-layout--active\s*\{[\s\S]*display:\s*flex;[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*flex:\s*1;[\s\S]*gap:\s*12px;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__stage--comparison\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*flex:\s*1;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison\s*\{[\s\S]*background:\s*#fcf7f0;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__stage--comparison \.visual-session__demonstration-stage,[\s\S]*?\.visual-session--comparison \.visual-session__stage--comparison \.visual-session__camera-stage\s*\{[\s\S]*width:\s*auto;[\s\S]*height:\s*100%;[\s\S]*max-width:\s*calc\(50% - 6px\);[\s\S]*aspect-ratio:\s*3\s*\/\s*4;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__comparison-status\s*\{[\s\S]*width:\s*100%;[\s\S]*min-width:\s*0;[\s\S]*flex:\s*0 0 auto;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__comparison-actions\s*\{[\s\S]*width:\s*112px;[\s\S]*flex:\s*0 0 112px;[\s\S]*justify-content:\s*space-between;[\s\S]*flex-direction:\s*column;[\s\S]*border-radius:\s*16px;[\s\S]*background:\s*#f5eee6;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__comparison-controls\s*\{[\s\S]*display:\s*flex;[\s\S]*width:\s*100%;[\s\S]*flex-direction:\s*column;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__landscape-start\s*\{[\s\S]*width:\s*100%;[\s\S]*min-height:\s*48px;[\s\S]*border-radius:\s*999px;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__comparison-exit\s*\{[\s\S]*width:\s*100%;[\s\S]*min-height:\s*44px;[\s\S]*background:\s*transparent;[\s\S]*color:\s*#3d4a5c;/
    )
    expect(source).toMatch(
      /\.visual-session__comparison-status-detail\s*\{[\s\S]*color:\s*#46556a;[\s\S]*font-size:\s*12px;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__media-label\s*\{[\s\S]*font-size:\s*12px;[\s\S]*padding:\s*6px 8px;/
    )
  })

  it('matches the completion curtain to camera preparation and clips it to the media corners', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).toMatch(
      /\.visual-session__completion-overlay\s*\{[\s\S]*overflow:\s*hidden;[\s\S]*border-radius:\s*30rpx;[\s\S]*background:\s*rgba\(15, 27, 43, 0\.3\);/
    )
    expect(source).toMatch(
      /\.visual-session__completion-title\s*\{[\s\S]*color:\s*rgba\(255, 250, 244, 0\.86\);[\s\S]*font-size:\s*30rpx;[\s\S]*font-weight:\s*800;[\s\S]*line-height:\s*1\.45;/
    )
    expect(source).toMatch(
      /\.visual-session__completion-retry\s*\{[\s\S]*margin-top:\s*36rpx;[\s\S]*height:\s*64rpx;[\s\S]*min-height:\s*64rpx;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;[\s\S]*line-height:\s*64rpx;[\s\S]*padding:\s*0 28rpx;/
    )
  })
})
