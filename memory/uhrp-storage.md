# UHRP Storage — Architecture & Implementation

## What Changed (2026-03-29)
Replaced custom Express/MinIO wrapper with real `@bsv/sdk` StorageUploader/StorageDownloader.

## Provider Configuration
- `VITE_UHRP_PROVIDERS` env var, comma-separated URLs
- Default: `https://nanostore.babbage.systems` (confirmed working live provider)
- Designed for N providers — upload goes to ALL configured providers in parallel
- Adding a second provider = just append to env var

## Upload Flow
```
Patient selects file + retention period
  -> for each provider: StorageUploader.publishFile({ file, retentionPeriod })
  -> Promise.allSettled (tolerates partial failures)
  -> collect: uhrpUrl (from first success), providerCount, retentionExpiry, confirmedSize
  -> mint PushDrop token with UHRP URL + metadata (including retentionExpiry, providerCount)
  -> notify recipient via MessageBox
```

## Download Flow
```
StorageDownloader.download(uhrpUrl)
  -> SDK resolves via overlay network (provider-agnostic)
  -> fallback: direct fetch from legacy MinIO at VITE_UHRP_URL (transitional)
```

## SDK Types (from @bsv/sdk)
- `StorageUploader({ wallet, storageURL })` — needs WalletClient
- `uploader.publishFile({ file: { data, type }, retentionPeriod })` -> `UploadFileResult { published, uhrpURL }`
- `StorageDownloader()` — no wallet needed
- `downloader.download(uhrpUrl)` -> `DownloadResult { data: Uint8Array, mimeType: string | null }`
- File data for upload: `Array.from(uint8Array)` or `Uint8Array`

## Retention Options (in ImageUpload.tsx)
| Label | Minutes |
|-------|---------|
| 1 Day | 1440 |
| 1 Week | 10080 |
| 1 Month | 43200 |
| 3 Months | 129600 |
| 6 Months | 262800 |
| 1 Year | 525600 (default) |
| 5 Years | 2628000 |
| 10 Years | 5256000 |

## Docker Compose
- `VITE_UHRP_PROVIDERS` added to frontend service env in `docker-compose.yml`
- `VITE_UHRP_URL` (legacy MinIO) kept — still needed for download fallback to local uhrp-storage container
- Uploads go directly to `nanostore.babbage.systems` via SDK, not through the local uhrp-storage container
- Run with: `docker compose up --build`

## Key Decisions
- MIME type now properly passed through (was `_mimeType` unused param before)
- retentionExpiry stored as epoch ms in token metadata for display on doctor side
- providerCount stored in token metadata for transparency
- Legacy MinIO server kept as download fallback only (no longer upload target)
- WalletClient instantiated per-upload in storage.ts (not shared singleton — upload is infrequent)

## Files Modified
- `frontend/src/services/storage.ts` — Core rewrite
- `frontend/src/services/tokens.ts` — Added retentionExpiry?, providerCount? to metadata type
- `frontend/src/components/app/ImageUpload.tsx` — Retention selector (3-col grid)
- `frontend/src/components/app/PatientDashboard.tsx` — Types, upload wiring, success widget enrichment
- `frontend/src/components/app/ImageViewer.tsx` — Shows retention expiry in file details
- `frontend/.env.example` — Added VITE_UHRP_PROVIDERS
- `docker-compose.yml` — Added VITE_UHRP_PROVIDERS to frontend env
