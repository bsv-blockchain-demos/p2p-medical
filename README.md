# P2P Medical Data Sharing

Peer-to-peer medical file sharing on the BSV blockchain. Patients encrypt files in-browser, share them directly with a chosen doctor, and every access is permanently recorded on-chain.

## How It Works

1. **Patient picks a file and a doctor** — the file is encrypted with AES-256-GCM inside the browser using an ECDH shared key derived from both wallets. It never leaves the device unprotected.
2. **Encrypted upload + on-chain proof** — the ciphertext is stored via UHRP, and a PushDrop token is minted on-chain as permanent, tamper-proof proof of the transfer.
3. **Doctor verifies and views** — the doctor's wallet verifies the file hash, decrypts it, and records an on-chain attestation that the file was received and viewed.

Every share and every view is logged in an immutable audit trail — no one can access a file without a permanent record.

## Architecture

```
┌────────────┐         ┌────────────┐
│  Frontend   │ ◄─────► │  Backend    │
│  Vite+React │  /api   │  Express    │
│  :3000      │         │  :3001      │
└─────┬──────┘         └─────┬──────┘
      │                       │
      │  @bsv/sdk             │  MongoDB :27017
      │  WalletClient         │  @bsv/overlay
      │                       │
      ▼                       ▼
┌────────────┐         ┌────────────┐
│  UHRP      │         │  BSV       │
│  Storage   │         │  Blockchain│
└────────────┘         └────────────┘
```

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | Vite, React 18, TypeScript, Tailwind, Framer Motion | UI, in-browser encryption, wallet interaction |
| Backend | Express, MongoDB, `@bsv/overlay` | Token storage, audit events, overlay engine (SHIP/SLAP) |
| Blockchain | `@bsv/sdk`, PushDrop tokens, BRC-100 wallet | Identity, on-chain proof, key derivation, encryption |
| Storage | UHRP via `nanostore.babbage.systems` | Content-addressed encrypted file hosting |
| Messaging | MessageBox | Real-time notifications to doctor's wallet |

## Prerequisites

- **Node.js** >= 20
- **npm** (or your preferred package manager)
- **MongoDB** — local instance or Docker
- **BSV Wallet** — a BRC-100 compatible wallet (e.g. MetaNet Desktop) for connecting from the browser

## Quick Start (Docker)

The easiest way to run everything:

```bash
docker-compose up
```

This starts all services:

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Vite dev server |
| Backend | 3001 | Express API + overlay engine |
| MongoDB | 27017 | Database |
| MinIO | 9000 / 9001 | S3-compatible storage (fallback) |
| Block Headers Service | 8080 | BSV header verification |
| UHRP Storage | 3002 | Local UHRP server (fallback) |
| MessageBox | 3003 | Notification service |

Open [http://localhost:3000](http://localhost:3000) and connect your wallet.

## Local Development (without Docker)

You need MongoDB running locally (or set `MONGO_URL` to a remote instance).

### Backend

```bash
cd backend
cp .env.example .env    # edit if needed
npm install
npm run dev             # starts on :3001
```

### Frontend

```bash
cd frontend
cp .env.example .env    # edit if needed
npm install
npm run dev             # starts on :3000
```

### Optional Services

The local UHRP storage and MessageBox servers are only needed if you want to run fully offline. By default, the frontend uses `nanostore.babbage.systems` for UHRP uploads.

```bash
# UHRP Storage (fallback)
cd services/uhrp-storage && npm install && npm run dev   # :3002

# MessageBox
cd services/message-box && npm install && npm run dev    # :3003
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `MONGO_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `DB_NAME` | `p2p_medical` | Database name |
| `BHS_URL` | `http://localhost:8080` | Block Headers Service URL |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3001` | Backend API URL |
| `VITE_UHRP_URL` | `http://localhost:3002` | Legacy MinIO UHRP (fallback only) |
| `VITE_UHRP_PROVIDERS` | `https://nanostore.babbage.systems` | Comma-separated UHRP provider URLs |
| `VITE_MESSAGEBOX_URL` | `http://localhost:3003` | MessageBox server URL |

## API Routes

### Identity

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/identity/register` | Register or update identity (one role per key) |
| `GET` | `/api/identity/profile?key=` | Fetch profile by identity key |
| `DELETE` | `/api/identity/profile` | Delete profile |
| `GET` | `/api/identity/search?q=&role=` | Search by name, optional role filter |

### Tokens

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/tokens/share` | Share a token + log upload audit event |
| `POST` | `/api/tokens/access` | Mark as decrypted + log access audit event |
| `POST` | `/api/tokens/view` | Record view + log view audit event |

### Overlay (SHIP/SLAP)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/submit` | Submit transactions to the overlay |
| `POST` | `/lookup` | Query tokens, identities, audit events |

## Project Structure

```
frontend/src/
├── pages/
│   ├── LandingPage.tsx          # Marketing page + wallet connect
│   └── MainApp.tsx              # App shell with navigation
├── components/app/
│   ├── PatientDashboard.tsx     # Upload flow orchestrator
│   ├── DoctorInbox.tsx          # Pending encrypted tokens
│   ├── AuditTimeline.tsx        # Immutable event log
│   ├── ImageViewer.tsx          # Download, verify, decrypt, display
│   ├── ImageUpload.tsx          # File picker + metadata
│   ├── RecipientSearch.tsx      # Doctor lookup
│   └── RegisterProfile.tsx      # First-time registration
├── services/
│   ├── wallet.ts                # WalletClient singleton
│   ├── crypto.ts                # ECDH encryption/decryption
│   ├── storage.ts               # UHRP upload/download
│   ├── tokens.ts                # Token minting + audit queries
│   └── messagebox.ts            # Doctor notifications
└── context/
    └── WalletContext.tsx         # Auth + profile state

backend/src/
├── index.ts                     # Entry point, MongoDB setup
├── routes/
│   ├── identity.ts              # Identity CRUD
│   └── tokens.ts                # Token share/access/view
└── overlay/
    ├── index.ts                 # Overlay engine setup
    ├── topic-manager.ts         # Transaction admission
    └── lookup-service.ts        # Query resolution
```

## License

Private — not licensed for redistribution.
