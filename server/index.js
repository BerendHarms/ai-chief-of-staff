// AI Chief of Staff — Express backend with WebSocket for real-time updates

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Blob } from 'buffer';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { processIncoming, askChiefOfStaff } from './agents/coordinator.js';
import graph from './store/knowledgeGraph.js';
import { seedDemoCompany } from './demoData.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── WebSocket — broadcast graph updates to all clients ─────────

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`🔌 Client connected (${clients.size} total)`);

  // Send current graph state on connect
  ws.send(JSON.stringify({
    type: 'graph_update',
    data: graph.getFullGraph()
  }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`🔌 Client disconnected (${clients.size} total)`);
  });
});

function broadcast(type, data) {
  const message = JSON.stringify({ type, data });
  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  }
}

// ── API Routes ─────────────────────────────────────────────────

// Get full knowledge graph
app.get('/api/graph', (req, res) => {
  res.json(graph.getFullGraph());
});

// Get recent events (timeline)
app.get('/api/events', (req, res) => {
  const count = parseInt(req.query.count) || 20;
  res.json(graph.getRecentEvents(count));
});

// Get today's events
app.get('/api/events/today', (req, res) => {
  res.json(graph.getEventsToday());
});

// Get open conflicts
app.get('/api/conflicts', (req, res) => {
  res.json(graph.getOpenConflicts());
});

// Resolve a conflict
app.post('/api/conflicts/:id/resolve', (req, res) => {
  const conflict = graph.resolveConflict(req.params.id, req.body.resolution);
  broadcast('conflict_resolved', conflict);
  broadcast('graph_update', graph.getFullGraph());
  res.json(conflict);
});

// ── Notifications endpoints ─────────────────────────────────────

app.get('/api/notifications', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(graph.getNotifications(limit));
});

app.get('/api/notifications/unread', (req, res) => {
  res.json(graph.getUnreadNotifications());
});

app.post('/api/notifications/:id/read', (req, res) => {
  const notif = graph.markNotificationRead(req.params.id);
  res.json(notif || { error: 'Not found' });
});

app.post('/api/notifications/read-all', (req, res) => {
  graph.markAllNotificationsRead();
  res.json({ success: true });
});

// ── Communication analytics ─────────────────────────────────────

app.get('/api/analytics/communication', (req, res) => {
  res.json(graph.getCommAnalytics());
});

// ── Helper: step broadcaster for agent pipeline ────────────────

const onStep = (step) => broadcast('agent_step', step);

// ── Ingestion endpoints ────────────────────────────────────────

