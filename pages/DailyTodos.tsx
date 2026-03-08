import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../lib/api/client';
import { useStore } from '../store/useStore';
import {
  Plus, ChevronDown, ChevronUp,
  CalendarDays, ArrowDownToLine, Loader2, Sparkles
} from 'lucide-react';
import DailyTodoItem, { DailyTodoData } from '../components/DailyTodoItem';

type DailyTodo = DailyTodoData;

// Group todos by date string (YYYY-MM-DD)
function groupByDate(todos: DailyTodo[]): Map<string, DailyTodo[]> {
  const map = new Map<string, DailyTodo[]>();
  for (const todo of todos) {
    const key = todo.date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(todo);
  }
  return map;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDateHeader(dateStr: string): { day: string; weekday: string; monthYear: string; isToday: boolean; isPast: boolean } {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const isToday = toDateKey(d) === toDateKey(today);
  const isPast = d < today && !isToday;
  return {
    day: d.getDate().toString(),
    weekday: isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'long' }),
    monthYear: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    isToday,
    isPast
  };
}

const LOAD_DAYS = 14; // Load 2 weeks in each direction

const DailyTodos: React.FC = () => {
  const { showToast, data } = useStore();
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [carrying, setCarrying] = useState(false);
  const [newTodoTexts, setNewTodoTexts] = useState<Record<string, string>>({});
  const [newTodoIdeaIds, setNewTodoIdeaIds] = useState<Record<string, string>>({});
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const ideas = data.ideas || [];

  const todayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Date range state
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [rangeStart, setRangeStart] = useState(addDays(today, -LOAD_DAYS));
  const [rangeEnd, setRangeEnd] = useState(addDays(today, LOAD_DAYS));

  const fetchTodos = useCallback(async (from: Date, to: Date) => {
    try {
      const data = await apiClient.get(
        `/daily-todos?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      return data as DailyTodo[];
    } catch (err) {
      console.error('Failed to fetch daily todos:', err);
      return [];
    }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchTodos(rangeStart, rangeEnd);
      setTodos(data);
      setLoading(false);
      // Scroll to today after render
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      }, 100);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -- Infinite scroll: load more past days
  const loadPast = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const newStart = addDays(rangeStart, -LOAD_DAYS);
    const data = await fetchTodos(newStart, addDays(rangeStart, -1));
    setTodos(prev => [...data, ...prev]);
    setRangeStart(newStart);
    setLoadingMore(false);
  }, [rangeStart, loadingMore, fetchTodos]);

  // -- Infinite scroll: load more future days
  const loadFuture = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const newEnd = addDays(rangeEnd, LOAD_DAYS);
    const data = await fetchTodos(addDays(rangeEnd, 1), newEnd);
    setTodos(prev => [...prev, ...data]);
    setRangeEnd(newEnd);
    setLoadingMore(false);
  }, [rangeEnd, loadingMore, fetchTodos]);

  // Scroll handler for infinite scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop < 200) loadPast();
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) loadFuture();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loadPast, loadFuture]);

  // Generate date slots for the range
  const dateSlots: string[] = [];
  {
    let d = new Date(rangeStart);
    while (d <= rangeEnd) {
      dateSlots.push(toDateKey(d));
      d = addDays(d, 1);
    }
  }

  const grouped = groupByDate(todos);

  // --- CRUD ---
  const addTodo = async (dateKey: string) => {
    const text = (newTodoTexts[dateKey] || '').trim();
    if (!text) return;
    try {
      const ideaId = newTodoIdeaIds[dateKey] || null;
      const todo = await apiClient.post('/daily-todos', { text, date: dateKey, ideaId });
      setTodos(prev => [...prev, todo]);
      setNewTodoTexts(prev => ({ ...prev, [dateKey]: '' }));
      setNewTodoIdeaIds(prev => ({ ...prev, [dateKey]: '' }));
    } catch (err: any) {
      showToast(err.message || 'Failed to add todo', 'error');
    }
  };

  const toggleComplete = async (todo: DailyTodo) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${todo.id}`, {
        completed: !todo.completed
      });
      setTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
    } catch (err: any) {
      showToast(err.message || 'Failed to update', 'error');
    }
  };

  const toggleUrgent = async (todo: DailyTodo) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${todo.id}`, {
        isUrgent: !todo.isUrgent
      });
      setTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
    } catch (err: any) {
      showToast(err.message || 'Failed to update', 'error');
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await apiClient.delete(`/daily-todos/${id}`);
      setTodos(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  const saveEdit = async (id: string, text: string) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${id}`, { text });
      setTodos(prev => prev.map(t => t.id === id ? updated : t));
    } catch (err: any) {
      showToast(err.message || 'Failed to update', 'error');
    }
  };

  const carryForward = async () => {
    setCarrying(true);
    try {
      const result = await apiClient.post('/daily-todos/carry-forward', {});
      if (result.carried > 0) {
        showToast(`Carried forward ${result.carried} todo${result.carried > 1 ? 's' : ''} to today`, 'success');
        // Reload all todos
        const data = await fetchTodos(rangeStart, rangeEnd);
        setTodos(data);
      } else {
        showToast('Nothing to carry forward — all caught up! ✨', 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Carry forward failed', 'error');
    }
    setCarrying(false);
  };

  const toggleCollapse = (dateKey: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  const tagTodoToIdea = async (todoId: string, ideaId: string | null) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${todoId}`, { ideaId });
      setTodos(prev => prev.map(t => t.id === todoId ? updated : t));
    } catch (err: any) {
      showToast(err.message || 'Failed to tag todo', 'error');
    }
  };

  const scrollToToday = () => {
    todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="daily-todos-loading">
        <Loader2 className="daily-todos-spinner" />
        <p>Loading your daily todos...</p>
      </div>
    );
  }

  return (
    <div className="daily-todos-container">
      {/* Header */}
      <div className="daily-todos-header">
        <div className="daily-todos-title-row">
          <div className="daily-todos-title-group">
            <CalendarDays className="daily-todos-title-icon" />
            <h1>Daily To-Dos</h1>
          </div>
          <div className="daily-todos-actions">
            <button
              onClick={carryForward}
              disabled={carrying}
              className="daily-todos-carry-btn"
              title="Carry incomplete past todos to today"
            >
              {carrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
              <span className="daily-todos-btn-label">Carry Forward</span>
            </button>
            <button onClick={scrollToToday} className="daily-todos-today-btn">
              <Sparkles className="w-4 h-4" />
              <span className="daily-todos-btn-label">Today</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="daily-todos-scroll" ref={scrollRef}>
        {loadingMore && (
          <div className="daily-todos-load-indicator">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading more...
          </div>
        )}

        {dateSlots.map(dateKey => {
          const { day, weekday, monthYear, isToday, isPast } = formatDateHeader(dateKey);
          const dayTodos = grouped.get(dateKey) || [];
          const completedCount = dayTodos.filter(t => t.completed).length;
          const totalCount = dayTodos.length;
          const isCollapsed = collapsedDays.has(dateKey) && !isToday;

          return (
            <div
              key={dateKey}
              ref={isToday ? todayRef : undefined}
              className={`daily-todos-day ${isToday ? 'daily-todos-day--today' : ''} ${isPast ? 'daily-todos-day--past' : ''}`}
            >
              {/* Date header */}
              <div
                className="daily-todos-day-header"
                onClick={() => !isToday && toggleCollapse(dateKey)}
              >
                <div className="daily-todos-date-badge-wrapper">
                  <div className={`daily-todos-date-badge ${isToday ? 'daily-todos-date-badge--today' : ''}`}>
                    <span className="daily-todos-date-day">{day}</span>
                  </div>
                  <div className="daily-todos-date-text">
                    <span className={`daily-todos-weekday ${isToday ? 'daily-todos-weekday--today' : ''}`}>{weekday}</span>
                    <span className="daily-todos-month">{monthYear}</span>
                  </div>
                </div>
                <div className="daily-todos-day-meta">
                  {totalCount > 0 && (
                    <span className={`daily-todos-progress ${completedCount === totalCount ? 'daily-todos-progress--done' : ''}`}>
                      {completedCount}/{totalCount}
                    </span>
                  )}
                  {!isToday && (
                    isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Todo list */}
              {!isCollapsed && (
                <div className="daily-todos-list">
                  {dayTodos.map(todo => (
                    <DailyTodoItem
                      key={todo.id}
                      todo={todo}
                      ideas={ideas}
                      onToggleComplete={toggleComplete}
                      onToggleUrgent={toggleUrgent}
                      onDelete={deleteTodo}
                      onSaveEdit={saveEdit}
                      onTagIdea={tagTodoToIdea}
                    />
                  ))}

                  {/* Add new todo input */}
                  <div className="daily-todo-add">
                    <Plus className="w-4 h-4 daily-todo-add-icon" />
                    <input
                      ref={el => { inputRefs.current[dateKey] = el; }}
                      className="daily-todo-add-input"
                      placeholder="Add a to-do..."
                      value={newTodoTexts[dateKey] || ''}
                      onChange={e => setNewTodoTexts(prev => ({ ...prev, [dateKey]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addTodo(dateKey);
                      }}
                    />
                    {/* Idea selector for new todo */}
                    <select
                      className="text-[10px] font-bold text-gray-400 bg-transparent border border-gray-200 rounded-lg px-2 py-1 outline-none cursor-pointer hover:border-gray-300 transition-colors"
                      style={newTodoIdeaIds[dateKey] ? { color: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
                      value={newTodoIdeaIds[dateKey] || ''}
                      onChange={e => setNewTodoIdeaIds(prev => ({ ...prev, [dateKey]: e.target.value }))}
                    >
                      <option value="">No idea</option>
                      {ideas.map(idea => (
                        <option key={idea.id} value={idea.id}>{idea.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loadingMore && (
          <div className="daily-todos-load-indicator">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading more...
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyTodos;
