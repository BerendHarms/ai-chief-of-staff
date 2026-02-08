// In-memory knowledge graph store — the organizational brain
// Persists to a JSON file so we don't lose state on restart

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE = path.join(__dirname, 'graph_data.json');

const DEFAULT_STATE = {
  nodes: [],           // people, teams, topics, decisions, documents
  edges: [],           // relationships between nodes
  events: [],          // timeline of all changes (versioned organizational memory)
  conflicts: [],       // detected contradictions
  notifications: [],   // routed notifications from the router agent
  metadata: {
    lastUpdated: null,
    version: 0,
    totalEvents: 0
  }
};

let state = loadState();

function loadState() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
      return data;
    }
  } catch (e) {
    console.log('Starting with fresh state');
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function saveState() {
  fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2));
}

// ── Node operations ────────────────────────────────────

export function addNode(node) {
  const id = node.id || uuidv4();
  const existing = state.nodes.find(n => n.id === id);
  if (existing) {
    // Track version history for decisions and important changes
    if (existing.type === 'decision' || node.type === 'decision') {
      if (!existing.history) existing.history = [];
      // Only record if something meaningful changed
      const oldLabel = existing.label;
      const oldDetails = JSON.stringify(existing.details);
      const newLabel = node.label || oldLabel;
      const newDetails = JSON.stringify({ ...existing.details, ...node.details });
      if (oldLabel !== newLabel || oldDetails !== newDetails) {
        existing.history.push({
          label: oldLabel,
          details: { ...existing.details },
          changedAt: existing.updatedAt || existing.createdAt,
          version: existing.history.length + 1
        });
      }
    }
    Object.assign(existing, { ...node, id, updatedAt: new Date().toISOString() });
  } else {
    state.nodes.push({
      id,
      type: node.type || 'topic', // person, team, topic, decision, document
      label: node.label,
      details: node.details || {},
      history: [],               // version history
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...node
    });
  }
  state.metadata.version++;
  state.metadata.lastUpdated = new Date().toISOString();
  saveState();
  return id;
}

export function addEdge(edge) {
  const id = edge.id || uuidv4();
  const existing = state.edges.find(e =>
    e.from === edge.from && e.to === edge.to && e.type === edge.type
  );
  if (existing) {
    Object.assign(existing, { ...edge, id: existing.id, updatedAt: new Date().toISOString() });
    saveState();
    return existing.id;
  }
  state.edges.push({
    id,
    from: edge.from,
    to: edge.to,
    type: edge.type || 'related_to', // knows, owns, decided, conflicts_with, informed_about
    label: edge.label || edge.type,
    weight: edge.weight || 1,
    createdAt: new Date().toISOString(),
    ...edge
  });
  state.metadata.version++;
  saveState();
  return id;
}

// ── Event log (versioned organizational memory) ────────

export function addEvent(event) {
  const id = uuidv4();
  const entry = {
    id,
    type: event.type, // meeting, decision, email, message, conflict, update
    source: event.source, // email, whatsapp, voice, manual
    summary: event.summary,
    details: event.details || {},
    affectedNodes: event.affectedNodes || [],
    affectedEdges: event.affectedEdges || [],
    timestamp: new Date().toISOString(),
    agentId: event.agentId || 'system',
    ...event
  };
  state.events.push(entry);
  state.metadata.totalEvents++;
  state.metadata.version++;
  state.metadata.lastUpdated = new Date().toISOString();
  saveState();
  return entry;
}

// ── Conflict tracking ──────────────────────────────────

export function addConflict(conflict) {
  const id = uuidv4();
  const entry = {
    id,
    type: conflict.type || 'contradiction',
    description: conflict.description,
    nodeIds: conflict.nodeIds || [],
    eventIds: conflict.eventIds || [],
    severity: conflict.severity || 'medium', // low, medium, high
    status: 'open', // open, resolved, dismissed
    detectedAt: new Date().toISOString(),
    ...conflict
  };
  state.conflicts.push(entry);
  state.metadata.version++;
  saveState();
  return entry;
}

export function resolveConflict(conflictId, resolution) {
  const conflict = state.conflicts.find(c => c.id === conflictId);
  if (conflict) {
    conflict.status = 'resolved';
    conflict.resolution = resolution;
    conflict.resolvedAt = new Date().toISOString();
    state.metadata.version++;
    saveState();
  }
  return conflict;
}

// ── Query helpers ──────────────────────────────────────

export function getFullGraph() {
  return { ...state };
}

export function getNode(id) {
  return state.nodes.find(n => n.id === id);
}

export function getNodesByType(type) {
  return state.nodes.filter(n => n.type === type);
}

