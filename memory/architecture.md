# Architecture Details

## Container Topology
```
Docker Compose Stack:
  frontend (:3000)     — Vite + React 18
  backend (:3001)      — Express + overlay engine → mongodb
  uhrp-storage (:3002) — File upload/download → minio (S3)
  message-box (:3003)  — Store & forward messaging → mongodb
  mongodb (:27017)     — Overlay state + messages
  minio (:9000/:9001)  — S3-compatible file storage
  bhs (:8080)          — Block Headers Service (SPV)
```

## Data Flow — Patient Upload
1. Select image (<=10MB)
2. Lookup doctor (Identity overlay or paste pubkey)
3. Encrypt with wallet.encrypt() (ECDH + AES-256-GCM)
4. Hash ciphertext (SHA-256)
5. Upload to UHRP (StorageUploader → MinIO)
6. Mint PushDrop token (createAction + SHIPBroadcaster)
7. Notify doctor (MessageBox)
8. Show confirmation (txid + uhrpUrl)

## Data Flow — Doctor Receive
1. Query inbox (LookupResolver → overlay backend)
2. Select pending token
3. Download from UHRP (StorageDownloader)
4. Decrypt (wallet.decrypt with sender's pubkey)
5. Verify hash (SHA-256 match)
6. Render image
7. Spend token + mint receipt (access proof on-chain)

## PushDrop Token Fields
```
[0] protocolPrefix: "p2p-medical"
[1] eventType: "upload" | "accessed"
[2] contentHash: SHA-256 hex
[3] uhrpUrl: "uhrp://..."
[4] senderKey: patient pubkey
[5] recipientKey: doctor pubkey
[6] metadata: JSON { fileType, bodyPart, fileName, mimeType, fileSizeBytes }
[7] keyID: content hash (used for ECDH key derivation)
[8] timestamp: unix ms
```

## Identity Overlay (PushDrop Token)
```
[0] protocolPrefix: "p2p identity"
[1] identityKey: hex public key
[2] name: display name
[3] role: "patient" | "doctor"
[4] timestamp: epoch ms string
```

## MongoDB Schema
- Collection: `medical_tokens`
  - Indexes: recipientKey+status, senderKey, contentHash, txid+vout (unique), status+createdAt
- Collection: `identities`
  - Indexes: identityKey (unique), name, role
  - Doc: { txid, vout, identityKey, name, role, registeredAt, createdAt, updatedAt }

## React Component Tree
```
App → LandingPage (/) | ProtectedRoute → RegisterProfile | MainApp (/app)
  RegisterProfile → Name input, Role toggle cards (Patient/Doctor), Register button
  MainApp → AppHeader (ProfileDisplay, NavTabs)
          → PatientDashboard (DoctorSearch, ImageUpload, UploadProgress, Confirmation)
          → DoctorInbox (TokenList → TokenCard, ImageViewer → DecryptProgress, ImageDisplay, BlockchainProof)
          → AuditTimeline (AuditFilters, AuditEntry)
```
