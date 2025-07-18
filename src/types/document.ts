export interface Document {
  id: string
  name: string
  type: 'pdf' | 'docx' | 'pptx' | 'pages' | 'txt' | 'other'
  size: number
  uploadedAt: Date
  content: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  url?: string
}

export interface SearchResult {
  documentId: string
  documentName: string
  matches: SearchMatch[]
}

export interface SearchMatch {
  id: string
  originalText: string
  context: string
  position: number
  line: number
  selected: boolean
  relevance?: number
  reason?: string
  suggestedReplacement?: string
  contextualReplacement?: string
  approved?: boolean
}

export interface ReplacementOperation {
  documentId: string
  matches: SearchMatch[]
  replacementText: string
  preserveContext: boolean
  preserveTense: boolean
}

export interface ProcessingStatus {
  total: number
  completed: number
  current?: string
  errors: string[]
}

export interface ReplacementPreview {
  documentId: string
  documentName: string
  matches: SearchMatch[]
  previewContent: string
}

export interface ReviewState {
  isReviewing: boolean
  previews: ReplacementPreview[]
  currentPreviewIndex: number
}