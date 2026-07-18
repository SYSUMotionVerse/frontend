import { describe, expect, it } from 'vitest'
import { validateReleaseConfig } from '../../scripts/release-config.mjs'

describe('release configuration', () => {
  it('accepts HTTPS API and OSS model origins', () => {
    expect(
      validateReleaseConfig({
        VITE_API_BASE_URL: 'https://api.sport-snack.cn/api',
        VITE_POSE_MODEL_BASE_URL:
          'https://models.sport-snack.cn/pose/blazepose-lite-v1',
        VITE_POSE_MODEL_VERSION: 'blazepose-lite-v1',
      }),
    ).toEqual([])
  })

  it('rejects missing, local, or insecure production endpoints', () => {
    expect(
      validateReleaseConfig({
        VITE_API_BASE_URL: 'http://119.91.74.187/api',
        VITE_POSE_MODEL_BASE_URL: 'http://127.0.0.1:8765',
        VITE_POSE_MODEL_VERSION: '',
      }),
    ).toEqual([
      'VITE_API_BASE_URL must use HTTPS for a production mini-program',
      'VITE_API_BASE_URL must use a registrable domain instead of an IP address',
      'VITE_POSE_MODEL_BASE_URL must use HTTPS for a production mini-program',
      'VITE_POSE_MODEL_BASE_URL must use a registrable domain instead of an IP address',
      'VITE_POSE_MODEL_BASE_URL must not point to a local host',
      'VITE_POSE_MODEL_VERSION is required',
    ])
  })

  it('rejects HTTPS IP literals because WeChat requires a legal domain', () => {
    expect(
      validateReleaseConfig({
        VITE_API_BASE_URL: 'https://119.91.74.187/api',
        VITE_POSE_MODEL_BASE_URL: 'https://[2001:db8::1]/pose',
        VITE_POSE_MODEL_VERSION: 'blazepose-lite-v1',
      }),
    ).toEqual([
      'VITE_API_BASE_URL must use a registrable domain instead of an IP address',
      'VITE_POSE_MODEL_BASE_URL must use a registrable domain instead of an IP address',
    ])
  })

  it('rejects example placeholder domains', () => {
    expect(
      validateReleaseConfig({
        VITE_API_BASE_URL: 'https://api.example.com/api',
        VITE_POSE_MODEL_BASE_URL:
          'https://models.example.com/pose/blazepose-lite-v1',
        VITE_POSE_MODEL_VERSION: 'blazepose-lite-v1',
      }),
    ).toEqual([
      'VITE_API_BASE_URL must not use the example placeholder domain',
      'VITE_POSE_MODEL_BASE_URL must not use the example placeholder domain',
    ])
  })
})
