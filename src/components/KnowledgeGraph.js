import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

// ── View Configuration ─────────────────────────────────────────

const VIEWS = [
  { id: 'org', label: 'Org Chart', icon: '🏢', desc: 'Company hierarchy and reporting lines' },
  { id: 'flow', label: 'Info Flow', icon: '🔄', desc: 'How information moves across teams' },
  { id: 'stakeholder', label: 'Stakeholder Map', icon: '🎯', desc: 'Context and dependencies for a person' },
];

// Department/team colors
const TEAM_COLORS = {
  leadership: '#3B82F6',
  engineering: '#2563EB',
  product: '#F59E0B',
  sales: '#10B981',
  marketing: '#EC4899',
  default: '#6B7280',
};

const NODE_COLORS = {
  person: '#3B82F6',
  team: '#10B981',
  project: '#F59E0B',
  topic: '#06B6D4',
  decision: '#EF4444',
  document: '#8B5CF6',
};

export default function KnowledgeGraph({ graphData, selectedNode, onNodeSelect, graphFocus, onClearFocus, commAnalytics }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const nodesDatasetRef = useRef(new DataSet());
  const edgesDatasetRef = useRef(new DataSet());
  const [viewMode, setViewMode] = useState('org');
  const [focusNode, setFocusNode] = useState(null); // For stakeholder map center
  const [legendOpen, setLegendOpen] = useState(true);
  const lastViewChangeRef = useRef(0);
  const lastFitRef = useRef({ viewMode: null, focusKey: null });

  useEffect(() => {
    if (!graphFocus?.recommendedView) return;
    if (!['org', 'flow', 'stakeholder'].includes(graphFocus.recommendedView)) return;
    if (graphFocus.recommendedView === viewMode) return;
    const now = Date.now();
    if (now - lastViewChangeRef.current < 2000) return;
    setViewMode(graphFocus.recommendedView);
  }, [graphFocus, viewMode]);

  // ── Initialize vis-network ────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || networkRef.current) return;

    const network = new Network(
      containerRef.current,
      { nodes: nodesDatasetRef.current, edges: edgesDatasetRef.current },
      getBaseOptions()
    );

    networkRef.current = network;

    return () => { network.destroy(); networkRef.current = null; };
  }, []);

  // ── Click handler ─────────────────────────────────────────────

  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;
  const graphDataRef = useRef(graphData);
  graphDataRef.current = graphData;

  useEffect(() => {
    if (!networkRef.current) return;
    networkRef.current.off('click');
    networkRef.current.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = graphDataRef.current.nodes?.find(n => n.id === nodeId);
        if (node) {
          onNodeSelectRef.current(node);
          if (viewMode === 'stakeholder' && node.type === 'person') {
            setFocusNode(node);
          }
        }
      } else {
        onNodeSelectRef.current(null);
      }
    });
  }, [graphData, viewMode]);

  // ── Hover-to-highlight (fade non-connected nodes) ─────────────

  useEffect(() => {
    if (!networkRef.current) return;

    networkRef.current.off('hoverNode');
    networkRef.current.off('blurNode');

    networkRef.current.on('hoverNode', (params) => {
      const connectedNodes = networkRef.current.getConnectedNodes(params.node);
      const allNodeIds = nodesDatasetRef.current.getIds();

      // Dim unconnected nodes
      const updates = allNodeIds.map(id => {
        if (id === params.node || connectedNodes.includes(id)) {
          return { id, opacity: 1.0 };
        }
        return { id, opacity: 0.2 };
      });
      nodesDatasetRef.current.update(updates);

      // Dim unconnected edges
      const allEdgeIds = edgesDatasetRef.current.getIds();
      const connectedEdges = networkRef.current.getConnectedEdges(params.node);
      const edgeUpdates = allEdgeIds.map(id => ({
        id,
        color: { ...edgesDatasetRef.current.get(id)?.color, opacity: connectedEdges.includes(id) ? 0.9 : 0.06 }
      }));
      edgesDatasetRef.current.update(edgeUpdates);
    });

    networkRef.current.on('blurNode', () => {
      // Reset all nodes
      const allNodeIds = nodesDatasetRef.current.getIds();
      nodesDatasetRef.current.update(allNodeIds.map(id => ({ id, opacity: 1.0 })));
      // Reset all edges
      const allEdgeIds = edgesDatasetRef.current.getIds();
      edgesDatasetRef.current.update(allEdgeIds.map(id => ({ id, color: { ...edgesDatasetRef.current.get(id)?.color, opacity: 0.7 } })));
    });
  }, [viewMode, graphData]);

  // ── Build visualization for current view ──────────────────────

  const syncData = useCallback(() => {
    if (!graphData.nodes || graphData.nodes.length === 0) return;
    if (!networkRef.current) return;

    const focus = normalizeFocus(graphFocus, graphData);
    let visNodes, visEdges, options;

    switch (viewMode) {
      case 'org':
        ({ visNodes, visEdges, options } = buildOrgChart(graphData, focus));
        break;
      case 'flow':
        ({ visNodes, visEdges, options } = buildInfoFlow(graphData, focus, commAnalytics));
        break;
      case 'stakeholder':
        ({ visNodes, visEdges, options } = buildStakeholderMap(graphData, focusNode, focus));
        break;
      default:
        ({ visNodes, visEdges, options } = buildOrgChart(graphData, focus));
    }

    // Apply options
    networkRef.current.setOptions(options);

    // Sync nodes
    const currentNodeIds = new Set(nodesDatasetRef.current.getIds());
    const newNodeIds = new Set(visNodes.map(n => n.id));
    const toRemove = [...currentNodeIds].filter(id => !newNodeIds.has(id));
    if (toRemove.length > 0) nodesDatasetRef.current.remove(toRemove);
    nodesDatasetRef.current.update(visNodes);

    // Sync edges
    const currentEdgeIds = new Set(edgesDatasetRef.current.getIds());
    const newEdgeIds = new Set(visEdges.map(e => e.id));
    const edgesToRemove = [...currentEdgeIds].filter(id => !newEdgeIds.has(id));
    if (edgesToRemove.length > 0) edgesDatasetRef.current.remove(edgesToRemove);
    edgesDatasetRef.current.update(visEdges);

    // Fit to view
    const focusKey = getFocusKey(focus);
    const shouldFit = viewMode !== lastFitRef.current.viewMode || focusKey !== lastFitRef.current.focusKey;
    if (shouldFit) {
      lastFitRef.current = { viewMode, focusKey };
      setTimeout(() => {
        networkRef.current?.fit({
          animation: { duration: 600, easingFunction: 'easeInOutQuad' },
          maxZoomLevel: 1.2,
          minZoomLevel: 0.5,
        });
      }, 500);
    }

  }, [graphData, viewMode, focusNode, graphFocus, commAnalytics]);

  useEffect(() => { syncData(); }, [syncData]);

  // ── Selected node highlight ───────────────────────────────────

  useEffect(() => {
    if (!networkRef.current) return;
    if (selectedNode) {
      const exists = nodesDatasetRef.current.get(selectedNode.id);
      if (exists) {
        networkRef.current.selectNodes([selectedNode.id]);
      } else {
        networkRef.current.unselectAll();
      }
    } else {
      networkRef.current.unselectAll();
    }
  }, [selectedNode, viewMode, graphData]);

  // Auto-select first person for stakeholder map if none selected
  useEffect(() => {
    if (viewMode === 'stakeholder' && !focusNode && graphData.nodes?.length > 0) {
      const firstPerson = graphData.nodes.find(n => n.type === 'person');
      if (firstPerson) setFocusNode(firstPerson);
    }
  }, [viewMode, focusNode, graphData]);

  useEffect(() => {
    if (viewMode !== 'stakeholder') return;
    const resolved = resolveFocusPerson(graphData, graphFocus);
    if (resolved) setFocusNode(resolved);
  }, [graphFocus, graphData, viewMode]);

  const isEmpty = !graphData.nodes || graphData.nodes.length === 0;
  const people = graphData.nodes?.filter(n => n.type === 'person') || [];

  const handleViewChange = (id) => {
    lastViewChangeRef.current = Date.now();
    setViewMode(id);
  };

  return (
    <div className="knowledge-graph">
      <div className="graph-header">
        <div className="graph-header-left">
          <h2>Knowledge Graph</h2>
          <span className="graph-view-desc">
            {VIEWS.find(v => v.id === viewMode)?.desc}
          </span>
        </div>
        <div className="graph-header-right">
          {graphFocus && (
            <div className="graph-focus">
              <span className="graph-focus-label">Focus</span>
              <span className="graph-focus-text">
                {graphFocus.reason ? graphFocus.reason.substring(0, 80) : 'Context highlight'}
              </span>
              {onClearFocus && (
                <button className="graph-focus-clear" onClick={onClearFocus}>Clear</button>
              )}
            </div>
          )}
          <div className="view-modes">
            {VIEWS.map(v => (
              <button
                key={v.id}
                className={`view-mode-btn ${viewMode === v.id ? 'active' : ''}`}
                onClick={() => handleViewChange(v.id)}
                title={v.desc}
              >
                <span className="view-icon">{v.icon}</span> {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stakeholder map: person selector */}
      {viewMode === 'stakeholder' && (
        <div className="stakeholder-selector">
          <label>Focus on:</label>
          <div className="person-chips">
            {people.map(p => (
              <button
                key={p.id}
                className={`person-chip ${focusNode?.id === p.id ? 'active' : ''}`}
                onClick={() => setFocusNode(p)}
                style={{ borderColor: getTeamColor(p.details?.team) }}
              >
                {p.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={containerRef} className="graph-canvas" />

      {isEmpty && (
        <div className="graph-empty">
          <p>No data yet. Click <strong>"Load Demo Company"</strong> to see the knowledge graph.</p>
        </div>
      )}

      {/* Floating Legend Panel */}
      {!isEmpty && (
        <div className={`graph-legend-float ${legendOpen ? 'open' : ''}`}>
          <button className="legend-toggle" onClick={() => setLegendOpen(!legendOpen)}>
            {legendOpen ? 'Key \u2715' : 'Key'}
          </button>
          {legendOpen && (
            <div className="legend-body">
              {viewMode === 'org' && (
                <>
                  <div className="legend-section-title">Nodes</div>
                  <div className="legend-row">
                    <span className="legend-shape circle" style={{ background: '#3B82F6' }}></span>
                    <span className="legend-label">Person <span className="legend-hint">— with initials avatar</span></span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-shape rect" style={{ background: '#10B981' }}></span>
                    <span className="legend-label">Team / Department</span>
                  </div>
                  <div className="legend-section-title">Connections</div>
                  <div className="legend-row">
                    <span className="legend-edge solid" style={{ background: '#3B82F6' }}></span>
                    <span className="legend-label">Reports to <span className="legend-hint">— reporting line</span></span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-edge dashed" style={{ background: 'repeating-linear-gradient(90deg, #10B981 0px, #10B981 3px, transparent 3px, transparent 6px)' }}></span>
                    <span className="legend-label">Team lead <span className="legend-hint">— department head</span></span>
                  </div>
                  <div className="legend-section-title">Interactions</div>
                  <div className="legend-hint-block">Hover a node to highlight its connections. Click to see details.</div>
                </>
              )}
              {viewMode === 'flow' && (
                <>
                  <div className="legend-section-title">Nodes</div>
                  <div className="legend-row">
                    <span className="legend-shape rect" style={{ background: '#10B981' }}></span>
                    <span className="legend-label">Team</span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-shape ellipse" style={{ background: '#F59E0B' }}></span>
                    <span className="legend-label">Project</span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-shape diamond" style={{ background: '#EF4444' }}></span>
                    <span className="legend-label">Decision</span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-shape ellipse" style={{ background: '#06B6D4' }}></span>
                    <span className="legend-label">Topic</span>
                  </div>
                  <div className="legend-section-title">Connections</div>
                  <div className="legend-row">
                    <span className="legend-edge solid" style={{ background: '#94A3B8' }}></span>
                    <span className="legend-label">Owns / Leads</span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-edge thin"></span>
                    <span className="legend-label">Works on / Related</span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-edge dashed-red"></span>
                    <span className="legend-label">Affects <span className="legend-hint">— cross-impact</span></span>
                  </div>
                  <div className="legend-section-title">Interactions</div>
                  <div className="legend-hint-block">Hover to see connection type. Click node for details.</div>
                </>
              )}
              {viewMode === 'stakeholder' && (
                <>
                  <div className="legend-section-title">Nodes</div>
                  <div className="legend-row">
                    <span className="legend-shape circle lg" style={{ background: '#F59E0B' }}></span>
                    <span className="legend-label">Focus person <span className="legend-hint">— center</span></span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-shape circle" style={{ background: '#3B82F6' }}></span>
                    <span className="legend-label">Direct connection</span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-shape rect" style={{ background: '#10B981' }}></span>
                    <span className="legend-label">Team</span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-shape ellipse" style={{ background: '#06B6D4' }}></span>
                    <span className="legend-label">Project / Topic</span>
                  </div>
                  <div className="legend-section-title">Connections</div>
                  <div className="legend-row">
                    <span className="legend-edge solid" style={{ background: '#94A3B8' }}></span>
                    <span className="legend-label">Relationship <span className="legend-hint">— hover for type</span></span>
                  </div>
                  <div className="legend-section-title">Interactions</div>
                  <div className="legend-hint-block">Click a person to re-center the map around them.</div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// VIEW BUILDERS
// ═════════════════════════════════════════════════════════════════

function buildOrgChart(graphData, focus) {
  const focusIds = new Set(focus?.nodeIds || []);
  const focusActive = focusIds.size > 0;
  const workItemTypes = new Set(['project', 'decision', 'topic']);

  const orgEdges = graphData.edges.filter(e => e.type === 'reports_to');
  const allPeople = graphData.nodes.filter(n => n.type === 'person');
  const allTeams = graphData.nodes.filter(n => n.type === 'team');

  let people = allPeople;
  let teams = allTeams;

  if (focusActive) {
    const includePeople = new Set();
    const includeTeams = new Set();
    const reportsToEdges = graphData.edges.filter(e => e.type === 'reports_to');
    const belongsToEdges = graphData.edges.filter(e => e.type === 'belongs_to');
    const workEdges = graphData.edges.filter(e => ['owns', 'works_on', 'decided'].includes(e.type));
    const peopleById = new Map(allPeople.map(p => [p.id, p]));

    const addTeamForPerson = (personId) => {
      const teamEdge = belongsToEdges.find(e => e.from === personId);
      if (teamEdge) includeTeams.add(teamEdge.to);
    };

    const addManagerChain = (personId, visited = new Set()) => {
      if (visited.has(personId)) return;
      visited.add(personId);
      const reportEdge = reportsToEdges.find(e => e.from === personId);
      if (!reportEdge) return;
      includePeople.add(reportEdge.to);
      addTeamForPerson(reportEdge.to);
      addManagerChain(reportEdge.to, visited);
    };

    const addDirectReports = (personId) => {
      reportsToEdges.filter(e => e.to === personId).forEach(e => {
        includePeople.add(e.from);
        addTeamForPerson(e.from);
      });
    };

    const addPersonContext = (personId) => {
      if (!peopleById.has(personId)) return;
      includePeople.add(personId);
      addTeamForPerson(personId);
      addManagerChain(personId);
      addDirectReports(personId);
    };

    const focusNodes = graphData.nodes.filter(n => focusIds.has(n.id));
    focusNodes.forEach(n => {
      if (n.type === 'person') {
        addPersonContext(n.id);
      } else if (n.type === 'team') {
        includeTeams.add(n.id);
        belongsToEdges.filter(e => e.to === n.id).forEach(e => addPersonContext(e.from));
      } else if (workItemTypes.has(n.type)) {
        workEdges.forEach(e => {
          if (e.to === n.id || e.from === n.id) {
            const personId = peopleById.has(e.from) ? e.from : e.to;
            addPersonContext(personId);
          }
        });
      }
    });

    if (includePeople.size > 0 || includeTeams.size > 0) {
      people = allPeople.filter(p => includePeople.has(p.id));
      teams = allTeams.filter(t => includeTeams.has(t.id));
    }
  }

  const nodeIds = new Set([...people, ...teams].map(n => n.id));

  const visNodes = [
    ...teams.map(t => {
      const isFocus = focusIds.has(t.id);
      return {
        id: t.id,
        label: t.label,
        level: 0,
        shape: 'box',
        size: 20,
        margin: { top: 10, bottom: 10, left: 16, right: 16 },
        color: { background: '#10B981', border: '#059669', highlight: { background: '#10B981', border: '#3B82F6' }, hover: { background: '#10B981', border: '#1E293B' } },
        font: { color: '#fff', size: 14, bold: true, face: 'Inter, system-ui, sans-serif' },
        shadow: { enabled: true, color: isFocus ? 'rgba(34,197,94,0.4)' : 'rgba(34,197,94,0.15)', size: isFocus ? 8 : 3 },
        borderWidth: isFocus ? 3 : 2,
        title: `👥 ${t.label}\n${t.details?.focus || ''}`,
      };
    }),
    ...people.map(p => {
      const teamColor = getTeamColor(p.details?.team);
      const isFocus = focusIds.has(p.id);
      return {
        id: p.id,
        label: p.label,
        level: getOrgLevel(p, graphData),
        shape: 'circularImage',
        image: createInitialsAvatar(p.label, teamColor),
        size: 25,
        borderWidth: isFocus ? 4 : 3,
        color: { border: teamColor, highlight: { border: '#3B82F6' }, hover: { border: '#1E293B' } },
        font: { color: '#1E293B', size: 11, face: 'Inter, system-ui, sans-serif', vadjust: 34, bold: isFocus },
        shadow: { enabled: true, color: isFocus ? 'rgba(129,140,248,0.4)' : 'rgba(0,0,0,0.1)', size: isFocus ? 6 : 2 },
        title: `👤 ${p.label}\n${p.details?.role || ''}\nTeam: ${p.details?.team || 'Unknown'}`,
      };
    }),
  ];

  // Build team → team-lead edges and connect disconnected people to their team lead
  const belongsToEdges = graphData.edges.filter(e => e.type === 'belongs_to');
  const teamLeadEdges = [];
  const disconnectedEdges = [];
  const peopleIdSet = new Set(people.map(p => p.id));
  const reportsToFromIds = new Set(orgEdges.map(e => e.from));
  const teamLeads = {}; // teamId → leadPersonId

  teams.forEach(t => {
    // Find all people in this team that are in the visible set
    const members = belongsToEdges
      .filter(e => e.to === t.id && peopleIdSet.has(e.from))
      .map(e => e.from);
    if (members.length === 0) return;

    // The team lead is the member whose manager is NOT in the same team (or has no manager)
    const memberSet = new Set(members);
    const lead = members.find(mId => {
      const reportEdge = orgEdges.find(e => e.from === mId && e.type === 'reports_to');
      return !reportEdge || !memberSet.has(reportEdge.to);
    }) || members[0];

    teamLeads[t.id] = lead;
    teamLeadEdges.push({
      id: `team-lead-${t.id}`,
      from: t.id,
      to: lead,
      type: 'team_lead',
    });
  });

  // Connect disconnected people (no reports_to edge) to their team lead
  people.forEach(p => {
    if (reportsToFromIds.has(p.id)) return; // already has a reporting line
    const belongsEdge = belongsToEdges.find(e => e.from === p.id);
    if (!belongsEdge) return; // no team either
    const lead = teamLeads[belongsEdge.to];
    if (!lead || lead === p.id) return; // is the lead themselves or no lead found
    disconnectedEdges.push({
      id: `reports-inferred-${p.id}`,
      from: p.id,
      to: lead,
      type: 'reports_to_inferred',
    });
  });

  const visEdges = [
    ...orgEdges
      .filter(e => nodeIds.has(e.from) && nodeIds.has(e.to))
      .map(e => {
        const isFocusEdge = focusActive && (focusIds.has(e.from) || focusIds.has(e.to));
        return {
          id: e.id,
          from: e.from,
          to: e.to,
          arrows: { to: { enabled: true, scaleFactor: 0.5 } },
          color: { color: '#3B82F6', opacity: isFocusEdge ? 0.9 : 0.6 },
          dashes: false,
          width: isFocusEdge ? 3 : 2,
          smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 },
        };
      }),
    ...teamLeadEdges.map(e => {
      const isFocusEdge = focusActive && (focusIds.has(e.from) || focusIds.has(e.to));
      return {
        id: e.id,
        from: e.from,
        to: e.to,
        arrows: { to: { enabled: false } },
        color: { color: '#10B981', opacity: isFocusEdge ? 0.7 : 0.4 },
        dashes: [5, 5],
        width: isFocusEdge ? 2 : 1.5,
        smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 },
      };
    }),
    ...disconnectedEdges.map(e => {
      const isFocusEdge = focusActive && (focusIds.has(e.from) || focusIds.has(e.to));
      return {
        id: e.id,
        from: e.from,
        to: e.to,
        arrows: { to: { enabled: true, scaleFactor: 0.4 } },
        color: { color: '#94A3B8', opacity: isFocusEdge ? 0.7 : 0.4 },
        dashes: [4, 4],
        width: isFocusEdge ? 2 : 1,
        smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 },
      };
    }),
  ];

  const options = {
    ...getBaseOptions(),
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'UD',
        sortMethod: 'directed',
        nodeSpacing: 180,
        levelSeparation: 140,
        treeSpacing: 120,
        blockShifting: true,
        edgeMinimization: true,
        parentCentralization: true,
      }
    },
    physics: { enabled: false },
  };

  return { visNodes, visEdges, options };
}

function buildInfoFlow(graphData, focus, commAnalytics) {
  // Show teams as large clusters, with projects/decisions/topics connected
  const workItemTypes = ['project', 'decision', 'topic'];
  const teams = graphData.nodes.filter(n => n.type === 'team');
  const workItems = graphData.nodes.filter(n => workItemTypes.includes(n.type));
  const allNodes = [...teams, ...workItems];
  const nodeIds = new Set(allNodes.map(n => n.id));
  const nodeTypeById = Object.fromEntries(graphData.nodes.map(n => [n.id, n.type]));
  const siloSet = new Set(commAnalytics?.silos || []);
  const teamComm = commAnalytics?.teamComm || {};

  // Get edges connecting these nodes
  const relevantEdges = graphData.edges.filter(e =>
    nodeIds.has(e.from) && nodeIds.has(e.to) &&
    !['belongs_to', 'reports_to'].includes(e.type)
  );

  // Also add team-to-project edges by looking at person ownership/decisions
  const personEdges = graphData.edges.filter(e =>
    (e.type === 'owns' || e.type === 'works_on' || e.type === 'decided') &&
    (workItems.some(w => w.id === e.to))
  );

  // Map person -> team
  const personTeam = {};
  graphData.edges.filter(e => e.type === 'belongs_to').forEach(e => {
    personTeam[e.from] = e.to;
  });

  // Create team->project edges
  const teamProjectEdges = [];
  const seenEdges = new Set();
  personEdges.forEach(e => {
    const teamId = personTeam[e.from];
    if (teamId && !seenEdges.has(`${teamId}-${e.to}`)) {
      seenEdges.add(`${teamId}-${e.to}`);
      teamProjectEdges.push({
        id: `flow-${teamId}-${e.to}`,
        from: teamId,
        to: e.to,
        type: e.type,
      });
    }
  });

  const focusIds = new Set(focus?.nodeIds || []);
  const focusActive = focusIds.size > 0;
  let visibleNodeIds = new Set(allNodes.map(n => n.id));

  if (focusActive) {
    const focusTeamIds = new Set();
    const focusWorkItemIds = new Set();
    const focusPersonIds = new Set();

    graphData.nodes.forEach(n => {
      if (!focusIds.has(n.id)) return;
      if (n.type === 'team') focusTeamIds.add(n.id);
      else if (workItemTypes.includes(n.type)) focusWorkItemIds.add(n.id);
      else if (n.type === 'person') focusPersonIds.add(n.id);
    });

    // Expand from people to teams + work items
    focusPersonIds.forEach(personId => {
      const teamId = personTeam[personId];
      if (teamId) focusTeamIds.add(teamId);
      personEdges.forEach(e => {
        if (e.from === personId) focusWorkItemIds.add(e.to);
      });
    });

    // Expand from work items to owning/working teams
    focusWorkItemIds.forEach(workId => {
      personEdges.forEach(e => {
        if (e.to === workId) {
          const teamId = personTeam[e.from];
          if (teamId) focusTeamIds.add(teamId);
        }
      });
    });

    // Expand from teams to work items
    teamProjectEdges.forEach(e => {
      if (focusTeamIds.has(e.from)) focusWorkItemIds.add(e.to);
    });

    // Include collaborating teams
    relevantEdges.forEach(e => {
      if (e.type !== 'collaborates') return;
      if (focusTeamIds.has(e.from)) focusTeamIds.add(e.to);
      if (focusTeamIds.has(e.to)) focusTeamIds.add(e.from);
    });

    // Expand across related work items (e.g., decision affects project)
    relevantEdges.forEach(e => {
      if (!workItemTypes.includes(nodeTypeById[e.from]) || !workItemTypes.includes(nodeTypeById[e.to])) return;
      if (focusWorkItemIds.has(e.from)) focusWorkItemIds.add(e.to);
      if (focusWorkItemIds.has(e.to)) focusWorkItemIds.add(e.from);
    });

    const combined = new Set([...focusTeamIds, ...focusWorkItemIds]);
    if (combined.size > 0) visibleNodeIds = combined;
  }

  const visibleNodes = allNodes.filter(n => visibleNodeIds.has(n.id));

  const visNodes = visibleNodes.map(n => {
    const color = NODE_COLORS[n.type] || '#64748b';
    const isTeam = n.type === 'team';
    const isDecision = n.type === 'decision';
    const isFocus = focusIds.has(n.id);
    const isSilo = isTeam && siloSet.has(n.id);
    const teamEvents = teamComm[n.id]?.events || 0;

    // Fixed consistent sizing — communication volume shown in tooltip instead
    const teamSize = isTeam ? 26 : (isDecision ? 16 : 14);

    let label = n.label;

    return {
      id: n.id,
      label,
      shape: isTeam ? 'box' : (isDecision ? 'diamond' : 'ellipse'),
      size: teamSize,
      margin: isTeam ? 12 : 8,
      color: {
        background: isSilo ? '#92400e' : color,
        border: isSilo ? '#f59e0b' : color,
        highlight: { background: color, border: '#3B82F6' },
        hover: { background: color, border: '#1E293B' },
      },
      font: {
        color: '#fff',
        size: isTeam ? 14 : 11,
        bold: isTeam || isFocus,
        face: 'Inter, system-ui, sans-serif',
        ...(isDecision ? { vadjust: 26 } : {}),
      },
      shadow: { enabled: true, color: isSilo ? 'rgba(245,158,11,0.35)' : (isFocus ? `${color}55` : `${color}1A`), size: isFocus ? 10 : (isSilo ? 10 : 4) },
      borderWidth: isFocus ? 2.5 : 1.5,
      borderDashes: false,
      title: `${n.label}\nType: ${n.type}${n.details?.status ? '\nStatus: ' + n.details.status : ''}${isSilo ? '\n⚠ Isolated — no cross-team communication' : ''}${teamEvents > 0 ? `\nCommunication events: ${teamEvents}` : ''}`,
    };
  });

  // Add ghost nodes for superseded decisions (version trail)
  const ghostNodes = [];
  const ghostEdges = [];
  for (const n of visibleNodes) {
    if (n.type === 'decision' && n.history && n.history.length > 0) {
      const lastHistory = n.history[n.history.length - 1];
      const ghostId = `ghost-${n.id}`;
      ghostNodes.push({
        id: ghostId,
        label: `${lastHistory.label}\n(superseded)`,
        shape: 'diamond',
        size: 14,
        margin: 6,
        color: { background: 'rgba(156,163,175,0.2)', border: '#D1D5DB', highlight: { background: '#D1D5DB', border: '#3B82F6' } },
        font: { color: '#9CA3AF', size: 9, face: 'Inter, system-ui, sans-serif', vadjust: 22 },
        shadow: { enabled: false },
        borderWidth: 1,
        borderDashes: [4, 3],
        opacity: 0.5,
        title: `Superseded: ${lastHistory.label}\nChanged: ${new Date(lastHistory.changedAt).toLocaleDateString()}`,
      });
      ghostEdges.push({
        id: `ghost-edge-${n.id}`,
        from: ghostId,
        to: n.id,
        color: { color: '#9CA3AF', opacity: 0.3 },
        width: 1,
        dashes: [4, 4],
        arrows: { to: { enabled: true, scaleFactor: 0.3 } },
        label: 'superseded by',
        font: { color: '#9CA3AF', size: 8, strokeWidth: 0, background: '#F5F7FA' },
        smooth: { type: 'continuous', roundness: 0.3 },
      });
    }
  }
  // Ghost nodes hidden for cleaner view (decision history visible via node detail panel)

  const allFlowEdges = [...relevantEdges, ...teamProjectEdges];
  const visEdges = allFlowEdges
    .filter(e => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to))
    .map(e => {
      const isFocusEdge = focusActive && (focusIds.has(e.from) || focusIds.has(e.to));
      return {
        id: e.id,
        from: e.from,
        to: e.to,
        title: e.type === 'owns' ? 'leads' : (e.type === 'affects' ? 'affects' : (e.type === 'collaborates' ? 'collaborates' : e.type)),
        arrows: { to: { enabled: true, scaleFactor: 0.4, type: 'arrow' } },
        color: {
          color: e.type === 'affects' ? '#F87171' : '#94A3B8',
          opacity: isFocusEdge ? 0.8 : 0.5,
        },
        width: e.type === 'owns' ? (isFocusEdge ? 2.5 : 1.5) : (isFocusEdge ? 1.5 : 0.8),
        dashes: e.type === 'affects' ? [6, 4] : false,
        smooth: { type: 'continuous', roundness: 0.3 },
        font: { size: 0 },
      };
    });

  const options = {
    ...getBaseOptions(),
    layout: { hierarchical: false, improvedLayout: true },
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -260,
        centralGravity: 0.008,
        springLength: 300,
        springConstant: 0.02,
        damping: 0.4,
        avoidOverlap: 0.95,
      },
      stabilization: { iterations: 200, fit: true },
      maxVelocity: 20,
    },
  };

  return { visNodes, visEdges, options };
}

function buildStakeholderMap(graphData, focusNode, focus) {
  const focusIds = new Set(focus?.nodeIds || []);
  const resolvedFocus = resolveFocusPerson(graphData, focus);
  if (resolvedFocus) focusNode = resolvedFocus;

  if (!focusNode) {
    // Default to first person if none selected
    const firstPerson = graphData.nodes.find(n => n.type === 'person');
    if (!firstPerson) return { visNodes: [], visEdges: [], options: getBaseOptions() };
    focusNode = firstPerson;
  }

  // Get all edges connected to focus node
  const connectedEdges = graphData.edges.filter(e =>
    e.from === focusNode.id || e.to === focusNode.id
  );

  // Get connected node IDs
  const connectedIds = new Set();
  connectedEdges.forEach(e => {
    connectedIds.add(e.from === focusNode.id ? e.to : e.from);
  });

  // Get second-degree connections (nodes connected to connected nodes)
  const secondDegreeEdges = graphData.edges.filter(e => {
    const isFirstDegree = e.from === focusNode.id || e.to === focusNode.id;
    if (isFirstDegree) return false;
    return (connectedIds.has(e.from) || connectedIds.has(e.to));
  });

  const secondDegreeIds = new Set();
  secondDegreeEdges.forEach(e => {
    if (!connectedIds.has(e.from) && e.from !== focusNode.id) secondDegreeIds.add(e.from);
    if (!connectedIds.has(e.to) && e.to !== focusNode.id) secondDegreeIds.add(e.to);
  });

  // Build nodes: focus (large, center) + 1st degree (medium) — 2nd degree hidden for cleaner view
  const allIds = new Set([focusNode.id, ...connectedIds]);
  const allNodes = graphData.nodes.filter(n => allIds.has(n.id));

  const visNodes = allNodes.map(n => {
    const isFocus = n.id === focusNode.id;
    const isFocusHighlight = focusIds.has(n.id);
    const color = NODE_COLORS[n.type] || '#64748b';

    if (isFocus) {
      return {
        id: n.id,
        label: `${n.label}\n${n.details?.role || ''}`,
        shape: 'circularImage',
        image: createInitialsAvatar(n.label, '#f59e0b'),
        size: 34,
        borderWidth: 3,
        color: { border: '#f59e0b', highlight: { border: '#fff' } },
        font: { color: '#f59e0b', size: 12, bold: true, face: 'Inter, sans-serif', vadjust: 46 },
        shadow: { enabled: true, color: 'rgba(245,158,11,0.25)', size: 8 },
        fixed: { x: true, y: true },
        x: 0, y: 0,
        title: `🎯 ${n.label}\n${n.details?.role || ''}\nTeam: ${n.details?.team || ''}`,
      };
    }

    const isTeam = n.type === 'team';
    const isPerson = n.type === 'person';

    return {
      id: n.id,
      label: isPerson ? `${n.label}\n${n.details?.role || ''}` : n.label,
      shape: isTeam ? 'box' : (isPerson ? 'circularImage' : 'ellipse'),
      image: isPerson ? createInitialsAvatar(n.label, color) : undefined,
      size: isTeam ? 16 : 20,
      margin: isTeam ? 8 : undefined,
      borderWidth: isFocusHighlight ? 2.5 : 1.5,
      opacity: 1.0,
      color: {
        background: color,
        border: isFocusHighlight ? '#f59e0b' : color,
        highlight: { background: color, border: '#fff' },
      },
      font: {
        color: '#1E293B',
        size: 11,
        face: 'Inter, sans-serif',
        ...(isPerson ? { vadjust: 32 } : {}),
      },
      shadow: { enabled: isFocusHighlight, color: `${color}44`, size: 6 },
      title: `${n.label}\n${n.details?.role || ''}\nType: ${n.type}`,
    };
  });

  const allEdgeIds = new Set();
  const visEdges = [...connectedEdges]
    .filter(e => allIds.has(e.from) && allIds.has(e.to))
    .filter(e => {
      const key = `${e.from}-${e.to}`;
      if (allEdgeIds.has(key)) return false;
      allEdgeIds.add(key);
      return true;
    })
    .map(e => {
      const isFocusEdge = focusIds.has(e.from) || focusIds.has(e.to);
      return {
        id: e.id,
        from: e.from,
        to: e.to,
        title: e.label || e.type,
        color: { color: '#94A3B8', opacity: isFocusEdge ? 0.7 : 0.45 },
        width: isFocusEdge ? 1.8 : 1,
        dashes: false,
        arrows: { to: { enabled: true, scaleFactor: 0.35 } },
        smooth: { type: 'continuous', roundness: 0.3 },
        font: { size: 0 },
      };
    });

  const options = {
    ...getBaseOptions(),
    layout: { hierarchical: false },
    physics: {
      enabled: true,
      solver: 'repulsion',
      repulsion: {
        nodeDistance: 320,
        centralGravity: 0.15,
        springLength: 280,
        springConstant: 0.015,
        damping: 0.4,
      },
      stabilization: { iterations: 150 },
    },
  };

  return { visNodes, visEdges, options };
}

// ═════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════

function normalizeFocus(graphFocus, graphData) {
  if (!graphFocus?.nodeIds || graphFocus.nodeIds.length === 0) return null;
  const idSet = new Set(graphData.nodes?.map(n => n.id) || []);
  const validIds = graphFocus.nodeIds.filter(id => idSet.has(id));
  if (validIds.length === 0) return null;
  return { ...graphFocus, nodeIds: validIds };
}

function getFocusKey(focus) {
  if (!focus?.nodeIds || focus.nodeIds.length === 0) return 'none';
  return [...focus.nodeIds].sort().join('|');
}

function resolveFocusPerson(graphData, focus) {
  if (!focus?.nodeIds || focus.nodeIds.length === 0) return null;
  const nodes = graphData.nodes || [];
  const focusNodes = nodes.filter(n => focus.nodeIds.includes(n.id));

  const person = focusNodes.find(n => n.type === 'person');
  if (person) return person;

  const team = focusNodes.find(n => n.type === 'team');
  if (team) {
    const memberEdge = graphData.edges.find(e => e.type === 'belongs_to' && e.to === team.id);
    if (memberEdge) return nodes.find(n => n.id === memberEdge.from);
  }

  const workItem = focusNodes.find(n => ['project', 'decision', 'topic'].includes(n.type));
  if (workItem) {
    const relEdge = graphData.edges.find(e =>
      ['owns', 'works_on', 'decided'].includes(e.type) &&
      (e.to === workItem.id || e.from === workItem.id)
    );
    if (relEdge) {
      const fromIsPerson = nodes.find(n => n.id === relEdge.from && n.type === 'person');
      const personId = fromIsPerson ? relEdge.from : relEdge.to;
      return nodes.find(n => n.id === personId && n.type === 'person') || null;
    }
  }

  return null;
}

function getBaseOptions() {
  return {
    nodes: {
      font: { size: 12, face: 'Inter, system-ui, sans-serif', strokeWidth: 0 },
      borderWidth: 2,
      shadow: { enabled: true, color: 'rgba(0,0,0,0.12)', size: 3 },
    },
    edges: {
      font: { color: '#94A3B8', size: 0, strokeWidth: 0, background: 'transparent' },
      smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 },
    },
    interaction: {
      hover: true,
      hoverConnectedEdges: true,
      tooltipDelay: 200,
      zoomView: true,
      dragView: true,
      dragNodes: true,
    },
  };
}

function getTeamColor(teamName) {
  if (!teamName) return TEAM_COLORS.default;
  return TEAM_COLORS[teamName.toLowerCase()] || TEAM_COLORS.default;
}

function getOrgLevel(person, graphData, visited = new Set()) {
  // Prevent infinite recursion from cycles
  if (visited.has(person.id)) return 1;
  visited.add(person.id);

  const reportsToEdge = graphData.edges.find(e => e.from === person.id && e.type === 'reports_to');
  if (!reportsToEdge) {
    // No reporting line — infer level from team peers
    const belongsEdge = graphData.edges.find(e => e.from === person.id && e.type === 'belongs_to');
    if (belongsEdge) {
      // Find a teammate who has a reports_to edge and use their level
      const teammates = graphData.edges
        .filter(e => e.type === 'belongs_to' && e.to === belongsEdge.to && e.from !== person.id)
        .map(e => graphData.nodes.find(n => n.id === e.from))
        .filter(Boolean);
      for (const mate of teammates) {
        const mateReports = graphData.edges.find(e => e.from === mate.id && e.type === 'reports_to');
        if (mateReports) {
          return getOrgLevel(mate, graphData, new Set(visited));
        }
      }
    }
    return 1; // Fallback: top level
  }
  const manager = graphData.nodes.find(n => n.id === reportsToEdge.to);
  if (!manager) return 1;
  return getOrgLevel(manager, graphData, visited) + 1;
}

function createInitialsAvatar(name, bgColor) {
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56">
    <circle cx="28" cy="28" r="28" fill="${bgColor}"/>
    <text x="28" y="29" fill="white" text-anchor="middle" dominant-baseline="central"
          font-family="Inter,system-ui,sans-serif" font-size="20" font-weight="600">${initials}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
