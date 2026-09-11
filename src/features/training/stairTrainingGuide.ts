import type { ActionTtsCue } from '../../domain/training/actionScoringTypes'

export const stairTrainingDurationSeconds = 300
export const stairSprintStartSeconds = 120
export const stairSprintDurationSeconds = 30

export const stairTrainingSafetyNotice = '确认楼梯照明良好、台阶完整、无明显障碍物且人流较少。训练中如出现头晕、胸闷、心悸、明显气短、关节疼痛或其他不适，立即停止训练并反馈研究人员。'

export type StairTrainingStageId =
  | 'warmup'
  | 'preparation'
  | 'sprint'
  | 'recovery'
  | 'stretch'
  | 'complete'

export interface StairTrainingStage {
  id: StairTrainingStageId
  label: string
  startSeconds: number
  endSeconds: number
}

export interface StairTrainingTtsCue extends ActionTtsCue {
  durationSeconds: number
}

const stairAudioBaseUrl = 'https://cdn.sysusports.cn/training-tts/stairs/es-5min-v1'

export const stairTrainingStages: readonly StairTrainingStage[] = [
  { id: 'warmup', label: '快走热身', startSeconds: 0, endSeconds: 90 },
  { id: 'preparation', label: '爬楼准备', startSeconds: 90, endSeconds: 120 },
  { id: 'sprint', label: '快速爬楼', startSeconds: 120, endSeconds: 150 },
  { id: 'recovery', label: '缓步恢复', startSeconds: 150, endSeconds: 210 },
  { id: 'stretch', label: '拉伸放松', startSeconds: 210, endSeconds: 300 },
  { id: 'complete', label: '训练完成', startSeconds: 300, endSeconds: 301 }
]

export const stairTrainingTtsCues: readonly StairTrainingTtsCue[] = [
  {
    time: 0,
    text: '练习开始，先进行热身。快走或轻微步行，保持自然呼吸。',
    audio_url: `${stairAudioBaseUrl}/01-000s.mp3`,
    durationSeconds: 6.288
  },
  {
    time: 45,
    text: '继续快走，逐渐提高心率，做好爬楼准备。',
    audio_url: `${stairAudioBaseUrl}/02-045s.mp3`,
    durationSeconds: 4.344
  },
  {
    time: 90,
    text: '热身完成。调整呼吸，来到楼梯起点，准备快速爬楼。',
    audio_url: `${stairAudioBaseUrl}/03-090s.mp3`,
    durationSeconds: 6
  },
  {
    time: 110,
    text: '注意脚下，原则上一步一阶。准备，3、2、1。',
    audio_url: `${stairAudioBaseUrl}/04-110s.mp3`,
    durationSeconds: 5.664
  },
  {
    time: 120,
    text: 'Go！快速爬楼，保持目标强度和稳定节奏。',
    audio_url: `${stairAudioBaseUrl}/05-120s.mp3`,
    durationSeconds: 5.184
  },
  {
    time: 135,
    text: '还剩15秒，注意脚下，保持节奏。',
    audio_url: `${stairAudioBaseUrl}/06-135s.mp3`,
    durationSeconds: 3.792
  },
  {
    time: 145,
    text: '最后5秒，5、4、3、2、1。',
    audio_url: `${stairAudioBaseUrl}/07-145s.mp3`,
    durationSeconds: 4.128
  },
  {
    time: 150,
    text: '冲刺结束，转为缓步恢复，调整呼吸。',
    audio_url: `${stairAudioBaseUrl}/08-150s.mp3`,
    durationSeconds: 4.176
  },
  {
    time: 210,
    text: '开始拉伸。先放松小腿，动作缓慢，保持稳定。',
    audio_url: `${stairAudioBaseUrl}/09-210s.mp3`,
    durationSeconds: 5.496
  },
  {
    time: 240,
    text: '大腿前侧拉伸，自然呼吸。',
    audio_url: `${stairAudioBaseUrl}/10-240s.mp3`,
    durationSeconds: 3.048
  },
  {
    time: 270,
    text: '臀部拉伸，保持舒适幅度。',
    audio_url: `${stairAudioBaseUrl}/11-270s.mp3`,
    durationSeconds: 3.048
  },
  {
    time: 300,
    text: '本次练习完成。继续缓步放松，适量补水。',
    audio_url: `${stairAudioBaseUrl}/12-300s.mp3`,
    durationSeconds: 4.896
  }
]

export const stairScheduledTtsCues: readonly ActionTtsCue[] = stairTrainingTtsCues
  .filter(cue => cue.time < stairTrainingDurationSeconds)
  .map(({ time, text, audio_url }) => ({ time, text, audio_url }))

export const stairCompletionTtsCue = stairTrainingTtsCues.at(-1)!

export function resolveStairTrainingStage(elapsedSeconds: number) {
  const elapsed = Number.isFinite(elapsedSeconds)
    ? Math.max(0, Math.min(stairTrainingDurationSeconds, elapsedSeconds))
    : 0

  return stairTrainingStages.find(stage => (
    elapsed >= stage.startSeconds && elapsed < stage.endSeconds
  )) ?? stairTrainingStages.at(-1)!
}

export function resolveStairTrainingInstruction(elapsedSeconds: number) {
  const elapsed = Number.isFinite(elapsedSeconds)
    ? Math.max(0, Math.min(stairTrainingDurationSeconds, elapsedSeconds))
    : 0

  return stairTrainingTtsCues
    .filter(cue => cue.time <= elapsed)
    .at(-1)?.text ?? stairTrainingTtsCues[0].text
}
