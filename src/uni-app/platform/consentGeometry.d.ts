import type { ConsentField } from '../api/consentTypes'
export function consentFieldStyle(field: ConsentField, pageWidth: number, pageHeight: number, text: string,
  name?: string, layout?: Record<string, ConsentField>, signedAspect?: number): Record<string, string>
