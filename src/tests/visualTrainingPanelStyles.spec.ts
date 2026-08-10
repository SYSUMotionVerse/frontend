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

  it('starts the camera automatically and keeps only the exit action at the bottom', () => {
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

  it('lets the student swap the main stage with the lower-right preview', () => {
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
    expect(source).toContain("@click.stop=\"selectMedia('demonstration')\"")
    expect(source).toContain("@click.stop=\"selectMedia('camera')\"")
    expect(source).toContain('动作演示')
    expect(source).toContain('我的画面')
    expect(source).toContain("emit('startRecognition', 5)")
    expect(source).toContain('visual-session__media-stage--primary')
    expect(source).toContain('visual-session__media-stage--secondary')
    expect(source).toContain('visual-session__secondary-switch')
    expect(source).toContain('visual-session__secondary-space')
    expect(source).not.toContain('visual-session__media-switch')
    expect(source).not.toContain('visual-session__recording-badge')
    expect(source).toContain('defineExpose({ startRecord, stopRecord })')
    expect(source).toContain('phaseKind === \'rest\'')
    expect(source).toContain('visual-session__rest-overlay')
    expect(source).toContain('下一训练步骤：{{ restNextTitle }}')
    expect(source).toContain("phaseKind === 'rest' && !phaseCueCount")
    expect(source).toContain('动作剩余')
    expect(source).toContain('visual-session__start-overlay')
    expect(source).toContain('startCountdown > 0')
    expect(source).toContain(':controls="false"')
    expect(source).toContain('visual-session__playback-control')
    expect(source).toContain('visual-session__position-guide')
    expect(source).toContain('站在框内')
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
    expect(shellSource).toContain('<view v-if="props.fitViewport" class="training-shell__content">')
    expect(shellSource).toContain('<transition v-else name="shell-enter" appear>')
    expect(pageSource).toContain('<view class="visual-session-page">')
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
      /\.visual-session__lower-grid\s*\{[\s\S]*display:\s*flex;[\s\S]*height:\s*280rpx;[\s\S]*min-height:\s*280rpx;[\s\S]*flex:\s*0 0 280rpx;[\s\S]*gap:\s*24rpx;/
    )
    expect(panelSource).toMatch(
      /\.visual-session__media-stage--secondary\s*\{[\s\S]*top:\s*calc\(100% \+ 30rpx\);[\s\S]*right:\s*0;[\s\S]*width:\s*200rpx;[\s\S]*height:\s*280rpx;/
    )
    expect(panelSource).toMatch(
      /\.visual-session__secondary-space\s*\{[\s\S]*width:\s*200rpx;[\s\S]*height:\s*280rpx;[\s\S]*flex:\s*0 0 200rpx;/
    )
    expect(panelSource).toContain(':object-fit="comparisonMode ? \'contain\' : \'cover\'"')
    expect(panelSource).toMatch(/\.visual-session__secondary[\s\S]*border-radius:\s*9999px;/)
    expect(panelSource).not.toContain('.visual-session__record')
    expect(panelSource).toContain('hover-class="visual-session__action--pressed"')
    expect(shellSource).toContain('overflow-y: auto;')
  })

  it('keeps landscape comparison panels portrait-framed and puts controls in a right-side rail', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).toContain('v-if="showStartAction && !comparisonMode"')
    expect(source).toContain(":class=\"{ 'visual-session--comparison': comparisonMode }\"")
    expect(source).not.toContain('@media (orientation: landscape)')
    expect(source).toContain('class="visual-session__comparison-layout"')
    expect(source).toContain('v-if="comparisonMode" class="visual-session__comparison-actions"')
    expect(source).toContain('v-if="!comparisonMode" class="visual-session__actions"')
    expect(source).toContain('class="visual-session__landscape-start"')
    expect(source).toContain('class="visual-session__comparison-exit"')
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__comparison-layout--active\s*\{[\s\S]*display:\s*flex;[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*flex:\s*1;[\s\S]*gap:\s*16rpx;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__stage--comparison\s*\{[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*flex:\s*1;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*space-between;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__stage--comparison \.visual-session__demonstration-stage,[\s\S]*?\.visual-session--comparison \.visual-session__stage--comparison \.visual-session__camera-stage\s*\{[\s\S]*width:\s*auto;[\s\S]*height:\s*100%;[\s\S]*max-width:\s*calc\(50% - 10rpx\);[\s\S]*aspect-ratio:\s*3\s*\/\s*4;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__comparison-actions\s*\{[\s\S]*width:\s*144rpx;[\s\S]*flex:\s*0 0 144rpx;[\s\S]*flex-direction:\s*column;/
    )
    expect(source).toMatch(
      /\.visual-session--comparison \.visual-session__landscape-start\s*\{[\s\S]*width:\s*100%;[\s\S]*min-height:\s*88rpx;[\s\S]*flex:\s*0 0 auto;/
    )
  })
})
