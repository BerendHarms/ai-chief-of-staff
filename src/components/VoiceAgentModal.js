import React, { useEffect, useRef, useState } from 'react';

export default function VoiceAgentModal({ apiUrl, isOpen, onClose }) {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | recording | transcribing | done | error
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [context, setContext] = useState('');
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (!isOpen) {
      cleanupRecording();
      setRecording(false);
      setStatus('idle');
      setTranscript('');
      setSummary('');
      setSpeaker('');
      setContext('');
      setError('');
    }
  }, [isOpen]);

  const cleanupRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    chunksRef.current = [];
  };

  const startRecording = async () => {
    setError('');
    setStatus('recording');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        setRecording(false);
        setStatus('transcribing');
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
        cleanupRecording();
      };

      recorder.start();
      setRecording(true);
    } catch (e) {
      setError('Microphone access denied or unavailable.');
      setStatus('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  };

  const uploadAudio = async (blob) => {
    try {
      const form = new FormData();
      form.append('audio', blob, 'voice.webm');
      if (speaker.trim()) form.append('speaker', speaker.trim());
      if (context.trim()) form.append('context', context.trim());

      const res = await fetch(`${apiUrl}/api/agent/voice`, {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Transcription failed');

      setTranscript(data.transcript || '');
      setSummary(data.ingest?.summary || '');
      setStatus('done');
    } catch (e) {
      setError(e.message || 'Failed to transcribe');
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="voice-agent-overlay" onClick={onClose}>
      <div className="voice-agent-modal" onClick={e => e.stopPropagation()}>
        <div className="voice-agent-header">
          <h3>Voice Agent</h3>
          <button className="btn-briefing-close" onClick={onClose}>×</button>
        </div>

        <p className="panel-desc">Press the microphone, speak naturally, and your update will be ingested into the system.</p>

        <div className="voice-agent-fields">
          <input
            placeholder="Speaker name (optional)"
            value={speaker}
            onChange={e => setSpeaker(e.target.value)}
          />
          <input
            placeholder="Context (optional) e.g., 'post‑meeting recap'"
            value={context}
            onChange={e => setContext(e.target.value)}
          />
        </div>

        <div className="voice-agent-controls">
          {!recording ? (
            <button className="btn btn-primary" onClick={startRecording}>
              🎙 Start Recording
            </button>
          ) : (
            <button className="btn btn-stop-recording" onClick={stopRecording}>
              ⏹ Stop Recording
            </button>
          )}
          <span className={`voice-agent-status ${status}`}>{status === 'recording' ? 'Listening...' : status}</span>
        </div>

        {error && <div className="voice-agent-error">Error: {error}</div>}

        {transcript && (
          <div className="voice-agent-result">
            <h4>Transcript</h4>
            <p>{transcript}</p>
          </div>
        )}

        {summary && (
          <div className="voice-agent-result">
            <h4>Ingest Summary</h4>
            <p>{summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}
