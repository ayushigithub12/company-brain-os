# 🧠 Company Brain OS

> An AI-powered company knowledge system that turns your Notion pages and Google Drive docs into a searchable, queryable brain — with auto-extracted process cards and knowledge gap detection.

![Company Brain OS](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)
![Pinecone](https://img.shields.io/badge/Pinecone-Vector_DB-green?style=flat-square)
![Groq](https://img.shields.io/badge/Groq-LLaMA_3.1-orange?style=flat-square)

---

## What is Company Brain OS?

Most companies lose knowledge every day — in Notion pages nobody reads, Google Docs buried in folders, and processes that only exist in one person's head. When that person leaves, the knowledge leaves with them.

**Company Brain OS** solves this by:

1. **Connecting** to your Notion workspace and Google Drive
2. **Indexing** all your documents into a semantic vector database
3. **Answering** questions about how your company works — in plain English
4. **Extracting** structured process cards (SOPs) automatically from your docs
5. **Detecting** knowledge gaps — questions your team asks that aren't documented anywhere

---

## Features

### Phase 1 — Knowledge Ingestion + RAG Query Engine
- Connect Notion (internal integration token) and Google Drive (OAuth2)
- Automatic document chunking with overlap for optimal retrieval
- Voyage AI embeddings stored in Pinecone vector database
- Ask any question → get a grounded answer with source citations
- Confidence scoring on every answer (0–100%)
- Knowledge gap detection — unanswered queries logged automatically

### Phase 2 — Process Card Extraction (AI-powered SOPs)
- After every sync, AI reads your documents and extracts structured process cards
- Each card contains: name, description, trigger, steps, owners, tags, edge cases
- Human verification workflow — Verify, Needs Review, or Delete each card
- Auto-deduplication — syncing the same content never creates duplicate cards
- Only new or changed documents trigger new card extraction
- Filter cards by status: All, Draft, Verified, Needs Review

### Phase 3 — Intelligence Layer
- **Gaps Dashboard** — unanswered queries grouped by frequency, low-confidence answers flagged
- **Stale Cards** — verified cards not updated in 30+ days highlighted for review
- **Semantic Search** — search across all documents AND process cards simultaneously
- **Answer rate tracking** — see what % of questions your brain can answer

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 14 (App Router) | Full-stack React, API routes, server components |
| Language | TypeScript | Type safety across the entire codebase |
| Database | PostgreSQL (Supabase) | Relational data — users, workspaces, cards, logs |
| ORM | Prisma 5 | Type-safe DB queries, migrations |
| Vector DB | Pinecone | Semantic similarity search at scale |
| Embeddings | Voyage AI (voyage-3) | Best-in-class retrieval embeddings, free tier |
| AI / LLM | Groq (LLaMA 3.1 8B) | Fast inference, generous free tier |
| Auth | NextAuth.js | Google OAuth, session management |
| Notion API | @notionhq/client | Page discovery, block extraction |
| Google Drive | googleapis | OAuth2, Docs/Sheets/PDF export |
| Styling | Inline styles | Zero-dependency, works everywhere |

---

## Architecture

```
User Question
     │
     ▼
Voyage AI Embeddings (query)
     │
     ▼
Pinecone Vector Search (top-K chunks)
     │
     ▼
Groq LLaMA 3.1 (grounded answer generation)
     │
     ▼
Answer + Sources + Confidence Score
```

**Ingestion Pipeline:**
```
Notion/Drive → Raw Documents → Chunker → Voyage AI Embeddings → Pinecone
                                    └──→ PostgreSQL (chunks, metadata)
                                              └──→ Groq (card extraction)
                                                        └──→ Process Cards DB
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase account (free)
- A Pinecone account (free)
- A Voyage AI account (free)
- A Groq account (free)
- A Google Cloud project (free)
- A Notion integration (free)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/company-brain-os.git
cd company-brain-os
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | Supabase → Connect → URI |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` |
| `NOTION_CLIENT_ID` | notion.so/my-integrations → your integration token |
| `NOTION_CLIENT_SECRET` | Same as above |
| `GROQ_API_KEY` | console.groq.com → API Keys |
| `VOYAGE_API_KEY` | dash.voyageai.com → API Keys |
| `PINECONE_API_KEY` | app.pinecone.io → API Keys |
| `GOOGLE_CLIENT_ID` | console.cloud.google.com → OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | Same as above |
| `ADMIN_EMAIL` | Your Gmail address (gets Admin role) |

### 4. Push database schema

```bash
npx prisma db push
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

### Connecting Notion

1. Go to [notion.so/my-integrations](https://notion.so/my-integrations)
2. Create a new integration → Access Token type
3. Copy the token → paste as `NOTION_CLIENT_ID` and `NOTION_CLIENT_SECRET`
4. In your Notion workspace, open each page → `...` menu → Connections → select your integration
5. In the app → Dashboard → Connect Notion → Sync

### Connecting Google Drive

1. Click **Connect Google Drive** on the dashboard
2. Authorize with your Google account
3. Click **Sync** — all Docs, Sheets, and PDFs are imported automatically

### Asking Questions

Type any question about your company in the Brain tab:

> "How do we onboard a new employee?"
> "What is our deployment process?"
> "Who approves budget requests above $5000?"

The answer includes source citations and a confidence score.

### Process Cards

After syncing, click **Cards** → **Extract from docs** (or it runs automatically on sync).

The AI reads your documents and extracts structured SOPs. Review each card:
- **Verify** — mark as human-approved
- **Needs Review** — flag for attention
- **Edit** — update steps, owners, or tags
- **Delete** — remove irrelevant cards

### Knowledge Gaps

Click **Gaps** to see:
- Questions your team asked that had no documented answer
- Low-confidence answers that need better documentation
- Verified cards that haven't been updated in 30+ days

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/           # NextAuth routes
│   │   ├── cards/          # Process card CRUD + extraction
│   │   ├── connectors/     # Notion + Google Drive sync
│   │   ├── gaps/           # Gap detection
│   │   ├── query/          # RAG query endpoint
│   │   ├── search/         # Semantic search
│   │   └── workspace/      # Bootstrap, stats, members, invite
│   ├── cards/              # Cards list + detail pages
│   ├── dashboard/          # Main brain page
│   ├── gaps/               # Gaps dashboard
│   ├── login/              # Auth page
│   ├── search/             # Search page
│   └── settings/           # Workspace + members settings
├── lib/
│   ├── auth.ts             # NextAuth config
│   ├── db/prisma.ts        # Prisma singleton
│   ├── cards/extractor.ts  # AI card extraction engine
│   ├── connectors/
│   │   ├── notion.ts       # Notion API client
│   │   └── google-drive.ts # Google Drive OAuth + file fetch
│   ├── permissions.ts      # Role-based access control
│   └── rag/
│       ├── chunker.ts      # Smart text chunking with overlap
│       ├── embeddings.ts   # Voyage AI embedding service
│       ├── ingest.ts       # Full ingestion pipeline
│       ├── query.ts        # RAG query engine
│       └── vectorstore.ts  # Pinecone client
├── types/index.ts          # Shared TypeScript types
└── components/
    └── providers.tsx       # NextAuth session provider
prisma/
└── schema.prisma           # Complete database schema
```

---

## Key Design Decisions

**Why Voyage AI for embeddings?**
Voyage AI's `voyage-3` model outperforms OpenAI's text-embedding-3-small on retrieval benchmarks. The free tier (200M tokens) is more than enough for a company's entire knowledge base.

**Why Groq instead of OpenAI/Anthropic?**
Groq's free tier gives 14,400 requests/day on LLaMA 3.1, which is sufficient for both query answering and card extraction. No credit card required.

**Why Pinecone serverless?**
Serverless Pinecone has no pod costs, scales to zero, and the free tier handles millions of vectors — perfect for a company knowledge base.

**Why incremental sync?**
Documents are only re-embedded when their `sourceUpdatedAt` timestamp changes. Clicking Sync 100 times on unchanged content costs nothing and runs instantly.

---

## Roadmap

- [x] Phase 1 — RAG query engine + Notion/Drive connectors
- [x] Phase 2 — AI process card extraction + verification workflow
- [x] Phase 3 — Gap detection + semantic search + stale card alerts
- [ ] Feature 4 — Public shareable card links
- [ ] Feature 5 — Analytics dashboard (queries/day, top questions, gap trends)
- [ ] Feature 6 — Slack bot integration
- [ ] Landing page
- [ ] Production deployment (Vercel)

---

## Contributing

This project is currently in active development. Issues and PRs welcome.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ by [Ayushi Sharma](https://github.com/YOUR_GITHUB_USERNAME)