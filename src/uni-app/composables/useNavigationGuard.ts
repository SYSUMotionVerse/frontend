import { resolveStudentNextPage } from '../../domain/student/state'
import type { StudentAppState } from '../../domain/student/types'

export function resolveNextPageFromSnapshot(snapshot: StudentAppState) {
  return resolveStudentNextPage(snapshot)
}
