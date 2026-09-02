import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PoseAngleFrame } from '../uni-app/components/pose/poseAnalysis'
import {
  buildMissingPoseActionResult,
  buildSessionScoringResult,
  sampleActionPoseSegmentsForUpload,
  samplePoseFramesForUpload
} from '../subpackages/training/composables/useVisualTrainingSession'

function frame(tsMs: number): PoseAngleFrame {
  return {
    tsMs,
    angles: {}
  }
}

describe('visual session resilience', () => {
  it('records a complete zero-score action when no usable pose was captured', () => {
    const result = buildMissingPoseActionResult({
      id: 11,
      video_id: 21,
      expected_duration: 15,
      video: { title: 'No-camera action' }
    }, { action_id: 'standard-action-11' }, 0)

    expect(result).toEqual({
      itemId: 11,
      videoId: 21,
      actionId: 'standard-action-11',
      title: 'No-camera action',
      expectedDuration: 15,
      score: 0,
      passed: false,
      feedback: [],
      angleDetails: {},
      frameCount: 0
    })
  })

  it('keeps a session unscored when frames exist but none contain usable body angles', () => {
    const missing = buildMissingPoseActionResult({
      id: 11,
      video_id: 21,
      expected_duration: 15,
      video: { title: 'No usable body' }
    }, { action_id: 'standard-action-11' }, 3)

    expect(buildSessionScoringResult([missing], [], [11])).toEqual({
      score: undefined,
      summary: '未识别到人体，暂无评分',
      scoreDetails: undefined,
      scoreUnavailableReason: '未识别到人体，暂无评分'
    })
  })

  it('downsamples large uploads evenly while preserving both boundaries', () => {
    const frames = Array.from({ length: 101 }, (_, index) => frame(index))
    const sampled = samplePoseFramesForUpload(frames, 10)

    expect(sampled).toHaveLength(10)
    expect(sampled[0]?.tsMs).toBe(0)
    expect(sampled.at(-1)?.tsMs).toBe(100)
    expect(new Set(sampled.map(item => item.tsMs)).size).toBe(10)
  })

  it('retains action identity while allocating upload frames across segments', () => {
    const sampled = sampleActionPoseSegmentsForUpload([
      { itemId: 11, videoId: 21, frames: Array.from({ length: 10 }, (_, index) => frame(index)) },
      { itemId: 12, videoId: 22, frames: Array.from({ length: 10 }, (_, index) => frame(100 + index)) }
    ], 6)

    expect(sampled).toHaveLength(6)
    expect(sampled.slice(0, 3).map(item => item.arrangementItemId)).toEqual([11, 11, 11])
    expect(sampled.slice(3).map(item => item.arrangementItemId)).toEqual([12, 12, 12])
    expect(sampled.slice(3).map(item => item.actionFrameIndex)).toEqual([0, 1, 2])
  })

  it('wires page hide/show/unload and native back into the session controller', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/visual-session.vue'),
      'utf8'
    )
    const session = readFileSync(
      resolve(process.cwd(), 'src/subpackages/training/composables/useVisualTrainingSession.ts'),
      'utf8'
    )

    expect(page).toContain('onHide(() =>')
    expect(page).toContain('session.suspendSession()')
    expect(page).toContain('session.resumeSession()')
    expect(page).toContain('session.disposeSession()')
    expect(page).toContain('onBackPress(() =>')
    expect(session).toContain('function resumeTimerDrivenPhase()')
    expect(session).toContain('if (disposed || sessionStopping || sessionSuspended || requestId !== videoRequestId')
  })
})