export function getEdgesForNode(nodeId) {
  return state.edges.filter(e => e.from === nodeId || e.to === nodeId);
}

export function getRecentEvents(count = 20) {
  return state.events.slice(-count);
}

export function getEventsToday() {
  const today = new Date().toISOString().split('T')[0];
  return state.events.filter(e => e.timestamp.startsWith(today));
}

export function getOpenConflicts() {
  return state.conflicts.filter(c => c.status === 'open');
}

export function getVersion() {
  return state.metadata.version;
}

// ── Notification storage ────────────────────────────────

export function addNotification(notification) {
  const entry = {
    id: uuidv4(),
    ...notification,
    createdAt: new Date().toISOString(),
    read: false
  };
  if (!state.notifications) state.notifications = [];
  state.notifications.push(entry);
  saveState();
  return entry;
}

export function getNotifications(limit = 50) {
  if (!state.notifications) return [];
  return state.notifications.slice(-limit);
}

export function getUnreadNotifications() {
  if (!state.notifications) return [];
  return state.notifications.filter(n => !n.read);
}

export function markNotificationRead(notificationId) {
  if (!state.notifications) return null;
  const notif = state.notifications.find(n => n.id === notificationId);
  if (notif) { notif.read = true; saveState(); }
  return notif;
}

export function markAllNotificationsRead() {
  if (!state.notifications) return;
  state.notifications.forEach(n => { n.read = true; });
  saveState();
}

// ── Communication analytics ─────────────────────────────

export function getCommAnalytics() {
  // Count communication frequency per person from events
  const personComm = {};   // personId -> { sent: N, mentioned: N, events: N }
  const teamComm = {};     // teamId -> { events: N, crossTeam: N }
  const pairComm = {};     // "id1-id2" -> count (communication pairs)

  const personTeamMap = {};
  state.edges.filter(e => e.type === 'belongs_to').forEach(e => {
    personTeamMap[e.from] = e.to;
  });

  for (const event of state.events) {
    const affected = event.affectedNodes || [];
    const sender = event.details?.sender;
    const participants = event.details?.participants || event.details?.analysis?.notifications?.map(n => n.targetEntity) || [];

    // Count per person
    for (const nodeId of affected) {
      const node = state.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      if (node.type === 'person') {
        if (!personComm[nodeId]) personComm[nodeId] = { sent: 0, mentioned: 0, events: 0 };
        personComm[nodeId].events++;
        if (sender && node.label.toLowerCase().includes(sender.toLowerCase())) {
          personComm[nodeId].sent++;
        } else {
          personComm[nodeId].mentioned++;
        }
      }
      if (node.type === 'team') {
        if (!teamComm[nodeId]) teamComm[nodeId] = { events: 0, crossTeam: 0 };
        teamComm[nodeId].events++;
      }
    }

    // Count pair communication
    const people = affected.filter(id => state.nodes.find(n => n.id === id && n.type === 'person'));
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const key = [people[i], people[j]].sort().join('-');
        pairComm[key] = (pairComm[key] || 0) + 1;
      }
    }

    // Cross-team detection
    const teams = new Set(people.map(p => personTeamMap[p]).filter(Boolean));
    if (teams.size > 1) {
      for (const teamId of teams) {
        if (!teamComm[teamId]) teamComm[teamId] = { events: 0, crossTeam: 0 };
        teamComm[teamId].crossTeam++;
      }
    }
  }

  // Detect silos (teams with no cross-team communication)
  const silos = Object.entries(teamComm)
    .filter(([_, data]) => data.crossTeam === 0 && data.events > 0)
    .map(([teamId]) => teamId);

  // Detect bottlenecks (people mentioned in many events but rarely send)
  const bottlenecks = Object.entries(personComm)
    .filter(([_, data]) => data.events >= 3 && data.mentioned > data.sent * 2)
    .map(([personId]) => personId);

  return { personComm, teamComm, pairComm, silos, bottlenecks };
}

// ── Reset (for demo purposes) ──────────────────────────

export function resetGraph() {
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  saveState();
  return state;
}

// ── Seed with demo data ────────────────────────────────

export function seedDemoData(nodes, edges, events) {
  if (nodes) nodes.forEach(n => addNode(n));
  if (edges) edges.forEach(e => addEdge(e));
  if (events) events.forEach(ev => addEvent(ev));
  return getFullGraph();
}

export default {
  addNode, addEdge, addEvent, addConflict, resolveConflict,
  getFullGraph, getNode, getNodesByType, getEdgesForNode,
  getRecentEvents, getEventsToday, getOpenConflicts, getVersion,
  addNotification, getNotifications, getUnreadNotifications, markNotificationRead, markAllNotificationsRead,
  getCommAnalytics,
  resetGraph, seedDemoData
};
