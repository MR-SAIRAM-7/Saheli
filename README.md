# SHG Chain (Saheli)

Agentic AI and Algorand-powered financial hub for Women Self-Help Groups (SHGs).

Built for hackathon demonstration under the themes:
- Blockchain with Algorand
- Agentic AI x Blockchain

## Executive Summary

SHG Chain digitizes SHG savings, loans, and trust records using an auditable blockchain-first architecture with a WhatsApp-first user experience.

The platform addresses common SHG pain points:
- Manual bookkeeping errors
- Low transparency in pooled funds
- Slow emergency loan processing
- Limited institutional credit visibility
- Rural onboarding friction due to app complexity

The project combines:
- WhatsApp voice/text interactions
- AI-driven treasury and loan workflows
- Multi-role web dashboards (Member, Leader, Bank/NGO)
- QR-based offline verification proofs
- Optional Twilio + Cloudinary integration for automatic WhatsApp QR delivery

## Problem Statement

Large numbers of women in SHGs rely on collective savings and micro-credit but face trust, auditability, and formal credit access barriers. Traditional records are easy to dispute and difficult for banks/NGOs to verify quickly.

## Solution

SHG Chain creates a digital financial layer where transactions and reputation signals are verifiable, role-governed, and accessible through familiar channels like WhatsApp.

Core design goals:
- Make Web3 invisible to end users
- Keep verification strong for institutions
- Automate repetitive treasury and repayment workflows
- Keep the demo reliable under hackathon constraints

## Feature Set

### Must-Have Features

1. WhatsApp-first text and voice flow
- Backend webhook endpoint receives WhatsApp messages
- Voice notes can be transcribed using OpenAI Whisper (when configured)
- Intent parsing supports deposit, withdrawal, loan, balance, and QR requests

2. Agentic micro-loan flow
- Emergency and micro-loan logic in AI/agent routes
- Leader approval is enforced before final loan QR generation in dashboard flow
- Auto-repayment schedules are tracked and exposed via API

3. AI-driven idle fund management
- Simulated vault deployment and yield harvesting through agent routes
- Leader dashboard includes invest/harvest controls and terminal log

4. Offline-first QR proof system
- QR payload contains transaction metadata and explorer verification reference
- Verification endpoint available for scan-side checks
- Optional wallet deep link included in QR payload

5. Role-based web portals
- Member dashboard: passport, activity, loan request, auto-repayment, support/settings
- Leader dashboard: treasury controls, approvals, reports, loan queue, QR generation
- Bank dashboard: scanner flow, SHG directory, grant approval, ledger monitoring

### Wow-Factor Extensions Included in This Repo

- Dynamic trust-score style passport surfaces (d-SBT concept represented in UI and data model)
- Gasless interaction pattern for member-side loan requests (relayer-style backend flow)
- Multi-sig approval workflows for sensitive actions
- WhatsApp QR proof auto-delivery using Twilio + Cloudinary

## Current Implementation Notes

This codebase now runs strict Algorand-backed financial execution:
- Deposit, loan disbursement, grant, multisig, AI-agent treasury actions, and QR anchors produce real Algorand TxIDs
- Verification uses Algorand Indexer lookups instead of local-only hash simulation
- Twilio and Cloudinary flows remain real API integrations for WhatsApp QR delivery

## Technical Architecture

### Frontend
- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn-style UI components
- GSAP-based motion and dashboard transitions
- Pera wallet connect integration for wallet UX

### Backend
- Node.js + Express + TypeScript
- MongoDB via Mongoose
- JWT auth and role-aware data routing
- AI/agent workflow endpoints
- Twilio webhook handling for WhatsApp
- Cloudinary upload for QR media hosting

### Blockchain Layer
- Algorand SDK dependency included
- Strict on-chain transaction submission from backend relayer/treasury signer
- Indexer-backed transaction verification for QR and audit flows
- Pera wallet integration for wallet-first user onboarding and login

## Repository Structure

```
.
|- app/         # React frontend
|  |- src/
|  |  |- components/
|  |  |- dashboards/
|  |  |- contexts/
|  |  |- hooks/
|  |  |- lib/
|- backend/     # Express API
|  |- src/
|  |  |- routes/
|  |  |- services/
|  |  |- models/
|  |  |- middleware/
|  |  |- config/
```

## Local Setup

### Prerequisites
- Node.js 20+
- npm
- MongoDB (local or remote)

### 1) Install dependencies

From project root:

```bash
cd app && npm install
cd ../backend && npm install
```

### 2) Configure backend environment

Copy and edit:

```bash
cd backend
cp .env.example .env
```

Minimum required for local run:
- PORT
- NODE_ENV
- MONGODB_URI (optional if using default local fallback)

Required for strict Algorand execution:
- ALGORAND_STRICT_MODE=true
- ALGORAND_NETWORK=testnet (or mainnet/localnet)
- ALGORAND_TREASURY_MNEMONIC
- ALGORAND_ALGOD_SERVER (optional if using Algonode default)
- ALGORAND_ALGOD_PORT (default 443)
- ALGORAND_ALGOD_TOKEN and ALGORAND_ALGOD_TOKEN_HEADER (only if provider requires auth)
- ALGORAND_INDEXER_SERVER (optional if using Algonode default)
- ALGORAND_INDEXER_PORT (default 443)
- ALGORAND_INDEXER_TOKEN and ALGORAND_INDEXER_TOKEN_HEADER (optional)
- ALGORAND_MICROALGOS_PER_RUPEE (default 1000)

Frontend wallet setting:
- VITE_ALGORAND_CHAIN_ID=416002 for testnet (416001 mainnet)

