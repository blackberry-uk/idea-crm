import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../lib/api/client';
import { BookOpen, ExternalLink, Trash2, Search, Lightbulb, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface LibItem {
  id: string;
  url: string;
  title: string;
  summary?: string | null;
  sourceSubject?: string | null;
  createdAt: string;
  idea?: { id: string; title: string } | null;
}

const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};

const Library: React.FC = () => {
  const [items, setItems] = useState<LibItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    document.title = 'Library | Idea-CRM';
    apiClient.get('/library').then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const remove = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id)); // optimistic
    try { await apiClient.delete(`/library/${id}`); } catch { apiClient.get('/library').then(setItems).catch(() => {}); }
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter(i =>
      `${i.title} ${i.summary || ''} ${i.url} ${i.idea?.title || ''}`.toLowerCase().includes(query)
    );
  }, [items, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, { title: string; items: LibItem[] }>();
    for (const it of filtered) {
      const key = it.idea?.id || '__none__';
      const title = it.idea?.title || 'Unfiled';
      if (!map.has(key)) map.set(key, { title, items: [] });
      map.get(key)!.items.push(it);
    }
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [filtered]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-1">
        <BookOpen className="w-8 h-8" style={{ color: 'var(--primary)' }} />
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Library</h1>
      </div>
      <p className="text-gray-500 mb-6">
        Links &amp; articles you saved by email (subject <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">lib:</code>) — summarized and filed by project.
      </p>

      <div className="relative mb-6">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search your library…"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-16 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-gray-500">Your library is empty.</p>
          <p className="text-sm mt-1">Email a link with subject <code className="bg-gray-100 px-1.5 py-0.5 rounded">lib:</code> and it'll appear here, summarized.</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center text-gray-400 py-12">No items match “{q}”.</div>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => (
            <section key={group.title}>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <h2 className="font-bold text-gray-700">{group.title}</h2>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{group.items.length}</span>
              </div>
              <div className="space-y-3">
                {group.items.map(it => (
                  <div key={it.id} className="group bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <a href={it.url} target="_blank" rel="noreferrer" className="font-bold text-gray-900 hover:text-indigo-600 flex items-center gap-1.5 leading-snug">
                        {it.title} <ExternalLink className="w-3.5 h-3.5 opacity-50 shrink-0" />
                      </a>
                      <button onClick={() => remove(it.id)} title="Remove" className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {it.summary && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{it.summary}</p>}
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                      <span>{hostOf(it.url)}</span>
                      <span>·</span>
                      <span>{format(new Date(it.createdAt), 'd MMM yyyy')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default Library;
