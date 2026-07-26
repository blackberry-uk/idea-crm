import React, { useState, useRef, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { apiClient } from '../lib/api/client';
import { Zap, Check, Loader2, ArrowUpRight } from 'lucide-react';

// Local (not UTC) yyyy-mm-dd so captures land on the user's real "today".
const localToday = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

type CapturedItem = { id: string; text: string; state: 'saving' | 'saved' | 'error' };

/**
 * Ultra-light, instant-render capture surface. Deliberately NOT wrapped in the
 * app's ProtectedRoute/Layout: it renders its input immediately without waiting
 * for the full data hydrate, so "add to home screen → tap → type → done" is
 * near-instant. Auth is a simple token check; the POST carries the Bearer token.
 */
const Capture: React.FC = () => {
  const [text, setText] = useState('');
  const [recent, setRecent] = useState<CapturedItem[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasToken = !!apiClient.getToken();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  const capture = async () => {
    const value = text.trim();
    if (!value) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Optimistic: clear instantly and refocus so you can fire off the next thought.
    setRecent(prev => [{ id, text: value, state: 'saving' }, ...prev].slice(0, 8));
    setText('');
    inputRef.current?.focus();

    try {
      await apiClient.post('/quick-capture', { text: value, date: localToday() });
      setRecent(prev => prev.map(r => (r.id === id ? { ...r, state: 'saved' } : r)));
    } catch {
      setRecent(prev => prev.map(r => (r.id === id ? { ...r, state: 'error' } : r)));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Enter to send; Shift+Enter for a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      capture();
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #4f46e5 0%, #4338ca 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 18px calc(24px + env(safe-area-inset-bottom))',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 560, marginTop: '8vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Zap className="w-5 h-5" style={{ color: '#fde68a' }} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>
            Quick Capture
          </span>
        </div>
        <p style={{ fontSize: 14, opacity: 0.75, margin: '0 0 16px' }}>
          Dump the thought. It lands in today's list — triage later.
        </p>

        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="What's on your mind?"
          rows={3}
          autoFocus
          style={{
            width: '100%',
            padding: '18px 18px',
            fontSize: 18,
            lineHeight: 1.4,
            borderRadius: 20,
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: '#111827',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            fontFamily: 'inherit',
          }}
        />

        <button
          onClick={capture}
          disabled={!text.trim()}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '16px',
            fontSize: 16,
            fontWeight: 800,
            borderRadius: 16,
            border: 'none',
            cursor: text.trim() ? 'pointer' : 'default',
            background: text.trim() ? '#fde68a' : 'rgba(255,255,255,0.25)',
            color: text.trim() ? '#3730a3' : 'rgba(255,255,255,0.6)',
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          Capture <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>(Enter)</span>
        </button>

        {recent.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 10 }}>
              Captured
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(255,255,255,0.12)',
                    borderRadius: 12, padding: '10px 14px', fontSize: 15,
                    opacity: item.state === 'error' ? 0.7 : 1,
                  }}
                >
                  {item.state === 'saving' && <Loader2 className="w-4 h-4 animate-spin" style={{ flexShrink: 0, opacity: 0.8 }} />}
                  {item.state === 'saved' && <Check className="w-4 h-4" style={{ flexShrink: 0, color: '#86efac' }} />}
                  {item.state === 'error' && <span style={{ flexShrink: 0, color: '#fca5a5', fontWeight: 700 }}>!</span>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.text}
                  </span>
                  {item.state === 'error' && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#fca5a5' }}>failed</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <a
          href="#/"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 28, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)',
            textDecoration: 'none',
          }}
        >
          Open full app <ArrowUpRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};

export default Capture;
