## AI Chief of Staff Documentation

This folder contains lightweight documentation for the hackathon submission.

### What it is
AI Chief of Staff is an organizational intelligence layer that ingests internal
communications, extracts structured knowledge, and maintains a living source of
truth. It visualizes how information flows, detects conflicts, and routes
updates to the right stakeholders.

### Key features
- Multi-agent pipeline: Coordinator, Memory, Critic, Router, Summary
- Knowledge graph with Org, Info Flow, and Stakeholder views
- Conflict detection with resolution workflow
- Ask AI with evidence-linked graph focus
- Notifications routing panel
- Decision version trail + superseded "ghost" nodes
- Auto Demo and real-time updates over WebSocket
- Voice Agent (mic → transcription → ingestion)

### Quick start
1. Install deps:
   - `npm install`
   - `cd server && npm install`
2. Start backend:
   - `cd server && npm start`
3. Start frontend:
   - `npm start`
4. Click **Auto Demo** or **Load Demo Company**

### Environment
Set `OPENAI_API_KEY` in `server/.env`.
Set `ELEVENLABS_API_KEY` to enable the Voice Agent.

### More details
See `documentation/ARCHITECTURE.md` for data flows and API overview.
