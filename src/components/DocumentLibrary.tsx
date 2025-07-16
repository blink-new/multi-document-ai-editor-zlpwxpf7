import { useState } from 'react'
import { FileText, File, Presentation, FileImage, Trash2, Eye, Download } from 'lucide-react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { useToast } from '../hooks/use-toast'
import type { Document } from '../types/document'

interface DocumentLibraryProps {
  documents: Document[]
  selectedDocument?: Document
  onDocumentSelect: (document: Document) => void
  onDocumentDelete: (documentId: string) => void
}

const getFileIcon = (type: Document['type']) => {
  switch (type) {
    case 'pdf':
      return <FileText className="w-4 h-4 text-red-500" />
    case 'docx':
      return <File className="w-4 h-4 text-blue-500" />
    case 'pptx':
      return <Presentation className="w-4 h-4 text-orange-500" />
    case 'txt':
      return <FileText className="w-4 h-4 text-gray-500" />
    case 'pages':
      return <File className="w-4 h-4 text-blue-600" />
    default:
      return <FileImage className="w-4 h-4 text-purple-500" />
  }
}

const getStatusBadge = (document: Document) => {
  switch (document.status) {
    case 'uploading':
      return <Badge variant="secondary">Uploading</Badge>
    case 'processing':
      return <Badge variant="secondary">Processing</Badge>
    case 'ready':
      // Check if content is searchable
      if (document.content.includes('Content extraction failed') || 
          document.content.includes('Content extraction not supported') ||
          document.content.includes('Content extraction returned minimal text') ||
          document.content.trim().length < 20) {
        return <Badge variant="outline" className="text-orange-600 border-orange-300">File Only</Badge>
      }
      return <Badge variant="default" className="bg-green-100 text-green-800">Searchable</Badge>
    case 'error':
      return <Badge variant="destructive">Error</Badge>
    default:
      return null
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function DocumentLibrary({ 
  documents, 
  selectedDocument, 
  onDocumentSelect, 
  onDocumentDelete 
}: DocumentLibraryProps) {
  const [hoveredDoc, setHoveredDoc] = useState<string | null>(null)
  const { toast } = useToast()

  const handleDownload = async (document: Document) => {
    if (document.url) {
      try {
        const link = window.document.createElement('a')
        link.href = document.url
        link.download = document.name
        window.document.body.appendChild(link)
        link.click()
        window.document.body.removeChild(link)
        
        toast({
          title: "Download started",
          description: `Downloading ${document.name}`
        })
      } catch (error) {
        toast({
          title: "Download failed",
          description: "Could not download the file",
          variant: "destructive"
        })
      }
    }
  }

  const handleDelete = (documentId: string) => {
    onDocumentDelete(documentId)
    toast({
      title: "Document deleted",
      description: "Document has been removed from your library"
    })
  }

  if (documents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No documents uploaded</p>
          <p className="text-xs text-muted-foreground">Upload documents to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Document Library</h2>
        <p className="text-sm text-muted-foreground">{documents.length} document(s)</p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {documents.map((document) => (
            <Card
              key={document.id}
              className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                selectedDocument?.id === document.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => onDocumentSelect(document)}
              onMouseEnter={() => setHoveredDoc(document.id)}
              onMouseLeave={() => setHoveredDoc(null)}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {getFileIcon(document.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{document.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(document.size)}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(document)}
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Uploaded {document.uploadedAt.toLocaleDateString()}
                </div>
                
                {hoveredDoc === document.id && document.status === 'ready' && (
                  <div className="flex items-center space-x-1 pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDocumentSelect(document)
                      }}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(document)
                      }}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(document.id)
                      }}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}