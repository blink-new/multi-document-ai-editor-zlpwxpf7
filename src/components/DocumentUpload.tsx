import { useCallback, useState } from 'react'
import { Upload, FileText, File, Presentation, FileImage } from 'lucide-react'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { useToast } from '../hooks/use-toast'
import { blink } from '../blink/client'
import type { Document } from '../types/document'

interface DocumentUploadProps {
  onDocumentsUploaded: (documents: Document[]) => void
}

const getFileIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return <FileText className="w-8 h-8 text-red-500" />
    case 'docx':
      return <File className="w-8 h-8 text-blue-500" />
    case 'pptx':
      return <Presentation className="w-8 h-8 text-orange-500" />
    case 'txt':
      return <FileText className="w-8 h-8 text-gray-500" />
    default:
      return <FileImage className="w-8 h-8 text-purple-500" />
  }
}

const getFileType = (fileName: string): Document['type'] => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'pdf':
      return 'pdf'
    case 'doc':
    case 'docx':
      return 'docx'
    case 'ppt':
    case 'pptx':
      return 'pptx'
    case 'pages':
      return 'pages'
    case 'txt':
      return 'txt'
    default:
      return 'other'
  }
}

const isValidFileObject = (file: any): file is File => {
  return (
    file &&
    typeof file === 'object' &&
    typeof file.name === 'string' &&
    typeof file.size === 'number' &&
    typeof file.type === 'string' &&
    file.name.length > 0
  )
}

export function DocumentUpload({ onDocumentsUploaded }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()

  const processFile = useCallback(async (file: File): Promise<Document> => {
    const fileId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Validate file before processing
    if (!isValidFileObject(file)) {
      throw new Error('Invalid file object provided')
    }
    
    console.log('Processing file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    })
    
    // Upload file to storage
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))
    
    const { publicUrl } = await blink.storage.upload(
      file,
      `documents/${fileId}_${file.name}`,
      {
        upsert: true,
        onProgress: (percent) => {
          setUploadProgress(prev => ({ ...prev, [fileId]: percent }))
        }
      }
    )

    // Extract text content from the file
    let content = ''
    const fileType = getFileType(file.name)
    
    try {
      if (fileType === 'txt') {
        // For text files, we can read them directly
        const text = await file.text()
        content = text || `Empty text file: ${file.name}`
      } else {
        // Use Blink's data extraction for other file types
        console.log('Extracting content from file:', file.name, 'File object:', {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        })
        
        // Double-check file is valid before extraction
        if (!file || !file.name || file.size === 0) {
          throw new Error('Invalid file object for extraction')
        }
        
        content = await blink.data.extractFromBlob(file)
        
        // If extraction returns empty or very short content, provide a fallback
        if (!content || content.trim().length < 10) {
          content = `File uploaded: ${file.name} (${fileType.toUpperCase()} format). Content extraction returned minimal text. File is available for download.`
        }
      }
    } catch (error) {
      console.error('Error extracting content from file:', error)
      // Provide more detailed error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      content = `File uploaded: ${file.name} (${fileType.toUpperCase()} format). Content extraction failed: ${errorMessage}. File is available for download.`
    }

    const document: Document = {
      id: fileId,
      name: file.name,
      type: getFileType(file.name),
      size: file.size,
      uploadedAt: new Date(),
      content,
      status: 'ready',
      url: publicUrl
    }

    // Note: Database persistence disabled due to Turso limit
    // Documents are now stored in localStorage via App.tsx handlers
    console.log('Document processed successfully:', fileId)

    setUploadProgress(prev => {
      const newProgress = { ...prev }
      delete newProgress[fileId]
      return newProgress
    })

    return document
  }, [])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to upload",
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)
    const fileArray = Array.from(files).filter(file => isValidFileObject(file))
    
    if (fileArray.length === 0) {
      toast({
        title: "No valid files",
        description: "No valid files were found to upload",
        variant: "destructive"
      })
      setIsProcessing(false)
      return
    }
    
    const documents: Document[] = []

    console.log('Processing files:', fileArray.map(f => ({ name: f.name, size: f.size, type: f.type })))

    try {
      for (const file of fileArray) {
        try {
          // Validate file object
          if (!isValidFileObject(file)) {
            console.error('Invalid file object:', file)
            toast({
              title: "Invalid file",
              description: "One or more files are invalid",
              variant: "destructive"
            })
            continue
          }

          // Validate file size (max 10MB)
          if (file.size > 10 * 1024 * 1024) {
            toast({
              title: "File too large",
              description: `${file.name} is larger than 10MB`,
              variant: "destructive"
            })
            continue
          }

          // Validate file is not empty
          if (file.size === 0) {
            toast({
              title: "Empty file",
              description: `${file.name} is empty`,
              variant: "destructive"
            })
            continue
          }

          const document = await processFile(file)
          documents.push(document)
        } catch (fileError) {
          console.error(`Error processing file ${file?.name || 'unknown'}:`, fileError)
          toast({
            title: "File processing error",
            description: `Failed to process ${file?.name || 'file'}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`,
            variant: "destructive"
          })
        }
      }

      onDocumentsUploaded(documents)
      
      toast({
        title: "Upload successful",
        description: `${documents.length} document(s) uploaded and processed`
      })
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload failed",
        description: "There was an error uploading your documents",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }, [onDocumentsUploaded, processFile, toast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    try {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      } else {
        toast({
          title: "No files dropped",
          description: "Please drop valid files to upload",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error handling dropped files:', error)
      toast({
        title: "Drop error",
        description: "There was an error processing the dropped files",
        variant: "destructive"
      })
    }
  }, [handleFiles, toast])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files)
      }
      // Reset the input value to allow re-uploading the same file
      e.target.value = ''
    } catch (error) {
      console.error('Error handling file input:', error)
      toast({
        title: "File input error",
        description: "There was an error processing the selected files",
        variant: "destructive"
      })
    }
  }, [handleFiles, toast])

  const hasActiveUploads = Object.keys(uploadProgress).length > 0

  return (
    <div className="space-y-4">
      <div
        className={`document-upload-zone ${isDragging ? 'border-primary bg-primary/5' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center space-y-4">
          <Upload className={`w-12 h-12 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-center">
            <p className="text-lg font-medium">
              {isDragging ? 'Drop files here' : 'Drag and drop documents'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports PDF, Word, PowerPoint, Pages, and text files
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Text content extraction currently available for TXT files only
            </p>
          </div>
          <Button variant="outline" disabled={isProcessing}>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.pages,.txt"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />
            Choose Files
          </Button>
        </div>
      </div>

      {hasActiveUploads && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Uploading...</h4>
          {Object.entries(uploadProgress).map(([fileId, progress]) => (
            <div key={fileId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>Processing file...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}