export interface MiniProgramSubpackageMeasurement {
  root: string
  bytes: number
}

export interface MiniProgramPackageMeasurement {
  mainPackageBytes: number
  totalBytes: number
  subpackages: MiniProgramSubpackageMeasurement[]
}

export const MAIN_PACKAGE_WARNING_LIMIT_BYTES: number

export function measureMiniProgramPackage(
  outputDirectory: string,
): Promise<MiniProgramPackageMeasurement>

export function assertMainPackageSize(
  measurement: MiniProgramPackageMeasurement,
  limitBytes?: number,
): void

export function formatPackageMeasurement(
  measurement: MiniProgramPackageMeasurement,
): string
