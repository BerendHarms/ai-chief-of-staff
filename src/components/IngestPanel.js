import React, { useState } from 'react';

const INGEST_TYPES = [
  { id: 'email', label: 'Email', icon: '📧' },
  { id: 'chat', label: 'Chat / WhatsApp', icon: '💬' },
  { id: 'meeting', label: 'Meeting Notes', icon: '🤝' },
  { id: 'voice', label: 'Voice Note', icon: '🎙️' },
];

const DEMO_SCENARIOS = [
  {
    label: 'Conflicting Decision',
    type: 'email',
    data: {
      sender: 'Sarah Chen',
      subject: 'Updated Launch Timeline',
      recipients: ['Marcus Rivera', 'Elena Volkov', 'Lisa Tanaka'],
      body: 'Team, after reviewing our Series B timeline, I\'ve decided we need to push the product launch to April 15 instead of March 20. The investors want to see our Q1 metrics before we go public with the launch. This gives us more time for the data pipeline migration too. Please update your team plans accordingly.'
    }
  },
  {
    label: 'New Hire Announcement',
    type: 'chat',
    data: {
      sender: 'Elena Volkov',
      channel: '#engineering',
      participants: ['Elena Volkov', 'Aisha Okafor', 'David Kim', 'Marcus Rivera'],
      message: 'Great news everyone! We just signed two senior backend engineers - Wei Zhang and Sofia Costa. They start March 1. Wei has deep Kubernetes experience which will be huge for Project Atlas, and Sofia comes from a data engineering background, perfect for the pipeline v2 work. @Aisha and @David please prepare onboarding plans.'
    }
  },
  {
    label: 'Client Escalation',
    type: 'email',
    data: {
      sender: 'Tom Mueller',
      subject: 'URGENT: TechCorp Pilot Issues',
      recipients: ['Sarah Chen', 'Marcus Rivera', 'Elena Volkov', 'Alex Foster'],
      body: 'The TechCorp pilot is hitting scaling issues. Their 200 users are experiencing 3-5 second response times which is unacceptable. They\'ve given us until end of this week to fix it or they\'re pausing the pilot. I need engineering support immediately. This is our biggest enterprise deal and it\'s at risk.'
    }
  },
  {
    label: 'Strategy Meeting',
    type: 'meeting',
    data: {
      title: 'Q1 Strategy Review',
      participants: ['Sarah Chen', 'Marcus Rivera', 'Tom Mueller', 'Priya Sharma', 'Lisa Tanaka'],
      notes: 'Reviewed Q1 priorities. Revenue is 15% ahead of plan thanks to enterprise pilot expansion. Marketing needs to pivot from developer-focused to enterprise messaging. Product roadmap needs to prioritize scalability features over new features given TechCorp feedback. Sarah shared that one VC from Series B wants a board seat - team discussed implications.',
      decisions: ['Pivot marketing to enterprise positioning', 'Prioritize scalability in Q1 product roadmap', 'Schedule board composition discussion for next week']
    }
  },
  {
    label: 'Voice Memo',
    type: 'voice',
    data: {
      speaker: 'Marcus Rivera',
      transcription: 'Quick thought after the investor call today. The lead partner at Horizon Ventures mentioned they\'re also looking at our competitor, DataFlow AI. We need to accelerate Project Atlas delivery to differentiate. I\'m going to ask Elena to pull two engineers from the pipeline v2 project temporarily. This might conflict with Aisha\'s timeline but the competitive threat is more urgent.',
      context: 'Post-investor call voice memo'
    }
  }
];

