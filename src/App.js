import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import KnowledgeGraph from './components/KnowledgeGraph';
import Timeline from './components/Timeline';
import IngestPanel from './components/IngestPanel';
import AskPanel from './components/AskPanel';
import ConflictPanel from './components/ConflictPanel';
import StatsBar from './components/StatsBar';
import AgentPipeline from './components/AgentPipeline';
import NotificationsPanel from './components/NotificationsPanel';
import VoiceAgentModal from './components/VoiceAgentModal';

const API_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

// ── Agent Step Queue — ensures each step is visible for a minimum duration ──
// Without this, WebSocket messages arrive too fast and React batches state
// updates, so the user only sees the first and last state.
const MIN_STEP_GAP = 1200; // ms between rendering each queued step

function useAgentStepQueue() {
  const [agentSteps, setAgentSteps] = useState([]);
  const [lastReasoning, setLastReasoning] = useState(null);
  const queueRef = useRef([]);
  const drainingRef = useRef(false);
  const timerRef = useRef(null);

  const applyStep = useCallback((step) => {
    if (step.agent === 'reasoning') {
      setLastReasoning(step.message);
      return;
    }
    setAgentSteps(prev => {
      const existing = prev.findIndex(s => s.agent === step.agent);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = step;
        return updated;
      }
      return [...prev, step];
    });
  }, []);

  const drainQueue = useCallback(() => {
    if (queueRef.current.length === 0) {
      drainingRef.current = false;
      return;
    }
    drainingRef.current = true;
    const next = queueRef.current.shift();
    applyStep(next);
    timerRef.current = setTimeout(drainQueue, MIN_STEP_GAP);
  }, [applyStep]);

  const enqueue = useCallback((step) => {
    queueRef.current.push(step);
    if (!drainingRef.current) {
      drainQueue();
    }
  }, [drainQueue]);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    queueRef.current = [];
    drainingRef.current = false;
    setAgentSteps([]);
    setLastReasoning(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return { agentSteps, lastReasoning, enqueue, reset, setAgentSteps, setLastReasoning };
}

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], events: [], conflicts: [], metadata: {} });
  const [selectedNode, setSelectedNode] = useState(null);
  const [activePanel, setActivePanel] = useState('ingest');
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [graphFocus, setGraphFocus] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [voiceAgentOpen, setVoiceAgentOpen] = useState(false);
  const { agentSteps, lastReasoning, enqueue: enqueueStep, reset: resetPipeline, setAgentSteps, setLastReasoning } = useAgentStepQueue();
  const pipelineDismissRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => setIsConnected(true);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'graph_update') setGraphData(msg.data);
      else if (msg.type === 'new_event') setLastEvent(msg.data);
      else if (msg.type === 'agent_step') {
        enqueueStep(msg.data);
      }
    };
    ws.onclose = () => {
      setIsConnected(false);
      reconnectRef.current = setTimeout(connectWs, 2000);
    };
    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, [enqueueStep]);

  useEffect(() => {
    connectWs();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connectWs]);

  const [commAnalytics, setCommAnalytics] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/graph`)
      .then(r => r.json())
      .then(setGraphData)
      .catch(() => {});
  }, []);

  // Fetch communication analytics when graph data changes
  useEffect(() => {
    if (!graphData.events || graphData.events.length === 0) return;
    fetch(`${API_URL}/api/analytics/communication`)
      .then(r => r.json())
      .then(setCommAnalytics)
      .catch(() => {});
  }, [graphData.events?.length]);

  useEffect(() => {
    if (!lastEvent?.affectedNodes || lastEvent.affectedNodes.length === 0) return;
    setGraphFocus({
      source: 'event',
      nodeIds: lastEvent.affectedNodes,
      reason: lastEvent.summary,
      recommendedView: 'flow',
      timestamp: lastEvent.timestamp
    });
  }, [lastEvent]);

  // Clear agent pipeline state when starting new ingestion
  const startProcessing = useCallback(() => {
    clearTimeout(pipelineDismissRef.current);
    setProcessing(true);
    resetPipeline();
  }, [resetPipeline]);

  // Auto-dismiss pipeline overlay after reasoning arrives
  useEffect(() => {
    if (lastReasoning && !processing) {
      pipelineDismissRef.current = setTimeout(() => {
        setAgentSteps([]);
        setLastReasoning(null);
      }, 20000);
    }
    return () => clearTimeout(pipelineDismissRef.current);
  }, [lastReasoning, processing, setAgentSteps, setLastReasoning]);

  const seedDemo = async () => {
    setProcessing(true);
    try { await fetch(`${API_URL}/api/demo/seed`, { method: 'POST' }); }
    catch (e) { console.error(e); }
    setGraphFocus(null);
    setProcessing(false);
  };

  const resetGraph = async () => {
    await fetch(`${API_URL}/api/demo/reset`, { method: 'POST' });
    setSelectedNode(null);
    setLastEvent(null);
    setGraphFocus(null);
  };

  // Auto-demo: runs demo scenarios sequentially to show live graph evolution
  const [demoRunning, setDemoRunning] = useState(false);
  const demoRef = useRef(false);

  const runAutoDemo = async () => {
    if (demoRunning) return;
    setDemoRunning(true);
    demoRef.current = true;

    // Step 0: Reset and seed
    await fetch(`${API_URL}/api/demo/reset`, { method: 'POST' });
    setSelectedNode(null); setLastEvent(null);
    await new Promise(r => setTimeout(r, 500));
    await fetch(`${API_URL}/api/demo/seed`, { method: 'POST' });
    await new Promise(r => setTimeout(r, 1500));
    if (!demoRef.current) { setDemoRunning(false); return; }

    // Step 1: Conflicting Decision (email)
    setActivePanel('ingest');
    startProcessing();
    await fetch(`${API_URL}/api/ingest/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: 'Sarah Chen',
        recipients: ['Marcus Rivera', 'Elena Volkov', 'Lisa Tanaka'],
        subject: 'Launch Date Update',
        body: 'Team, after reviewing the pipeline situation, I\'m pushing our launch to April 15. We need the extra time to ensure quality. This overrides the March 20 date.'
      })
    });
    setProcessing(false);
    await new Promise(r => setTimeout(r, 2000));
    if (!demoRef.current) { setDemoRunning(false); return; }

    // Step 2: Switch to conflicts tab
    setActivePanel('conflicts');
    await new Promise(r => setTimeout(r, 3000));
    if (!demoRef.current) { setDemoRunning(false); return; }

    // Step 3: New hire announcement (chat)
    setActivePanel('ingest');
    startProcessing();
    await fetch(`${API_URL}/api/ingest/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: '#engineering',
        sender: 'Elena Volkov',
        message: 'Great news everyone! We just got approval to hire two senior backend engineers. One will focus on Kubernetes for Project Atlas, and the other on data engineering for the pipeline v2 work. @Aisha and @David please start preparing onboarding plans so we are ready when they join in March.'
      })
    });
    setProcessing(false);
    await new Promise(r => setTimeout(r, 2000));
    if (!demoRef.current) { setDemoRunning(false); return; }

    // Step 4: Voice memo with competitive intelligence
    startProcessing();
    await fetch(`${API_URL}/api/ingest/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speaker: 'Marcus Rivera',
        transcription: 'Quick thought after the investor call today. The lead partner at Horizon Ventures mentioned they\'re also looking at our competitor, DataFlow AI. We need to accelerate Project Atlas delivery to differentiate. I\'m going to ask Elena to pull two engineers from the pipeline v2 project temporarily.',
        context: 'Post-investor call voice memo'
      })
    });
    setProcessing(false);
    await new Promise(r => setTimeout(r, 2000));
    if (!demoRef.current) { setDemoRunning(false); return; }

    // Step 5: Switch to Ask AI
    setActivePanel('ask');
    await new Promise(r => setTimeout(r, 1000));

    setDemoRunning(false);
    demoRef.current = false;
  };

  const stopDemo = () => {
    demoRef.current = false;
    setDemoRunning(false);
  };

  const handleAskAnswer = useCallback((answer, question) => {
    const nodeIds = answer?.evidenceNodeIds || [];
    if (!nodeIds || nodeIds.length === 0) return;
    setGraphFocus({
      source: 'ask',
      nodeIds,
      reason: question,
      recommendedView: answer?.recommendedView || null,
      timestamp: new Date().toISOString()
    });
  }, []);

  const handleTimelineFocus = useCallback((event) => {
    if (!event?.affectedNodes || event.affectedNodes.length === 0) return;
    setGraphFocus({
      source: 'timeline',
      nodeIds: event.affectedNodes,
      reason: event.summary || 'Timeline event',
      recommendedView: 'flow',
      timestamp: event.timestamp
    });
  }, []);

  const handleNotifFocus = useCallback((targetId) => {
    if (!targetId) return;
    setGraphFocus({
      source: 'notification',
      nodeIds: [targetId],
      reason: 'Notification target',
      recommendedView: 'stakeholder',
      timestamp: new Date().toISOString()
    });
  }, []);

  const clearGraphFocus = useCallback(() => {
    setGraphFocus(null);
  }, []);

  // Determine when the agent pipeline animation has finished (all 5 agents complete)
  const PIPELINE_AGENT_IDS = ['coordinator', 'memory', 'critic', 'router', 'summary'];
  const pipelineDone = agentSteps.length === 0 || PIPELINE_AGENT_IDS.every(id =>
    agentSteps.some(s => s.agent === id && s.status === 'complete')
  );

  const openConflicts = graphData.conflicts?.filter(c => c.status === 'open') || [];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon" role="img" aria-label="brain">&#x1f9e0;</span>
            <h1>AI Chief of Staff</h1>
          </div>
          <span className="subtitle">Organizational Intelligence System</span>
        </div>
        <div className="header-right">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {isConnected ? 'Live' : 'Connecting...'}
          </div>
          {demoRunning ? (
            <button onClick={stopDemo} className="btn btn-ghost" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              Stop Demo
            </button>
          ) : (
            <button onClick={runAutoDemo} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #3B82F6, #06B6D4)' }}>
              Auto Demo
            </button>
          )}
          <button onClick={() => setVoiceAgentOpen(true)} className="btn btn-ghost">
            🎙 Voice Agent
          </button>
          <button onClick={seedDemo} className="btn btn-primary" disabled={processing}>
            {processing ? 'Loading...' : 'Load Demo Company'}
          </button>
          <button onClick={resetGraph} className="btn btn-ghost">Reset</button>
        </div>
      </header>

      <StatsBar graphData={graphData} lastEvent={lastEvent} />

      <div className="main-layout">
        <div className="graph-container">
          <KnowledgeGraph
            graphData={graphData}
            selectedNode={selectedNode}
            onNodeSelect={setSelectedNode}
            graphFocus={graphFocus}
            onClearFocus={clearGraphFocus}
            commAnalytics={commAnalytics}
          />
          {(processing || agentSteps.length > 0) && (
            <div className="graph-processing">
              <AgentPipeline steps={agentSteps} reasoning={lastReasoning} />
            </div>
          )}
        </div>

        <div className="side-panel">
          <div className="panel-tabs">
            <button className={`panel-tab ${activePanel === 'ingest' ? 'active' : ''}`} onClick={() => setActivePanel('ingest')}>
              &#x1f4e5; Ingest
            </button>
            <button className={`panel-tab ${activePanel === 'ask' ? 'active' : ''}`} onClick={() => setActivePanel('ask')}>
              &#x1f916; Ask AI
            </button>
            <button
              className={`panel-tab ${activePanel === 'conflicts' ? 'active' : ''} ${openConflicts.length > 0 ? 'has-alerts' : ''}`}
              onClick={() => setActivePanel('conflicts')}
            >
              &#x26a0;&#xfe0f; Conflicts {openConflicts.length > 0 && <span className="badge">{openConflicts.length}</span>}
            </button>
            <button className={`panel-tab ${activePanel === 'notifications' ? 'active' : ''}`} onClick={() => setActivePanel('notifications')}>
              &#x1f514; Routed
            </button>
            <button className={`panel-tab ${activePanel === 'timeline' ? 'active' : ''}`} onClick={() => setActivePanel('timeline')}>
              &#x1f4c5; Timeline
            </button>
          </div>

          <div className="panel-content">
            {activePanel === 'ingest' && <IngestPanel apiUrl={API_URL} onProcessing={startProcessing} onProcessingDone={() => setProcessing(false)} processing={processing} pipelineDone={pipelineDone} />}
            {activePanel === 'ask' && <AskPanel apiUrl={API_URL} onAnswer={handleAskAnswer} />}
            {activePanel === 'conflicts' && <ConflictPanel conflicts={openConflicts} apiUrl={API_URL} />}
            {activePanel === 'notifications' && <NotificationsPanel apiUrl={API_URL} onFocusNode={handleNotifFocus} />}
            {activePanel === 'timeline' && (
              <Timeline
                events={graphData.events || []}
                nodes={graphData.nodes || []}
                onEventFocus={handleTimelineFocus}
              />
            )}
          </div>
        </div>
      </div>

      {selectedNode && (
        <NodeDetail
          node={selectedNode}
          edges={graphData.edges?.filter(e => e.from === selectedNode.id || e.to === selectedNode.id) || []}
          allNodes={graphData.nodes || []}
          onClose={() => setSelectedNode(null)}
          onSelectNode={setSelectedNode}
        />
      )}

      <VoiceAgentModal
        apiUrl={API_URL}
        isOpen={voiceAgentOpen}
        onClose={() => setVoiceAgentOpen(false)}
      />
    </div>
  );
}

