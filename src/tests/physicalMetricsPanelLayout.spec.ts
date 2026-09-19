import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PhysicalMetricsPanel from '../components/growth/PhysicalMetricsPanel.vue'

describe('physical metrics comparison layout', () => {
  it('uses a 1:1:1.5 column ratio and keeps change values on one line', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/growth/PhysicalMetricsPanel.vue'),
      'utf8'
    )

    expect(source).toMatch(/\.metric-card__column\s*\{[^}]*flex:\s*1 1 0;/)
    expect(source).toMatch(/\.metric-card__column--change\s*\{[^}]*flex:\s*1\.5 1 0;/)
    expect(source).toMatch(
      /\.metric-card__column--change \.metric-card__value\s*\{[^}]*white-space:\s*nowrap;/
    )
  })

  it('prefixes non-empty units and omits an empty unit label', () => {
    const wrapper = mount(PhysicalMetricsPanel, {
      props: {
        metricsState: {
          hasMetrics: true,
          metrics: [
            { label: '肺活量', unit: 'ml', values: [2600, 2750] },
            { label: '往返跑', unit: '  ', values: [12, 13] }
          ]
        }
      }
    })

    expect(wrapper.findAll('.metric-card__unit')).toHaveLength(1)
    expect(wrapper.get('.metric-card__unit').text()).toBe('单位：ml')
  })
})
