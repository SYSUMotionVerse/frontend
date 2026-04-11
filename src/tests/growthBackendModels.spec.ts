import { describe, expect, it } from 'vitest'

describe('growth backend read models', () => {
  it('merges exercise and stairs records into a sorted training history model', async () => {
    const { mapBackendTrainingHistory } = await import('../uni-app/api/growthBackendModels')

    expect(
      mapBackendTrainingHistory(
        [
          {
            id: 1,
            video: 7,
            duration: 30,
            score: 88.5,
            comment: '动作基本标准，注意细节。',
            status: 'COMPLETED',
            created_at: '2026-04-11T10:00:00Z',
            video_info: {
              id: 7,
              title: '马步冲拳',
              exercise_type: 'MARTIAL_ARTS'
            }
          }
        ],
        [
          {
            id: 2,
            duration: 26,
            speed_data: {
              completedIntervals: 1
            },
            acceleration_data: {
              qualityScore: 81,
              summary: '节奏稳定。'
            },
            created_at: '2026-04-11T11:00:00Z'
          }
        ]
      )
    ).toEqual([
      {
        id: 'stair-2',
        modality: 'stair',
        date: '2026-04-11',
        summary: '节奏稳定。',
        qualityScore: 81
      },
      {
        id: 'visual-1',
        modality: 'wushu',
        date: '2026-04-11',
        summary: '动作基本标准，注意细节。',
        qualityScore: 89
      }
    ])
  })

  it('maps backend psychology records into growth assessment history entries', async () => {
    const { mapBackendAssessmentHistory } = await import('../uni-app/api/growthBackendModels')

    expect(
      mapBackendAssessmentHistory([
        {
          id: 9,
          total_score: 6,
          analysis: '心理状态正常，建议保持规律运动。',
          completed_at: '2026-04-11T12:00:00Z',
          scale_info: {
            id: 1,
            title: '运动心理健康量表（第1次）',
            description: '评估运动对心理健康的影响',
            order: 1,
            created_at: '2026-04-11T08:00:00Z',
            questions: [
              {
                id: 11,
                question_text: '您最近一周的运动频率如何？',
                question_type: 'SINGLE',
                order: 1,
                options: [
                  { id: 101, option_text: '每天都运动', score: 5, order: 1 },
                  { id: 102, option_text: '3-5天', score: 4, order: 2 }
                ]
              },
              {
                id: 12,
                question_text: '运动后您的心情如何？',
                question_type: 'SINGLE',
                order: 2,
                options: [
                  { id: 103, option_text: '非常愉悦', score: 5, order: 1 },
                  { id: 104, option_text: '比较愉悦', score: 4, order: 2 }
                ]
              }
            ]
          }
        }
      ])
    ).toEqual([
      {
        checkpoint: 'baseline',
        title: '运动心理健康量表（第1次）',
        score: 6,
        percentage: 60,
        submittedAt: '2026-04-11T12:00:00Z'
      }
    ])
  })

  it('maps backend physical trend data into the panel metric format', async () => {
    const { mapBackendPhysicalMetrics } = await import('../uni-app/api/growthBackendModels')

    expect(
      mapBackendPhysicalMetrics({
        trend: [
          {
            test_round: 1,
            test_date: '2026-03-01',
            bmi: 19.4,
            body_fat_rate: 17.2,
            vital_capacity: 2600,
            fifty_meter_run: 9.1,
            standing_long_jump: 165,
            sit_and_reach: 13.5,
            one_minute_sit_ups: 36,
            pull_ups: null,
            eight_hundred_meter_run: 230,
            thousand_meter_run: null,
            grip_strength: 24.5
          },
          {
            test_round: 2,
            test_date: '2026-04-01',
            bmi: 19.1,
            body_fat_rate: 16.8,
            vital_capacity: 2750,
            fifty_meter_run: 8.9,
            standing_long_jump: 171,
            sit_and_reach: 15,
            one_minute_sit_ups: 40,
            pull_ups: null,
            eight_hundred_meter_run: 224,
            thousand_meter_run: null,
            grip_strength: 25.3
          }
        ],
        total_tests: 2
      })
    ).toEqual([
      {
        label: 'BMI',
        unit: '',
        values: [19.4, 19.1]
      },
      {
        label: '肺活量',
        unit: 'ml',
        values: [2600, 2750]
      },
      {
        label: '50 米跑',
        unit: 's',
        values: [9.1, 8.9]
      },
      {
        label: '立定跳远',
        unit: 'cm',
        values: [165, 171]
      },
      {
        label: '坐位体前屈',
        unit: 'cm',
        values: [13.5, 15]
      },
      {
        label: '1 分钟仰卧起坐',
        unit: '次',
        values: [36, 40]
      },
      {
        label: '800 米跑',
        unit: 's',
        values: [230, 224]
      },
      {
        label: '握力',
        unit: 'kg',
        values: [24.5, 25.3]
      }
    ])
  })
})