function NodeDetail({ node, edges, allNodes, onClose, onSelectNode }) {
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const typeColors = {
    person: '#3B82F6', team: '#10B981', project: '#F59E0B',
    topic: '#06B6D4', decision: '#EF4444', document: '#8B5CF6'
  };

  const connectedNodes = edges.map(e => {
    const otherId = e.from === node.id ? e.to : e.from;
    return { ...e, otherNode: allNodes.find(n => n.id === otherId) };
  });

  const handleConnectionClick = (conn) => {
    if (!conn?.otherNode || !onSelectNode) return;
    onSelectNode(conn.otherNode);
  };

  const handleBriefMe = async () => {
    setBriefingLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/brief/${node.id}`);
      const data = await res.json();
      setBriefing(data.briefing);
    } catch (e) {
      setBriefing({ summary: 'Failed to load briefing.', greeting: 'Error' });
    }
    setBriefingLoading(false);
  };

  return (
    <div className="node-detail-overlay" onClick={onClose}>
      <div className="node-detail" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>&times;</button>
        <div className="node-detail-header">
          <span className="node-type-badge" style={{ background: typeColors[node.type] || '#666' }}>{node.type}</span>
          <h2>{node.label}</h2>
        </div>

        {/* Brief Me button for people */}
        {node.type === 'person' && !briefing && (
          <button className="btn btn-brief" onClick={handleBriefMe} disabled={briefingLoading}>
            {briefingLoading ? '⏳ Generating briefing...' : '📋 Brief Me — Get Context View'}
          </button>
        )}

        {/* Briefing card */}
        {briefing && (
          <div className="briefing-card">
            <div className="briefing-header">
              <span className="briefing-icon">📋</span>
              <span className="briefing-title">Personalized Briefing</span>
              <button className="btn-briefing-close" onClick={() => setBriefing(null)}>×</button>
            </div>
            {briefing.greeting && <p className="briefing-greeting">{briefing.greeting}</p>}
            {briefing.summary && <p className="briefing-summary">{briefing.summary}</p>}

            {briefing.activeProjects?.length > 0 && (
              <div className="briefing-section">
                <h4>Active Projects</h4>
                {briefing.activeProjects.map((p, i) => (
                  <div key={i} className="briefing-item">
                    <span className="briefing-item-name">{p.name}</span>
                    <span className="briefing-item-detail">{p.theirRole} — {p.status}</span>
                  </div>
                ))}
              </div>
            )}

            {briefing.needsAttention?.length > 0 && (
              <div className="briefing-section attention">
                <h4>⚠ Needs Attention</h4>
                <ul>{briefing.needsAttention.map((item, i) => <li key={i}>{item}</li>)}</ul>
              </div>
            )}

            {briefing.keyPeople?.length > 0 && (
              <div className="briefing-section">
                <h4>Key People</h4>
                {briefing.keyPeople.map((p, i) => (
                  <div key={i} className="briefing-item">
                    <span className="briefing-item-name">{p.name}</span>
                    <span className="briefing-item-detail">{p.relationship} — {p.context}</span>
                  </div>
                ))}
              </div>
            )}

            {briefing.openConflicts?.length > 0 && (
              <div className="briefing-section attention">
                <h4>Open Conflicts</h4>
                {briefing.openConflicts.map((c, i) => (
                  <div key={i} className="briefing-item">
                    <span className="briefing-item-name">[{c.severity}] {c.description}</span>
                    <span className="briefing-item-detail">Suggested: {c.action}</span>
                  </div>
                ))}
              </div>
            )}

            {briefing.missedUpdates?.length > 0 && (
              <div className="briefing-section">
                <h4>Recent Updates</h4>
                <ul>{briefing.missedUpdates.map((u, i) => <li key={i}>{u}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        {node.details && Object.keys(node.details).length > 0 && (
          <div className="node-details-grid">
            {Object.entries(node.details).map(([key, value]) => (
              <div key={key} className="detail-item">
                <span className="detail-label">{key}</span>
                <span className="detail-value">{String(value)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Decision version trail */}
        {node.type === 'decision' && node.history && node.history.length > 0 && (
          <div className="version-trail">
            <h3>Decision History</h3>
            <div className="version-list">
              {/* Current version */}
              <div className="version-entry current">
                <span className="version-badge current">v{node.history.length + 1} (current)</span>
                <span className="version-label">{node.label}</span>
                <span className="version-date">{new Date(node.updatedAt).toLocaleDateString()}</span>
              </div>
              {/* Previous versions in reverse order */}
              {[...node.history].reverse().map((h, i) => (
                <div key={i} className="version-entry superseded">
                  <span className="version-badge superseded">v{node.history.length - i}</span>
                  <span className="version-label superseded">{h.label}</span>
                  <span className="version-date">{new Date(h.changedAt).toLocaleDateString()}</span>
                  {h.details && Object.keys(h.details).length > 0 && (
                    <span className="version-details">
                      {Object.entries(h.details).filter(([k]) => k !== 'topic').map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <h3>Connections ({connectedNodes.length})</h3>
        <div className="connections-list">
          {connectedNodes.map((conn, i) => (
            <button
              key={i}
              type="button"
              className="connection-item connection-link"
              onClick={() => handleConnectionClick(conn)}
              disabled={!conn.otherNode}
            >
              <span className="conn-type">{conn.type}</span>
              <span className="conn-label">{conn.otherNode?.label || '?'}</span>
              <span className="conn-node-type" style={{ color: typeColors[conn.otherNode?.type] || '#666' }}>
                ({conn.otherNode?.type})
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
