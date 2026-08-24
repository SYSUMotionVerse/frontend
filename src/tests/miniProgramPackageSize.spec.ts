import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MAIN_PACKAGE_WARNING_LIMIT_BYTES,
  assertMainPackageSize,
  measureMiniProgramPackage,
} from '../../scripts/check-mini-program-package-size.mjs'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(path => rm(path, { recursive: true })),
  )
})

describe('mini-program package size', () => {
  it('excludes generated subpackage files from the main package total', async () => {
    const outputDirectory = await createOutputDirectory()
    await writeSizedFile(join(outputDirectory, 'common/vendor.js'), 1200)
    await writeSizedFile(
      join(outputDirectory, 'subpackages/training/visual-session.js'),
      800,
    )

    const measurement = await measureMiniProgramPackage(outputDirectory)
    const appManifestSize = (await stat(join(outputDirectory, 'app.json'))).size

    expect(measurement.totalBytes).toBeGreaterThan(measurement.mainPackageBytes)
    expect(measurement.mainPackageBytes).toBe(1200 + appManifestSize)
    expect(measurement.subpackages).toEqual([
      { root: 'subpackages/training', bytes: 800 },
    ])
  })

  it('fails before the WeChat hard limit leaves too little upload headroom', () => {
    expect(() =>
      assertMainPackageSize({
        mainPackageBytes: MAIN_PACKAGE_WARNING_LIMIT_BYTES + 1,
        totalBytes: MAIN_PACKAGE_WARNING_LIMIT_BYTES + 1,
        subpackages: [],
      }),
    ).toThrow('exceeds the release limit of 1500 KB')
  })
})

async function createOutputDirectory() {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'sport-snack-package-'))
  temporaryDirectories.push(outputDirectory)
  await writeFile(
    join(outputDirectory, 'app.json'),
    JSON.stringify({
      pages: ['pages/index'],
      subPackages: [{ root: 'subpackages/training', pages: ['visual-session'] }],
    }),
  )
  return outputDirectory
}

async function writeSizedFile(path: string, size: number) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, 'x'.repeat(size))
}
