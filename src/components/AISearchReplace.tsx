import { useState } from 'react'
import { Search, Replace, Wand2, CheckCircle, AlertCircle, Loader2, Eye, Sparkles, Brain } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Checkbox } from './ui/checkbox'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { Progress } from './ui/progress'
import { Alert, AlertDescription } from './ui/alert'
import { useToast } from '../hooks/use-toast'
import { blink } from '../blink/client'
import { ReplacementReview } from './ReplacementReview'
import type { Document, SearchResult, SearchMatch, ReplacementOperation, ProcessingStatus, ReplacementPreview, ReviewState } from '../types/document'

interface AISearchReplaceProps {
  documents: Document[]
  onDocumentsUpdated: (documents: Document[]) => void
  onHighlightMatches?: (documentId: string, matches: SearchMatch[]) => void
}

export function AISearchReplace({ documents, onDocumentsUpdated, onHighlightMatches }: AISearchReplaceProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [replacementText, setReplacementText] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isGeneratingPreviews, setIsGeneratingPreviews] = useState(false)
  const [isReplacing, setIsReplacing] = useState(false)
  const [preserveContext, setPreserveContext] = useState(true)
  const [preserveTense, setPreserveTense] = useState(true)
  const [smartReplacement, setSmartReplacement] = useState(true)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null)
  const [reviewState, setReviewState] = useState<ReviewState>({
    isReviewing: false,
    previews: [],
    currentPreviewIndex: 0
  })
  const { toast } = useToast()

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Search term required",
        description: "Please enter a term to search for",
        variant: "destructive"
      })
      return
    }

    if (documents.length === 0) {
      toast({
        title: "No documents",
        description: "Please upload documents first",
        variant: "destructive"
      })
      return
    }

    setIsSearching(true)
    setSearchResults([])

    try {
      const results: SearchResult[] = []

      for (const document of documents) {
        if (document.status !== 'ready') continue

        // Skip documents where content extraction failed or returned minimal content
        if (document.content.includes('Content extraction failed') || 
            document.content.includes('Content extraction not supported') ||
            document.content.includes('Content extraction returned minimal text') ||
            document.content.trim().length < 20) {
          continue
        }

        // Use AI for semantic search to find relevant content
        try {
          const searchPrompt = `
You are helping to search through a document for content related to a search query. 
Your task is to find all sentences, phrases, or paragraphs that are semantically related to the search term, not just exact matches.

Document content:
"""
${document.content}
"""

Search query: "${searchTerm}"

Instructions:
1. Find all content that is semantically related to "${searchTerm}" - this includes:
   - Exact matches
   - Synonyms and related terms
   - Concepts that are contextually related
   - Different phrasings of the same idea
   - References that might use different terminology

2. For each match found, return a JSON array with objects containing:
   - "text": the exact text from the document that matches
   - "context": surrounding context (about 200 characters before and after)
   - "relevance": a score from 1-10 indicating how relevant this match is
   - "reason": brief explanation of why this text is relevant to the search
   - "sentence": the complete sentence containing the match

3. Focus on complete sentences or meaningful phrases, not just individual words.

4. Return only valid JSON array format.

Example format:
[
  {
    "text": "exact matching text from document",
    "context": "...surrounding context from document...",
    "sentence": "Complete sentence containing the match.",
    "relevance": 8,
    "reason": "Direct reference to the search term"
  }
]

Return the JSON array:
          `

          const { text: aiResponse } = await blink.ai.generateText({
            prompt: searchPrompt,
            model: 'gpt-4o-mini',
            maxTokens: 2000
          })

          // Parse AI response to extract matches
          let aiMatches: any[] = []
          try {
            // Try to extract JSON from the response
            const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
              aiMatches = JSON.parse(jsonMatch[0])
            }
          } catch (parseError) {
            console.warn('Could not parse AI search results, falling back to simple search')
          }

          const matches: SearchMatch[] = []
          let matchId = 0

          // Process AI matches
          if (aiMatches.length > 0) {
            for (const aiMatch of aiMatches) {
              if (aiMatch.relevance >= 6) { // Only include high-relevance matches
                // Find the position of this text in the document
                const position = document.content.indexOf(aiMatch.text)
                if (position !== -1) {
                  const beforeMatch = document.content.substring(0, position)
                  const lineNumber = beforeMatch.split('\n').length

                  matches.push({
                    id: `ai_match_${matchId++}`,
                    originalText: aiMatch.text,
                    context: aiMatch.context,
                    position,
                    line: lineNumber,
                    selected: true,
                    relevance: aiMatch.relevance,
                    reason: aiMatch.reason
                  })
                }
              }
            }
          }

          // Fallback to simple text search if AI didn't find enough matches
          if (matches.length === 0) {
            const content = document.content.toLowerCase()
            const searchLower = searchTerm.toLowerCase()
            let index = 0

            while ((index = content.indexOf(searchLower, index)) !== -1) {
              // Get context around the match
              const contextStart = Math.max(0, index - 100)
              const contextEnd = Math.min(content.length, index + searchTerm.length + 100)
              const context = document.content.substring(contextStart, contextEnd)
              
              // Get line number
              const beforeMatch = document.content.substring(0, index)
              const lineNumber = beforeMatch.split('\n').length

              matches.push({
                id: `simple_match_${matchId++}`,
                originalText: document.content.substring(index, index + searchTerm.length),
                context,
                position: index,
                line: lineNumber,
                selected: true,
                relevance: 10,
                reason: "Exact text match"
              })

              index += searchTerm.length
            }
          }

          if (matches.length > 0) {
            results.push({
              documentId: document.id,
              documentName: document.name,
              matches: matches.sort((a, b) => (b.relevance || 0) - (a.relevance || 0)) // Sort by relevance
            })

            // Notify parent component about matches for highlighting
            if (onHighlightMatches) {
              onHighlightMatches(document.id, matches)
            }
          }

        } catch (aiError) {
          console.error('AI search error for document:', document.name, aiError)
          // Fallback to simple search on AI error
          const content = document.content.toLowerCase()
          const searchLower = searchTerm.toLowerCase()
          const matches: SearchMatch[] = []
          let index = 0
          let matchId = 0

          while ((index = content.indexOf(searchLower, index)) !== -1) {
            const contextStart = Math.max(0, index - 100)
            const contextEnd = Math.min(content.length, index + searchTerm.length + 100)
            const context = document.content.substring(contextStart, contextEnd)
            
            const beforeMatch = document.content.substring(0, index)
            const lineNumber = beforeMatch.split('\n').length

            matches.push({
              id: `fallback_match_${matchId++}`,
              originalText: document.content.substring(index, index + searchTerm.length),
              context,
              position: index,
              line: lineNumber,
              selected: true,
              relevance: 10,
              reason: "Exact text match"
            })

            index += searchTerm.length
          }

          if (matches.length > 0) {
            results.push({
              documentId: document.id,
              documentName: document.name,
              matches
            })

            // Notify parent component about matches for highlighting
            if (onHighlightMatches) {
              onHighlightMatches(document.id, matches)
            }
          }
        }
      }

      setSearchResults(results)
      
      const totalMatches = results.reduce((sum, result) => sum + result.matches.length, 0)
      const searchableDocuments = documents.filter(doc => 
        doc.status === 'ready' && 
        !doc.content.includes('Content extraction failed') && 
        !doc.content.includes('Content extraction not supported') &&
        !doc.content.includes('Content extraction returned minimal text') &&
        doc.content.trim().length >= 20
      ).length
      
      const skippedDocuments = documents.length - searchableDocuments
      
      toast({
        title: "AI Search completed",
        description: `Found ${totalMatches} semantic matches across ${results.length} documents${skippedDocuments > 0 ? ` (${skippedDocuments} documents skipped - no searchable content)` : ''}`
      })
    } catch (error) {
      console.error('Search error:', error)
      toast({
        title: "Search failed",
        description: "There was an error searching your documents",
        variant: "destructive"
      })
    } finally {
      setIsSearching(false)
    }
  }

  const generateContextualReplacements = async () => {
    if (!replacementText.trim()) {
      toast({
        title: "Replacement text required",
        description: "Please enter replacement text",
        variant: "destructive"
      })
      return
    }

    const selectedMatches = searchResults.flatMap(result => 
      result.matches.filter(match => match.selected)
    )

    if (selectedMatches.length === 0) {
      toast({
        title: "No matches selected",
        description: "Please select matches to replace",
        variant: "destructive"
      })
      return
    }

    setIsGeneratingPreviews(true)
    setProcessingStatus({
      total: selectedMatches.length,
      completed: 0,
      errors: []
    })

    try {
      const previews: ReplacementPreview[] = []

      for (const result of searchResults) {
        const selectedMatchesForDoc = result.matches.filter(match => match.selected)
        if (selectedMatchesForDoc.length === 0) continue

        const document = documents.find(doc => doc.id === result.documentId)
        if (!document) continue

        setProcessingStatus(prev => prev ? { ...prev, current: document.name } : null)

        // Generate contextual replacements for each match
        const enhancedMatches: SearchMatch[] = []

        for (const match of selectedMatchesForDoc) {
          try {
            if (smartReplacement) {
              // Use AI to generate context-aware replacement
              const contextPrompt = `
You are helping to replace text in a document while preserving context, tense, and sentence structure.

Original sentence/context: "${match.context}"
Text to replace: "${match.originalText}"
Replacement text: "${replacementText}"

Requirements:
- ${preserveContext ? 'Preserve the original sentence structure and flow' : 'Simple replacement is acceptable'}
- ${preserveTense ? 'Maintain the original tense and grammatical form' : 'Tense changes are acceptable'}
- Ensure the replacement fits naturally in the context
- Consider the surrounding words and sentence structure
- Make sure the replacement makes grammatical sense

Please provide:
1. The contextual replacement text (just the replacement, not the full sentence)
2. A brief explanation of any adjustments made

Format your response as JSON:
{
  "replacement": "contextually appropriate replacement text",
  "explanation": "brief explanation of adjustments made"
}
              `

              const { text: aiResponse } = await blink.ai.generateText({
                prompt: contextPrompt,
                model: 'gpt-4o-mini',
                maxTokens: 500
              })

              try {
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
                if (jsonMatch) {
                  const aiResult = JSON.parse(jsonMatch[0])
                  enhancedMatches.push({
                    ...match,
                    suggestedReplacement: replacementText,
                    contextualReplacement: aiResult.replacement,
                    reason: aiResult.explanation || match.reason
                  })
                } else {
                  // Fallback to simple replacement
                  enhancedMatches.push({
                    ...match,
                    suggestedReplacement: replacementText,
                    contextualReplacement: replacementText
                  })
                }
              } catch (parseError) {
                // Fallback to simple replacement
                enhancedMatches.push({
                  ...match,
                  suggestedReplacement: replacementText,
                  contextualReplacement: replacementText
                })
              }
            } else {
              // Simple replacement
              enhancedMatches.push({
                ...match,
                suggestedReplacement: replacementText,
                contextualReplacement: replacementText
              })
            }

            setProcessingStatus(prev => prev ? { 
              ...prev, 
              completed: prev.completed + 1 
            } : null)
          } catch (error) {
            console.error('Error generating contextual replacement:', error)
            // Fallback to simple replacement
            enhancedMatches.push({
              ...match,
              suggestedReplacement: replacementText,
              contextualReplacement: replacementText
            })
          }
        }

        // Generate preview content
        let previewContent = document.content
        for (const match of enhancedMatches.reverse()) {
          const replacement = match.contextualReplacement || match.suggestedReplacement || replacementText
          previewContent = previewContent.substring(0, match.position) + 
                          replacement + 
                          previewContent.substring(match.position + match.originalText.length)
        }

        previews.push({
          documentId: result.documentId,
          documentName: result.documentName,
          matches: enhancedMatches.reverse(),
          previewContent
        })
      }

      setReviewState({
        isReviewing: true,
        previews,
        currentPreviewIndex: 0
      })

      toast({
        title: "Previews generated",
        description: `Generated ${selectedMatches.length} contextual replacements for review`
      })
    } catch (error) {
      console.error('Preview generation error:', error)
      toast({
        title: "Preview generation failed",
        description: "There was an error generating replacement previews",
        variant: "destructive"
      })
    } finally {
      setIsGeneratingPreviews(false)
      setProcessingStatus(null)
    }
  }

  const handleApprove = (documentId: string, matchId: string) => {
    setReviewState(prev => ({
      ...prev,
      previews: prev.previews.map(preview => 
        preview.documentId === documentId
          ? {
              ...preview,
              matches: preview.matches.map(match =>
                match.id === matchId ? { ...match, approved: true } : match
              )
            }
          : preview
      )
    }))
  }

  const handleReject = (documentId: string, matchId: string) => {
    setReviewState(prev => ({
      ...prev,
      previews: prev.previews.map(preview => 
        preview.documentId === documentId
          ? {
              ...preview,
              matches: preview.matches.map(match =>
                match.id === matchId ? { ...match, approved: false } : match
              )
            }
          : preview
      )
    }))
  }

  const handleEditReplacement = (documentId: string, matchId: string, newReplacement: string) => {
    setReviewState(prev => ({
      ...prev,
      previews: prev.previews.map(preview => 
        preview.documentId === documentId
          ? {
              ...preview,
              matches: preview.matches.map(match =>
                match.id === matchId 
                  ? { ...match, contextualReplacement: newReplacement }
                  : match
              )
            }
          : preview
      )
    }))
  }

  const handleApproveAll = () => {
    setReviewState(prev => ({
      ...prev,
      previews: prev.previews.map(preview => ({
        ...preview,
        matches: preview.matches.map(match => ({ ...match, approved: true }))
      }))
    }))
  }

  const handleRejectAll = () => {
    setReviewState(prev => ({
      ...prev,
      previews: prev.previews.map(preview => ({
        ...preview,
        matches: preview.matches.map(match => ({ ...match, approved: false }))
      }))
    }))
  }

  const applyApprovedChanges = async () => {
    setIsReplacing(true)
    
    try {
      const updatedDocuments = [...documents]
      let appliedChanges = 0

      for (const preview of reviewState.previews) {
        const approvedMatches = preview.matches.filter(match => match.approved === true)
        if (approvedMatches.length === 0) continue

        const document = updatedDocuments.find(doc => doc.id === preview.documentId)
        if (!document) continue

        // Apply approved changes
        let newContent = document.content
        for (const match of approvedMatches.reverse()) {
          const replacement = match.contextualReplacement || match.suggestedReplacement || replacementText
          newContent = newContent.substring(0, match.position) + 
                      replacement + 
                      newContent.substring(match.position + match.originalText.length)
          appliedChanges++
        }

        document.content = newContent
      }

      onDocumentsUpdated(updatedDocuments)
      setSearchResults([])
      setSearchTerm('')
      setReplacementText('')
      setReviewState({
        isReviewing: false,
        previews: [],
        currentPreviewIndex: 0
      })

      toast({
        title: "Changes applied",
        description: `Successfully applied ${appliedChanges} approved replacements`
      })
    } catch (error) {
      console.error('Apply changes error:', error)
      toast({
        title: "Apply changes failed",
        description: "There was an error applying the changes",
        variant: "destructive"
      })
    } finally {
      setIsReplacing(false)
    }
  }

  const handleCloseReview = () => {
    const approvedMatches = reviewState.previews.reduce((sum, preview) => 
      sum + preview.matches.filter(match => match.approved === true).length, 0
    )

    if (approvedMatches > 0) {
      applyApprovedChanges()
    } else {
      setReviewState({
        isReviewing: false,
        previews: [],
        currentPreviewIndex: 0
      })
    }
  }

  const toggleMatchSelection = (resultIndex: number, matchId: string) => {
    setSearchResults(prev => prev.map((result, i) => 
      i === resultIndex 
        ? {
            ...result,
            matches: result.matches.map(match => 
              match.id === matchId 
                ? { ...match, selected: !match.selected }
                : match
            )
          }
        : result
    ))
  }

  const toggleAllMatches = (resultIndex: number, selected: boolean) => {
    setSearchResults(prev => prev.map((result, i) => 
      i === resultIndex 
        ? {
            ...result,
            matches: result.matches.map(match => ({ ...match, selected }))
          }
        : result
    ))
  }

  const totalMatches = searchResults.reduce((sum, result) => sum + result.matches.length, 0)
  const selectedMatches = searchResults.reduce((sum, result) => 
    sum + result.matches.filter(match => match.selected).length, 0
  )

  return (
    <>
      <div className="h-full flex flex-col space-y-6 p-6">
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <Brain className="w-6 h-6 text-primary" />
              <h2 className="font-bold text-xl">AI Search & Replace</h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Use advanced AI to find semantically related content and replace it with context-aware suggestions
            </p>
          </div>

          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="search-term" className="text-sm font-medium">Search Query</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="search-term"
                    placeholder="e.g., 'artificial intelligence', 'climate change', 'project management'"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-12"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  AI will find semantically related content, not just exact matches
                </p>
              </div>

              <div>
                <Label htmlFor="replacement-text" className="text-sm font-medium">Replacement Text</Label>
                <div className="relative mt-2">
                  <Replace className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Textarea
                    id="replacement-text"
                    placeholder="Enter replacement text..."
                    value={replacementText}
                    onChange={(e) => setReplacementText(e.target.value)}
                    className="pl-10 min-h-[100px] resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium flex items-center">
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Enhancement Options
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="space-y-1">
                        <Label htmlFor="smart-replacement" className="text-sm font-medium">Smart Replacement</Label>
                        <p className="text-xs text-muted-foreground">Use AI to generate context-aware replacements</p>
                      </div>
                      <Switch
                        id="smart-replacement"
                        checked={smartReplacement}
                        onCheckedChange={setSmartReplacement}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="space-y-1">
                        <Label htmlFor="preserve-context" className="text-sm font-medium">Preserve Context</Label>
                        <p className="text-xs text-muted-foreground">Maintain sentence structure and flow</p>
                      </div>
                      <Switch
                        id="preserve-context"
                        checked={preserveContext}
                        onCheckedChange={setPreserveContext}
                        disabled={!smartReplacement}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="space-y-1">
                        <Label htmlFor="preserve-tense" className="text-sm font-medium">Preserve Grammar</Label>
                        <p className="text-xs text-muted-foreground">Maintain tense and grammatical form</p>
                      </div>
                      <Switch
                        id="preserve-tense"
                        checked={preserveTense}
                        onCheckedChange={setPreserveTense}
                        disabled={!smartReplacement}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button 
                  onClick={handleSearch} 
                  disabled={isSearching || !searchTerm.trim()}
                  className="flex-1 h-12"
                  size="lg"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  AI Search
                </Button>
                <Button 
                  onClick={generateContextualReplacements}
                  disabled={isGeneratingPreviews || selectedMatches === 0 || !replacementText.trim()}
                  variant="default"
                  className="flex-1 h-12"
                  size="lg"
                >
                  {isGeneratingPreviews ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4 mr-2" />
                  )}
                  Preview Changes ({selectedMatches})
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {processingStatus && (
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {isGeneratingPreviews ? 'Generating contextual replacements...' : 'Processing...'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {processingStatus.completed}/{processingStatus.total}
                </span>
              </div>
              <Progress 
                value={(processingStatus.completed / processingStatus.total) * 100} 
                className="h-2"
              />
              {processingStatus.current && (
                <p className="text-xs text-muted-foreground">
                  Current: {processingStatus.current}
                </p>
              )}
            </div>
          </Card>
        )}

        {searchResults.length > 0 && (
          <div className="flex-1 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Search Results</h3>
              <Badge variant="secondary" className="text-sm">
                {selectedMatches}/{totalMatches} selected
              </Badge>
            </div>
            
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {searchResults.map((result, resultIndex) => (
                  <Card key={result.documentId} className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-lg">{result.documentName}</h4>
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline" className="text-sm">
                            {result.matches.length} matches
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleAllMatches(resultIndex, true)}
                          >
                            Select All
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleAllMatches(resultIndex, false)}
                          >
                            None
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid gap-3">
                        {result.matches.map((match) => (
                          <div
                            key={match.id}
                            className="flex items-start space-x-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              checked={match.selected}
                              onCheckedChange={() => toggleMatchSelection(resultIndex, match.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground font-medium">Line {match.line}</span>
                                {match.relevance && (
                                  <Badge 
                                    variant={match.relevance >= 8 ? "default" : match.relevance >= 6 ? "secondary" : "outline"}
                                    className="text-xs"
                                  >
                                    Relevance: {match.relevance}/10
                                  </Badge>
                                )}
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm leading-relaxed">
                                  <span 
                                    className="search-highlight"
                                    dangerouslySetInnerHTML={{
                                      __html: match.context.replace(
                                        new RegExp(match.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                                        `<mark class="bg-yellow-200 px-1 py-0.5 rounded font-medium">$&</mark>`
                                      )
                                    }}
                                  />
                                </p>
                                {match.reason && (
                                  <p className="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
                                    <strong>Why this matches:</strong> {match.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {searchResults.length === 0 && !isSearching && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md">
              <Search className="w-16 h-16 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-medium">Ready to search</h3>
                <p className="text-sm text-muted-foreground">
                  Enter a search term above to find semantically related content across all your documents
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {reviewState.isReviewing && (
        <ReplacementReview
          previews={reviewState.previews}
          currentIndex={reviewState.currentPreviewIndex}
          onIndexChange={(index) => setReviewState(prev => ({ ...prev, currentPreviewIndex: index }))}
          onApprove={handleApprove}
          onReject={handleReject}
          onEditReplacement={handleEditReplacement}
          onApproveAll={handleApproveAll}
          onRejectAll={handleRejectAll}
          onClose={handleCloseReview}
        />
      )}
    </>
  )
}