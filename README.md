# P2P Medical Data Sharing

An encrypted file-sharing demonstration using BSV wallets, content-addressed storage and a MongoDB-backed audit timeline. A sender encrypts a file through their wallet, uploads the ciphertext to a storage provider, and shares its metadata with the recipient.

[Hosted demo](https://p2p-medical.bsvblockchain.tech). Use synthetic files when evaluating the application.

## How It Works

1. **Encrypt and upload:** the sender selects a file and recipient. The wallet encrypts it using the recipient's identity key, then the app uploads the ciphertext to selected UHRP providers.
2. **Share a reference:** the app creates a PushDrop transaction, sends token metadata to the backend, and attempts a MessageBox notification. The content hash identifies and checks the ciphertext; it is not an access-control credential.
3. **Verify and decrypt:** the recipient downloads the ciphertext, checks its SHA-256 hash, and asks their wallet to decrypt it using the sender's identity key and the shared key identifier.

View and access events are written to MongoDB. The viewer records a view after decryption without waiting for it to succeed, so the application does not guarantee that every view is recorded or that view events are on-chain. The REST routes also accept identity keys from request bodies without wallet signature authentication. These are material limitations of the current demonstration.

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
│  (multi)   │         │            │
└────────────┘         └────────────┘
```

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | Vite, React 18, TypeScript, Tailwind, Framer Motion | UI, in-browser encryption, wallet interaction, provider selection |
| Backend | Express and MongoDB | Token storage, audit events and custom `/submit` and `/lookup` handlers |
| Blockchain | `@bsv/sdk`, PushDrop tokens, BRC-100 wallet | Identity, on-chain proof, key derivation, encryption |
| Storage | UHRP — Go UHRP (primary), Nanostore (secondary) | Multi-provider content-addressed encrypted file hosting |
| Messaging | MessageBox (BSVA-hosted, multi-region) | Real-time notifications to doctor's wallet |

## Prerequisites

- **Node.js** 22
- **npm** (or your preferred package manager)
- **MongoDB** — local instance or Docker
- **BSV Wallet** — a BRC-100 compatible wallet for connecting from the browser. Download [BSV Desktop](https://desktop.bsvb.tech) or [BSV Browser](https://mobile.bsvb.tech) for mobile.

## Quick Start (Docker)

From a new checkout:

```bash
git clone https://github.com/bsv-blockchain-demos/p2p-medical.git
cd p2p-medical
docker compose up --build
```

This starts all services:

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Vite dev server |
| Backend | 3001 | Express API + overlay engine |
| MongoDB | 27017 | Database |
| Block Headers Service | 8080 | BSV header verification |

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

### External Services

By default, the frontend uses `go-uhrp-us-1.bsvblockchain.tech` as the primary UHRP provider, with `nanostore.babbage.systems` available as a secondary option. Users can select one or both providers at upload time. MessageBox notifications use BSVA-hosted infrastructure with automatic multi-region fallback (EU, US, AP). No local storage services are required.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `MONGO_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `DB_NAME` | `p2p_medical` | Database name |
| `BHS_URL` | `http://localhost:8080` | Present in the template and Compose configuration; the current backend does not read it. |
| `ARC_URL` | `https://api.taal.com/arc` | ARC miner endpoint for transaction broadcast |
| `ARC_API_KEY` | *(empty)* | TAAL ARC authorization key (optional) |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3001` | Backend API URL |
| `VITE_UHRP_PROVIDERS` | `https://go-uhrp-us-1.bsvblockchain.tech` | Comma-separated UHRP provider URLs (user selects at upload time) |

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
| `POST` | `/api/tokens/access` | Mark as decrypted and record a MongoDB access event |
| `POST` | `/api/tokens/view` | Record a MongoDB view event |
| `PATCH` | `/api/tokens/:txid/cdn-url` | Backfill a CDN URL using a supplied sender key; no signature check is performed |

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
│   ├── AuditTimeline.tsx        # Audit trail (FROM, TO, TXID, FILE, DATE, STATUS)
│   ├── ImageViewer.tsx          # Download, verify, decrypt, display (shared by Inbox + Audit)
│   ├── ImageUpload.tsx          # File picker, metadata, UHRP provider selection
│   ├── UploadProgress.tsx       # Step-by-step upload progress + success details
│   ├── RecipientSearch.tsx      # Doctor lookup
│   └── RegisterProfile.tsx      # First-time registration
├── services/
│   ├── wallet.ts                # WalletClient singleton
│   ├── crypto.ts                # ECDH encryption/decryption
│   ├── storage.ts               # UHRP multi-provider upload/download + UHRP advertisement
│   ├── tokens.ts                # Token minting, audit queries, CDN URL backfill
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

## Build checks

Run `npm ci` and `npm run build` separately in `backend/` and `frontend/`. No automated test script is provided in either package. A complete functional check needs two wallet identities, MongoDB, storage services and funds for the wallet transactions. The Compose configuration uses mainnet ARC infrastructure.

## Licence

**Documented licence: MIT.** This is the declaration recorded in the project documentation. No standalone licence file or package licence declaration is included in this repository.
