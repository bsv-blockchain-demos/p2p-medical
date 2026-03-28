import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Upload } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { formatFileSize } from '@/lib/utils'
import type { FileMetadata } from './PatientDashboard'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/dicom']

const RETENTION_OPTIONS = [
  { label: '1 Day', minutes: 1440 },
  { label: '1 Week', minutes: 10080 },
  { label: '1 Month', minutes: 43200 },
  { label: '3 Months', minutes: 129600 },
  { label: '6 Months', minutes: 262800 },
  { label: '1 Year', minutes: 525600 },
  { label: '5 Years', minutes: 2628000 },
  { label: '10 Years', minutes: 5256000 },
] as const

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
  const [retentionPeriod, setRetentionPeriod] = useState(525600) // 1 Year default

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
        retentionPeriod,
      }
      onFileSelect(f, meta)
    },
    [fileType, bodyPart, retentionPeriod, onFileSelect],
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

  const dropZoneShadow = dragOver
    ? '0 0 30px rgba(139, 92, 246, 0.3), 0 0 60px rgba(139, 92, 246, 0.1)'
    : file
      ? '0 0 15px rgba(139, 92, 246, 0.1)'
      : 'none'

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <motion.div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 ${
            dragOver
              ? 'border-violet-500 bg-violet-500/5'
              : 'dark:border-slate-700 border-slate-300 hover:border-violet-500/30'
          }`}
          animate={{ boxShadow: dropZoneShadow }}
          transition={{ duration: 0.3 }}
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
          {!file ? (
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Upload className="w-8 h-8 dark:text-slate-500 text-slate-400 mx-auto mb-3" />
            </motion.div>
          ) : (
            <Upload className="w-8 h-8 dark:text-slate-500 text-slate-400 mx-auto mb-3" />
          )}
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
        </motion.div>

        <div className="grid grid-cols-3 gap-4">
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
          <div>
            <label className="text-sm font-medium mb-1 block">Retention</label>
            <Select
              value={String(retentionPeriod)}
              onChange={(e) => setRetentionPeriod(Number(e.target.value))}
            >
              {RETENTION_OPTIONS.map((opt) => (
                <option key={opt.minutes} value={opt.minutes}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
