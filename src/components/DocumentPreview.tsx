import { useState, useEffect } from 'react'
import { FileText, Download, ExternalLink, Copy, Check, Eye, EyeOff } from 'lucide-react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Textarea } from './ui/textarea'
import { useToast } from '../hooks/use-toast'
import type { Document, SearchMatch } from '../types/document'

interface DocumentPreviewProps {
  document: Document | null
  onDocumentUpdated?: (document: Document) => void
  highlightedMatches?: SearchMatch[]
}

export function DocumentPreview({ document, onDocumentUpdated, highlightedMatches }: DocumentPreviewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [copied, setCopied] = useState(false)
  const [showHighlights, setShowHighlights] = useState(true)
  const { toast } = useToast()

  // Function to highlight matched text in the document content
  const getHighlightedContent = (content: string) => {
    if (!highlightedMatches || highlightedMatches.length === 0 || !showHighlights) {
      return content
    }

    let highlightedContent = content
    
    // Sort matches by position in reverse order to avoid position shifts
    const sortedMatches = [...highlightedMatches].sort((a, b) => b.position - a.position)
    
    for (const match of sortedMatches) {
      const before = highlightedContent.substring(0, match.position)
      const matchText = highlightedContent.substring(match.position, match.position + match.originalText.length)
      const after = highlightedContent.substring(match.position + match.originalText.length)
      
      const relevanceClass = match.relevance && match.relevance >= 8 
        ? 'bg-yellow-300 border-yellow-500' 
        : match.relevance && match.relevance >= 6 
        ? 'bg-yellow-200 border-yellow-400' 
        : 'bg-yellow-100 border-yellow-300'
      
      highlightedContent = before + 
        `<mark class="${relevanceClass} px-1 py-0.5 rounded border-l-2 font-medium" title="Relevance: ${match.relevance}/10 - ${match.reason}">${matchText}</mark>` + 
        after
    }
    
    return highlightedContent
  }

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-medium">No document selected</h3>
            <p className="text-sm text-muted-foreground">
              Select a document from the library to preview its content
            </p>
          </div>
        </div>
      </div>
    )
  }

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(document.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: "Content copied",
        description: "Document content copied to clipboard"
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy content to clipboard",
        variant: "destructive"
      })
    }
  }

  const handleDownload = () => {
    if (document.url) {
      const link = window.document.createElement('a')
      link.href = document.url
      link.download = document.name
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
    }
  }

  const handleEdit = () => {
    setEditedContent(document.content)
    setIsEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!document || !editedContent.trim()) return
    
    try {
      // Update document content
      const updatedDocument = {
        ...document,
        content: editedContent,
        uploadedAt: new Date() // Update timestamp
      }
      
      // Try to save to database
      try {
        await blink.db.documents.update(document.id, {
          content: editedContent,
          updatedAt: new Date()
        })
        console.log('Document updated in database:', document.id)
      } catch (dbError) {
        console.warn('Could not update document in database:', dbError)
        // Continue without database - document will still work in memory
      }
      
      // Notify parent component of the update
      if (onDocumentUpdated) {
        onDocumentUpdated(updatedDocument)
      }
      
      setIsEditing(false)
      toast({
        title: "Changes saved",
        description: "Document content has been updated"
      })
    } catch (error) {
      console.error('Error saving document:', error)
      toast({
        title: "Save failed",
        description: "Could not save document changes",
        variant: "destructive"
      })
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedContent('')
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusColor = (status: Document['status']) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{document.name}</h2>
            <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
              <span>{formatFileSize(document.size)}</span>
              <span>•</span>
              <span>Uploaded {document.uploadedAt.toLocaleDateString()}</span>
            </div>
          </div>
          <Badge className={getStatusColor(document.status)}>
            {document.status}
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          {highlightedMatches && highlightedMatches.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowHighlights(!showHighlights)}
            >
              {showHighlights ? (
                <EyeOff className="w-4 h-4 mr-2" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              {showHighlights ? 'Hide' : 'Show'} Highlights
            </Button>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyContent}
            disabled={document.status !== 'ready'}
          >
            {copied ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            {copied ? 'Copied!' : 'Copy Content'}
          </Button>
          
          {document.url && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
          
          {document.url && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(document.url, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {document.status === 'ready' ? (
          <div className="h-full p-4">
            {isEditing ? (
              <div className="h-full flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Edit Content</h3>
                  <div className="space-x-2">
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit}>
                      Save Changes
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="flex-1 min-h-0 resize-none font-mono text-sm"
                  placeholder="Document content..."
                />
              </div>
            ) : (
              <div className="h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Content Preview</h3>
                  <Button size="sm" variant="outline" onClick={handleEdit}>
                    Edit Content
                  </Button>
                </div>
                <Card className="h-full">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      {highlightedMatches && highlightedMatches.length > 0 && showHighlights ? (
                        <div 
                          className="whitespace-pre-wrap text-sm font-mono leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: getHighlightedContent(document.content || 'No content available')
                          }}
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                          {document.content || 'No content available'}
                        </pre>
                      )}
                    </div>
                  </ScrollArea>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center space-y-2">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
              <h3 className="font-medium">
                {document.status === 'processing' ? 'Processing document...' : 
                 document.status === 'error' ? 'Error processing document' :
                 'Document not ready'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {document.status === 'processing' ? 'Please wait while we extract the content' :
                 document.status === 'error' ? 'There was an error processing this document' :
                 'Document is still being uploaded'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}