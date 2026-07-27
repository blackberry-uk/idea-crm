import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../lib/api/client';
import { format } from 'date-fns';
import {
  BookOpen, ExternalLink, Trash2, Loader2, Plus, FileText, Download, Link2, Globe
} from 'lucide-react';

interface LibItem { id: string; url: string; title: string; summary?: string | null; createdAt: string; }

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

const IdeaLibraryTab: React.FC<{
  idea: any;
  attachments: any[];
  onOpenAttachment: (id: string) => void;
  onDeleteAttachment: (e: React.MouseEvent, id: string) => void;
}> = ({ idea, attachments, onOpenAttachment, onDeleteAttachment }) => {
  const [items, setItems] = useState<LibItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    let alive = true;
    apiClient.get('/library')
      .then((all: any[]) => { if (alive) setItems((all || []).filter(i => i.idea?.id === idea.id)); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [idea.id]);

  const add = async () => {
    const url = newUrl.trim();
    if (!/^https?:\/\//i.test(url)) { setAddError('Enter a valid URL (starting with http)'); return; }
    setAdding(true); setAddError('');
    try {
      const item = await apiClient.post('/library', { url, ideaId: idea.id });
      setItems(prev => [item, ...prev]);
      setNewUrl('');
    } catch (e: any) { setAddError(e?.message || 'Failed to add link'); }
    finally { setAdding(false); }
  };

  const removeItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    try { await apiClient.delete(`/library/${id}`); } catch {}
  };

  // Old-style plain links stored directly on the idea.
  const ideaLinks: { title: string; url: string }[] = Array.isArray(idea.links) ? idea.links : [];
  const docs = Array.isArray(attachments) ? attachments : [];

  const isEmpty = !loading && items.length === 0 && ideaLinks.length === 0 && docs.length === 0;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Add a link */}
      <div className="bg-white rounded-2xl border border-[var(--border)] p-3 shadow-sm mb-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={newUrl}
              onChange={e => { setNewUrl(e.target.value); setAddError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') add(); }}
              placeholder="Paste a link to save to this project…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border)] outline-none focus:ring-2 focus:ring-[var(--primary-shadow)] focus:border-[var(--primary)]"
            />
          </div>
          <button
            onClick={add}
            disabled={adding || !newUrl.trim()}
            className="px-4 py-2.5 rounded-xl font-bold text-white disabled:opacity-50 inline-flex items-center gap-2 justify-center whitespace-nowrap"
            style={{ background: 'var(--primary)' }}
          >
            {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Summarizing…</> : <><Plus className="w-4 h-4" /> Add link</>}
          </button>
        </div>
        {addError && <p className="text-xs font-bold text-red-500 mt-2 ml-1">{addError}</p>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-16 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : isEmpty ? (
        <div className="text-center text-gray-400 py-16 bg-white border border-[var(--border)] rounded-2xl">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-gray-500">Nothing in this project's library yet.</p>
          <p className="text-sm mt-1">Add a link above, email one with subject <code className="bg-gray-100 px-1.5 py-0.5 rounded">lib:</code>, or upload documents from the Checklist tab.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Links & articles (Library items + summaries) */}
          {(items.length > 0 || ideaLinks.length > 0) && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-sky-500" />
                <h2 className="font-bold text-gray-700">Links &amp; articles</h2>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{items.length + ideaLinks.length}</span>
              </div>
              <div className="space-y-3">
                {items.map(it => (
                  <div key={it.id} className="group bg-white rounded-2xl border border-[var(--border)] p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <a href={it.url} target="_blank" rel="noreferrer" className="font-bold text-gray-900 hover:text-[var(--primary)] flex items-center gap-1.5 leading-snug">
                        {it.title} <ExternalLink className="w-3.5 h-3.5 opacity-50 shrink-0" />
                      </a>
                      <button onClick={() => removeItem(it.id)} title="Remove" className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {it.summary && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{it.summary}</p>}
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                      <span>{hostOf(it.url)}</span><span>·</span>
                      <span>{format(new Date(it.createdAt), 'd MMM yyyy')}</span>
                    </div>
                  </div>
                ))}
                {ideaLinks.map((link, idx) => (
                  <a key={`il-${idx}`} href={link.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2.5 bg-white rounded-xl border border-[var(--border)] px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
                    <Link2 className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-semibold text-gray-800 truncate">{link.title || link.url}</span>
                    <span className="text-xs text-gray-400 ml-auto shrink-0">{hostOf(link.url)}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Documents & attachments */}
          {docs.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-violet-500" />
                <h2 className="font-bold text-gray-700">Documents &amp; attachments</h2>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{docs.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docs.map((att: any) => (
                  <div key={att.id} className="group bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-violet-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <button onClick={() => onOpenAttachment(att.id)} className="font-semibold text-gray-800 hover:text-[var(--primary)] text-left truncate block w-full">
                        {att.title || att.fileName || 'Untitled'}
                      </button>
                      <p className="text-xs text-gray-400 mt-0.5">{att.createdAt ? format(new Date(att.createdAt), 'd MMM yyyy') : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => onOpenAttachment(att.id)} title="Open" className="p-1.5 text-gray-300 hover:text-[var(--primary)] rounded-lg hover:bg-gray-50">
                        <Download className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => onDeleteAttachment(e, att.id)} title="Delete" className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default IdeaLibraryTab;
