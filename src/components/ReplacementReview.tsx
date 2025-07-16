import { useState } from 'react'
import { Check, X, ChevronLeft, ChevronRight, Eye, FileText, AlertTriangle, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Alert, AlertDescription } from './ui/alert'
import type { ReplacementPreview, SearchMatch } from '../types/document'

interface ReplacementReviewProps {
  previews: ReplacementPreview[]
  currentIndex: number
  onIndexChange: (index: number) => void
  onApprove: (documentId: string, matchId: string) => void
  onReject: (documentId: string, matchId: string) => void
  onEditReplacement: (documentId: string, matchId: string, newReplacement: string) => void
  onApproveAll: () => void
  onRejectAll: () => void
  onClose: () => void
}

export function ReplacementReview({
  previews,
  currentIndex,
  onIndexChange,
  onApprove,
  onReject,
  onEditReplacement,
  onApproveAll,
  onRejectAll,
  onClose
}: ReplacementReviewProps) {
  const [editingMatch, setEditingMatch] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  if (previews.length === 0) return null

  const currentPreview = previews[currentIndex]
  const totalMatches = previews.reduce((sum, preview) => sum + preview.matches.length, 0)
  const approvedMatches = previews.reduce((sum, preview) => 
    sum + preview.matches.filter(match => match.approved === true).length, 0
  )
  const rejectedMatches = previews.reduce((sum, preview) => 
    sum + preview.matches.filter(match => match.approved === false).length, 0
  )

  const handleEditStart = (match: SearchMatch) => {
    setEditingMatch(match.id)
    setEditText(match.contextualReplacement || match.suggestedReplacement || '')
  }

  const handleEditSave = (match: SearchMatch) => {
    onEditReplacement(currentPreview.documentId, match.id, editText)
    setEditingMatch(null)
    setEditText('')
  }

  const handleEditCancel = () => {
    setEditingMatch(null)
    setEditText('')
  }

  const getHighlightedPreview = (content: string, matches: SearchMatch[]) => {
    let highlightedContent = content
    
    // Sort matches by position in reverse order to avoid position shifts
    const sortedMatches = [...matches].sort((a, b) => b.position - a.position)
    
    for (const match of sortedMatches) {
      const before = highlightedContent.substring(0, match.position)
      const matchText = highlightedContent.substring(match.position, match.position + match.originalText.length)
      const after = highlightedContent.substring(match.position + match.originalText.length)
      
      const statusClass = match.approved === true 
        ? 'bg-green-200 border-green-500 text-green-900' 
        : match.approved === false 
        ? 'bg-red-200 border-red-500 text-red-900'
        : 'bg-blue-200 border-blue-500 text-blue-900'
      
      const replacement = match.contextualReplacement || match.suggestedReplacement || matchText
      
      highlightedContent = before + 
        `<span class="${statusClass} px-2 py-1 rounded border-l-4 font-medium relative group" data-match-id="${match.id}">
          <span class="line-through opacity-60">${matchText}</span>
          <span class="ml-2 font-bold">${replacement}</span>
          <span class="absolute -top-8 left-0 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
            ${match.approved === true ? 'Approved' : match.approved === false ? 'Rejected' : 'Pending Review'}
          </span>
        </span>` + 
        after
    }
    
    return highlightedContent
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-6 h-6 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Review AI Replacements</h2>
                <p className="text-sm text-muted-foreground">
                  Review and approve contextual replacements before applying
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Progress and Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="text-sm">
                Document {currentIndex + 1} of {previews.length}
              </Badge>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>{approvedMatches} approved</span>
                </span>
                <span className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>{rejectedMatches} rejected</span>
                </span>
                <span className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>{totalMatches - approvedMatches - rejectedMatches} pending</span>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onIndexChange(Math.min(previews.length - 1, currentIndex + 1))}
                disabled={currentIndex === previews.length - 1}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex min-h-0">
          {/* Left Panel - Match List */}
          <div className="w-96 border-r bg-muted/30">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                {currentPreview.documentName}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {currentPreview.matches.length} replacements to review
              </p>
            </div>

            <ScrollArea className="h-[calc(100%-80px)]">
              <div className="p-4 space-y-3">
                {currentPreview.matches.map((match, index) => (
                  <Card key={match.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          Line {match.line}
                        </Badge>
                        <div className="flex items-center space-x-1">
                          {match.relevance && (
                            <Badge 
                              variant={match.relevance >= 8 ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {match.relevance}/10
                            </Badge>
                          )}
                          {match.approved === true && (
                            <Check className="w-4 h-4 text-green-600" />
                          )}
                          {match.approved === false && (
                            <X className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Original:</Label>
                          <p className="text-sm bg-red-50 p-2 rounded border-l-2 border-red-300">
                            "{match.originalText}"
                          </p>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">AI Suggestion:</Label>
                          {editingMatch === match.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="text-sm min-h-[60px]"
                                placeholder="Enter replacement text..."
                              />
                              <div className="flex space-x-2">
                                <Button size="xs" onClick={() => handleEditSave(match)}>
                                  Save
                                </Button>
                                <Button size="xs" variant="outline" onClick={handleEditCancel}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="text-sm bg-green-50 p-2 rounded border-l-2 border-green-300 cursor-pointer hover:bg-green-100 transition-colors"
                              onClick={() => handleEditStart(match)}
                            >
                              "{match.contextualReplacement || match.suggestedReplacement}"
                              <span className="text-xs text-muted-foreground ml-2">(click to edit)</span>
                            </div>
                          )}
                        </div>

                        {match.reason && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Reasoning:</Label>
                            <p className="text-xs text-muted-foreground italic">
                              {match.reason}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant={match.approved === true ? "default" : "outline"}
                          onClick={() => onApprove(currentPreview.documentId, match.id)}
                          className="flex-1"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant={match.approved === false ? "destructive" : "outline"}
                          onClick={() => onReject(currentPreview.documentId, match.id)}
                          className="flex-1"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Document Preview */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center">
                  <Eye className="w-4 h-4 mr-2" />
                  Document Preview
                </h3>
                <div className="text-sm text-muted-foreground">
                  Showing changes in context
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6">
                <div 
                  className="whitespace-pre-wrap text-sm font-mono leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: getHighlightedPreview(currentPreview.previewContent, currentPreview.matches)
                  }}
                />
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Alert className="w-auto">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Review each replacement carefully. Changes will be applied to your documents.
                </AlertDescription>
              </Alert>
            </div>

            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={onRejectAll}>
                Reject All
              </Button>
              <Button variant="outline" onClick={onApproveAll}>
                Approve All
              </Button>
              <Button onClick={onClose} disabled={totalMatches - approvedMatches - rejectedMatches > 0}>
                Apply Changes ({approvedMatches})
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}