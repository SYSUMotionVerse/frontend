import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('BlazePose external model assets', () => {
  it('downloads ignored external model assets into the action-tool cache', () => {
    const gitignore = readFileSync(resolve('.gitignore'), 'utf8')
    const prepareScript = readFileSync(
      resolve('scripts/ensure-action-tool-models.mjs'),
      'utf8'
    )

    expect(gitignore).toContain('/models/')
    expect(gitignore).toContain('.tmp/')
    expect(prepareScript).toContain("'.tmp/action-tool-models'")
    expect(prepareScript).toContain('VITE_POSE_MODEL_ARCHIVE_URL')
    expect(prepareScript).toContain("'detector/model.json'")
    expect(prepareScript).toContain("'landmark_lite/model.json'")
    expect(prepareScript).toContain('copyLocalFallback')
  })
})
