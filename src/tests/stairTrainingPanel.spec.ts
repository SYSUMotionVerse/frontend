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
  it('renders the redesigned training hero with four core metric tiles', () => {
    const wrapper = mountPanel()

    expect(wrapper.find('.stair-panel__hero').exists()).toBe(true)
    expect(wrapper.find('.stair-panel__countdown-card').exists()).toBe(true)
    expect(wrapper.find('.stair-panel__sensor-chip').exists()).toBe(true)
    expect(wrapper.findAll('.stair-panel__metric-card')).toHaveLength(4)
    expect(wrapper.text()).toContain('阶梯冲刺')
    expect(wrapper.text()).toContain('18')
    expect(wrapper.text()).toContain('126.4')
    expect(wrapper.text()).toContain('38')
    expect(wrapper.text()).toContain('0.47')
    expect(wrapper.text()).toContain('3.2')
    expect(wrapper.text()).toContain('采集中')
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

    expect(wrapper.find('.stair-panel__hero-support').text()).toContain('等待开始')
    expect(wrapper.find('.stair-panel__primary-action').text()).toContain('开始训练')
    expect(wrapper.text()).toContain('传感器就绪')
    expect(wrapper.text()).toContain('等待开始')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
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
    expect(panelSource).not.toContain('height: calc(100vh - 272rpx);')
  })
})
