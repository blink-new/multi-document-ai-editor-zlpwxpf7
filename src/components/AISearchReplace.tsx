import { useState } from 'react'
import { Search, Replace, Wand2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
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
import { useToast } from '../hooks/use-toast'
import { blink } from '../blink/client'
import type { Document, SearchResult, SearchMatch, ReplacementOperation, ProcessingStatus } from '../types/document'

interface AISearchReplaceProps {
  documents: Document[]
  onDocumentsUpdated: (documents: Document[]) => void
}

export function AISearchReplace({ documents, onDocumentsUpdated }: AISearchReplaceProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [replacementText, setReplacementText] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isReplacing, setIsReplacing] = useState(false)
  const [preserveContext, setPreserveContext] = useState(true)
  const [preserveTense, setPreserveTense] = useState(true)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null)
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

        // Simple text search for now - in a real app, you'd use more sophisticated search
        const content = document.content.toLowerCase()
        const searchLower = searchTerm.toLowerCase()
        const matches: SearchMatch[] = []

        let index = 0
        let matchId = 0
        while ((index = content.indexOf(searchLower, index)) !== -1) {
          // Get context around the match
          const contextStart = Math.max(0, index - 50)
          const contextEnd = Math.min(content.length, index + searchTerm.length + 50)
          const context = document.content.substring(contextStart, contextEnd)
          
          // Get line number
          const beforeMatch = document.content.substring(0, index)
          const lineNumber = beforeMatch.split('\n').length

          matches.push({
            id: `match_${matchId++}`,
            originalText: document.content.substring(index, index + searchTerm.length),
            context,
            position: index,
            line: lineNumber,
            selected: true
          })

          index += searchTerm.length
        }

        if (matches.length > 0) {
          results.push({
            documentId: document.id,
            documentName: document.name,
            matches
          })
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
        title: "Search completed",
        description: `Found ${totalMatches} matches across ${results.length} documents${skippedDocuments > 0 ? ` (${skippedDocuments} documents skipped - no searchable content)` : ''}`
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

  const handleReplace = async () => {
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

    setIsReplacing(true)
    setProcessingStatus({
      total: selectedMatches.length,
      completed: 0,
      errors: []
    })

    try {
      const updatedDocuments = [...documents]

      for (const result of searchResults) {
        const selectedMatchesForDoc = result.matches.filter(match => match.selected)
        if (selectedMatchesForDoc.length === 0) continue

        const document = updatedDocuments.find(doc => doc.id === result.documentId)
        if (!document) continue

        setProcessingStatus(prev => prev ? { ...prev, current: document.name } : null)

        // Use AI to generate context-aware replacements
        let newContent = document.content

        if (preserveContext || preserveTense) {
          try {
            const prompt = `
You are helping to replace text in a document while preserving context and structure.

Original document excerpt: "${document.content.substring(0, 1000)}..."

Task: Replace "${searchTerm}" with "${replacementText}" in the following contexts:

${selectedMatchesForDoc.map((match, i) => `
${i + 1}. Context: "${match.context}"
   Original: "${match.originalText}"
   Position: ${match.position}
`).join('\n')}

Requirements:
- ${preserveContext ? 'Preserve the original sentence structure and context' : 'Simple replacement is fine'}
- ${preserveTense ? 'Maintain the original tense and grammatical form' : 'Tense changes are acceptable'}
- Return the complete updated content
- Ensure all replacements are contextually appropriate

Please provide the updated document content:
            `

            const { text } = await blink.ai.generateText({
              prompt,
              model: 'gpt-4o-mini',
              maxTokens: 4000
            })

            newContent = text.trim()
          } catch (aiError) {
            console.error('AI replacement error:', aiError)
            // Fallback to simple replacement
            for (const match of selectedMatchesForDoc.reverse()) {
              newContent = newContent.substring(0, match.position) + 
                          replacementText + 
                          newContent.substring(match.position + match.originalText.length)
            }
          }
        } else {
          // Simple replacement
          for (const match of selectedMatchesForDoc.reverse()) {
            newContent = newContent.substring(0, match.position) + 
                        replacementText + 
                        newContent.substring(match.position + match.originalText.length)
          }
        }

        document.content = newContent

        setProcessingStatus(prev => prev ? { 
          ...prev, 
          completed: prev.completed + selectedMatchesForDoc.length 
        } : null)
      }

      onDocumentsUpdated(updatedDocuments)
      setSearchResults([])
      setSearchTerm('')
      setReplacementText('')

      toast({
        title: "Replacement completed",
        description: `Successfully updated ${selectedMatches.length} matches`
      })
    } catch (error) {
      console.error('Replacement error:', error)
      toast({
        title: "Replacement failed",
        description: "There was an error updating your documents",
        variant: "destructive"
      })
    } finally {
      setIsReplacing(false)
      setProcessingStatus(null)
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
    <div className="h-full flex flex-col space-y-4 p-4">
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-lg mb-2">AI Search & Replace</h2>
          <p className="text-sm text-muted-foreground">
            Search for terms across all documents and replace them intelligently
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="search-term">Search Term</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search-term"
                placeholder="Enter term to search for..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="replacement-text">Replacement Text</Label>
            <div className="relative">
              <Replace className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Textarea
                id="replacement-text"
                placeholder="Enter replacement text..."
                value={replacementText}
                onChange={(e) => setReplacementText(e.target.value)}
                className="pl-10 min-h-[80px]"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="preserve-context"
                checked={preserveContext}
                onCheckedChange={setPreserveContext}
              />
              <Label htmlFor="preserve-context">Preserve sentence context</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="preserve-tense"
                checked={preserveTense}
                onCheckedChange={setPreserveTense}
              />
              <Label htmlFor="preserve-tense">Preserve tense and grammar</Label>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button 
              onClick={handleSearch} 
              disabled={isSearching || !searchTerm.trim()}
              className="flex-1"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Search
            </Button>
            <Button 
              onClick={handleReplace}
              disabled={isReplacing || selectedMatches === 0}
              variant="default"
              className="flex-1"
            >
              {isReplacing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 mr-2" />
              )}
              Replace ({selectedMatches})
            </Button>
          </div>
        </div>
      </div>

      {processingStatus && (
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Processing...</span>
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Search Results</h3>
            <Badge variant="secondary">
              {selectedMatches}/{totalMatches} selected
            </Badge>
          </div>
          
          <ScrollArea className="h-full">
            <div className="space-y-4">
              {searchResults.map((result, resultIndex) => (
                <Card key={result.documentId} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{result.documentName}</h4>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
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
                    
                    <div className="space-y-2">
                      {result.matches.map((match) => (
                        <div
                          key={match.id}
                          className="flex items-start space-x-3 p-2 rounded border"
                        >
                          <Checkbox
                            checked={match.selected}
                            onCheckedChange={() => toggleMatchSelection(resultIndex, match.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="text-muted-foreground">Line {match.line}:</span>{' '}
                              <span 
                                className="search-highlight"
                                dangerouslySetInnerHTML={{
                                  __html: match.context.replace(
                                    new RegExp(searchTerm, 'gi'),
                                    `<mark>$&</mark>`
                                  )
                                }}
                              />
                            </p>
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
    </div>
  )
}