// Voice Agent: record -> transcribe -> ingest
app.post('/api/agent/voice', upload.single('audio'), async (req, res) => {
  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(400).json({ success: false, error: 'Missing ELEVENLABS_API_KEY' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No audio file provided' });
  }

  const { speaker, context } = req.body || {};
  const file = req.file;

  try {
    const formData = new FormData();
    formData.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'audio.webm');
    formData.append('model_id', 'scribe_v2');

    const sttResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
      body: formData
    });

    if (!sttResponse.ok) {
      const errorText = await sttResponse.text();
      return res.status(500).json({ success: false, error: `ElevenLabs STT failed: ${errorText}` });
    }

    const sttData = await sttResponse.json();
    const transcript = sttData.text || '';
    const content = `Voice note from ${speaker || 'Unknown'}:\n${transcript}\n${context ? `Context: ${context}` : ''}`;

    const result = await processIncoming('voice', content, { sender: speaker }, onStep);
    broadcast('new_event', result.event);
    broadcast('graph_update', graph.getFullGraph());

    res.json({ success: true, transcript, ingest: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process incoming email
app.post('/api/ingest/email', async (req, res) => {
  const { sender, subject, body, recipients } = req.body;
  const content = `Email from ${sender}\nSubject: ${subject}\nTo: ${(recipients || []).join(', ')}\n\n${body}`;

  const result = await processIncoming('email', content, {
    sender, subject, participants: recipients
  }, onStep);

  broadcast('new_event', result.event);
  broadcast('graph_update', graph.getFullGraph());
  if (result.conflicts?.length > 0) {
    broadcast('new_conflicts', result.conflicts);
  }
  res.json(result);
});

// Process incoming chat/WhatsApp message
app.post('/api/ingest/chat', async (req, res) => {
  const { sender, message, channel, participants } = req.body;
  const content = `Chat message in ${channel || 'direct'} from ${sender}:\n${message}`;

  const result = await processIncoming('chat', content, {
    sender, participants: participants || [sender]
  }, onStep);

  broadcast('new_event', result.event);
  broadcast('graph_update', graph.getFullGraph());
  if (result.conflicts?.length > 0) {
    broadcast('new_conflicts', result.conflicts);
  }
  res.json(result);
});

// Process meeting notes / voice transcription
app.post('/api/ingest/meeting', async (req, res) => {
  const { title, participants, notes, decisions } = req.body;
  const content = `Meeting: ${title}\nParticipants: ${(participants || []).join(', ')}\n\nNotes:\n${notes}\n\n${decisions ? `Decisions made:\n${decisions.join('\n')}` : ''}`;

  const result = await processIncoming('meeting', content, {
    subject: title, participants
  }, onStep);

  broadcast('new_event', result.event);
  broadcast('graph_update', graph.getFullGraph());
  if (result.conflicts?.length > 0) {
    broadcast('new_conflicts', result.conflicts);
  }
  res.json(result);
});

// Process voice note (text already transcribed)
app.post('/api/ingest/voice', async (req, res) => {
  const { speaker, transcription, context } = req.body;
  const content = `Voice note from ${speaker}:\n${transcription}\n${context ? `Context: ${context}` : ''}`;

  const result = await processIncoming('voice', content, {
    sender: speaker
  }, onStep);

  broadcast('new_event', result.event);
  broadcast('graph_update', graph.getFullGraph());
  res.json(result);
});

// Generic text ingestion
app.post('/api/ingest/text', async (req, res) => {
  const { source, content, metadata } = req.body;

  const result = await processIncoming(source || 'manual', content, metadata || {}, onStep);

  broadcast('new_event', result.event);
  broadcast('graph_update', graph.getFullGraph());
  if (result.conflicts?.length > 0) {
    broadcast('new_conflicts', result.conflicts);
  }
  res.json(result);
});

// ── WhatsApp / OpenClaw webhook ────────────────────────────────
// Accepts inbound WhatsApp messages (e.g. from OpenClaw agent tool or bridge).
// Optional auth: set WEBHOOK_SECRET in server/.env and send Authorization: Bearer <secret> or x-webhook-secret: <secret>.

function checkWebhookAuth(req, res) {
  const secret = process.env.WEBHOOK_SECRET || process.env.OPENCLAW_WEBHOOK_TOKEN;
  if (!secret) return true;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-webhook-secret'];
  if (token !== secret) {
    res.status(401).json({ success: false, error: 'Invalid or missing webhook secret' });
    return false;
  }
  return true;
}

function extractEmails(value) {
  if (!value) return [];
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig);
  return matches ? Array.from(new Set(matches)) : [];
}

function parseRouteKey(address) {
  if (!address) return null;
  const local = String(address).split('@')[0] || '';
  if (!local) return null;
  if (local.includes('+')) {
    const [, plusKey] = local.split('+');
    return plusKey || local;
  }
  return local;
}

function parseEnvelope(envelopeRaw) {
  if (!envelopeRaw) return null;
  try {
    return JSON.parse(envelopeRaw);
  } catch {
    return null;
  }
}

// ── Email webhook (SendGrid Inbound Parse) ───────────────────────
// Accepts SendGrid multipart payloads, with JSON fallback for local testing.

app.get('/api/webhooks/email', (req, res) => {
  res.json({
    ok: true,
    message: 'Email webhook (SendGrid inbound parse). POST multipart/form-data or JSON with from, to, subject, text/html.',
    post_url: '/api/webhooks/email'
  });
});

app.post('/api/webhooks/email', upload.any(), async (req, res) => {
  if (!checkWebhookAuth(req, res)) return;

  const body = req.body || {};
  const envelope = parseEnvelope(body.envelope);
  const sender = body.from || envelope?.from || body.sender || 'Unknown';
  const subject = body.subject || body.Subject || '(no subject)';
  const textBody = body.text || body['stripped-text'];
  const htmlBody = body.html || body['stripped-html'];
  const emailBody = textBody || htmlBody || body.body || body.content || '';

  const recipients = [
    ...extractEmails(envelope?.to),
    ...extractEmails(body.to),
    ...extractEmails(body.recipients),
    ...extractEmails(body.recipient)
  ];
  const uniqueRecipients = Array.from(new Set(recipients));
  const routeKey = parseRouteKey(uniqueRecipients[0]);
  const participants = [...uniqueRecipients];
  if (routeKey && !participants.includes(routeKey)) participants.push(routeKey);

  if (!emailBody || typeof emailBody !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid email body (use text or html)' });
  }

  const content = `Email from ${sender}\nSubject: ${subject}\nTo: ${uniqueRecipients.join(', ')}\n\n${emailBody}`;

  try {
    const result = await processIncoming('email', content, {
      sender,
      subject,
      participants,
      routeKey,
      source: 'email_webhook',
      provider: 'sendgrid'
    }, onStep);

    broadcast('new_event', result.event);
    broadcast('graph_update', graph.getFullGraph());
    if (result.conflicts?.length > 0) {
      broadcast('new_conflicts', result.conflicts);
    }
    res.json(result);
  } catch (err) {
    console.error('Email webhook ingest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET so you can verify the webhook route is registered (e.g. curl http://localhost:3001/api/webhooks/whatsapp)
app.get('/api/webhooks/whatsapp', (req, res) => {
  res.json({
    ok: true,
    message: 'WhatsApp/OpenClaw webhook. POST JSON with "message" and optional "sender", "channel", "participants".',
    post_url: '/api/webhooks/whatsapp'
  });
});

app.post('/api/webhooks/whatsapp', async (req, res) => {
  if (!checkWebhookAuth(req, res)) return;

  // Flexible payload: OpenClaw / bridge may send { from, body } or { sender, message } or similar
  const body = req.body || {};
  const sender = body.from ?? body.sender ?? body.senderId ?? 'WhatsApp';
  const message = body.body ?? body.message ?? body.text ?? body.content ?? '';
  const channel = body.channel ?? (body.isGroup ? 'group' : 'direct');
  const participants = Array.isArray(body.participants) ? body.participants : (body.participant ? [body.participant] : [sender]);

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid message body (use message, body, or text)' });
  }

  const content = `Chat message in ${channel} from ${sender}:\n${message}`;

  try {
    const result = await processIncoming('chat', content, {
      sender,
      participants,
      channel,
      source: 'whatsapp',
      ...(body.timestamp && { timestamp: body.timestamp })
    }, onStep);

    broadcast('new_event', result.event);
    broadcast('graph_update', graph.getFullGraph());
    if (result.conflicts?.length > 0) {
      broadcast('new_conflicts', result.conflicts);
    }
    res.json(result);
  } catch (err) {
    console.error('Webhook ingest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Ask the AI Chief of Staff ──────────────────────────────────

app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  const result = await askChiefOfStaff(question);
  res.json(result);
});

// ── Brief Me — personalized context view ───────────────────────

app.get('/api/brief/:personId', async (req, res) => {
  const { personId } = req.params;
  const currentGraph = graph.getFullGraph();
  const person = currentGraph.nodes.find(n => n.id === personId);

  if (!person) {
    return res.status(404).json({ error: 'Person not found' });
  }

  // Gather context for this person
  const edges = currentGraph.edges.filter(e => e.from === personId || e.to === personId);
  const connectedIds = new Set(edges.map(e => e.from === personId ? e.to : e.from));
  const connectedNodes = currentGraph.nodes.filter(n => connectedIds.has(n.id));
  const recentEvents = currentGraph.events.filter(e =>
    e.affectedNodes?.includes(personId) ||
    connectedIds.has(e.details?.sender) ||
    (e.details?.participants || []).some(p => connectedIds.has(p))
  ).slice(-10);
  const openConflicts = currentGraph.conflicts.filter(c =>
    c.status === 'open' && (c.nodeIds?.includes(personId) || c.nodeIds?.some(id => connectedIds.has(id)))
  );

  const contextPrompt = `You are the AI Chief of Staff. Generate a concise briefing for ${person.label} (${person.details?.role || 'team member'}).

This person:
- Role: ${person.details?.role || 'Unknown'}
- Team: ${person.details?.team || 'Unknown'}
- Connected to: ${connectedNodes.map(n => `${n.label} (${n.type})`).join(', ')}
- Relationships: ${edges.map(e => {
    const other = currentGraph.nodes.find(n => n.id === (e.from === personId ? e.to : e.from));
    return `${e.type} ${other?.label || '?'}`;
  }).join(', ')}

Recent events involving them or their connections:
${recentEvents.map(e => `- [${e.source}] ${e.summary}`).join('\n') || 'No recent events'}

Open conflicts affecting them:
${openConflicts.map(c => `- [${c.severity}] ${c.description}`).join('\n') || 'No conflicts'}

All organizational projects/topics:
${currentGraph.nodes.filter(n => ['project', 'topic', 'decision'].includes(n.type)).map(n => `- ${n.label} (${n.type}): ${JSON.stringify(n.details)}`).join('\n')}

Generate a structured briefing in JSON:
{
  "greeting": "Short greeting for the person",
  "summary": "2-3 sentence overview of their current situation",
  "activeProjects": [{"name": "...", "status": "...", "theirRole": "..."}],
  "needsAttention": ["Action item or thing they should know about"],
  "keyPeople": [{"name": "...", "relationship": "...", "context": "why they matter right now"}],
  "openConflicts": [{"description": "...", "severity": "...", "action": "suggested action"}],
  "missedUpdates": ["Things that happened recently they should know about"]
}`;

  try {
    const openai = (await import('openai')).default;
    const client = new openai({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are the AI Chief of Staff. Generate concise, actionable briefings. Be specific and reference real data.' },
        { role: 'user', content: contextPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1200
    });

    const briefing = JSON.parse(response.choices[0].message.content);
    res.json({ success: true, person: { id: person.id, label: person.label, details: person.details }, briefing });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      person: { id: person.id, label: person.label, details: person.details },
      briefing: {
        greeting: `Briefing for ${person.label}`,
        summary: `${person.label} is a ${person.details?.role || 'team member'} on the ${person.details?.team || 'unknown'} team with ${edges.length} connections.`,
        activeProjects: [],
        needsAttention: openConflicts.map(c => c.description),
        keyPeople: connectedNodes.filter(n => n.type === 'person').map(n => ({ name: n.label, relationship: 'connected', context: n.details?.role || '' })),
        openConflicts: openConflicts.map(c => ({ description: c.description, severity: c.severity, action: 'Review and resolve' })),
        missedUpdates: recentEvents.map(e => e.summary)
      }
    });
  }
});

// ── Demo data management ───────────────────────────────────────

app.post('/api/demo/seed', (req, res) => {
  graph.resetGraph();
  const result = seedDemoCompany();
  broadcast('graph_update', graph.getFullGraph());
  res.json({ success: true, ...result });
});

app.post('/api/demo/reset', (req, res) => {
  graph.resetGraph();
  broadcast('graph_update', graph.getFullGraph());
  res.json({ success: true, message: 'Graph reset' });
});

// ── Start server ───────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🧠 AI Chief of Staff server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket available on ws://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /api/graph          — Full knowledge graph`);
  console.log(`  GET  /api/events         — Recent events`);
  console.log(`  GET  /api/events/today   — Today's events`);
  console.log(`  GET  /api/conflicts      — Open conflicts`);
  console.log(`  POST /api/ingest/email   — Ingest email`);
  console.log(`  POST /api/ingest/chat    — Ingest chat message`);
  console.log(`  POST /api/ingest/meeting — Ingest meeting notes`);
  console.log(`  POST /api/ingest/voice   — Ingest voice note`);
  console.log(`  GET  /api/webhooks/email — Email webhook info (verify route)`);
  console.log(`  POST /api/webhooks/email — Email webhook (SendGrid inbound parse)`);
  console.log(`  GET  /api/webhooks/whatsapp — Webhook info (verify route)`);
  console.log(`  POST /api/webhooks/whatsapp — WhatsApp/OpenClaw webhook`);
  console.log(`  POST /api/agent/voice    — Voice agent (STT + ingest)`);
  console.log(`  POST /api/ask            — Ask the Chief of Staff`);
  console.log(`  POST /api/demo/seed      — Seed demo data`);
  console.log(`  POST /api/demo/reset     — Reset graph`);
});
