export interface ConsentField {
  page: number
  x: number
  y: number
  width: number
  height: number
  font_size?: number
  baseline_offset?: number
  value_only?: boolean
  layout_version?: number
  mask_padding?: number
}

export interface StudyConsentDocument {
  template_id: number
  title: string
  participant_name: string
  researcher_name: string
  date: string
  required: boolean
  pages: Array<{ url: string, width: number, height: number }>
  layout: Record<'participant' | 'researcher' | 'participant_date' | 'researcher_date', ConsentField>
}

export interface ConsentSignatureResult {
  id: string
  status: 'PENDING' | 'REJECTED' | 'VERIFIED' | 'ACCEPTED'
  image_url: string
  error: string
}

export interface ConsentSignatureInput {
  template_id: number
  client_request_id: string
  image_base64: string
  signature_token: string
  agree: true
}

export interface ConsentVerificationInput { template_id: number, image_base64: string }
export interface ConsentVerificationResult { signature_token: string }