For WhatsApp + QR media delivery:
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_WHATSAPP_FROM (or TWILIO_WHATSAPP_NUMBER)
- TWILIO_MESSAGING_SERVICE_SID (optional, recommended for production)
- TWILIO_VALIDATE_SIGNATURE
- PUBLIC_BASE_URL (required when validating signatures behind tunnels/proxies)
- TWILIO_STATUS_CALLBACK_URL (optional override)
- TWILIO_WHATSAPP_CONTENT_SID (optional approved template SID)
- CLOUDINARY_CLOUD_NAME
- Either CLOUDINARY_UPLOAD_PRESET, or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET

Optional voice transcription:
- OPENAI_API_KEY

For app-wide language translation using Sarvam AI:
- SARVAM_API_KEY
- SARVAM_API_URL (optional)
- SARVAM_API_KEY_HEADER (optional)
- SARVAM_APP_ID (optional)

### 3) Run backend

```bash
cd backend
npm run dev
```

Backend health:
- http://127.0.0.1:3001/health

### 4) Run frontend

```bash
cd app
npm run dev
```

Frontend runs on Vite default and proxies /api to backend (127.0.0.1:3001).

## Demo User Seeding (Judging Panel)

Seed endpoint:
- POST /api/auth/seed-demo

PowerShell example:

```powershell
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/api/auth/seed-demo"
```

Demo credentials:
- Member: +91-9876543210
- Leader: +91-9000000001
- Bank: +91-9000000002
- Password: demo1234

## WhatsApp Integration

### Incoming WhatsApp messages
- Endpoint: POST /webhook/whatsapp
- Supports text and media payload handling
- If media is audio and OPENAI_API_KEY is set, backend attempts transcription
- Parsed intent is forwarded to the AI chat route
- Twilio signature validation is supported (set TWILIO_VALIDATE_SIGNATURE=true)
- Free-form/unknown intents can use OpenAI chat completion for natural AI replies

### Twilio delivery status callback
- Endpoint: POST /webhook/twilio/status
- Captures delivery lifecycle updates (queued, sent, delivered, failed)
- Configure this URL in Twilio Message status callback settings

## App-Wide Translation (Sarvam)

- Backend endpoints:
	- POST /api/translate
	- POST /api/translate/batch
- Frontend language selector now uses these endpoints to translate the full interface to selected Indian languages.
- Sarvam API key is kept server-side in backend environment variables.

### Real WhatsApp production notes
- Use an approved WhatsApp sender (not sandbox-only) before going live
- If outside 24-hour customer care window, send approved template messages (Content API)
- Set TWILIO_WHATSAPP_CONTENT_SID for your approved template SID
- Use TWILIO_MESSAGING_SERVICE_SID if managing multiple WhatsApp senders

### Automatic QR delivery to member WhatsApp
- Triggered by QR generation route: POST /api/qr/generate
- Backend flow:
	1. Generate QR as data URL
	2. Upload image to Cloudinary
	3. Send Twilio WhatsApp media message with proof details and QR image
- Response includes delivery metadata:
	- attempted
	- sent
	- messageSid
	- mediaUrl
	- error (if failed)

## Primary API Areas

- Auth: /api/auth
	- register, login, profile, seed-demo
- Members: /api/members
- Transactions: /api/transactions
- Loans: /api/loans
- Multi-sig: /api/multisig
- AI Chat/Insights: /api/ai-agent
- Autonomous Agent: /api/agent
- QR: /api/qr
- Stats and institutional views: /api/stats

## Product Flows (Demo)

### Flow 1: Member QR Proof
1. Member generates QR in dashboard
2. QR payload is created with tx metadata
3. System attempts Cloudinary upload and Twilio WhatsApp send
4. Member receives QR proof in WhatsApp (when configured)

### Flow 2: Emergency/Micro Loan Lifecycle
1. Member requests loan from member experience
2. Backend evaluates risk and threshold policy
3. Member and SHG leaders are notified on WhatsApp about the request
4. Leader approves in loan queue
5. On disbursement, member receives WhatsApp approval with tx verification link
6. Loan becomes approved and QR can be generated

### Flow 3: Institutional Verification
1. Bank dashboard opens scanner flow
2. TX hash / payload is verified through QR verify endpoint
3. Institution views ledger and SHG trust context

## Build and Quality Checks

Frontend:

```bash
cd app
npm run build
```

Backend:

```bash
cd backend
npm run build
```

## MERN Readiness

The project now runs as a MERN stack in runtime paths:
- MongoDB is the source of truth for members, loans, transactions, multi-leader approvals, stats, and agent flows.
- Express + Node APIs serve all business logic under `/api/*`.
- React frontend calls env-configurable API base URL (`VITE_API_BASE_URL`, default `/api`).
- No API route depends on runtime in-memory mock arrays.

## Deployment

### Option A: Docker Compose (recommended)

From repository root:

```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3001`
- MongoDB: `mongodb://localhost:27017/saheli`

### Option B: Separate Process Deployment

1) Backend

```bash
cd backend
npm ci
npm run build
npm run start
```

2) Frontend

```bash
cd app
npm ci
npm run build
npm run preview
```

### Required Environment Variables

Backend (`backend/.env`):
- `PORT`
- `NODE_ENV`
- `MONGODB_URI`
- `JWT_SECRET`
- `CORS_ORIGINS` (comma-separated)

Frontend (`app/.env`):
- `VITE_API_BASE_URL` (use `/api` when reverse-proxied behind same host)

### Production Bootstrap

After backend starts, seed demo users once:

```bash
curl -X POST http://127.0.0.1:3001/api/auth/seed-demo
```

## Known Demo Constraints


#   S a h e l i  
 