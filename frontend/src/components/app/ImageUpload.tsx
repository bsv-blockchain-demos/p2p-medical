import { useCallback, useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileImage, FileText, File as FileIcon, CheckCircle2, Scan, Clock, HardDrive, ChevronDown, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { formatFileSize } from '@/lib/utils'
import type { FileMetadata } from './PatientDashboard'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/dicom']

const UHRP_PROVIDERS = [
  { key: 'https://go-uhrp-us-1.bsvblockchain.tech', label: 'BSV Blockchain Tech (Go-US-1)' },
  { key: 'https://nanostore.babbage.systems', label: 'Nanostore' },
] as const

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
  const providerRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileType, setFileType] = useState<FileMetadata['fileType']>('xray')
  const [bodyPart, setBodyPart] = useState('')
  const [retentionPeriod, setRetentionPeriod] = useState(10080) // 1 Week default
  const [selectedProviders, setSelectedProviders] = useState<string[]>([UHRP_PROVIDERS[0].key])
  const [providerOpen, setProviderOpen] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    if (!providerOpen) return
    const handler = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setProviderOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [providerOpen])

  // Re-sync metadata to parent when dropdown values change after file is already selected
  useEffect(() => {
    if (!file) return
    const meta: FileMetadata = {
      fileType,
      bodyPart,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSizeBytes: file.size,
      retentionPeriod,
      selectedProviders,
    }
    onFileSelect(file, meta)
  }, [fileType, bodyPart, retentionPeriod, selectedProviders]) // eslint-disable-line react-hooks/exhaustive-deps

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
        selectedProviders,
      }
      onFileSelect(f, meta)
    },
    [fileType, bodyPart, retentionPeriod, selectedProviders, onFileSelect],
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
          <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-4">
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
            <div className="relative" ref={providerRef}>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4" />
                UHRP Storage
              </label>
              <button
                type="button"
                onClick={() => setProviderOpen((v) => !v)}
                className="flex h-10 w-full items-center justify-between rounded-md border dark:border-slate-700 border-slate-300 dark:bg-slate-800/50 bg-white px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:border-slate-400/40"
              >
                <span className="flex items-center gap-1.5 truncate">
                  {selectedProviders.length === UHRP_PROVIDERS.length ? (
                    <span className="text-slate-900 dark:text-slate-100">All providers</span>
                  ) : (
                    UHRP_PROVIDERS.filter((p) => selectedProviders.includes(p.key)).map((p) => (
                      <span
                        key={p.key}
                        className="inline-flex items-center rounded-full border dark:border-slate-600 border-slate-300 dark:bg-slate-700/50 bg-slate-100 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-xs font-medium"
                      >
                        {p.label}
                      </span>
                    ))
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${providerOpen ? 'rotate-180' : ''}`} />
              </button>
              {providerOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-md border dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-white shadow-lg py-1">
                  {UHRP_PROVIDERS.map((p) => {
                    const checked = selectedProviders.includes(p.key)
                    const isOnly = checked && selectedProviders.length === 1
                    return (
                      <button
                        key={p.key}
                        type="button"
                        disabled={isOnly}
                        onClick={() =>
                          setSelectedProviders((prev) =>
                            checked ? prev.filter((k) => k !== p.key) : [...prev, p.key],
                          )
                        }
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            checked
                              ? 'border-violet-500 bg-violet-500 text-white'
                              : 'dark:border-slate-600 border-slate-300'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
                        </span>
                        <span className="flex flex-col items-start min-w-0">
                          <span className="text-slate-900 dark:text-slate-100">{p.label}</span>
                          <span className="text-[10px] text-slate-400 truncate w-full">{p.key}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
