import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../lib/api/client';
import MiniMarkdown from '../MiniMarkdown';
import { format } from 'date-fns';
import {
  Sparkles, RefreshCw, Send, Search, Loader2, CircleDot, Clock, AlertTriangle,
  StickyNote, BookOpen, FileText, X, CheckCircle2, Circle
} from 'lucide-react';

interface Msg { id: string; role: 'analysis' | 'user' | 'assistant'; content: string; createdAt: string; }
interface Counts { open: number; overdue: number; done: number; notes: number; library: number; docs: number; }

const AIOverviewTab: React.FC<{ ideaId: string; ideaTitle: string }> = ({ ideaId, ideaTitle }) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);

  // search
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<any>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiClient.get(`/ideas/${ideaId}/overview`)
      .then((r: any) => { if (alive) { setMessages(r.messages || []); setCounts(r.counts || null); } })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ideaId]);

  const scrollToEnd = () => setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const msg = await apiClient.post(`/ideas/${ideaId}/overview/analyze`, {});
      setMessages(prev => [...prev, msg]);
      scrollToEnd();
    } catch (e: any) {
      alert(e?.message || 'Analysis failed');
    } finally { setAnalyzing(false); }
  };

  const sendPrompt = async () => {
    const p = prompt.trim();
    if (!p || sending) return;
    setSending(true);
    // optimistic user bubble
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, role: 'user', content: p, createdAt: new Date().toISOString() }]);
    setPrompt('');
    scrollToEnd();
    try {
      const { user, assistant } = await apiClient.post(`/ideas/${ideaId}/overview/message`, { prompt: p });
      setMessages(prev => [...prev.filter(m => m.id !== tempId), user, assistant]);
      scrollToEnd();
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert(e?.message || 'Could not get an answer');
    } finally { setSending(false); }
  };

  // debounced project-scoped search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults(null); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await apiClient.get(`/ideas/${ideaId}/search?q=${encodeURIComponent(q.trim())}`);
        setResults(r);
      } catch { setResults({ todos: [], notes: [], library: [] }); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [q, ideaId]);

  const hasAnyResults = results && (results.todos?.length || results.notes?.length || results.library?.length);
  const hasAnalysis = messages.some(m => m.role === 'analysis');

  const chips = useMemo(() => counts ? [
    { icon: CircleDot, label: 'Open', value: counts.open, tint: '#6366f1' },
    { icon: AlertTriangle, label: 'Overdue', value: counts.overdue, tint: counts.overdue > 0 ? '#ef4444' : '#9ca3af' },
    { icon: CheckCircle2, label: 'Done', value: counts.done, tint: '#10b981' },
    { icon: StickyNote, label: 'Notes', value: counts.notes, tint: '#f59e0b' },
    { icon: BookOpen, label: 'Library', value: counts.library, tint: '#0ea5e9' },
    { icon: FileText, label: 'Docs', value: counts.docs, tint: '#8b5cf6' },
  ] : [], [counts]);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Activity snapshot */}
      {counts && (
        <div className="flex flex-wrap gap-2 mb-4">
          {chips.map(c => (
            <div key={c.label} className="flex items-center gap-1.5 bg-white border border-[var(--border)] rounded-xl px-3 py-1.5 shadow-sm">
              <c.icon className="w-3.5 h-3.5" style={{ color: c.tint }} />
              <span className="text-sm font-black text-gray-900">{c.value}</span>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">{c.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search this project */}
      <div className="relative mb-5">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={`Search this project — tasks, notes & library…`}
          className="w-full pl-10 pr-9 py-3 rounded-xl border border-[var(--border)] bg-white outline-none focus:ring-2 focus:ring-[var(--primary-shadow)] focus:border-[var(--primary)]"
        />
        {q && (
          <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
            <X className="w-4 h-4" />
          </button>
        )}
        {q.trim() && (
          <div className="absolute z-30 mt-2 w-full bg-white border border-[var(--border)] rounded-2xl shadow-xl max-h-[60vh] overflow-y-auto p-2">
            {searching ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm p-4"><Loader2 className="w-4 h-4 animate-spin" /> Searching…</div>
            ) : !hasAnyResults ? (
              <div className="text-sm text-gray-400 p-4 text-center">No matches in this project.</div>
            ) : (
              <div className="space-y-3">
                {results.todos?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2 mb-1">Tasks</p>
                    {results.todos.map((t: any) => (
                      <div key={t.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                        {t.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <Circle className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />}
                        <span className={`text-sm ${t.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.text}
                          {t.date && <span className="text-[11px] text-gray-400 ml-1.5">{format(new Date(t.date), 'd MMM')}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {results.notes?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2 mb-1">Notes</p>
                    {results.notes.map((n: any) => (
                      <div key={n.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                        <StickyNote className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                        <span className="text-sm text-gray-700 line-clamp-2">{n.content}</span>
                      </div>
                    ))}
                  </div>
                )}
                {results.library?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2 mb-1">Library</p>
                    {results.library.map((l: any) => (
                      <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                        <BookOpen className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
                        <span className="text-sm text-gray-800 font-semibold line-clamp-2">{l.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thread */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-16 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading overview…</div>
      ) : !hasAnalysis && messages.length === 0 ? (
        <div className="text-center bg-white border border-[var(--border)] rounded-2xl py-14 px-6 shadow-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'var(--primary-shadow)' }}>
            <Sparkles className="w-7 h-7" style={{ color: 'var(--primary)' }} />
          </div>
          <h3 className="text-lg font-extrabold text-gray-900">Get an AI read on {ideaTitle}</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">A full analysis of everything in this project — open tasks, what needs attention, and suggested next moves. Then ask follow-ups.</p>
          <button
            onClick={analyze}
            disabled={analyzing}
            className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white disabled:opacity-60"
            style={{ background: 'var(--primary)' }}
          >
            {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</> : <><Sparkles className="w-4 h-4" /> Analyse this project</>}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map(m => {
            if (m.role === 'analysis') {
              return (
                <div key={m.id} className="bg-white border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border)]" style={{ background: 'var(--primary-shadow)' }}>
                    <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                    <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Analysis</span>
                    <span className="text-[11px] font-bold text-gray-400 ml-auto">{format(new Date(m.createdAt), 'd MMM yyyy · HH:mm')}</span>
                  </div>
                  <div className="px-5 py-4 text-sm"><MiniMarkdown text={m.content} /></div>
                </div>
              );
            }
            if (m.role === 'user') {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium text-white shadow-sm" style={{ background: 'var(--primary)' }}>
                    {m.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[90%] bg-white border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3 shadow-sm text-sm">
                  <MiniMarkdown text={m.content} />
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white border border-[var(--border)] rounded-2xl px-4 py-3 shadow-sm text-sm text-gray-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
              </div>
            </div>
          )}
          <div ref={threadEndRef} />

          {/* Re-analyse button between thread and composer */}
          <div className="flex justify-center pt-1">
            <button
              onClick={analyze}
              disabled={analyzing}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 bg-white border border-[var(--border)] rounded-full px-3 py-1.5 disabled:opacity-60"
            >
              {analyzing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</> : <><RefreshCw className="w-3.5 h-3.5" /> New analysis</>}
            </button>
          </div>
        </div>
      )}

      {/* Prompt composer */}
      {(hasAnalysis || messages.length > 0) && (
        <div className="sticky bottom-4 mt-4">
          <div className="flex items-end gap-2 bg-white border border-[var(--border)] rounded-2xl shadow-lg p-2">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(); } }}
              placeholder="Ask a follow-up about this project…"
              rows={1}
              className="flex-1 resize-none outline-none px-3 py-2 text-sm max-h-32 bg-transparent"
            />
            <button
              onClick={sendPrompt}
              disabled={!prompt.trim() || sending}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 shrink-0"
              style={{ background: 'var(--primary)' }}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIOverviewTab;
