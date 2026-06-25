# BeerGPT — AI Chief of Staff

**Your organization's intelligence layer.** BeerGPT ingests real-time communications — emails, Slack messages, meetings, voice memos, WhatsApp — and builds a living knowledge graph that shows you how information really flows, where conflicts are hiding, and who needs to know what.

> *"Every organization has a Chief of Staff. Ours runs on AI."*

---

## The Problem

As organizations scale, critical context gets lost. Decisions are made in silos. Conflicting information goes undetected. The people who need to know are the last to find out.

**BeerGPT** solves this by acting as an always-on organizational intelligence system that:

- Extracts structured knowledge from every communication channel
- Maintains a single source of truth as a living knowledge graph
- Detects conflicts and contradictions in real time
- Routes the right information to the right people automatically

---

## Key Features

### Multi-Agent AI Pipeline
Every incoming communication passes through a 5-agent pipeline powered by GPT-4o, each with a specialized role:

| Agent | Role |
|-------|------|
| **Coordinator** | Parses input, extracts entities and relationships, cross-references against existing knowledge |
| **Memory** | Updates the knowledge graph — adds nodes, edges, and version history |
| **Critic** | Detects contradictions and conflicts with existing organizational truth |
| **Router** | Determines who needs to be notified and at what urgency level |
| **Summary** | Generates a concise event summary with reasoning |

The pipeline runs in real time and is visualized step-by-step in the UI so you can see the AI "thinking."

### Interactive Knowledge Graph
Three purpose-built views of your organization:

- **Org Chart** — Hierarchy and reporting lines with team clustering
- **Info Flow** — How information moves across teams, with silo and bottleneck detection
- **Stakeholder Map** — Personalized context view for any individual

Nodes represent people, teams, projects, topics, decisions, and documents. Click any node for a full detail view with connection mapping.

### Conflict Detection & Resolution
When the Critic agent detects contradictory information (e.g., two people announcing different launch dates), it flags a conflict with severity level and involved entities. Conflicts appear in a dedicated panel for review and resolution.

### Smart Notification Routing
The Router agent analyzes each piece of incoming information and determines which people and teams need to be notified, with urgency levels (high / medium / low). No more "reply all" — information goes exactly where it's needed.

### Decision Version Trail
Decisions evolve. When a decision is superseded, BeerGPT preserves the full version history. Previous versions appear as "ghost" nodes in the graph, giving you a clear audit trail of how and when decisions changed.

### Ask AI with Evidence Linking
Ask natural-language questions about your organization. The AI answers using graph context and highlights the specific evidence nodes on the graph, automatically switching to the most relevant view.

### Voice Agent
Click the microphone to speak. Audio is transcribed via ElevenLabs STT and ingested through the full pipeline — no typing required.

### WhatsApp / OpenClaw Integration
Connect WhatsApp via OpenClaw to automatically ingest messages into the knowledge graph through a webhook endpoint with optional authentication.

### Communication Analytics
Automatically detects:
- **Silos** — Teams with no cross-team communication
- **Bottlenecks** — People overloaded by mentions and responsibilities
- Per-person and per-team communication frequency

