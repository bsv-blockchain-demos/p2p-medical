import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import multer from 'multer'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const PORT = process.env.PORT || 3002
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000'
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin'
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin'
const S3_BUCKET = process.env.S3_BUCKET || 'medical-files'

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
})

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } })

const app = express()
app.use(cors())
app.use(express.json())

// Upload file — returns UHRP URL based on content hash
app.post('/publishFile', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' })
      return
    }

    const data = req.file.buffer
    const hash = crypto.createHash('sha256').update(data).digest('hex')
    const key = `uhrp/${hash}`

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: req.file.mimetype || 'application/octet-stream',
        Metadata: {
          'content-hash': hash,
        },
      }),
    )

    const uhrpURL = `uhrp://${hash}`
    res.json({ uhrpURL, hash, size: data.length })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// Download file by UHRP URL
app.get('/download/:hash', async (req, res) => {
  try {
    const { hash } = req.params
    const key = `uhrp/${hash}`

    const result = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      }),
    )

    if (!result.Body) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    const bodyBytes = await result.Body.transformToByteArray()

    // Verify hash
    const computedHash = crypto.createHash('sha256').update(bodyBytes).digest('hex')
    if (computedHash !== hash) {
      res.status(500).json({ error: 'Hash verification failed' })
      return
    }

    res.set('Content-Type', result.ContentType || 'application/octet-stream')
    res.set('X-Content-Hash', hash)
    res.send(Buffer.from(bodyBytes))
  } catch (error) {
    console.error('Download error:', error)
    res.status(500).json({ error: 'Download failed' })
  }
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'uhrp-storage' })
})

app.listen(PORT, () => {
  console.log(`UHRP Storage Server running on port ${PORT}`)
})
