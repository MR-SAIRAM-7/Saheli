# Saheli

A finance platform for women's Self-Help Groups (SHGs) in India. Members save, borrow and check their records over WhatsApp or the web, and ledger records can be anchored on the Algorand blockchain.

**Live app:** https://saheli-eight.vercel.app

Built as a team project.

## Features

- **Three dashboards:** member, SHG leader and bank, with role-based access.
- **Loans:** members request, leaders approve, and the bank processes a disbursement queue.
- **Multi-signature approvals:** leaders sign or reject shared actions.
- **WhatsApp assistant:** a Twilio webhook handles messages. Voice notes are transcribed with OpenAI Whisper.
- **QR proofs:** generate and verify a QR code for a transaction.
- **Credit passport:** a member record that can be minted and refreshed.
- **Treasury agent:** calculates idle funds, deploys and harvests them through an adapter, and evaluates emergency loans. The default adapter is **simulated**.
- **Pera Wallet:** sign in with, or link, an Algorand wallet.
- **Translation:** site text through Sarvam AI.

## Tech stack

| Part | Built with |
|---|---|
| Frontend (`app/`) | React 19, TypeScript, Vite, Tailwind CSS, Radix UI, Pera Wallet Connect |
| Backend (`backend/`) | Node.js, Express, TypeScript, Mongoose, JWT, algosdk, Twilio |
| Database | MongoDB |
| Deployment | Docker Compose, Vercel (frontend) |

## Run it locally

You need Node.js 20 and MongoDB.

```bash
git clone https://github.com/MR-SAIRAM-7/Saheli.git
cd Saheli
npm install
npm --prefix backend install
npm --prefix app install
cp backend/.env.example backend/.env
cp app/.env.example app/.env
npm run dev
```

Set `MONGODB_URI` and `JWT_SECRET` in `backend/.env`. Twilio, OpenAI, Sarvam and Cloudinary keys are needed only for their features. Algorand settings and the demo fallback are described in `backend/.env.example`.

With Docker, after creating `backend/.env`:

```bash
docker compose up --build
```

The app is then on port 8080 and the API on port 3001.

## API

All routes are under `/api`.

| Route | Purpose |
|---|---|
| `/auth` | Register, log in, Pera Wallet sign-in and linking, profile |
| `/members` | Member records |
| `/transactions` | Ledger |
| `/loans` | Requests, approvals, bank queue |
| `/multisig` | Pending actions, sign, reject |
| `/agent`, `/ai-agent` | Treasury agent and assistant |
| `/qr` | Generate and verify proofs |
| `/stats`, `/translate` | Dashboard figures, translation |

`GET /health` reports service status. WhatsApp messages arrive at `POST /webhook/whatsapp`.

## Project structure

```
app/       React frontend: dashboards, sections, components
backend/   Express API: routes, models, services, middleware
```

## Limits

- DeFi yield uses a simulated adapter unless a live provider is configured.
- The repository includes demo data and a demo seeding route. Review both before any real use.
- There is no automated test suite in this repository yet.

## License

MIT