### Real-Time Everything
Built on WebSockets. Every ingestion, every graph update, every agent step streams to all connected clients instantly.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ Knowledge │  │ Agent    │  │ Ask AI   │  │ Notifications │   │
│  │ Graph     │  │ Pipeline │  │ Panel    │  │ & Conflicts   │   │
│  │ (vis.js)  │  │ Overlay  │  │          │  │               │   │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘   │
│                          ▲ WebSocket                            │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                    Express Backend                               │
│                          │                                       │
│    POST /api/ingest/*  ──┤                                       │
│    POST /api/ask       ──┤                                       │
│    POST /api/agent/voice ┤                                       │
│    POST /api/webhooks/*  ┤                                       │
│                          ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Multi-Agent Pipeline (GPT-4o)                 │  │
│  │  Coordinator → Memory → Critic → Router → Summary         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Knowledge Graph Store (JSON)                     │  │
│  │   Nodes · Edges · Events · Conflicts · Notifications      │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, vis-network, Recharts |
| Backend | Node.js, Express 5, WebSocket (ws) |
| AI | OpenAI GPT-4o-mini, ElevenLabs STT |
| Graph | vis-network for visualization, custom JSON store |
| Styling | Tailwind CSS, custom CSS |
| Integrations | WhatsApp (OpenClaw), Email webhook, Voice |

---

## Quick Start

### Prerequisites
- Node.js 18+
- An OpenAI API key
- (Optional) An ElevenLabs API key for voice features

### 1. Clone and install

```bash
git clone https://github.com/your-username/ai-chief-of-staff.git
cd ai-chief-of-staff

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install
```

### 2. Configure environment

```bash
# Backend (required)
cp server/.env.example server/.env
# Edit server/.env and add your OPENAI_API_KEY

# Frontend (optional)
cp .env.example .env
```

### 3. Start the application

```bash
# Terminal 1 — Start the backend
cd server && npm start
# Runs on http://localhost:3001

# Terminal 2 — Start the frontend
npm start
# Runs on http://localhost:3000
```

### 4. Try it out

1. Click **Load Demo Company** to seed a realistic startup org with 10 people, 5 teams, and active projects
2. Use the **Ingest** panel to submit an email, chat message, or meeting notes
3. Watch the **Agent Pipeline** process your input in real time
4. Explore the **Knowledge Graph** across Org Chart, Info Flow, and Stakeholder views
5. Try **Ask AI** — e.g., *"Who is working on Project Atlas?"* or *"Are there any scheduling conflicts?"*
6. Click any person node and hit **Brief Me** for a personalized context view

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/graph` | Full knowledge graph state |
| `POST` | `/api/ingest/email` | Ingest an email |
| `POST` | `/api/ingest/chat` | Ingest a chat/Slack/WhatsApp message |
| `POST` | `/api/ingest/meeting` | Ingest meeting notes |
| `POST` | `/api/ingest/voice` | Ingest voice transcript |
| `POST` | `/api/ingest/text` | Ingest freeform text |
| `POST` | `/api/agent/voice` | Upload audio for STT + ingestion |
| `POST` | `/api/ask` | Ask AI a question about the org |
| `GET` | `/api/notifications` | Get routed notifications |
| `GET` | `/api/analytics/communication` | Communication analytics (silos, bottlenecks) |
| `GET` | `/api/brief/:personId` | Personalized briefing for a person |
| `POST` | `/api/webhooks/whatsapp` | WhatsApp/OpenClaw webhook |
| `POST` | `/api/demo/seed` | Load demo company |
| `POST` | `/api/demo/reset` | Reset knowledge graph |

---

## Project Structure

```
ai-chief-of-staff/
├── server/
│   ├── agents/
│   │   ├── coordinator.js    # Orchestrates the pipeline, calls GPT-4o
│   │   ├── memory.js         # Updates the knowledge graph
│   │   ├── critic.js         # Detects contradictions
│   │   ├── router.js         # Routes notifications
│   │   └── summary.js        # Generates event summaries
│   ├── store/
│   │   └── knowledgeGraph.js  # Graph persistence layer
│   ├── demoData.js            # Demo company seed data
│   └── index.js               # Express API + WebSocket server
├── src/
│   ├── components/
│   │   ├── KnowledgeGraph.js  # Interactive graph with 3 views
│   │   ├── AgentPipeline.js   # Real-time pipeline visualization
│   │   ├── AskPanel.js        # Natural-language Q&A
│   │   ├── IngestPanel.js     # Multi-channel ingestion forms
│   │   ├── ConflictPanel.js   # Conflict detection & resolution
│   │   ├── NotificationsPanel.js  # Smart notification routing
│   │   ├── Timeline.js        # Event timeline
│   │   ├── StatsBar.js        # Dashboard stats
│   │   └── VoiceAgentModal.js # Voice input modal
│   ├── App.js                 # Main orchestration
│   └── App.css                # Styling
└── documentation/
    ├── ARCHITECTURE.md         # Detailed architecture docs
    └── OPENCLAW_WHATSAPP.md    # WhatsApp integration guide
```

---

## What Makes This Different

Most AI tools answer questions. **BeerGPT builds understanding.**

- It doesn't just store data — it builds a **living knowledge graph** that evolves with every communication
- It doesn't just summarize — it **detects conflicts** between what different people believe to be true
- It doesn't just notify everyone — it **intelligently routes** information to exactly who needs it
- It doesn't just show current state — it preserves **decision history** so you can trace how things evolved
- It doesn't just work with text — it ingests **emails, chats, meetings, voice, and WhatsApp** through a unified pipeline
- Every step of the AI reasoning is **transparent and visible** through the agent pipeline overlay

---

## License

MIT
