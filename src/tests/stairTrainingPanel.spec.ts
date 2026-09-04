import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import StairTrainingPanel from '../components/training/StairTrainingPanel.vue'

function mountPanel(overrides: Partial<InstanceType<typeof StairTrainingPanel>['$props']> = {}) {
  return mount(StairTrainingPanel, {
    props: {
      secondsLeft: 18,
      isRunning: true,
      cadenceSpm: 126.4,
      estimatedStepCount: 38,
      estimatedVerticalSpeedMps: 0.47,
      estimatedFloorsPerMin: 3.2,
      confidence: 0.84,
      sensorStatus: 'collecting',
      sampleCount: 24,
      ...overrides
    }
  })
}

describe('stair training panel', () => {
  it('keeps the live view focused on the two metrics needed during the climb', () => {
    const wrapper = mountPanel()

    expect(wrapper.find('.stair-panel__hero').exists()).toBe(true)
    expect(wrapper.find('.stair-panel__countdown-card').exists()).toBe(true)
    expect(wrapper.find('.stair-panel__sensor-chip').exists()).toBe(true)
    expect(wrapper.find('.stair-panel__metric-strip').exists()).toBe(true)
    expect(wrapper.findAll('.stair-panel__metric-card')).toHaveLength(2)
    expect(wrapper.text()).toContain('阶梯训练')
    expect(wrapper.text()).toContain('18')
    expect(wrapper.text()).toContain('126.4')
    expect(wrapper.text()).toContain('38')
    expect(wrapper.text()).toContain('采集中')
    expect(wrapper.text()).not.toContain('爬升速度')
    expect(wrapper.text()).not.toContain('楼层速度')
    expect(wrapper.text()).not.toContain('0.47')
    expect(wrapper.text()).not.toContain('3.2')
    expect(wrapper.text()).not.toContain('识别置信度')
    expect(wrapper.text()).not.toContain('样本计数')
    expect(wrapper.text()).not.toContain('84%')
    expect(wrapper.text()).not.toContain('24 条样本')
  })

  it('shows a ready state before the session starts and keeps the primary action enabled', () => {
    const wrapper = mountPanel({
      isRunning: false,
      cadenceSpm: 0,
      estimatedStepCount: 0,
      estimatedVerticalSpeedMps: 0,
      estimatedFloorsPerMin: 0,
      confidence: 0,
      sensorStatus: 'ready',
      sampleCount: 0
    })

    expect(wrapper.find('.stair-panel__hero-support').text()).toContain('准备好后开始')
    expect(wrapper.find('.stair-panel__primary-action').text()).toContain('30 秒训练')
    expect(wrapper.text()).toContain('传感器就绪')
    expect(wrapper.text()).toContain('等待开始')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  })

  it('keeps the primary and secondary session actions wired to their explicit events', async () => {
    const wrapper = mountPanel({ isRunning: false })

    await wrapper.get('.stair-panel__primary-action').trigger('click')
    await wrapper.get('.stair-panel__secondary-action').trigger('click')

    expect(wrapper.emitted('start')).toHaveLength(1)
    expect(wrapper.emitted('interrupt')).toHaveLength(1)
  })

  it('offers a retry action when questionnaire navigation fails', async () => {
    const wrapper = mountPanel({
      isRunning: false,
      sensorStatus: 'stopped',
      questionnaireNavigationState: 'failed'
    })

    expect(wrapper.text()).toContain('继续填写反馈')
    expect(wrapper.text()).toContain('本轮训练已保存')
    await wrapper.get('.stair-panel__primary-action').trigger('click')

    expect(wrapper.emitted('continueQuestionnaire')).toHaveLength(1)
    expect(wrapper.emitted('start')).toBeUndefined()
  })

  it('stops an active sensor capture when the page hides instead of waiting for unmount', () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/training/stair-session.vue'),
      'utf8'
    )

    expect(pageSource).toContain("import { onHide } from '@dcloudio/uni-app'")
    expect(pageSource).toContain('function stopActiveCapture()')
    expect(pageSource).toMatch(/onHide\(\(\) => \{[\s\S]*stopActiveCapture\(\)/)
    expect(pageSource).toMatch(/onBeforeUnmount\(\(\) => \{[\s\S]*stopActiveCapture\(\)/)
  })

  it('resets the panel to a clean ready state and credits no interval when capture stops early', () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/training/stair-session.vue'),
      'utf8'
    )
    const stopSource = pageSource.slice(
      pageSource.indexOf('function stopActiveCapture()'),
      pageSource.indexOf('function interruptSession()')
    )

    expect(stopSource).toContain('if (isFinishing.value) return')
    expect(stopSource).toContain('completedIntervals: 0')
    expect(stopSource).not.toContain('wasRunning')
    expect(stopSource).toContain('secondsLeft.value = 30')
    expect(stopSource).toContain("sensorStatus.value = 'ready'")
    expect(stopSource).toContain('resetLiveMetrics()')
  })

  it('updates provisional cadence twice per second without leaving a live timer behind', () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/training/stair-session.vue'),
      'utf8'
    )

    expect(pageSource).toContain('const LIVE_METRICS_INTERVAL_MS = 500')
    expect(pageSource).toContain('analysis.provisionalCadenceSpm')
    expect(pageSource).toContain('liveMetricsTimerId = setInterval(refreshLiveSnapshot, LIVE_METRICS_INTERVAL_MS)')
    expect(pageSource).toContain('clearInterval(liveMetricsTimerId)')
  })

  it('stretches the stair session card to consume the available page height above the dock', () => {
    const panelSource = readFileSync(
      resolve(process.cwd(), 'src/components/training/StairTrainingPanel.vue'),
      'utf8'
    )
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/pages/training/stair-session.vue'),
      'utf8'
    )
    const shellSource = readFileSync(
      resolve(process.cwd(), 'src/uni-app/components/training/UniTrainingPageShell.vue'),
      'utf8'
    )

    expect(pageSource).toContain(':fit-viewport="true"')
    expect(shellSource).toContain('fitViewport?: boolean')
    expect(shellSource).toContain("'training-shell--fit-viewport': props.fitViewport")
    expect(shellSource).toContain("'training-shell__inner--fit-viewport': props.fitViewport")
    expect(shellSource).toMatch(/\.training-shell--fit-viewport\s*\{[\s\S]*height:\s*100vh;/)
    expect(shellSource).toMatch(/\.training-shell--fit-viewport\s*\{[\s\S]*box-sizing:\s*border-box;/)
    expect(shellSource).toMatch(/\.training-shell__inner--fit-viewport\s*\{[\s\S]*height:\s*100%;/)
    expect(panelSource).toMatch(/\.stair-panel\s*\{[\s\S]*display:\s*flex;/)
    expect(panelSource).toMatch(/\.stair-panel\s*\{[\s\S]*height:\s*100%;/)
    expect(panelSource).toMatch(/\.stair-panel\s*\{[\s\S]*width:\s*100%;/)
    expect(panelSource).toMatch(/\.stair-panel\s*\{[\s\S]*box-sizing:\s*border-box;/)
    expect(panelSource).toMatch(/\.stair-panel__hero\s*\{[\s\S]*height:\s*100%;/)
    expect(panelSource).toMatch(/\.stair-panel__hero\s*\{[\s\S]*display:\s*flex;/)
    expect(panelSource).toMatch(/\.stair-panel__hero\s*\{[\s\S]*box-sizing:\s*border-box;/)
    expect(panelSource).toMatch(/\.stair-panel__actions\s*\{[\s\S]*margin-top:\s*auto;/)
    expect(panelSource).toContain('stair-panel__metric-strip')
    expect(panelSource).not.toContain('backdrop-filter')
    expect(panelSource).not.toContain('radial-gradient(')
    expect(panelSource).not.toContain('linear-gradient(')
    expect(panelSource).not.toContain('stair-panel__hero-mark')
    expect(panelSource).toContain("'stair-panel__primary-action--disabled': isPrimaryActionDisabled")
    expect(panelSource).not.toContain('.stair-panel__primary-action[disabled]')
    expect(panelSource).not.toContain('height: calc(100vh - 272rpx);')
  })
})
