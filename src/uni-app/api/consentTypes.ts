export interface ConsentField {
  page: number
  x: number
  y: number
  width: number
  height: number
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
  client_recognition: { method: string, text: string }
}
