import React, { useState } from 'react';

const QUICK_QUESTIONS = [
  'What changed today?',
  'Are there any conflicts I should know about?',
  'Give me a status update on all projects',
  'Who is overloaded right now?',
  'What decisions were made this week?',
  'What does the new team member need to know?',
];

export default function AskPanel({ apiUrl, onAnswer }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const handleAsk = async (q) => {
    const queryText = q || question;
    if (!queryText.trim()) return;

    setLoading(true);
    setAnswer(null);

    try {
      const res = await fetch(`${apiUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: queryText })
      });
      const json = await res.json();
      setAnswer(json);
      if (onAnswer) onAnswer(json, queryText);
      setHistory(prev => [{ question: queryText, answer: json.answer, timestamp: new Date().toISOString() }, ...prev].slice(0, 10));
    } catch (e) {
      setAnswer({ answer: `Error: ${e.message}`, context: {} });
    }

    setLoading(false);
    setQuestion('');
  };

  return (
    <div className="ask-panel">
      <h3>Ask the Chief of Staff</h3>
      <p className="panel-desc">Ask anything about your organization. The AI has access to the full knowledge graph.</p>

      <div className="quick-questions">
        {QUICK_QUESTIONS.map((q, i) => (
          <button key={i} className="btn btn-quick" onClick={() => handleAsk(q)} disabled={loading}>
            {q}
          </button>
        ))}
      </div>

      <form className="ask-form" onSubmit={e => { e.preventDefault(); handleAsk(); }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask a question..."
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !question.trim()}>
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </form>

      {loading && (
        <div className="thinking-indicator">
          <div className="thinking-dots">
            <span></span><span></span><span></span>
          </div>
          <span>Analyzing organizational knowledge...</span>
        </div>
      )}

      {answer && (
        <div className="answer-card">
          <div className="answer-content" dangerouslySetInnerHTML={{ __html: formatMarkdown(answer.answer) }} />
          {answer.context && (
            <div className="answer-context">
              <span>Events today: {answer.context.eventsToday || 0}</span>
              <span>Open conflicts: {answer.context.openConflicts || 0}</span>
              <span>Entities tracked: {answer.context.totalEntities || 0}</span>
            </div>
          )}
        </div>
      )}

      {history.length > 1 && (
        <div className="ask-history">
          <h4>Previous Questions</h4>
          {history.slice(1).map((h, i) => (
            <div key={i} className="history-item" onClick={() => handleAsk(h.question)}>
              <span className="history-q">{h.question}</span>
              <span className="history-time">{new Date(h.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^## (.*$)/gm, '<h3>$1</h3>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
