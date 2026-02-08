// Demo data — realistic startup/scaleup organizational structure
// This seeds the knowledge graph with a compelling demo scenario

import graph from './store/knowledgeGraph.js';

export function seedDemoCompany() {
  // ── PEOPLE ───────────────────────────────────────────────────

  const people = [
    { id: 'sarah', type: 'person', label: 'Sarah Chen', details: { role: 'CEO', email: 'sarah@nexusai.com', team: 'leadership' } },
    { id: 'marcus', type: 'person', label: 'Marcus Rivera', details: { role: 'CTO', email: 'marcus@nexusai.com', team: 'leadership' } },
    { id: 'elena', type: 'person', label: 'Elena Volkov', details: { role: 'VP Engineering', email: 'elena@nexusai.com', team: 'engineering' } },
    { id: 'james', type: 'person', label: 'James Park', details: { role: 'Lead Designer', email: 'james@nexusai.com', team: 'product' } },
    { id: 'aisha', type: 'person', label: 'Aisha Okafor', details: { role: 'Data Lead', email: 'aisha@nexusai.com', team: 'engineering' } },
    { id: 'tom', type: 'person', label: 'Tom Mueller', details: { role: 'Sales Director', email: 'tom@nexusai.com', team: 'sales' } },
    { id: 'lisa', type: 'person', label: 'Lisa Tanaka', details: { role: 'Product Manager', email: 'lisa@nexusai.com', team: 'product' } },
    { id: 'david', type: 'person', label: 'David Kim', details: { role: 'DevOps Engineer', email: 'david@nexusai.com', team: 'engineering' } },
    { id: 'priya', type: 'person', label: 'Priya Sharma', details: { role: 'Marketing Lead', email: 'priya@nexusai.com', team: 'marketing' } },
    { id: 'alex', type: 'person', label: 'Alex Foster', details: { role: 'Customer Success', email: 'alex@nexusai.com', team: 'sales' } },
  ];

  // ── TEAMS ────────────────────────────────────────────────────

  const teams = [
    { id: 'leadership', type: 'team', label: 'Leadership', details: { size: 2, focus: 'Strategy & Vision' } },
    { id: 'engineering', type: 'team', label: 'Engineering', details: { size: 3, focus: 'Product Development' } },
    { id: 'product', type: 'team', label: 'Product', details: { size: 2, focus: 'Design & PM' } },
    { id: 'sales', type: 'team', label: 'Sales & CS', details: { size: 2, focus: 'Revenue & Customer Success' } },
    { id: 'marketing', type: 'team', label: 'Marketing', details: { size: 1, focus: 'Growth & Brand' } },
  ];

  // ── PROJECTS / TOPICS ────────────────────────────────────────

  const topics = [
    { id: 'project-atlas', type: 'project', label: 'Project Atlas', details: { description: 'Next-gen AI platform', status: 'active', deadline: '2026-03-15' } },
    { id: 'series-b', type: 'topic', label: 'Series B Fundraise', details: { description: 'Raising $25M Series B', status: 'in_progress', target: '$25M' } },
    { id: 'enterprise-pilot', type: 'project', label: 'Enterprise Pilot', details: { description: 'Fortune 500 pilot program', status: 'active', client: 'TechCorp' } },
    { id: 'hiring-plan', type: 'topic', label: 'Q1 Hiring Plan', details: { description: 'Hiring 5 engineers', status: 'active', openRoles: 5 } },
    { id: 'data-pipeline', type: 'project', label: 'Data Pipeline v2', details: { description: 'Rebuild data infrastructure', status: 'active' } },
    { id: 'launch-event', type: 'topic', label: 'Product Launch Event', details: { description: 'Public launch in March', date: '2026-03-20' } },
  ];

  // ── DECISIONS ────────────────────────────────────────────────

  const decisions = [
    { id: 'decision-stack', type: 'decision', label: 'Adopt Kubernetes', details: { topic: 'infrastructure', decidedBy: 'marcus', date: '2026-02-01', context: 'Moving from ECS to K8s for better scaling' } },
    { id: 'decision-pricing', type: 'decision', label: 'Freemium Model', details: { topic: 'pricing', decidedBy: 'sarah', date: '2026-02-03', context: 'Free tier + enterprise pricing' } },
    { id: 'decision-timeline', type: 'decision', label: 'Launch March 20', details: { topic: 'launch', decidedBy: 'lisa', date: '2026-02-05', context: 'Product launch date set for March 20' } },
  ];

  // ── Add all nodes ────────────────────────────────────────────

  [...people, ...teams, ...topics, ...decisions].forEach(n => graph.addNode(n));

  // ── RELATIONSHIPS ────────────────────────────────────────────

  const edges = [
    // Team membership
    { from: 'sarah', to: 'leadership', type: 'belongs_to', label: 'CEO' },
    { from: 'marcus', to: 'leadership', type: 'belongs_to', label: 'CTO' },
    { from: 'elena', to: 'engineering', type: 'belongs_to', label: 'VP Engineering' },
    { from: 'aisha', to: 'engineering', type: 'belongs_to', label: 'Data Lead' },
    { from: 'david', to: 'engineering', type: 'belongs_to', label: 'DevOps' },
    { from: 'james', to: 'product', type: 'belongs_to', label: 'Lead Designer' },
    { from: 'lisa', to: 'product', type: 'belongs_to', label: 'PM' },
    { from: 'tom', to: 'sales', type: 'belongs_to', label: 'Sales Director' },
    { from: 'alex', to: 'sales', type: 'belongs_to', label: 'Customer Success' },
    { from: 'priya', to: 'marketing', type: 'belongs_to', label: 'Marketing Lead' },

    // Reporting lines
    { from: 'marcus', to: 'sarah', type: 'reports_to', label: 'reports to' },
    { from: 'elena', to: 'marcus', type: 'reports_to', label: 'reports to' },
    { from: 'aisha', to: 'elena', type: 'reports_to', label: 'reports to' },
    { from: 'david', to: 'elena', type: 'reports_to', label: 'reports to' },
    { from: 'james', to: 'lisa', type: 'reports_to', label: 'reports to' },
    { from: 'lisa', to: 'sarah', type: 'reports_to', label: 'reports to' },
    { from: 'tom', to: 'sarah', type: 'reports_to', label: 'reports to' },
    { from: 'priya', to: 'sarah', type: 'reports_to', label: 'reports to' },
    { from: 'alex', to: 'tom', type: 'reports_to', label: 'reports to' },

    // Project ownership
    { from: 'marcus', to: 'project-atlas', type: 'owns', label: 'leads' },
    { from: 'elena', to: 'project-atlas', type: 'works_on', label: 'builds' },
    { from: 'aisha', to: 'data-pipeline', type: 'owns', label: 'leads' },
    { from: 'david', to: 'data-pipeline', type: 'works_on', label: 'implements' },
    { from: 'tom', to: 'enterprise-pilot', type: 'owns', label: 'leads' },
    { from: 'alex', to: 'enterprise-pilot', type: 'works_on', label: 'supports' },
    { from: 'sarah', to: 'series-b', type: 'owns', label: 'leads' },
    { from: 'marcus', to: 'series-b', type: 'works_on', label: 'supports' },
    { from: 'priya', to: 'launch-event', type: 'owns', label: 'leads' },
    { from: 'james', to: 'launch-event', type: 'works_on', label: 'designs' },
    { from: 'lisa', to: 'hiring-plan', type: 'owns', label: 'leads' },

    // Decision connections
    { from: 'marcus', to: 'decision-stack', type: 'decided', label: 'decided' },
    { from: 'decision-stack', to: 'project-atlas', type: 'affects', label: 'affects' },
    { from: 'sarah', to: 'decision-pricing', type: 'decided', label: 'decided' },
    { from: 'decision-pricing', to: 'enterprise-pilot', type: 'affects', label: 'affects' },
    { from: 'lisa', to: 'decision-timeline', type: 'decided', label: 'decided' },
    { from: 'decision-timeline', to: 'launch-event', type: 'affects', label: 'affects' },

    // Cross-team dependencies
    { from: 'engineering', to: 'product', type: 'collaborates', label: 'builds for' },
    { from: 'sales', to: 'product', type: 'collaborates', label: 'feeds requirements' },
    { from: 'marketing', to: 'sales', type: 'collaborates', label: 'generates leads' },
  ];

  edges.forEach(e => graph.addEdge(e));

  // ── SEED EVENTS (recent activity) ───────────────────────────

  const events = [
    {
      type: 'meeting',
      source: 'meeting',
      summary: 'Leadership standup: Sarah shared Series B progress — 2 term sheets received. Marcus flagged Atlas infrastructure migration risk.',
      details: { participants: ['sarah', 'marcus', 'elena', 'lisa'] },
      affectedNodes: ['sarah', 'marcus', 'series-b', 'project-atlas'],
      agentId: 'coordinator'
    },
    {
      type: 'email',
      source: 'email',
      summary: 'Tom sent update: TechCorp pilot expanding from 50 to 200 users. Need engineering support for scaling.',
      details: { sender: 'tom', recipients: ['sarah', 'marcus', 'elena'] },
      affectedNodes: ['tom', 'enterprise-pilot', 'engineering'],
      agentId: 'coordinator'
    },
    {
      type: 'chat',
      source: 'chat',
      summary: 'Aisha flagged in #engineering: Data pipeline v2 migration will require 2-week downtime window. Conflicts with launch timeline.',
      details: { channel: '#engineering', sender: 'aisha' },
      affectedNodes: ['aisha', 'data-pipeline', 'decision-timeline'],
      agentId: 'coordinator'
    },
    {
      type: 'decision',
      source: 'email',
      summary: 'Elena decided to hire 2 senior backend engineers immediately to support Atlas and enterprise pilot scaling needs.',
      details: { decidedBy: 'elena', approved_by: 'marcus' },
      affectedNodes: ['elena', 'hiring-plan', 'project-atlas'],
      agentId: 'coordinator'
    },
  ];

  events.forEach(e => graph.addEvent(e));

  // ── SEED CONFLICT ────────────────────────────────────────────

  graph.addConflict({
    type: 'timeline_conflict',
    description: 'Data Pipeline v2 requires 2-week downtime, but Product Launch is scheduled for March 20. These timelines may conflict.',
    severity: 'high',
    nodeIds: ['data-pipeline', 'decision-timeline', 'launch-event']
  });

  const result = graph.getFullGraph();
  console.log(`\n🌱 Demo seeded: ${result.nodes.length} nodes, ${result.edges.length} edges, ${result.events.length} events, ${result.conflicts.length} conflicts`);

  return {
    nodes: result.nodes.length,
    edges: result.edges.length,
    events: result.events.length,
    conflicts: result.conflicts.length
  };
}

export default { seedDemoCompany };
