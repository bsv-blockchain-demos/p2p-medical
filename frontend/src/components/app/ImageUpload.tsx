import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileImage, FileText, File as FileIcon, CheckCircle2, Scan, Heart, Clock } from 'lucide-react'
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

function getFileIcon(file: File) {
  if (file.type.startsWith('image/')) return FileImage
  if (file.type === 'application/pdf' || file.type === 'text/plain') return FileText
  return FileIcon
}

export default function ImageUpload({ onFileSelect, file }: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileType, setFileType] = useState<FileMetadata['fileType']>('xray')
  const [bodyPart, setBodyPart] = useState('')
  const [retentionPeriod, setRetentionPeriod] = useState(10080) // 1 Week default

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

  const SelectedIcon = file ? getFileIcon(file) : null

  return (
    <Card>
      <CardContent className="p-6 space-y-0">
        {/* Gradient border wrapper */}
        <motion.div
          className={`rounded-xl p-px bg-gradient-to-br transition-all duration-300 ${
            dragOver
              ? 'from-violet-500/50 via-violet-500/20 to-violet-500/30'
              : file
                ? 'from-violet-500/30 via-transparent to-violet-500/15'
                : 'from-violet-500/20 via-transparent to-violet-500/10'
          }`}
          animate={{
            boxShadow: dropZoneShadow,
            scale: dragOver ? 1.01 : 1,
          }}
          transition={{ duration: 0.3 }}
        >
          <div
            className={`rounded-[11px] p-10 text-center cursor-pointer transition-colors duration-200 ${
              file
                ? 'bg-violet-50 dark:bg-violet-950/20'
                : 'bg-white dark:bg-slate-900'
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
            {file && SelectedIcon ? (
              <>
                <div className="relative inline-flex mb-3">
                  <SelectedIcon className="w-10 h-10 text-violet-500 dark:text-violet-400" />
                  <CheckCircle2 className="w-4 h-4 text-violet-500 absolute -top-1 -right-1.5" />
                </div>
                <p className="text-violet-700 dark:text-violet-300 font-semibold">{file.name}</p>
                <p className="text-sm dark:text-slate-400 text-slate-500 mt-0.5">
                  {formatFileSize(file.size)} &middot; {file.type}
                </p>
                <p className="text-xs dark:text-slate-500 text-slate-400 mt-2">Click to replace</p>
              </>
            ) : (
              <>
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Upload className="w-10 h-10 dark:text-slate-500 text-slate-400 mx-auto mb-3" />
                </motion.div>
                <p className="font-medium">Drop your file here, or click to browse</p>
                <p className="text-sm dark:text-slate-500 text-slate-400 mt-1">
                  JPEG, PNG, DICOM &middot; Max 10MB
                </p>
              </>
            )}
          </div>
        </motion.div>

        {/* Metadata row */}
        <div className="border-t dark:border-slate-800/60 border-slate-200/60 pt-5 mt-5">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Scan className="w-4 h-4" />
                File type
              </label>
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
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Heart className="w-4 h-4" />
                Body part
              </label>
              <Input
                placeholder="e.g. Chest, Knee, Hand"
                value={bodyPart}
                onChange={(e) => setBodyPart(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Retention
              </label>
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
        </div>
      </CardContent>
    </Card>
  )
}
