// Coordinator Agent — the Chief of Staff brain
// Orchestrates all other agents and decides what to do with incoming information

import OpenAI from 'openai';
import memoryAgent from './memory.js';
import criticAgent from './critic.js';
import routerAgent from './router.js';
import summaryAgent from './summary.js';
import graph from '../store/knowledgeGraph.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are the AI Chief of Staff — the brain of an organization.
You coordinate information flow, maintain organizational truth, and ensure the right people know the right things.

Your job when receiving new information:
1. Identify ENTITIES (people, teams, topics, decisions, projects)
2. Identify RELATIONSHIPS between entities
3. Identify what CHANGED vs what was already known
4. Flag any CONFLICTS with existing knowledge
5. Determine WHO needs to be notified
6. Create a concise SUMMARY of what happened

Respond in JSON with this exact structure:
{
  "entities": [{"id": "suggested-id", "type": "person|team|topic|decision|project|document", "label": "Name", "details": {}}],
  "relationships": [{"from": "entity-id", "to": "entity-id", "type": "knows|owns|decided|works_on|informed_about|reports_to|conflicts_with", "label": "description"}],
  "changes": [{"description": "what changed", "importance": "high|medium|low"}],
  "conflicts": [{"description": "conflict description", "severity": "high|medium|low", "involvedEntities": ["id1", "id2"]}],
  "notifications": [{"targetEntity": "entity-id", "message": "what they need to know", "urgency": "high|medium|low"}],
  "summary": "One paragraph summary of what just happened"
}`;

const wait = (ms) => new Promise(r => setTimeout(r, ms));

export async function processIncoming(source, content, metadata = {}, onStep) {
  console.log(`\n🧠 Coordinator processing ${source} input...`);

  // Emit: Coordinator starting
  onStep?.({ agent: 'coordinator', status: 'active', message: `Reading ${source} from ${metadata.sender || 'unknown'}...`, detail: 'Parsing communication and identifying context' });

  // Get current context for the AI
  const currentGraph = graph.getFullGraph();
  const recentEvents = graph.getRecentEvents(10);

  const contextPrompt = `
Current organizational knowledge:
- ${currentGraph.nodes.length} known entities: ${currentGraph.nodes.map(n => `${n.label} (${n.type})`).join(', ')}
- ${currentGraph.edges.length} known relationships
- ${currentGraph.conflicts.filter(c => c.status === 'open').length} open conflicts
- Recent events: ${recentEvents.map(e => e.summary).join('; ')}

New information received via ${source}:
${content}

${metadata.sender ? `From: ${metadata.sender}` : ''}
${metadata.subject ? `Subject: ${metadata.subject}` : ''}
${metadata.participants ? `Participants: ${metadata.participants.join(', ')}` : ''}

