# SafeVoice Backend API

Express + MongoDB + Anthropic backend for the SafeVoice structured testimony platform.

---

## Stack

| Layer | Tech |
|---|---|
| Server | Node.js + Express |
| Database | MongoDB (Mongoose) |
| Auth | JWT (Bearer tokens) |
| AI | Anthropic Claude (server-side, key never exposed) |
| PDF Export | PDFKit |

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env

# 3. Start development server
npm run dev

# 4. Production
npm start
```

**Required `.env` values:**
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — random string, at least 32 characters
- `ANTHROPIC_API_KEY` — your `sk-ant-...` key

---

## API Reference

All protected routes require:
```
Authorization: Bearer <token>
```

---

### Auth

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register survivor or legal user |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | Any | Get current user |
| PUT | `/api/auth/password` | Any | Change password |

**Register body:**
```json
{
  "email": "user@example.com",
  "password": "minimum8chars",
  "role": "survivor",
  "displayName": "Optional name",
  "isAnonymous": true
}
```

**Login response:**
```json
{
  "token": "eyJ...",
  "user": { "_id": "...", "email": "...", "role": "survivor" }
}
```

---

### Testimony

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/testimony` | survivor | Submit testimony |
| GET | `/api/testimony/mine` | survivor | List own testimonies |
| GET | `/api/testimony` | legal | List all testimonies (paginated) |
| GET | `/api/testimony/:id` | any | Get single testimony |
| PATCH | `/api/testimony/:id` | legal | Update status / assign |
| POST | `/api/testimony/:id/notes` | legal | Add legal note |
| DELETE | `/api/testimony/:id` | survivor | Withdraw testimony |

**Submit testimony body:**
```json
{
  "rawMemoryText": "I remember that evening...",
  "emotionsAtRecording": ["Anxious", "Determined"],
  "overallCertaintyPct": 72,
  "timelineEvents": [
    { "description": "Initial encounter", "approximateTime": "~9:30 PM", "certaintyPct": 85 },
    { "description": "Left location next morning", "approximateTime": "9:00 AM", "certaintyPct": 95 }
  ]
}
```

**List testimonies query params (legal only):**
- `?status=submitted` — filter by status
- `?page=1&limit=20` — pagination

---

### AI (server-side Anthropic proxy)

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/ai/structure` | survivor | Structure testimony for survivor review |
| POST | `/api/ai/legal-summary` | legal | Generate formal legal summary |

**Structure body:**
```json
{
  "testimonyId": "mongo_object_id",
  "mode": "standard"
}
```
`mode` options: `"standard"` (default) or `"simplified"`

**Legal summary body:**
```json
{ "testimonyId": "mongo_object_id" }
```

---

### Export

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/export/pdf/:id` | legal | Download court-ready PDF |
| GET | `/api/export/json/:id` | legal | Download structured JSON |

---

## Data Models

### User
```
email, passwordHash (bcrypt), role (survivor|legal),
displayName, isAnonymous, organisation, barNumber,
createdAt, lastLogin
```

### Testimony
```
caseRef (SV-YYYY-NNNN), survivorId, assignedLegalId,
emotionsAtRecording[], rawMemoryText, overallCertaintyPct,
timelineEvents[], aiStructuredSummary, aiLegalSummary,
status (draft|submitted|structured|needs_review|flagged|closed),
legalNotes[], flags[], withdrawn, withdrawnAt
```

---

## Security Notes

- API key lives only in `.env`, never sent to clients
- Passwords hashed with bcrypt (12 rounds)
- Rate limiting: 100 req/15 min globally, 20 req/min for AI routes
- Helmet sets secure HTTP headers
- CORS restricted to `ALLOWED_ORIGIN`
- Survivors can only read/withdraw their own testimonies

---

## Connecting the Frontend

Replace the direct Anthropic fetch in the frontend with calls to this backend:

```js
// OLD (client-side, exposes key)
fetch('https://api.anthropic.com/v1/messages', { headers: { 'x-api-key': apiKey } })

// NEW (server-side proxy, secure)
fetch('http://localhost:4000/api/ai/structure', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ testimonyId, mode: 'standard' })
})
```