export default function IngestPanel({ apiUrl, onProcessing, onProcessingDone, processing, pipelineDone }) {
  const [activeType, setActiveType] = useState('email');
  const [formData, setFormData] = useState({});
  const [result, setResult] = useState(null);

  const handleSubmit = async (data, type) => {
    onProcessing();
    setResult(null);
    try {
      const res = await fetch(`${apiUrl}/api/ingest/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setResult({ success: false, error: e.message });
    }
    if (onProcessingDone) onProcessingDone();
  };

  const handleDemoScenario = async (scenario) => {
    setActiveType(scenario.type);
    await handleSubmit(scenario.data, scenario.type);
  };

  return (
    <div className="ingest-panel">
      <h3>Ingest Communication</h3>
      <p className="panel-desc">Feed information into the organizational brain. The AI will extract entities, relationships, and route notifications.</p>

      {/* Quick Demo Scenarios */}
      <div className="demo-scenarios">
        <label>Quick Demo Scenarios:</label>
        <div className="scenario-buttons">
          {DEMO_SCENARIOS.map((s, i) => (
            <button
              key={i}
              className="btn btn-scenario"
              onClick={() => handleDemoScenario(s)}
              disabled={processing}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="divider"></div>

      {/* Manual Input */}
      <div className="ingest-type-tabs">
        {INGEST_TYPES.map(t => (
          <button
            key={t.id}
            className={`ingest-tab ${activeType === t.id ? 'active' : ''}`}
            onClick={() => { setActiveType(t.id); setFormData({}); setResult(null); }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Forms */}
      {activeType === 'email' && (
        <EmailForm formData={formData} setFormData={setFormData} onSubmit={(d) => handleSubmit(d, 'email')} processing={processing} />
      )}
      {activeType === 'chat' && (
        <ChatForm formData={formData} setFormData={setFormData} onSubmit={(d) => handleSubmit(d, 'chat')} processing={processing} />
      )}
      {activeType === 'meeting' && (
        <MeetingForm formData={formData} setFormData={setFormData} onSubmit={(d) => handleSubmit(d, 'meeting')} processing={processing} />
      )}
      {activeType === 'voice' && (
        <VoiceForm formData={formData} setFormData={setFormData} onSubmit={(d) => handleSubmit(d, 'voice')} processing={processing} />
      )}

      {/* Result — only show after agent pipeline animation finishes */}
      {result && pipelineDone && (
        <div className={`ingest-result ${result.success ? 'success' : 'error'}`}>
          {result.success ? (
            <>
              <div className="result-header">Processed successfully</div>
              <p>{result.summary}</p>
              <div className="result-stats">
                <span>{result.entitiesUpdated} entities</span>
                <span>{result.relationshipsUpdated} relationships</span>
                {result.conflicts?.length > 0 && <span className="conflict-badge">{result.conflicts.length} conflicts</span>}
              </div>
            </>
          ) : (
            <div className="result-header">Error: {result.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

function EmailForm({ formData, setFormData, onSubmit, processing }) {
  return (
    <form className="ingest-form" onSubmit={e => { e.preventDefault(); onSubmit(formData); }}>
      <input placeholder="From (sender)" value={formData.sender || ''} onChange={e => setFormData({...formData, sender: e.target.value})} />
      <input placeholder="Subject" value={formData.subject || ''} onChange={e => setFormData({...formData, subject: e.target.value})} />
      <input placeholder="To (comma-separated)" value={formData.recipients || ''} onChange={e => setFormData({...formData, recipients: e.target.value.split(',')})} />
      <textarea placeholder="Email body..." rows={4} value={formData.body || ''} onChange={e => setFormData({...formData, body: e.target.value})} />
      <button type="submit" className="btn btn-primary" disabled={processing}>{processing ? 'Processing...' : 'Ingest Email'}</button>
    </form>
  );
}

function ChatForm({ formData, setFormData, onSubmit, processing }) {
  return (
    <form className="ingest-form" onSubmit={e => { e.preventDefault(); onSubmit(formData); }}>
      <input placeholder="Sender" value={formData.sender || ''} onChange={e => setFormData({...formData, sender: e.target.value})} />
      <input placeholder="Channel (e.g. #engineering)" value={formData.channel || ''} onChange={e => setFormData({...formData, channel: e.target.value})} />
      <textarea placeholder="Message..." rows={3} value={formData.message || ''} onChange={e => setFormData({...formData, message: e.target.value})} />
      <button type="submit" className="btn btn-primary" disabled={processing}>{processing ? 'Processing...' : 'Ingest Chat'}</button>
    </form>
  );
}

function MeetingForm({ formData, setFormData, onSubmit, processing }) {
  return (
    <form className="ingest-form" onSubmit={e => { e.preventDefault(); onSubmit({...formData, participants: (formData.participantsStr || '').split(',').map(s => s.trim()), decisions: (formData.decisionsStr || '').split('\n').filter(Boolean)}); }}>
      <input placeholder="Meeting title" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} />
      <input placeholder="Participants (comma-separated)" value={formData.participantsStr || ''} onChange={e => setFormData({...formData, participantsStr: e.target.value})} />
      <textarea placeholder="Meeting notes..." rows={4} value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} />
      <textarea placeholder="Decisions (one per line)" rows={2} value={formData.decisionsStr || ''} onChange={e => setFormData({...formData, decisionsStr: e.target.value})} />
      <button type="submit" className="btn btn-primary" disabled={processing}>{processing ? 'Processing...' : 'Ingest Meeting'}</button>
    </form>
  );
}

function VoiceForm({ formData, setFormData, onSubmit, processing }) {
  return (
    <form className="ingest-form" onSubmit={e => { e.preventDefault(); onSubmit(formData); }}>
      <input placeholder="Speaker" value={formData.speaker || ''} onChange={e => setFormData({...formData, speaker: e.target.value})} />
      <textarea placeholder="Transcription..." rows={4} value={formData.transcription || ''} onChange={e => setFormData({...formData, transcription: e.target.value})} />
      <input placeholder="Context (optional)" value={formData.context || ''} onChange={e => setFormData({...formData, context: e.target.value})} />
      <button type="submit" className="btn btn-primary" disabled={processing}>{processing ? 'Processing...' : 'Ingest Voice'}</button>
    </form>
  );
}
