import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { formatFileSize } from '@/lib/utils'
import type { FileMetadata } from './PatientDashboard'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/dicom']

interface ImageUploadProps {
  onFileSelect: (file: File, metadata: FileMetadata) => void
  file: File | null
  metadata: FileMetadata
}

export default function ImageUpload({ onFileSelect, file }: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileType, setFileType] = useState<FileMetadata['fileType']>('xray')
  const [bodyPart, setBodyPart] = useState('')

  const processFile = useCallback(
    (f: File) => {
      if (f.size > MAX_FILE_SIZE) {
        alert('File too large. Maximum size is 10MB.')
        return
      }
      const meta: FileMetadata = {
        fileType,
        bodyPart,
        fileName: f.name,
        mimeType: f.type || 'application/octet-stream',
        fileSizeBytes: f.size,
      }
      onFileSelect(f, meta)
    },
    [fileType, bodyPart, onFileSelect],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files[0]
      if (f) processFile(f)
    },
    [processFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) processFile(f)
    },
    [processFile],
  )

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
            dragOver
              ? 'border-violet-500 bg-violet-500/5 glow-violet'
              : 'dark:border-slate-700 border-slate-300 hover:border-violet-500/30'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileInput}
            className="hidden"
          />
          <Upload className="w-8 h-8 dark:text-slate-500 text-slate-400 mx-auto mb-3" />
          {file ? (
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm dark:text-slate-400 text-slate-500">
                {formatFileSize(file.size)} &middot; {file.type}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-medium">Drag & drop image or click to browse</p>
              <p className="text-sm dark:text-slate-500 text-slate-400 mt-1">
                JPEG, PNG, DICOM &middot; Max 10MB
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">File type</label>
            <Select
              value={fileType}
              onChange={(e) => setFileType(e.target.value as FileMetadata['fileType'])}
            >
              <option value="xray">X-ray</option>
              <option value="scan">Scan</option>
              <option value="report">Report</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Body part</label>
            <Input
              placeholder="e.g. Chest, Knee, Hand"
              value={bodyPart}
              onChange={(e) => setBodyPart(e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
