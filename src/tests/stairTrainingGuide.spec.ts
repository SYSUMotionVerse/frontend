import { describe, expect, it } from 'vitest'
import {
  resolveStairTrainingInstruction,
  resolveStairTrainingStage,
  stairCompletionTtsCue,
  stairScheduledTtsCues,
  stairSprintDurationSeconds,
  stairSprintStartSeconds,
  stairTrainingDurationSeconds,
  stairTrainingStages,
  stairTrainingTtsCues
} from '../features/training/stairTrainingGuide'

describe('stair training guide', () => {
  it('models the complete five-minute protocol and sprint window', () => {
    expect(stairTrainingDurationSeconds).toBe(300)
    expect(stairSprintStartSeconds).toBe(120)
    expect(stairSprintDurationSeconds).toBe(30)
    expect(stairTrainingStages.map(stage => [stage.id, stage.startSeconds, stage.endSeconds])).toEqual([
      ['warmup', 0, 90],
      ['preparation', 90, 120],
      ['sprint', 120, 150],
      ['recovery', 150, 210],
      ['stretch', 210, 300],
      ['complete', 300, 301]
    ])
  })

  it('keeps every scheduled narration cue clear of the next cue', () => {
    expect(stairTrainingTtsCues.map(cue => cue.time)).toEqual([
      0, 45, 90, 110, 120, 135, 145, 150, 210, 240, 270, 300
    ])

    stairTrainingTtsCues.slice(0, -1).forEach((cue, index) => {
      const nextCue = stairTrainingTtsCues[index + 1]
      expect(cue.time + cue.durationSeconds).toBeLessThan(nextCue.time)
    })
    expect(stairScheduledTtsCues).toHaveLength(11)
    expect(stairCompletionTtsCue.time).toBe(300)
  })

  it('resolves the current phase and latest instruction at boundaries', () => {
    expect(resolveStairTrainingStage(89).id).toBe('warmup')
    expect(resolveStairTrainingStage(90).id).toBe('preparation')
    expect(resolveStairTrainingStage(120).id).toBe('sprint')
    expect(resolveStairTrainingStage(150).id).toBe('recovery')
    expect(resolveStairTrainingStage(210).id).toBe('stretch')
    expect(resolveStairTrainingStage(300).id).toBe('complete')
    expect(resolveStairTrainingInstruction(145)).toContain('最后5秒')
    expect(resolveStairTrainingInstruction(300)).toContain('本次练习完成')
  })
})
