import type { TrainingModality } from '../../types/student'

export function isTrainingAllowed(profile: { allowedModalities?: readonly TrainingModality[] }, modality: TrainingModality) {
  return profile.allowedModalities === undefined || profile.allowedModalities.includes(modality)
}

export function showTrainingGroupDenied() {
  void uni.showToast({ title: '您所在组别未开放此训练形式', icon: 'none' })
}
