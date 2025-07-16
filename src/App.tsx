import { useState, useEffect } from 'react'
import { FileText, Upload, Search, Settings, AlertCircle } from 'lucide-react'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Toaster } from './components/ui/toaster'
import { DocumentUpload } from './components/DocumentUpload'
import { DocumentLibrary } from './components/DocumentLibrary'
import { AISearchReplace } from './components/AISearchReplace'
import { DocumentPreview } from './components/DocumentPreview'
import { blink } from './blink/client'
import type { Document, SearchMatch } from './types/document'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [activeTab, setActiveTab] = useState('upload')
  const [highlightedMatches, setHighlightedMatches] = useState<{[documentId: string]: SearchMatch[]}>({})
  const [currentHighlights, setCurrentHighlights] = useState<SearchMatch[]>([])

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged(async (state) => {
      setUser(state.user)
      setLoading(state.isLoading)
      
      // Load documents from localStorage when user is authenticated
      if (state.user && !state.isLoading) {
        try {
          const savedDocuments = localStorage.getItem(`documents_${state.user.id}`)
          if (savedDocuments) {
            const documents: Document[] = JSON.parse(savedDocuments).map((doc: any) => ({
              ...doc,
              uploadedAt: new Date(doc.uploadedAt)
            }))
            setDocuments(documents)
            console.log('Loaded documents from localStorage:', documents.length)
          }
        } catch (error) {
          console.warn('Could not load documents from localStorage:', error)
          // Continue with empty documents array
        }
      }
    })
    return unsubscribe
  }, [])

  const handleDocumentsUploaded = (newDocuments: Document[]) => {
    setDocuments(prev => {
      const updated = [...prev, ...newDocuments]
      // Save to localStorage
      if (user) {
        try {
          localStorage.setItem(`documents_${user.id}`, JSON.stringify(updated))
        } catch (error) {
          console.warn('Could not save documents to localStorage:', error)
        }
      }
      return updated
    })
    if (newDocuments.length > 0) {
      setActiveTab('library')
    }
  }

  const handleDocumentSelect = (document: Document) => {
    setSelectedDocument(document)
    setActiveTab('preview')
    // Update current highlights when document is selected
    setCurrentHighlights(highlightedMatches[document.id] || [])
  }

  const handleHighlightMatches = (documentId: string, matches: SearchMatch[]) => {
    setHighlightedMatches(prev => ({
      ...prev,
      [documentId]: matches
    }))
    
    // If this is the currently selected document, update current highlights
    if (selectedDocument?.id === documentId) {
      setCurrentHighlights(matches)
    }
  }

  const handleDocumentDelete = async (documentId: string) => {
    try {
      setDocuments(prev => {
        const updated = prev.filter(doc => doc.id !== documentId)
        // Save to localStorage
        if (user) {
          try {
            localStorage.setItem(`documents_${user.id}`, JSON.stringify(updated))
          } catch (error) {
            console.warn('Could not save documents to localStorage:', error)
          }
        }
        return updated
      })
      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null)
      }
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const handleDocumentsUpdated = (updatedDocuments: Document[]) => {
    setDocuments(updatedDocuments)
    // Save to localStorage
    if (user) {
      try {
        localStorage.setItem(`documents_${user.id}`, JSON.stringify(updatedDocuments))
      } catch (error) {
        console.warn('Could not save documents to localStorage:', error)
      }
    }
    // Update selected document if it was modified
    if (selectedDocument) {
      const updatedSelected = updatedDocuments.find(doc => doc.id === selectedDocument.id)
      if (updatedSelected) {
        setSelectedDocument(updatedSelected)
      }
    }
  }

  const handleDocumentUpdated = (updatedDocument: Document) => {
    setDocuments(prev => {
      const updated = prev.map(doc => 
        doc.id === updatedDocument.id ? updatedDocument : doc
      )
      // Save to localStorage
      if (user) {
        try {
          localStorage.setItem(`documents_${user.id}`, JSON.stringify(updated))
        } catch (error) {
          console.warn('Could not save documents to localStorage:', error)
        }
      }
      return updated
    })
    if (selectedDocument?.id === updatedDocument.id) {
      setSelectedDocument(updatedDocument)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md mx-auto p-6">
          <div className="space-y-2">
            <FileText className="w-16 h-16 text-primary mx-auto" />
            <h1 className="text-3xl font-bold">Multi-Document AI Editor</h1>
            <p className="text-muted-foreground">
              Upload multiple documents and use AI to search and replace terms intelligently across all files
            </p>
          </div>
          <Button onClick={() => blink.auth.login()} size="lg" className="w-full">
            Sign In to Get Started
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-background to-muted/30 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Multi-Document AI Editor
              </h1>
              <p className="text-sm text-muted-foreground">
                AI-powered contextual search and replace across documents
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">{documents.length} documents loaded</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => blink.auth.logout()}
              className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Panel - Navigation and Tools */}
        <div className="w-96 border-r bg-gradient-to-b from-muted/20 to-background">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <div className="p-4 border-b bg-card/50">
              <TabsList className="grid w-full grid-cols-4 bg-muted/50">
                <TabsTrigger value="upload" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Upload className="w-4 h-4 mr-1" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="library" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <FileText className="w-4 h-4 mr-1" />
                  Library
                </TabsTrigger>
                <TabsTrigger value="search" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Search className="w-4 h-4 mr-1" />
                  Search
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Settings className="w-4 h-4 mr-1" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="h-[calc(100%-80px)]">
              <TabsContent value="upload" className="h-full m-0 p-4">
                <div className="space-y-4">
                  <div>
                    <h2 className="font-semibold text-lg mb-2">Upload Documents</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload multiple document types to get started
                    </p>
                  </div>
                  <DocumentUpload onDocumentsUploaded={handleDocumentsUploaded} />
                </div>
              </TabsContent>

              <TabsContent value="library" className="h-full m-0">
                <DocumentLibrary
                  documents={documents}
                  selectedDocument={selectedDocument}
                  onDocumentSelect={handleDocumentSelect}
                  onDocumentDelete={handleDocumentDelete}
                />
              </TabsContent>

              <TabsContent value="search" className="h-full m-0">
                <AISearchReplace
                  documents={documents}
                  onDocumentsUpdated={handleDocumentsUpdated}
                  onHighlightMatches={handleHighlightMatches}
                />
              </TabsContent>

              <TabsContent value="preview" className="h-full m-0">
                <div className="h-full p-4">
                  <div className="space-y-6">
                    <div>
                      <h2 className="font-semibold text-lg mb-2 flex items-center">
                        <Settings className="w-5 h-5 mr-2" />
                        Settings & Export
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Manage your documents and export options
                      </p>
                    </div>
                    
                    {documents.length > 0 ? (
                      <div className="space-y-4">
                        <Card className="p-4">
                          <h3 className="font-medium mb-3 flex items-center">
                            <FileText className="w-4 h-4 mr-2" />
                            Document Statistics
                          </h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-medium">{documents.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Ready:</span>
                                <span className="font-medium text-green-600">
                                  {documents.filter(d => d.status === 'ready').length}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Processing:</span>
                                <span className="font-medium text-yellow-600">
                                  {documents.filter(d => d.status === 'processing').length}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Errors:</span>
                                <span className="font-medium text-red-600">
                                  {documents.filter(d => d.status === 'error').length}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Size:</span>
                                <span className="font-medium">
                                  {(documents.reduce((sum, doc) => sum + doc.size, 0) / 1024 / 1024).toFixed(2)} MB
                                </span>
                              </div>
                            </div>
                          </div>
                        </Card>
                        
                        <Card className="p-4">
                          <h3 className="font-medium mb-3">Export Options</h3>
                          <div className="space-y-2">
                            <Button variant="outline" size="sm" className="w-full justify-start">
                              <FileText className="w-4 h-4 mr-2" />
                              Export All Documents
                            </Button>
                            <Button variant="outline" size="sm" className="w-full justify-start">
                              <Search className="w-4 h-4 mr-2" />
                              Export Search Results
                            </Button>
                          </div>
                        </Card>

                        <Card className="p-4">
                          <h3 className="font-medium mb-3">Quick Actions</h3>
                          <div className="space-y-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => {
                                if (confirm('Are you sure you want to clear all documents?')) {
                                  onDocumentsUpdated([])
                                  setSelectedDocument(null)
                                }
                              }}
                            >
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Clear All Documents
                            </Button>
                          </div>
                        </Card>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-4">
                          <Settings className="w-16 h-16 text-muted-foreground mx-auto" />
                          <div>
                            <h3 className="text-lg font-medium">No documents yet</h3>
                            <p className="text-sm text-muted-foreground">
                              Upload some documents to see settings and export options
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Right Panel - Document Preview */}
        <div className="flex-1 bg-gradient-to-br from-background to-muted/10">
          <DocumentPreview 
            document={selectedDocument} 
            onDocumentUpdated={handleDocumentUpdated}
            highlightedMatches={currentHighlights}
          />
        </div>
      </div>

      <Toaster />
    </div>
  )
}

export default App