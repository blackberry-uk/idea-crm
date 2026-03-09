
import React, { useState } from 'react';
import { useStore } from '../store/useStore.ts';
import { Link } from 'react-router-dom';
import { Plus, Trash2, LogOut, Lightbulb, MessageSquarePlus, MessageSquare, ShieldCheck, ArrowUpDown } from 'lucide-react';
import IdeaModal from '../components/IdeaModal';
import QuickNoteModal from '../components/QuickNoteModal';
import { format } from 'date-fns';

type SortCol = 'title' | 'lastUpdate' | 'notes' | 'todos';
type SortDir = 'asc' | 'desc';

const IdeasPage: React.FC = () => {
  const { data, myIdeas, deleteIdea, leaveIdea, confirm, showToast } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeEntity, setActiveEntity] = useState('All');
  const [quickNoteIdea, setQuickNoteIdea] = useState<{ id: string, title: string } | null>(() => {
    const saved = localStorage.getItem('active_quick_note_idea');
    return saved ? JSON.parse(saved) : null;
  });

  const handleSetQuickNoteIdea = (idea: { id: string, title: string } | null) => {
    setQuickNoteIdea(idea);
    if (idea) {
      localStorage.setItem('active_quick_note_idea', JSON.stringify(idea));
    } else {
      localStorage.removeItem('active_quick_note_idea');
    }
  };

  const [sortCol, setSortCol] = useState<SortCol>(
    (localStorage.getItem('ideas_sort_col') as SortCol) || 'lastUpdate'
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    (localStorage.getItem('ideas_sort_dir') as SortDir) || 'desc'
  );

  const handleSort = (col: SortCol) => {
    const newDir = sortCol === col && sortDir === 'asc' ? 'desc' : sortCol === col && sortDir === 'desc' ? 'asc' : col === 'title' ? 'asc' : 'desc';
    setSortCol(col);
    setSortDir(newDir);
    localStorage.setItem('ideas_sort_col', col);
    localStorage.setItem('ideas_sort_dir', newDir);
  };

  const processedIdeas = myIdeas.map(idea => {
    const ideaNotes = (data.notes || []).filter(n => n.ideaId === idea.id);
    const pendingTodos = (idea.todos || []).filter(t => !t.completed);
    const lastNoteDate = ideaNotes.length > 0
      ? Math.max(...ideaNotes.map(n => new Date(n.createdAt).getTime()))
      : 0;
    const lastActivityDate = Math.max(new Date(idea.updatedAt).getTime(), lastNoteDate);

    return {
      ...idea,
      noteCount: ideaNotes.length,
      todoCount: pendingTodos.length,
      lastActivityDate
    };
  });

  const entities = ['All', ...(data.currentUser?.personalEntities || [])];

  const sortedIdeas = processedIdeas
    .filter(idea => activeEntity === 'All' || idea.entity === activeEntity)
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortCol) {
        case 'title': return dir * a.title.localeCompare(b.title);
        case 'lastUpdate': return dir * (a.lastActivityDate - b.lastActivityDate);
        case 'notes': return dir * (a.noteCount - b.noteCount);
        case 'todos': return dir * (a.todoCount - b.todoCount);
        default: return 0;
      }
    });

  React.useEffect(() => {
    document.title = 'Idea Pipeline | Idea-CRM';
    return () => { document.title = 'IdeaCRM Tracker'; };
  }, []);

  const SortIcon = ({ col }: { col: SortCol }) => (
    <span className={`ideas-sort-icon ${sortCol === col ? 'ideas-sort-icon--active' : ''}`}>
      {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <ArrowUpDown className="w-3 h-3" />}
    </span>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-5 px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Idea Pipeline</h1>
          <p className="text-sm text-gray-400">{sortedIdeas.length} Ideas</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-2 text-white px-5 py-2 rounded-xl font-semibold shadow-lg transition-all active:scale-95 text-sm"
          style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 15px -3px var(--primary-shadow)' }}
        >
          <Plus className="w-4 h-4" />
          New Idea
        </button>
      </div>

      {/* Entity Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {entities.map(entity => (
          <button
            key={entity}
            onClick={() => setActiveEntity(entity)}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border shadow-sm ${activeEntity === entity
              ? 'text-white'
              : 'bg-white border-gray-100 text-gray-400 hover:border-[var(--primary)]'
            }`}
            style={activeEntity === entity ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
          >
            {entity}
          </button>
        ))}
      </div>

      {/* Sortable Ideas Table */}
      <section className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="ideas-table">
          <thead>
            <tr>
              <th className="ideas-th ideas-th--sortable" onClick={() => handleSort('title')}>
                Idea <SortIcon col="title" />
              </th>
              <th className="ideas-th ideas-th--hide-mobile">Status</th>
              <th className="ideas-th ideas-th--hide-mobile">Entity</th>
              <th className="ideas-th ideas-th--sortable ideas-th--center" onClick={() => handleSort('lastUpdate')}>
                Updated <SortIcon col="lastUpdate" />
              </th>
              <th className="ideas-th ideas-th--sortable ideas-th--center" onClick={() => handleSort('notes')}>
                Notes <SortIcon col="notes" />
              </th>
              <th className="ideas-th ideas-th--sortable ideas-th--center" onClick={() => handleSort('todos')}>
                Todos <SortIcon col="todos" />
              </th>
              <th className="ideas-th" style={{ width: '4.5rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {sortedIdeas.map(idea => {
              const isOwner = idea.ownerId === data.currentUser?.id;
              return (
                <tr key={idea.id} className="ideas-row">
                  <td className="ideas-td">
                    <Link to={`/ideas/${idea.id}`} className="ideas-title-link">
                      {idea.title}
                    </Link>
                  </td>
                  <td className="ideas-td ideas-td--hide-mobile">
                    <span className={`ideas-status-badge ${
                      ['Ideation', 'Scoping', 'Backlog'].includes(idea.status) ? 'ideas-status--amber' :
                      ['Research'].includes(idea.status) ? 'ideas-status--blue' :
                      ['Prototype', 'Proposal', 'Business Plan'].includes(idea.status) ? 'ideas-status--primary' :
                      ['Testing', 'Approval', 'Capital Raise'].includes(idea.status) ? 'ideas-status--purple' :
                      ['Launched', 'Execution', 'Active', 'Done'].includes(idea.status) ? 'ideas-status--green' :
                      idea.status === 'Dead' ? 'ideas-status--red' : 'ideas-status--gray'
                    }`}>
                      {idea.status}
                    </span>
                  </td>
                  <td className="ideas-td ideas-td--hide-mobile">
                    <span className="ideas-entity-badge">{idea.entity}</span>
                  </td>
                  <td className="ideas-td ideas-td--center ideas-td--muted">
                    {format(new Date(idea.lastActivityDate), 'MMM d')}
                  </td>
                  <td className="ideas-td ideas-td--center">
                    <span className="ideas-count" style={{ color: 'var(--primary)' }}>
                      <MessageSquare className="w-3 h-3" />
                      {idea.noteCount}
                    </span>
                  </td>
                  <td className="ideas-td ideas-td--center">
                    <span className="ideas-count ideas-count--amber">
                      <ShieldCheck className="w-3 h-3" />
                      {idea.todoCount}
                    </span>
                  </td>
                  <td className="ideas-td ideas-td--center">
                    <div className="flex items-center gap-1 justify-center">
                      <button
                        onClick={() => handleSetQuickNoteIdea({ id: idea.id, title: idea.title })}
                        className="ideas-action-btn"
                        title="Quick Note"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (isOwner) {
                            confirm({
                              title: 'Delete Idea',
                              message: `Permanently delete "${idea.title}"?`,
                              confirmLabel: 'Delete',
                              type: 'danger',
                              onConfirm: async () => {
                                try { await deleteIdea(idea.id); showToast('Idea deleted', 'success'); }
                                catch (err: any) { showToast(err.message || 'Failed', 'error'); }
                              }
                            });
                          } else {
                            confirm({
                              title: 'Leave Project',
                              message: `Stop collaborating on "${idea.title}"?`,
                              confirmLabel: 'Leave',
                              type: 'danger',
                              onConfirm: async () => {
                                try { await leaveIdea(idea.id); showToast('Left project', 'info'); }
                                catch (err: any) { showToast(err.message || 'Failed', 'error'); }
                              }
                            });
                          }
                        }}
                        className="ideas-action-btn ideas-action-btn--danger"
                        title={isOwner ? 'Delete' : 'Leave'}
                      >
                        {isOwner ? <Trash2 className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedIdeas.length === 0 && (
          <div className="py-16 text-center">
            <Lightbulb className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No ideas found</p>
          </div>
        )}
      </section>

      <IdeaModal isOpen={showAddForm} onClose={() => setShowAddForm(false)} />

      <QuickNoteModal
        isOpen={!!quickNoteIdea}
        onClose={() => handleSetQuickNoteIdea(null)}
        ideaId={quickNoteIdea?.id || ''}
        ideaTitle={quickNoteIdea?.title || ''}
      />
    </div>
  );
};

export default IdeasPage;
