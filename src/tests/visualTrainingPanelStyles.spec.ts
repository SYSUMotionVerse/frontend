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

  it('uses one bottom action to enable the camera and then control recording', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    expect(source).not.toContain('visual-session__recognition-actions')
    expect(source).not.toContain('visual-session__recognition-button')
    expect(source).toContain('function handleRecordAction()')
    expect(source).toMatch(
      /if \(!props\.recognitionEnabled\) \{[\s\S]*emit\('startRecognition', 5\)[\s\S]*return[\s\S]*\}/
    )
    expect(source).toContain('props.recognitionEnabled && !poseMountReady.value')
    expect(source).toContain(':disabled="recordActionDisabled"')
    expect(source).toContain('@click="handleRecordAction"')
  })

  it('keeps the teaching video primary and places the camera beside the information panel', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/components/VisualTrainingPanel.vue'),
      'utf8'
    )

    const videoIndex = source.indexOf('class="visual-session__video"')
    const infoIndex = source.indexOf('class="visual-session__info-panel"')
    const cameraIndex = source.indexOf('class="visual-session__camera-panel"')

    expect(videoIndex).toBeGreaterThan(-1)
    expect(infoIndex).toBeGreaterThan(videoIndex)
    expect(cameraIndex).toBeGreaterThan(videoIndex)
    expect(cameraIndex).toBeGreaterThan(infoIndex)
    expect(source).toContain('v-if="recording" class="visual-session__recording-badge"')
    expect(source).toContain('<text>{{ recordSeconds }}s</text>')
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

  it('uses a stable portrait 4:3 teaching video followed by the information and camera row', () => {
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
    expect(shellSource).toMatch(
      /\.training-shell__content\s*\{[\s\S]*height:\s*100%;[\s\S]*flex:\s*1;[\s\S]*min-height:\s*0;/
    )
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
      /\.visual-session__camera-panel\s*\{[\s\S]*width:\s*200rpx;[\s\S]*height:\s*280rpx;[\s\S]*min-height:\s*0;[\s\S]*align-self:\s*stretch;/
    )
    expect(panelSource).toContain('object-fit="cover"')
    expect(panelSource).toMatch(/\.visual-session__secondary[\s\S]*border-radius:\s*9999px;/)
    expect(panelSource).toMatch(/\.visual-session__record\s*\{[\s\S]*background:\s*#ef9b92;/)
    expect(panelSource).toMatch(/\.visual-session__record--recording\s*\{[\s\S]*background:\s*#c84f4f;/)
    expect(panelSource).toContain('hover-class="visual-session__action--pressed"')
    expect(shellSource).toContain('overflow-y: auto;')
  })
})
