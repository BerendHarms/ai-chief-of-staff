## Architecture Overview

### System shape
- **Frontend**: React app that renders the knowledge graph, timeline, conflicts,
  notifications, and Ask AI panel.
- **Backend**: Express API + WebSocket server that runs the multi-agent pipeline
  and persists the knowledge graph to JSON.

### Core flow: ingestion -> intelligence
1. A communication is submitted via `POST /api/ingest/*`.
2. `Coordinator` calls the OpenAI model and returns structured JSON:
   entities, relationships, changes, conflicts, notifications, summary.
3. Agents run in sequence:
   - **Memory** updates the graph
   - **Critic** detects contradictions
   - **Router** determines who needs to know and persists notifications
   - **Summary** generates the event summary
4. The event is stored and broadcast over WebSocket:
   - `graph_update` updates the UI
   - `agent_step` powers the pipeline visualization

### Voice Agent flow
1. User clicks the microphone in the dashboard.
2. Browser records audio and uploads to `POST /api/agent/voice`.
3. Server sends audio to ElevenLabs STT and receives a transcript.
4. Transcript is ingested through the standard `voice` pipeline.

### Ask AI flow
`POST /api/ask` answers a question using graph context and returns:
- `answer` (markdown)
- `evidenceNodeIds` for graph focus
- `recommendedView` (org / flow / stakeholder)

### Data model (knowledge graph)
Stored in `server/store/graph_data.json`:
- **nodes**: people, teams, projects, topics, decisions, documents
- **edges**: relationships (reports_to, belongs_to, owns, works_on, decided, etc.)
- **events**: timeline of changes
- **conflicts**: detected contradictions
- **notifications**: routed messages to people/teams
- **history**: version trail for decision nodes

### Communication analytics
`GET /api/analytics/communication` computes:
- per-person and per-team communication counts
- silos (teams with no cross-team communication)
- bottlenecks (people overloaded by mentions)

### Key UI views
- **Org Chart**: hierarchy and reporting lines
- **Info Flow**: project/topic/decision network with silo detection
- **Stakeholder Map**: personalized context for a person
- **Pipeline Overlay**: step-by-step agent reasoning
- **Decision Version Trail**: superseded decisions visualized as ghost nodes

### Primary endpoints
- `GET /api/graph`
- `POST /api/ingest/email|chat|meeting|voice|text`
- `POST /api/agent/voice`
- `POST /api/ask`
- `GET /api/notifications`
- `GET /api/analytics/communication`
- `GET /api/brief/:personId`

### Key files
- `server/index.js` API + WebSocket
- `server/agents/*.js` agent pipeline
- `server/store/knowledgeGraph.js` graph persistence
- `src/App.js` UI orchestration
- `src/components/KnowledgeGraph.js` graph views
- `src/components/AgentPipeline.js` reasoning visualization
