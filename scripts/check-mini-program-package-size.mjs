import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { relative, resolve, sep } from 'node:path'

export const MAIN_PACKAGE_WARNING_LIMIT_BYTES = 1500 * 1024

export async function measureMiniProgramPackage(outputDirectory) {
  const absoluteOutputDirectory = resolve(outputDirectory)
  const appManifest = JSON.parse(
    await readFile(resolve(absoluteOutputDirectory, 'app.json'), 'utf8'),
  )
  const subpackageRoots = (appManifest.subPackages ?? appManifest.subpackages ?? [])
    .map(subpackage => normalizeRelativePath(subpackage.root))
    .filter(Boolean)
  const files = await collectFiles(absoluteOutputDirectory)
  const subpackages = subpackageRoots.map(root => ({ root, bytes: 0 }))
  let mainPackageBytes = 0
  let totalBytes = 0

  for (const file of files) {
    const relativePath = normalizeRelativePath(
      relative(absoluteOutputDirectory, file.path),
    )
    totalBytes += file.bytes
    const subpackage = subpackages.find(({ root }) =>
      relativePath === root || relativePath.startsWith(`${root}/`),
    )

    if (subpackage) {
      subpackage.bytes += file.bytes
    } else {
      mainPackageBytes += file.bytes
    }
  }

  return { mainPackageBytes, totalBytes, subpackages }
}

export function assertMainPackageSize(
  measurement,
  limitBytes = MAIN_PACKAGE_WARNING_LIMIT_BYTES,
) {
  if (measurement.mainPackageBytes > limitBytes) {
    throw new Error(
      `Main package is ${formatKilobytes(measurement.mainPackageBytes)} KB and exceeds the release limit of ${formatKilobytes(limitBytes)} KB`,
    )
  }
}

export function formatPackageMeasurement(measurement) {
  const lines = [
    `Main package: ${formatKilobytes(measurement.mainPackageBytes)} KB / ${formatKilobytes(MAIN_PACKAGE_WARNING_LIMIT_BYTES)} KB release limit`,
    `Complete bundle: ${formatKilobytes(measurement.totalBytes)} KB`,
  ]
  for (const subpackage of measurement.subpackages) {
    lines.push(
      `Subpackage ${subpackage.root}: ${formatKilobytes(subpackage.bytes)} KB`,
    )
  }
  return lines.join('\n')
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(path))
    } else if (entry.isFile()) {
      files.push({ path, bytes: (await stat(path)).size })
    }
  }

  return files
}

function normalizeRelativePath(path) {
  return path.split(sep).join('/').replace(/^\.\//, '').replace(/\/$/, '')
}

function formatKilobytes(bytes) {
  return (bytes / 1024).toFixed(2).replace(/\.00$/, '')
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  const outputDirectory = resolve(
    process.argv[2] ?? 'dist/build/mp-weixin',
  )
  try {
    const measurement = await measureMiniProgramPackage(outputDirectory)
    console.log(formatPackageMeasurement(measurement))
    assertMainPackageSize(measurement)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
