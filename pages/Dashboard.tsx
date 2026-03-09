
import React from 'react';
import { useStore } from '../store/useStore.ts';
import { format } from 'date-fns';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, TrendingUp, Info, Cloud, RotateCcw, CheckCheck, Brain, Mountain, CalendarCheck, ChevronRight, Circle, Check, Flame, AlertTriangle, Plus, Lightbulb, ClipboardList, Tag, Send } from 'lucide-react';
import { Note } from '../types';
import { getNoteExcerpt } from '../lib/utils';
import OnboardingGuide from '../components/OnboardingGuide';
import { apiClient } from '../lib/api/client';
import DailyTodoItem from '../components/DailyTodoItem';

const Dashboard: React.FC = () => {
  const { data, updateIdea } = useStore();
  const { search } = useLocation();
  const showTrainingParam = new URLSearchParams(search).get('training') === 'true';

  // Daily todos state
  const [todayTodos, setTodayTodos] = React.useState<any[]>([]);
  const [overdueTodos, setOverdueTodos] = React.useState<any[]>([]);
  const [todosLoading, setTodosLoading] = React.useState(true);
  const [newTodayText, setNewTodayText] = React.useState('');
  const [newTodayIdeaId, setNewTodayIdeaId] = React.useState('');
  const [showDashboardTagPicker, setShowDashboardTagPicker] = React.useState(false);

  const ideas = data.ideas || [];

  const fetchDailyTodos = React.useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().slice(0, 10);

      // Fetch a wide range to catch overdue items
      const pastStart = new Date(today);
      pastStart.setDate(pastStart.getDate() - 90);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const allTodos = await apiClient.get(
        `/daily-todos?from=${pastStart.toISOString()}&to=${todayEnd.toISOString()}`
      );

      const todayItems = allTodos.filter((t: any) => t.date.slice(0, 10) === todayStr);
      const overdueItems = allTodos.filter((t: any) =>
        t.date.slice(0, 10) < todayStr && !t.completed
      );

      setTodayTodos(todayItems);
      setOverdueTodos(overdueItems);
    } catch (err) {
      console.error('Failed to fetch daily todos for dashboard:', err);
    } finally {
      setTodosLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDailyTodos();
  }, [fetchDailyTodos]);

  const toggleTodoComplete = async (todo: any) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${todo.id}`, {
        completed: !todo.completed
      });
      setOverdueTodos(prev => prev.map(t => t.id === todo.id ? updated : t).filter(t => !t.completed));
      setTodayTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
    } catch (err) {
      console.error('Failed to toggle todo:', err);
    }
  };

  const toggleTodoUrgent = async (todo: any) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${todo.id}`, {
        isUrgent: !todo.isUrgent
      });
      setOverdueTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
      setTodayTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
    } catch (err) {
      console.error('Failed to toggle urgency:', err);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await apiClient.delete(`/daily-todos/${id}`);
      setTodayTodos(prev => prev.filter(t => t.id !== id));
      setOverdueTodos(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete todo:', err);
    }
  };

  const saveTodoEdit = async (id: string, text: string) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${id}`, { text });
      setTodayTodos(prev => prev.map(t => t.id === id ? updated : t));
      setOverdueTodos(prev => prev.map(t => t.id === id ? updated : t));
    } catch (err) {
      console.error('Failed to save edit:', err);
    }
  };

  const tagTodoToIdea = async (todoId: string, ideaId: string | null) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${todoId}`, { ideaId });
      setTodayTodos(prev => prev.map(t => t.id === todoId ? updated : t));
      setOverdueTodos(prev => prev.map(t => t.id === todoId ? updated : t));
    } catch (err) {
      console.error('Failed to tag todo:', err);
    }
  };

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

      <OnboardingGuide hideIfCompleted={!showTrainingParam} />

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
          {/* Left column — Today's Todos + Overdue */}
          <div className="space-y-6">
            {/* Today's Todos — Full List */}
            <section className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: 'var(--primary)' }}>
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-gray-900">Today's To-Dos</h2>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                      {format(new Date(), 'EEEE, MMMM d')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!todosLoading && todayTodos.length > 0 && (
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-full border ${todayTodos.every(t => t.completed) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                      {todayTodos.filter(t => t.completed).length}/{todayTodos.length}
                    </span>
                  )}
                  <Link to="/daily" className="text-xs font-bold hover:underline" style={{ color: 'var(--primary)' }}>Full Calendar</Link>
                </div>
              </div>

              {/* Todo items */}
              {!todosLoading && (
                <div className="space-y-1">
                  {todayTodos.map(todo => (
                    <DailyTodoItem
                      key={todo.id}
                      todo={todo}
                      ideas={ideas}
                      onToggleComplete={toggleTodoComplete}
                      onToggleUrgent={toggleTodoUrgent}
                      onDelete={deleteTodo}
                      onSaveEdit={saveTodoEdit}
                      onTagIdea={tagTodoToIdea}
                    />
                  ))}

                  {/* Inline add */}
                  <div className="daily-todo-add-mobile">
                    <div className="daily-todo-add-input-row">
                      <textarea
                        className="daily-todo-add-input-big"
                        placeholder="What needs to be done?"
                        rows={2}
                        value={newTodayText}
                        onChange={e => setNewTodayText(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === 'Enter' && !e.shiftKey && newTodayText.trim()) {
                            e.preventDefault();
                            try {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const todo = await apiClient.post('/daily-todos', {
                                text: newTodayText.trim(),
                                date: today.toISOString().slice(0, 10),
                                ideaId: newTodayIdeaId || null
                              });
                              setTodayTodos(prev => [...prev, todo]);
                              setNewTodayText('');
                              setNewTodayIdeaId('');
                            } catch (err) {
                              console.error('Failed to add todo:', err);
                            }
                          }
                        }}
                      />
                      <button
                        className={`daily-todo-add-tag-btn ${newTodayIdeaId ? 'daily-todo-add-tag-btn--active' : ''}`}
                        onClick={() => setShowDashboardTagPicker(!showDashboardTagPicker)}
                        title="Tag to idea"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      <button
                        className="daily-todo-add-send-btn"
                        onClick={async () => {
                          if (!newTodayText.trim()) return;
                          try {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const todo = await apiClient.post('/daily-todos', {
                              text: newTodayText.trim(),
                              date: today.toISOString().slice(0, 10),
                              ideaId: newTodayIdeaId || null
                            });
                            setTodayTodos(prev => [...prev, todo]);
                            setNewTodayText('');
                            setNewTodayIdeaId('');
                          } catch (err) {
                            console.error('Failed to add todo:', err);
                          }
                        }}
                        disabled={!newTodayText.trim()}
                        title="Add to-do"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    {newTodayIdeaId && (() => {
                      const taggedIdea = ideas.find(i => i.id === newTodayIdeaId);
                      return taggedIdea ? (
                        <div className="daily-todo-add-tagged">
                          <span className="daily-todo-add-tagged-badge">
                            💡 {taggedIdea.title}
                            <button onClick={() => setNewTodayIdeaId('')} className="daily-todo-add-tagged-remove">×</button>
                          </span>
                        </div>
                      ) : null;
                    })()}
                    {showDashboardTagPicker && (
                      <div className="daily-todo-add-picker">
                        {[...ideas].sort((a, b) => a.title.localeCompare(b.title)).map(idea => (
                          <button
                            key={idea.id}
                            className={`daily-todo-add-picker-item ${newTodayIdeaId === idea.id ? 'daily-todo-add-picker-item--selected' : ''}`}
                            onClick={() => {
                              setNewTodayIdeaId(idea.id);
                              setShowDashboardTagPicker(false);
                            }}
                          >
                            💡 {idea.title}
                          </button>
                        ))}
                        {newTodayIdeaId && (
                          <button
                            className="daily-todo-add-picker-item daily-todo-add-picker-item--remove"
                            onClick={() => {
                              setNewTodayIdeaId('');
                              setShowDashboardTagPicker(false);
                            }}
                          >
                            ✕ Remove tag
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {todayTodos.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-4 font-medium italic">No to-dos for today yet. Add one above!</p>
                  )}
                </div>
              )}
            </section>

            {/* Pending Idea Tasks */}
            {(() => {
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);
              const todayStr = todayStart.toISOString().slice(0, 10);

              const pendingIdeaTodos = (data.ideas || []).flatMap(idea =>
                (idea.todos || []).filter(t => {
                  if (!t.completed) return true;
                  // Include if completed today
                  if (t.completedAt && t.completedAt.slice(0, 10) === todayStr) return true;
                  return false;
                }).map(t => ({
                  ...t,
                  ideaId: idea.id,
                  ideaTitle: idea.title
                }))
              );
              // Sort: pending first, then within pending: urgent > dueDate > rest, completed-today at bottom
              pendingIdeaTodos.sort((a, b) => {
                if (a.completed !== b.completed) return a.completed ? 1 : -1;
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                if (a.dueDate && !b.dueDate) return -1;
                if (!a.dueDate && b.dueDate) return 1;
                return 0;
              });
              const pendingCount = pendingIdeaTodos.filter(t => !t.completed).length;
              if (pendingIdeaTodos.length === 0) return null;
              return (
                <section className="bg-white rounded-2xl border border-amber-100 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-amber-500" />
                      <h2 className="font-bold text-lg text-gray-900">Pending Idea Tasks</h2>
                      {pendingCount > 0 && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full border border-amber-100">
                          {pendingCount}
                        </span>
                      )}
                    </div>
                    <Link to="/ideas" className="text-xs font-bold hover:underline" style={{ color: 'var(--primary)' }}>View Ideas</Link>
                  </div>
                  <div className="space-y-1">
                    {pendingIdeaTodos.map(todo => (
                      <div
                        key={todo.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${todo.completed ? 'opacity-50' : ''} ${!todo.completed ? 'hover:bg-amber-50/50' : ''} ${todo.isUrgent && !todo.completed ? 'bg-red-50/40' : ''}`}
                      >
                        <button
                          onClick={async () => {
                            if (todo.completed) return; // Already done
                            const idea = (data.ideas || []).find(i => i.id === todo.ideaId);
                            if (!idea) return;
                            const updatedTodos = idea.todos.map(t =>
                              t.id === todo.id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t
                            );
                            try {
                              await updateIdea(todo.ideaId, { todos: updatedTodos });
                            } catch (err) {
                              console.error('Failed to complete idea todo:', err);
                            }
                          }}
                          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${todo.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-amber-300 hover:border-emerald-500 hover:bg-emerald-50 bg-white'}`}
                          title={todo.completed ? 'Completed today' : 'Mark as completed'}
                          disabled={todo.completed}
                        >
                          {todo.completed ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5 text-transparent" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{todo.text}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Link
                              to={`/ideas/${todo.ideaId}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: 'var(--primary-shadow, #eef2ff)', color: 'var(--primary, #6366f1)' }}
                            >
                              <Lightbulb className="w-2.5 h-2.5" />
                              {todo.ideaTitle.length > 18 ? todo.ideaTitle.slice(0, 18) + '\u2026' : todo.ideaTitle}
                            </Link>
                            {todo.dueDate && !todo.completed && (
                              <span className={`text-[9px] font-bold uppercase tracking-widest ${new Date(todo.dueDate) < new Date() ? 'text-red-400' : 'text-gray-400'}`}>
                                Due {format(new Date(todo.dueDate), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                        {todo.isUrgent && !todo.completed && (
                          <Flame className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        )}
                        <Link to={`/ideas/${todo.ideaId}`} className="flex-shrink-0">
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 transition-colors" />
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}

            {/* Overdue Todos */}
            {!todosLoading && overdueTodos.length > 0 && (
              <section className="bg-white rounded-2xl border border-red-100 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <h2 className="font-bold text-lg text-gray-900">Overdue</h2>
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-black rounded-full border border-red-100">
                      {overdueTodos.length}
                    </span>
                  </div>
                  <Link to="/daily" className="text-xs font-bold hover:underline" style={{ color: 'var(--primary)' }}>View All</Link>
                </div>
                <div className="space-y-1">
                  {overdueTodos.map(todo => (
                    <DailyTodoItem
                      key={todo.id}
                      todo={todo}
                      ideas={ideas}
                      onToggleComplete={toggleTodoComplete}
                      onToggleUrgent={toggleTodoUrgent}
                      onDelete={deleteTodo}
                      onSaveEdit={saveTodoEdit}
                      onTagIdea={tagTodoToIdea}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All caught up state */}
            {!todosLoading && overdueTodos.length === 0 && todayTodos.length > 0 && todayTodos.every(t => t.completed) && (
              <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-6 text-center">
                <p className="text-emerald-600 font-bold text-sm">✨ All caught up! Great work today.</p>
              </div>
            )}
          </div>

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
