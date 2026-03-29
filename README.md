# P2P Medical Data Sharing

**Zero-Access Architecture** — your files are encrypted before they leave your browser. Reading them back requires your doctor's wallet key and the file's content address. Miss either one and the data stays locked — for everyone, including the platform.

## How It Works

1. **Pick a file, pick your doctor** — select a medical file and choose the doctor you want to share it with. The file is encrypted right in your browser — it never leaves your device unprotected.
2. **Permanent proof it was shared** — the ciphertext is stored by its content hash, a unique address that only the recipient can use. A blockchain transaction records who shared what, with whom, and when.
3. **Doctor verifies and views** — only your doctor's wallet holds the key that pairs with the file's content address. It verifies integrity, decrypts, and records an on-chain attestation — proof the file was received intact.

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
- **BSV Wallet** — a BRC-100 compatible wallet for connecting from the browser. Download [BSV Desktop](https://desktop.bsvb.tech) or [BSV Browser](https://mobile.bsvb.tech) for mobile.

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
| `ARC_URL` | `https://api.taal.com/arc` | ARC miner endpoint for transaction broadcast |
| `ARC_API_KEY` | *(empty)* | TAAL ARC authorization key (optional) |

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

### Broadcast

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/broadcast` | Forward BEEF transaction to ARC miners |

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
