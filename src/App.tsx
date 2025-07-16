import { useState, useEffect } from 'react'
import { FileText, Upload, Search, Settings } from 'lucide-react'
import { Button } from './components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Toaster } from './components/ui/toaster'
import { DocumentUpload } from './components/DocumentUpload'
import { DocumentLibrary } from './components/DocumentLibrary'
import { AISearchReplace } from './components/AISearchReplace'
import { DocumentPreview } from './components/DocumentPreview'
import { blink } from './blink/client'
import type { Document } from './types/document'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [activeTab, setActiveTab] = useState('upload')

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged(async (state) => {
      setUser(state.user)
      setLoading(state.isLoading)
      
      // Load documents from database when user is authenticated
      if (state.user && !state.isLoading) {
        try {
          const dbDocuments = await blink.db.documents.list({
            where: { userId: state.user.id },
            orderBy: { uploadedAt: 'desc' }
          })
          
          // Convert database documents to Document type
          const documents: Document[] = dbDocuments.map(doc => ({
            id: doc.id,
            name: doc.name,
            type: doc.type as Document['type'],
            size: doc.size,
            uploadedAt: new Date(doc.uploadedAt),
            content: doc.content,
            status: doc.status as Document['status'],
            url: doc.url
          }))
          
          setDocuments(documents)
          console.log('Loaded documents from database:', documents.length)
        } catch (error) {
          console.warn('Could not load documents from database:', error)
          // Continue without database - user can still upload new documents
        }
      }
    })
    return unsubscribe
  }, [])

  const handleDocumentsUploaded = (newDocuments: Document[]) => {
    setDocuments(prev => [...prev, ...newDocuments])
    if (newDocuments.length > 0) {
      setActiveTab('library')
    }
  }

  const handleDocumentSelect = (document: Document) => {
    setSelectedDocument(document)
    setActiveTab('preview')
  }

  const handleDocumentDelete = async (documentId: string) => {
    try {
      // Try to delete from database
      try {
        await blink.db.documents.delete(documentId)
        console.log('Document deleted from database:', documentId)
      } catch (dbError) {
        console.warn('Could not delete document from database:', dbError)
        // Continue without database - document will still be removed from memory
      }
      
      setDocuments(prev => prev.filter(doc => doc.id !== documentId))
      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null)
      }
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const handleDocumentsUpdated = (updatedDocuments: Document[]) => {
    setDocuments(updatedDocuments)
    // Update selected document if it was modified
    if (selectedDocument) {
      const updatedSelected = updatedDocuments.find(doc => doc.id === selectedDocument.id)
      if (updatedSelected) {
        setSelectedDocument(updatedSelected)
      }
    }
  }

  const handleDocumentUpdated = (updatedDocument: Document) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === updatedDocument.id ? updatedDocument : doc
    ))
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
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Multi-Document AI Editor</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered document search and replace
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => blink.auth.logout()}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Panel - Navigation and Tools */}
        <div className="w-96 border-r bg-card">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-4 m-4">
              <TabsTrigger value="upload" className="text-xs">
                <Upload className="w-4 h-4 mr-1" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="library" className="text-xs">
                <FileText className="w-4 h-4 mr-1" />
                Library
              </TabsTrigger>
              <TabsTrigger value="search" className="text-xs">
                <Search className="w-4 h-4 mr-1" />
                Search
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">
                <Settings className="w-4 h-4 mr-1" />
                Preview
              </TabsTrigger>
            </TabsList>

            <div className="h-[calc(100%-60px)]">
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
                />
              </TabsContent>

              <TabsContent value="preview" className="h-full m-0">
                <div className="h-full p-4">
                  <div className="space-y-4">
                    <div>
                      <h2 className="font-semibold text-lg mb-2">Document Settings</h2>
                      <p className="text-sm text-muted-foreground">
                        Manage document settings and export options
                      </p>
                    </div>
                    
                    {documents.length > 0 && (
                      <div className="space-y-3">
                        <div className="p-4 bg-muted rounded-lg">
                          <h3 className="font-medium mb-2">Export Options</h3>
                          <div className="space-y-2">
                            <Button variant="outline" size="sm" className="w-full">
                              Export All as ZIP
                            </Button>
                            <Button variant="outline" size="sm" className="w-full">
                              Export Search Results
                            </Button>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-muted rounded-lg">
                          <h3 className="font-medium mb-2">Statistics</h3>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>Total Documents:</span>
                              <span>{documents.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Ready Documents:</span>
                              <span>{documents.filter(d => d.status === 'ready').length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total Size:</span>
                              <span>
                                {(documents.reduce((sum, doc) => sum + doc.size, 0) / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
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
        <div className="flex-1 bg-background">
          <DocumentPreview 
            document={selectedDocument} 
            onDocumentUpdated={handleDocumentUpdated}
          />
        </div>
      </div>

      <Toaster />
    </div>
  )
}

export default App