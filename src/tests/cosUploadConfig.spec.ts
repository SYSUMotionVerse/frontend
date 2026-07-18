// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { loadEnv } from 'vite'
import {
  poseModelFiles,
  resolveCosUploadConfig
} from '../../scripts/cos-upload-config.mjs'

describe('COS pose-model upload configuration', () => {
  const environment = loadEnv('', process.cwd(), '')

  it('loads deployment values from the ignored local environment file', () => {
    const config = resolveCosUploadConfig(environment)
    const required = [
      'COS_REGION',
      'COS_BUCKET',
      'COS_SECRET_ID',
      'COS_SECRET_KEY',
      'COS_PUBLIC_BASE_URL'
    ]
    const expectedMissing = required.filter(name => !environment[name]?.trim())

    expect(config.missing).toEqual(expectedMissing)
    expect(config.region).toBe(environment.COS_REGION?.trim() ?? '')
    expect(config.bucket).toBe(environment.COS_BUCKET?.trim() ?? '')
    expect(config.publicBaseUrl).toBe(
      environment.COS_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
    )
    expect(config.prefix).toBe(environment.COS_MODEL_PREFIX?.trim() || 'pose')
    expect(config.version).toBe(
      environment.POSE_MODEL_VERSION?.trim() || 'blazepose-lite-v1'
    )
    expect(poseModelFiles).toHaveLength(5)
  })
})