Analyze this information and extract structured intelligence. Use existing entity IDs where they match.`;

  try {
    // Update while waiting for OpenAI
    await wait(300);
    onStep?.({ agent: 'coordinator', status: 'active', message: `Extracting entities & relationships...`, detail: `Cross-referencing against ${currentGraph.nodes.length} known entities` });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contextPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    const entityNames = (analysis.entities || []).map(e => e.label).join(', ');
    const changeDescs = (analysis.changes || []).filter(c => c.importance === 'high').map(c => c.description);
    console.log(`📊 Extracted: ${analysis.entities?.length || 0} entities, ${analysis.relationships?.length || 0} relationships`);

    // Emit: Coordinator done
    onStep?.({
      agent: 'coordinator', status: 'complete',
      message: `Found ${analysis.entities?.length || 0} entities, ${analysis.relationships?.length || 0} relationships`,
      detail: entityNames ? `Identified: ${entityNames}` : undefined,
      data: { entities: analysis.entities?.length || 0, relationships: analysis.relationships?.length || 0, changes: analysis.changes?.length || 0 }
    });

    // ── Step 1: Memory Agent — update the knowledge graph ──────
    await wait(200);
    onStep?.({ agent: 'memory', status: 'active', message: 'Writing to knowledge graph...', detail: `Merging ${analysis.entities?.length || 0} entities into organizational memory` });
    await wait(200);
    const memoryResult = await memoryAgent.updateGraph(analysis.entities, analysis.relationships);
    onStep?.({ agent: 'memory', status: 'active', message: `Linking ${analysis.relationships?.length || 0} relationships...`, detail: `Connecting entities across teams and projects` });
    await wait(200);
    const newNodes = memoryResult.nodeIds?.length || 0;
    const newEdges = memoryResult.edgeIds?.length || 0;
    onStep?.({
      agent: 'memory', status: 'complete',
      message: `Updated ${newNodes} nodes, ${newEdges} edges`,
      detail: newNodes > 0 ? `Graph now has ${graph.getFullGraph().nodes.length} total entities` : undefined,
      data: { nodes: newNodes, edges: newEdges }
    });

    // ── Step 2: Critic Agent — check for conflicts ─────────────
    await wait(200);
    onStep?.({ agent: 'critic', status: 'active', message: 'Scanning for conflicts...', detail: 'Comparing new information against existing decisions' });
    await wait(200);
    onStep?.({ agent: 'critic', status: 'active', message: 'Cross-checking decision history...', detail: `Reviewing ${currentGraph.nodes.filter(n => n.type === 'decision').length} existing decisions for contradictions` });
    await wait(200);
    const criticResult = await criticAgent.checkConflicts(analysis, currentGraph);
    const conflictCount = criticResult.conflicts?.length || 0;
    const conflictDescs = criticResult.conflicts?.map(c => c.description) || [];
    onStep?.({
      agent: 'critic', status: 'complete',
      message: conflictCount > 0 ? `${conflictCount} conflict(s) detected!` : 'No conflicts detected',
      detail: conflictCount > 0 ? conflictDescs[0] : 'All information consistent with existing knowledge',
      data: { conflicts: conflictCount, hasConflicts: conflictCount > 0 }
    });

    // ── Step 3: Router Agent — determine who to notify ─────────
    await wait(200);
    const notifTargets = (analysis.notifications || []).map(n => n.targetEntity).join(', ');
    onStep?.({ agent: 'router', status: 'active', message: 'Determining who needs to know...', detail: notifTargets ? `Evaluating impact on: ${notifTargets}` : 'Mapping stakeholder impact' });
    await wait(200);
    const routerResult = await routerAgent.routeNotifications(analysis.notifications, currentGraph);
    const notifCount = routerResult.notifications?.length || 0;
    const urgentNotifs = (routerResult.notifications || []).filter(n => n.urgency === 'high');
    const routedTargets = [...new Set((routerResult.notifications || []).map(n => n.targetLabel))].join(', ');
    onStep?.({ agent: 'router', status: 'active', message: `Routing ${notifCount} notifications...`, detail: urgentNotifs.length > 0 ? `${urgentNotifs.length} marked as urgent priority` : `Delivering to: ${routedTargets || 'stakeholders'}` });
    await wait(200);
    onStep?.({
      agent: 'router', status: 'complete',
      message: `${notifCount} notification(s) routed${urgentNotifs.length > 0 ? ` (${urgentNotifs.length} urgent)` : ''}`,
      detail: routedTargets ? `Notified: ${routedTargets}` : undefined,
      data: { notifications: notifCount }
    });

    // ── Step 4: Summary Agent — create human-readable summary ──
    await wait(200);
    onStep?.({ agent: 'summary', status: 'active', message: 'Synthesizing impact summary...', detail: 'Analyzing organizational impact of changes' });
    await wait(200);
    const summaryResult = await summaryAgent.generateSummary(source, content, analysis);
    onStep?.({ agent: 'summary', status: 'active', message: 'Composing executive briefing...', detail: changeDescs.length > 0 ? `Key change: ${changeDescs[0]}` : 'Generating actionable summary' });
    await wait(200);
    onStep?.({
      agent: 'summary', status: 'complete',
      message: summaryResult.summary?.substring(0, 120) || 'Summary generated',
      detail: changeDescs.length > 0 ? `Key change: ${changeDescs[0]}` : undefined
    });

    // Build AI reasoning explanation
    await wait(200);
    const reasoning = buildReasoning(analysis, memoryResult, criticResult, routerResult, summaryResult);
    onStep?.({ agent: 'reasoning', status: 'complete', message: reasoning });

    // Log the event
    const event = graph.addEvent({
      type: source,
      source: source,
      summary: summaryResult.summary,
      details: {
        analysis,
        memoryUpdates: memoryResult,
        conflicts: criticResult,
        notifications: routerResult,
        reasoning,
        rawContent: content.substring(0, 500) // truncate for storage
      },
      affectedNodes: memoryResult.nodeIds || [],
      agentId: 'coordinator'
    });

    return {
      success: true,
      event,
      summary: summaryResult.summary,
      reasoning,
      entitiesUpdated: memoryResult.nodeIds?.length || 0,
      relationshipsUpdated: memoryResult.edgeIds?.length || 0,
      conflicts: criticResult.conflicts || [],
      notifications: routerResult.notifications || [],
      graphVersion: graph.getVersion()
    };

  } catch (error) {
    console.error('❌ Coordinator error:', error.message);
    onStep?.({ agent: 'coordinator', status: 'error', message: `Error: ${error.message}` });

    // Fallback: still log the event even if AI fails
    const event = graph.addEvent({
      type: source,
      source,
      summary: `Received ${source} communication (processing failed)`,
      details: { error: error.message, rawContent: content.substring(0, 500) },
      agentId: 'coordinator'
    });

    return {
      success: false,
      error: error.message,
      event,
      graphVersion: graph.getVersion()
    };
  }
}

function buildReasoning(analysis, memoryResult, criticResult, routerResult, summaryResult) {
  const parts = [];
  parts.push(summaryResult.summary || 'Processed incoming communication.');

  if (analysis.changes?.length > 0) {
    const highChanges = analysis.changes.filter(c => c.importance === 'high');
    if (highChanges.length > 0) {
      parts.push(`Key changes: ${highChanges.map(c => c.description).join('; ')}.`);
    }
  }

  if (criticResult.conflicts?.length > 0) {
    parts.push(`Conflicts found: ${criticResult.conflicts.map(c => c.description).join('; ')}.`);
  }

  if (routerResult.notifications?.length > 0) {
    const highUrgency = routerResult.notifications.filter(n => n.urgency === 'high');
    if (highUrgency.length > 0) {
      parts.push(`Urgent notifications sent to: ${highUrgency.map(n => n.targetLabel).join(', ')}.`);
    } else {
      const targets = [...new Set(routerResult.notifications.map(n => n.targetLabel))];
      parts.push(`Notified: ${targets.slice(0, 5).join(', ')}${targets.length > 5 ? ` and ${targets.length - 5} others` : ''}.`);
    }
  }

  return parts.join(' ');
}

// "What changed today?" — the killer feature
export async function askChiefOfStaff(question) {
  const currentGraph = graph.getFullGraph();
  const todayEvents = graph.getEventsToday();
  const openConflicts = graph.getOpenConflicts();

  const contextPrompt = `You are the AI Chief of Staff. Answer the user's question based on organizational knowledge.

