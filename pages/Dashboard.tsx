
import React from 'react';
import { useStore } from '../store/useStore.ts';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { ChevronRight, Calendar, Clock, MessageSquare, TrendingUp, Info, Database, Cloud, MapPin, AtSign, ExternalLink, ShieldCheck, RotateCcw, CheckCheck, Brain, Mountain } from 'lucide-react';
import { Note } from '../types';
import { getNoteExcerpt } from '../lib/utils';
import OnboardingGuide from '../components/OnboardingGuide';

const Dashboard: React.FC = () => {
  const { data } = useStore();

  React.useEffect(() => {
    document.title = 'Dashboard | Idea-CRM';
    return () => { document.title = 'IdeaCRM Tracker'; };
  }, []);

  const INTENT_CONFIG: Record<string, { icon: any, label: string, color: string }> = {
    follow_up: { icon: RotateCcw, label: 'Follow up', color: 'text-green-600' },
    acted_upon: { icon: CheckCheck, label: 'Acted upon', color: 'text-emerald-500' },
    reflection: { icon: Brain, label: 'Reflection', color: 'text-gray-400' },
    memoir: { icon: Mountain, label: 'Memoir', color: 'text-yellow-600' },
  };

  const activeIdeas = (data.ideas || [])
    .map(idea => {
      const ideaNotes = (data.notes || []).filter(n => n.ideaId === idea.id);
      const pendingTodos = (idea.todos || []).filter(t => !t.completed);
      return {
        ...idea,
        noteCount: ideaNotes.length,
        todoCount: pendingTodos.length,
        activityScore: ideaNotes.length + pendingTodos.length
      };
    })
    .sort((a, b) => b.activityScore - a.activityScore)
    .slice(0, 5);

  const recentNotes = [...(data.notes || [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const isEmpty = (data.ideas?.length || 0) === 0 && (data.contacts?.length || 0) === 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase transition-colors duration-500" style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-shadow)', borderColor: 'var(--primary)' }}>
              <Cloud className="w-3 h-3" />
              Cloud Synced (PostgreSQL)
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-white transition-colors duration-500 shadow-sm" style={{ backgroundColor: 'var(--primary)' }}>
          <TrendingUp className="w-5 h-5" />
          <span className="font-semibold text-sm">{(data.ideas || []).filter(i => i.status === 'Launched').length} Ideas Launched</span>
        </div>
      </div>

      <OnboardingGuide />

      {isEmpty ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center max-w-2xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: 'var(--primary-shadow)', color: 'var(--primary)' }}>
            <Info className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900">Your Workspace is Ready</h2>
            <p className="text-gray-500">
              Your data is securely stored in Supabase PostgreSQL and is available on all your devices.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/ideas" className="w-full sm:w-auto px-6 py-3 text-white font-bold rounded-xl shadow-lg transition-all" style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 15px -3px var(--primary-shadow)' }}>Create First Idea</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900">Most Active Ideas</h2>
              <Link to="/ideas" className="text-xs font-bold hover:underline" style={{ color: 'var(--primary)' }}>View Pipeline</Link>
            </div>
            <div className="space-y-3">
              {activeIdeas.map(idea => (
                <Link key={idea.id} to={`/ideas/${idea.id}`} className="block p-4 rounded-xl border border-gray-50 transition-all group" style={{ transitionColor: 'var(--primary)' }}>
                  <div className="flex justify-between items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 group-hover:text-[var(--primary)] transition-colors truncate">{idea.title}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Updated {format(new Date(idea.updatedAt), 'EEE, MMM d')}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 px-4">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Notes</span>
                        <div className="flex items-center gap-1" style={{ color: 'var(--primary)' }}>
                          <MessageSquare className="w-3 h-3" />
                          <span className="text-xs font-bold">{idea.noteCount}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Todos</span>
                        <div className="flex items-center gap-1 text-amber-600">
                          <ShieldCheck className="w-3 h-3" />
                          <span className="text-xs font-bold">{idea.todoCount}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[var(--primary)] transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900">Recent Activity</h2>
              <Link to="/reports/weekly" className="text-xs font-bold hover:underline" style={{ color: 'var(--primary)' }}>Full Report</Link>
            </div>
            <div className="space-y-4">
              {recentNotes.map(note => (
                <div key={note.id} className="flex gap-4">
                  <div className={`mt-1 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 ${INTENT_CONFIG[note.intent || 'memoir']?.color || ''}`} style={(!note.intent) ? { color: 'var(--primary)' } : {}}>
                    {note.intent ? (
                      React.createElement(INTENT_CONFIG[note.intent].icon, { className: "w-4 h-4" })
                    ) : (
                      <MessageSquare className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-700 line-clamp-2 font-medium mb-1">
                      {getNoteExcerpt(note.body)}
                    </p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                      {format(new Date(note.createdAt), 'EEE, MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
