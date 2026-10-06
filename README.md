# JJCET AI Assistant

A production-quality AI RAG Chatbot for **J.J. College of Engineering and Technology (JJCET)**, Tiruchirappalli, Tamil Nadu, powered by verified information from the official college website ([https://jjcet.ac.in/](https://jjcet.ac.in/)).

---

## 🏛️ Project Overview

The **JJCET AI Assistant** is designed for students, parents, faculty, and visitors. Rather than relying on hardcoded facts, it indexes the official JJCET website through an automated crawling, cleaning, entity-extraction, semantic chunking, and persistent hybrid vector search pipeline.

### Core Capabilities
- **Official Grounded Knowledge:** Ingests live pages from `https://jjcet.ac.in/`, removing scripts, styles, SVGs, boilerplate, and duplicate navigation.
- **Persistent Hybrid Search:** Combines cosine vector similarity with BM25 inverted index in `data/index/jjcet_index.json`.
- **Specialized Faculty & HOD Search:** High-precision HOD identification and full faculty roster generation grouped by department.
- **Person Lookup & Unknown Person Handling:** Exact and partial matching for faculty (e.g. *Ambika*); strict detection of non-existent names (e.g. *chelama*, *chelamal*) preventing fallback to generic About Us pages.
- **Multilingual Support:** Understands and responds naturally in **English**, **Tamil**, and **Tanglish** (e.g., *"CSE HOD yaaru?"*, *"JJCET la enna courses irukku?"*).
- **Zero UI Artifacts & Responsive Tables:** Renders clean responsive tables on desktop and mobile without raw markdown pipes, SVGs, or debug tags.

---

## 📐 Architecture

```
                    ┌─────────────────────────┐
                    │  https://jjcet.ac.in/   │
                    └────────────┬────────────┘
                                 │
                   (Crawler & Cheerio Cleaner)
                                 │
                    ┌────────────▼────────────┐
                    │  Content Ingestion &    │
                    │   Entity Extraction     │
                    │(Faculty, Courses, Info) │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Semantic Chunking &    │
                    │   Persistent Hybrid     │
                    │      Vector Index       │
                    │ (data/index/*.json)     │
                    └────────────┬────────────┘
                                 │
   User Query ──► [ Intent & Entity Detector ]
                                 │
                  ┌──────────────┴──────────────┐
                  ▼                             ▼
       [ Hybrid Search & Rerank ]      [ Person Lookup ]
       (Semantic + Keyword + Boost)    (Exact / Fuzzy / Fallback)
                  │                             │
                  └──────────────┬──────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Grounded Generation    │
                    │  (Gemini 2.5 Flash /    │
                    │   Grounded Synthesizer) │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Clean Sanitization   │
                    │   + Source Citations    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Modern React + Vite UI  │
                    └─────────────────────────┘
```

---

## 📁 Project Structure

```
├── data/
│   └── index/
│       └── jjcet_index.json      # Persistent vector & keyword index
├── server/
│   ├── ai/
│   │   ├── gemini.ts             # Grounded AI generation & fallback synthesizer
│   │   └── sanitizer.ts          # Strips debug tags, SVGs, and raw tokens
│   ├── ingestion/
│   │   ├── cleaner.ts            # HTML cleaner & table extractor
│   │   ├── extractors.ts         # Structured faculty, HOD & course extractors
│   │   ├── chunker.ts            # Semantic chunker & keyword generator
│   │   └── crawler.ts            # Official JJCET website crawler
│   ├── rag/
│   │   ├── embeddings.ts         # Vector embedding & cosine similarity engine
│   │   ├── vectorStore.ts        # Persistent vector & BM25 store
│   │   ├── intent.ts             # Intent, department & language classifier
│   │   └── hybridSearch.ts       # Hybrid search, department boost & person lookup
│   ├── index.ts                  # Express backend API server
│   ├── ingest-cli.ts             # CLI command for npm run ingest
│   └── types.ts                  # Core TypeScript data definitions
├── src/
│   ├── App.tsx                   # Modern React chat UI with responsive tables
│   ├── main.tsx                  # React entry point
│   └── index.css                 # JJCET blue/white design system
├── tests/
│   └── rag.test.ts               # Automated integration test suite (12 core queries)
├── .env.example                  # Environment configuration template
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite config with API proxy
└── README.md                     # Documentation
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18 or later (tested on v24)
- **npm**: v9 or later

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Inside `.env`:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
```
> **Note:** If `GEMINI_API_KEY` is omitted, the assistant seamlessly runs in high-precision local grounded synthesis mode, ensuring offline reliability and immediate testability.

### 4. Build / Refresh Knowledge Base
To crawl and index official content from `https://jjcet.ac.in/`:
```bash
npm run ingest
```
This fetches all live official pages, extracts faculty and courses, computes embeddings, and persists the index in `data/index/jjcet_index.json`.

### 5. Run the Application
Start both the backend server and frontend development server simultaneously:
```bash
npm run dev
```
- **Frontend UI:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:3001](http://localhost:3001)

---

## 🧪 Testing

Run the automated integration test suite validating all 12 required core queries:
```bash
npm test
```

### Verified Test Cases:
1. `CSE HOD yaaru?` → Returns **Dr. K. Suresh** (Associate Professor / HOD) with CSE source.
2. `ECE HOD yaaru?` → Returns **Dr. S. Sumithra** (Professor / HOD / Dean Research) with ECE source.
3. `CSE faculty full list kudu` → Returns full structured official faculty roster in markdown table.
4. `CSE facullty list` → Typo tolerance handles "facullty" and returns CSE roster.
5. `JJCET la enna courses irukku?` → Returns UG & PG programs in responsive table format.
6. `Ambika` → Returns official person record: **Mrs. M. Ambika** (Assistant Professor, CSE).
7. `chelama` → Returns exact required notice: *"No official JJCET faculty or staff record was found for 'chelama'. Please check the spelling or provide the full name."* (No About Us fallback).
8. `chelamal` → Exact unknown person notice.
9. `Admission eligibility enna?` → Returns official TNEA code (3806), 10+2 PCM criteria, and procedures.
10. `JJCET enga irukku?` → Returns campus location at Ammapettai, Poolankulathupatti, Tiruchirappalli.
11. `What facilities are available?` → Returns Hostels, Central Library, Transport, and Centres of Excellence.
12. `Placement details` → Returns Placement cell details and recruiters (Zoho, TCS, EY, Kyndryl, etc.).

---

## 📡 API Reference

### `POST /api/chat`
Send a chat message to the assistant.

**Request:**
```json
{
  "message": "CSE HOD yaaru?"
}
```

**Response:**
```json
{
  "answer": "**Computer Science & Engineering** HOD **Dr. K. Suresh** (Associate Professor / HOD).\n- **Educational Qualification**: M.E., Ph.D.\n- **Experience**: 14. 10 years\n- **Specialization**: Biometrics Cyber Security",
  "sources": [
    {
      "title": "Computer Science & Engineering - Head of Department",
      "url": "https://jjcet.ac.in/computer-science-and-engineering/",
      "department": "Computer Science & Engineering"
    }
  ],
  "intent": "HOD",
  "department": "Computer Science & Engineering"
}
```

### `GET /api/status`
Health check and knowledge index status.

**Response:**
```json
{
  "status": "online",
  "indexed": true,
  "chunkCount": 1386,
  "facultyCount": 255,
  "courseCount": 20,
  "lastIndexed": "2026-09-23T06:38:39.123Z"
}
```
