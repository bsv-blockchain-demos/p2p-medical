# P2P Medical — Project Memory

## Project Overview
BSV-based peer-to-peer medical data sharing POC. Patient encrypts files for a doctor recipient, uploads to UHRP, mints PushDrop token on-chain, notifies via MessageBox.

## Key Architecture
- Frontend: Vite + React + TypeScript + Tailwind
- BSV SDK: `@bsv/sdk` (WalletClient, PushDrop, StorageUploader/StorageDownloader)
- Backend: Express overlay server at `VITE_API_URL` (tokens, lookup)
- Storage: UHRP via `nanostore.babbage.systems` (see [uhrp-storage.md](uhrp-storage.md))
- Messaging: BSVA-hosted MessageBox (`@bsv/message-box-client`, multi-region EU/US/AP fallback)

## Key Files
- `frontend/src/services/storage.ts` — UHRP upload/download (SDK-based, multi-provider)
- `frontend/src/services/tokens.ts` — PushDrop token minting, overlay submit, direct API share
- `frontend/src/services/crypto.ts` — Encryption/decryption, hashing
- `frontend/src/services/wallet.ts` — WalletClient singleton, identity key
- `frontend/src/services/messagebox.ts` — MessageBox notifications
- `frontend/src/components/app/PatientDashboard.tsx` — Upload flow orchestrator, types (FileMetadata, UploadResult)
- `frontend/src/components/app/ImageUpload.tsx` — File picker + metadata (type, body part, retention)
- `frontend/src/components/app/ImageViewer.tsx` — Doctor-side download, verify, decrypt, display
- `frontend/src/components/app/DoctorInbox.tsx` — Token inbox
- `frontend/src/components/app/RecipientSearch.tsx` — Doctor lookup
- `frontend/src/components/app/AuditTimeline.tsx` — Audit trail

## Important Types
- `FileMetadata` (PatientDashboard.tsx): fileType, bodyPart, fileName, mimeType, fileSizeBytes, retentionPeriod
- `UploadResult` (PatientDashboard.tsx): txid, uhrpUrl, recipientKey, timestamp, retentionExpiry, providerCount
- `MedicalTokenFields` (tokens.ts): eventType, contentHash, uhrpUrl, senderKey, recipientKey, metadata, keyID
- `MedicalToken` (tokens.ts): extends MedicalTokenFields + txid, vout, status, timestamp
- `AuditEvent` (tokens.ts): event (upload|access), txid, senderKey, recipientKey, accessedBy, uhrpUrl, metadata, timestamp
- Token metadata includes: retentionExpiry?, providerCount?

## Audit Events System
- MongoDB collection: `audit_events` (immutable inserts, never updated)
- Indexes: senderKey+createdAt, recipientKey+createdAt, txid, uhrpUrl
- Events inserted on `POST /api/tokens/share` (upload) and `POST /api/tokens/access` (access)
- Lookup query type `audit-events` in `ls_medical_token` service returns events where user is sender or recipient
- Frontend `queryAuditTrail()` returns `AuditEvent[]`, `resolveNames()` batch-fetches counterparty names
- AuditTimeline columns: COUNTERPARTY | NAME | TXID | UHRP | EVENT | FILE | DATE | STATUS
- Client-side search filters by txid, identity key, UHRP URL, or counterparty name

## Env Variables
- `VITE_API_URL` — Backend overlay server
- `VITE_UHRP_URL` — Legacy MinIO server (fallback only)
- `VITE_UHRP_PROVIDERS` — Comma-separated UHRP provider URLs (default: nanostore.babbage.systems)

## BSV SDK v2 API Notes
- `SecurityLevel` type: use `1 as SecurityLevel` for cast
- `CreateActionResult` has `txid?` and `tx?` (AtomicBEEF)
- `CreateActionInput` uses `outpoint: "txid.vout"` string format
- `SHIPBroadcaster` takes `(topics[], config?)` — config has `networkPreset`
- `StorageUploader` takes `{ storageURL, wallet }` config object
- `StorageDownloader` takes `{ networkPreset }` config, no wallet needed
- `PushDrop.lock()` signature: `(fields, protocolID, keyID, counterparty, forSelf?, includeSignature?)`
- `Transaction.fromAtomicBEEF(result.tx)` to convert for broadcasting
- ArrayBuffer cast needed: `data.buffer as ArrayBuffer` for Blob/crypto.subtle

## Identity Overlay Design
- **Protocol prefix:** `"p2p identity"`
- **PushDrop fields:** [prefix, identityKey, name, role, timestamp] (5 fields)
- **Topic:** `tm_identity`, **Lookup:** `ls_identity`
- **Basket:** `identity_tokens`, **Tags:** `['p2p identity', role]`
- **Protocol ID:** `[1, 'p2p identity']`, counterparty: `'self'`
- **MongoDB collection:** `identities` (unique index on identityKey)
- **Queries:** exact identityKey lookup, case-insensitive name regex + optional role filter

## npm Cache Issue
- User's `~/.npm/_cacache` has root-owned files from a prior sudo install
- Workaround: `npm install --cache /tmp/npm-cache`

## Implementation Status
- [x] Phase 1-8: Full scaffold, landing page, auth, overlay engine, patient upload, doctor receive, audit trail, Docker
- [x] Identity registration (overlay, API, frontend service, WalletContext, UI, routing, DoctorSearch)
- All TypeScript compiles clean, Vite build succeeds

## Detailed Topic Files
- [uhrp-storage.md](uhrp-storage.md) — UHRP architecture, provider config, upload/download flows
- [architecture.md](architecture.md) — Container topology, data flows, PushDrop token fields, MongoDB schema, component tree
