import React, { useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { CheckCircle2, PlusCircle, StickyNote, Activity } from 'lucide-react';

interface Ev { id: string; at: Date; kind: 'created' | 'completed' | 'note'; label: string; who?: string; }

const dayLabel = (d: Date) => isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, d MMM yyyy');

const IdeaActivityTab: React.FC<{ idea: any; todos: any[]; notes: any[]; users: any[] }> = ({ idea, todos, notes, users }) => {
  const nameOf = (uid?: string) => users.find(u => u.id === uid)?.name?.split(' ')[0];

  const events = useMemo(() => {
    const evs: Ev[] = [];
    for (const t of (todos || [])) {
      if (t.createdAt) evs.push({ id: `c-${t.id}`, at: new Date(t.createdAt), kind: 'created', label: t.text, who: nameOf(t.userId) });
      if (t.completed && t.completedAt) evs.push({ id: `d-${t.id}`, at: new Date(t.completedAt), kind: 'completed', label: t.text, who: nameOf(t.completedById) });
    }
    for (const n of (notes || [])) {
      const body = (n.content || n.body || '').toString().replace(/\s+/g, ' ').trim();
      if (body) evs.push({ id: `n-${n.id}`, at: new Date(n.createdAt), kind: 'note', label: body.slice(0, 160), who: nameOf(n.createdById) });
    }
    return evs.sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [todos, notes, users]);

  const groups = useMemo(() => {
    const map = new Map<string, Ev[]>();
    for (const e of events) {
      const key = format(e.at, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [events]);

  const meta = {
    created: { icon: PlusCircle, tint: '#6366f1', verb: 'added task' },
    completed: { icon: CheckCircle2, tint: '#10b981', verb: 'completed' },
    note: { icon: StickyNote, tint: '#f59e0b', verb: 'noted' },
  } as const;

  if (events.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center text-gray-400 py-16 bg-white border border-[var(--border)] rounded-2xl">
        <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-semibold text-gray-500">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {groups.map(([key, evs]) => (
        <div key={key} className="mb-6">
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 sticky top-0">{dayLabel(evs[0].at)}</p>
          <div className="space-y-1.5">
            {evs.map(e => {
              const m = meta[e.kind];
              return (
                <div key={e.id} className="flex items-start gap-3 bg-white border border-[var(--border)] rounded-xl px-4 py-2.5 shadow-sm">
                  <m.icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: m.tint }} />
                  <div className="min-w-0 flex-1">
                    <span className={`text-sm ${e.kind === 'completed' ? 'text-gray-500' : 'text-gray-800'}`}>
                      <span className="text-gray-400 font-semibold">{e.who ? `${e.who} ` : ''}{m.verb}: </span>
                      {e.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-300 shrink-0 mt-0.5">{format(e.at, 'HH:mm')}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default IdeaActivityTab;