Current state:
- ${currentGraph.nodes.length} entities tracked
- ${currentGraph.edges.length} relationships mapped
- ${todayEvents.length} events today
- ${openConflicts.length} open conflicts

Today's events:
${todayEvents.map(e => `[${e.timestamp}] ${e.source}: ${e.summary}`).join('\n')}

Open conflicts:
${openConflicts.map(c => `[${c.severity}] ${c.description}`).join('\n')}

All entities:
${currentGraph.nodes.map(n => `- ${n.label} (${n.type}): ${JSON.stringify(n.details)}`).join('\n')}

Key relationships:
${currentGraph.edges.slice(0, 50).map(e => {
  const fromNode = currentGraph.nodes.find(n => n.id === e.from);
  const toNode = currentGraph.nodes.find(n => n.id === e.to);
  return `- ${fromNode?.label || e.from} --[${e.type}]--> ${toNode?.label || e.to}`;
}).join('\n')}

User question: ${question}

Provide a clear, actionable answer. If relevant, mention who needs to be informed and what actions should be taken.

Return JSON with this shape:
{
  "answer": "markdown answer",
  "evidenceNodes": ["entity label or id from the list above", "..."],
  "recommendedView": "flow|org|stakeholder"
}

Rules:
- evidenceNodes should be 3-8 items if possible, and must match existing entity labels or ids.
- If no clear evidence applies, return an empty evidenceNodes array.
- Choose recommendedView based on the question (org for hierarchy, flow for projects/decisions/communication, stakeholder for a person context).`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are the AI Chief of Staff — the organizational brain. Be concise, actionable, and insightful.' },
        { role: 'user', content: contextPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 1000
    });

    const raw = response.choices[0].message.content || '';
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }

    const answerText = parsed?.answer || raw;
    const evidenceNodeIds = resolveEvidenceNodeIds(parsed?.evidenceNodes, currentGraph);
    const recommendedView = normalizeRecommendedView(parsed?.recommendedView || question);
    const fallbackEvidence = evidenceNodeIds.length === 0
      ? guessEvidenceNodeIds(question, answerText, currentGraph)
      : evidenceNodeIds;

    return {
      answer: answerText,
      evidenceNodeIds: fallbackEvidence,
      recommendedView,
      context: {
        eventsToday: todayEvents.length,
        openConflicts: openConflicts.length,
        totalEntities: currentGraph.nodes.length
      }
    };
  } catch (error) {
    return {
      answer: `I encountered an error: ${error.message}. But here's what I know: ${todayEvents.length} events today, ${openConflicts.length} open conflicts.`,
      evidenceNodeIds: guessEvidenceNodeIds(question, '', currentGraph),
      recommendedView: normalizeRecommendedView(question),
      context: { error: error.message }
    };
  }
}

function resolveEvidenceNodeIds(evidenceNodes, currentGraph) {
  if (!Array.isArray(evidenceNodes)) return [];
  const nodes = currentGraph.nodes || [];
  const ids = new Set();

  for (const ref of evidenceNodes) {
    if (!ref) continue;
    const refStr = String(ref).toLowerCase();
    const byId = nodes.find(n => n.id.toLowerCase() === refStr);
    if (byId) { ids.add(byId.id); continue; }
    const byLabel = nodes.find(n => n.label.toLowerCase() === refStr);
    if (byLabel) ids.add(byLabel.id);
  }

  return [...ids];
}

function guessEvidenceNodeIds(question, answerText, currentGraph) {
  const nodes = currentGraph.nodes || [];
  const haystack = `${question || ''} ${answerText || ''}`.toLowerCase();
  const ids = nodes
    .filter(n => n.label && haystack.includes(n.label.toLowerCase()))
    .map(n => n.id);
  return [...new Set(ids)];
}

function normalizeRecommendedView(input) {
  if (!input) return null;
  const value = String(input).toLowerCase();
  if (value.includes('org')) return 'org';
  if (value.includes('flow')) return 'flow';
  if (value.includes('stake')) return 'stakeholder';
  return null;
}

export default { processIncoming, askChiefOfStaff };
