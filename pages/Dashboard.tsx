
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import { format, startOfWeek, addDays as dateAddDays, isSameDay, isToday, isBefore, startOfDay, startOfMonth, endOfMonth, getDay, addMonths, subMonths } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays, Calendar, Loader2, Plus, Send, Tag, ArrowDownToLine,
  ChevronLeft, ChevronRight, Flame, AlertTriangle, ChevronDown, ChevronUp,
  Lightbulb, Check, Circle, ClipboardList, Clock, ImagePlus, Trash2, GripVertical, RotateCw, X
} from 'lucide-react';
import { apiClient } from '../lib/api/client';
import DailyTodoItem, { DailyTodoData } from '../components/DailyTodoItem';
import IdeaPickerDropdown from '../components/IdeaPickerDropdown';
import TaskDetailModal from '../components/TaskDetailModal';
import ContactModal from '../components/ContactModal';
import EntityModal from '../components/EntityModal';
import { extractDelimitedMentions } from '../lib/taskMentions';
import { MentionInput } from '../components/MentionInput';

type DailyTodo = DailyTodoData;

function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TIME_BLOCKS = ['morning', 'afternoon', 'evening'] as const;
type TimeBlock = typeof TIME_BLOCKS[number];

const BLOCK_LABELS: Record<TimeBlock, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

const BLOCK_TIMES: Record<TimeBlock, string> = {
  morning: '6am – 12:59pm',
  afternoon: '1pm – 6:59pm',
  evening: '7pm onwards',
};

const BLOCK_SHORT: Record<TimeBlock, string> = {
  morning: 'AM',
  afternoon: 'PM',
  evening: 'EVE',
};

function getCurrentBlock(): TimeBlock {
  const h = new Date().getHours();
  if (h < 13) return 'morning';
  if (h < 19) return 'afternoon';
  return 'evening';
}

function sortTodos(todos: DailyTodo[]): DailyTodo[] {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

type ViewMode = 'day' | 'week';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, showToast, updateIdea, addContact, addEntity } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('ideaCrm_viewMode') as ViewMode) || 'day';
  });

  useEffect(() => {
    localStorage.setItem('ideaCrm_viewMode', viewMode);
  }, [viewMode]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [allTodos, setAllTodos] = useState<DailyTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [carrying, setCarrying] = useState(false);

  // Live clock
  const [clockTime, setClockTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Quick capture state
  const [newText, setNewText] = useState('');
  const [newIdeaId, setNewIdeaId] = useState('');
  const [newBlock, setNewBlock] = useState<TimeBlock>(getCurrentBlock());
  const [showTagPicker, setShowTagPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  // Inline add state — stores block name (day view) or date key (week view)
  const [inlineAddTarget, setInlineAddTarget] = useState<string | null>(null);

  // Week view drag state
  const [wvDragId, setWvDragId] = useState<string | null>(null);
  const [wvDragSourceDay, setWvDragSourceDay] = useState<string | null>(null);
  const [wvDragOverDay, setWvDragOverDay] = useState<string | null>(null);
  const [wvActionMenuId, setWvActionMenuId] = useState<string | null>(null);
  const [wvActionSubmenu, setWvActionSubmenu] = useState<'idea' | 'date' | 'time' | null>(null);
  const [contactToEdit, setContactToEdit] = useState<any>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const wvSubmenuTimer = useRef<number | null>(null);
  const openWvSubmenu = (menu: 'idea' | 'date' | 'time') => {
    if (wvSubmenuTimer.current) window.clearTimeout(wvSubmenuTimer.current);
    wvSubmenuTimer.current = window.setTimeout(() => setWvActionSubmenu(menu), 200);
  };
  const cancelWvSubmenuTimer = () => {
    if (wvSubmenuTimer.current) window.clearTimeout(wvSubmenuTimer.current);
  };
  const [wvCalMonth, setWvCalMonth] = useState(() => new Date());
  const [wvSubmenuSide, setWvSubmenuSide] = useState<'right' | 'left'>('right');
  const wvDropdownRef = useRef<HTMLDivElement>(null);
  const [wvSubtaskInputId, setWvSubtaskInputId] = useState<string | null>(null);
  const [wvSubtaskText, setWvSubtaskText] = useState('');
  const contacts = data.contacts || [];
  const entities = data.entities || [];

  // Insert a selected entity name into the text
  const handleOpenContactByName = async (name: string) => {
    const existing = findContactByName(name);
    if (existing) {
      setContactToEdit(existing);
      setShowContactModal(true);
      return;
    }
    const parts = name.trim().split(/\s+/);
    const created = await addContact({
      firstName: parts[0],
      lastName: parts.slice(1).join(' ') || undefined,
      fullName: name.trim()
    });
    setContactToEdit(created);
    setShowContactModal(true);
  };

  const [showEntityModal, setShowEntityModal] = useState(false);
  const [entityToEdit, setEntityToEdit] = useState<any>(null);

  const handleOpenEntityByName = async (name: string) => {
    const existing = entities.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setEntityToEdit(existing);
      setShowEntityModal(true);
      return;
    }
    const created = await addEntity({ name: name.trim() });
    setEntityToEdit(created);
    setShowEntityModal(true);
  };

  const insertEntityMention = (entity: { name: string }) => {
    setNewText(replaceActiveMention(newText, entityCursorPos, '#', entity.name));
    setEntityQuery(null);
    inputRef.current?.focus();
  };

  const insertNewEntityMention = () => {
    if (!entityQuery) return;
    setNewText(replaceActiveMention(newText, entityCursorPos, '#', entityQuery.trim()));
    setEntityQuery(null);
    inputRef.current?.focus();
  };

  // Detected @mentions in current text
  const detectedMentions = React.useMemo(() => {
    if (!newText.includes('@')) return [];
    const mentions: { name: string; isExisting: boolean }[] = [];
    extractDelimitedMentions(newText, '@').forEach(name => {
      const lower = name.toLowerCase();
      const isExisting = contacts.some(c => {
        const full = (c.fullName || '').toLowerCase();
        const first = (c.firstName || '').toLowerCase();
        const last = (c.lastName || '').toLowerCase();
        return full === lower || first === lower || `${first} ${last}`.trim() === lower;
      });
      mentions.push({ name, isExisting });
    });
    return mentions;
  }, [newText, contacts]);

  // Detected #entity mentions in current text
  const detectedEntityMentions = React.useMemo(() => {
    if (!newText.includes('#')) return [];
    const mentions: { name: string; isExisting: boolean }[] = [];
    extractDelimitedMentions(newText, '#').forEach(name => {
      const isExisting = entities.some(e => e.name.toLowerCase() === name.toLowerCase());
      mentions.push({ name, isExisting });
    });
    return mentions;
  }, [newText, entities]);

  // Backlog
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [backburnerOpen, setBackburnerOpen] = useState(false);

  // Idea tasks backlog
  const [ideaBacklogOpen, setIdeaBacklogOpen] = useState(false);

  // Task detail modal
  const [detailTodo, setDetailTodo] = useState<DailyTodo | null>(null);

  // Reminder gallery
  type ReminderImage = { id: string; imageData: string; caption: string | null; rotation: number; sortOrder: number };
  const [reminderImages, setReminderImages] = useState<ReminderImage[]>([]);
  const [previewContent, setPreviewContent] = useState<any | null>(null);
  const [showAddReminderLink, setShowAddReminderLink] = useState(false);
  const [newReminderLinkUrl, setNewReminderLinkUrl] = useState('');
  const [newReminderLinkTitle, setNewReminderLinkTitle] = useState('');

  const isMicrosoftFile = (fileType: string, fileName: string) => {
    const lowerType = fileType?.toLowerCase() || '';
    const lowerName = fileName?.toLowerCase() || '';
    return lowerType.includes('word') || lowerType.includes('excel') || lowerType.includes('spreadsheet') || lowerType.includes('presentation') || lowerType.includes('powerpoint') || lowerName.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/i);
  };

  const getIconForFile = (fileType: string, fileName: string) => {
    if (fileType === 'link') return '🔗';
    if (fileType?.includes('pdf')) return '📕';
    if (isMicrosoftFile(fileType, fileName)) return '📘';
    return '📄';
  };
  
  const getGoogleIframeUrl = (url: string) => {
    try {
      const u = new URL(url);
      if (u.hostname.includes('docs.google.com') || u.hostname.includes('drive.google.com')) {
        return url.replace(/\/(edit|view)(\?.*|#.*)?$/, '/preview');
      }
    } catch (e) {}
    return url;
  };
  const [galleryDragId, setGalleryDragId] = useState<string | null>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  const fetchReminderImages = useCallback(async () => {
    try {
      const imgs = await apiClient.get('/reminder-images');
      setReminderImages(imgs);
    } catch (err) { console.error('Failed to load reminder images', err); }
  }, []);

  useEffect(() => { fetchReminderImages(); }, []);

  // removed global click listener

  const uploadReminderImage = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      showToast('File size must be under 15MB', 'error');
      return;
    }
    
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const CHUNK_SIZE = 3 * 1024 * 1024;
      const numChunks = Math.ceil(base64.length / CHUNK_SIZE);

      if (numChunks === 1) {
        const img = await apiClient.post('/reminder-images', { 
          imageData: base64,
          fileType: file.type || 'application/octet-stream',
          fileName: file.name,
          fileSize: file.size
        });
        setReminderImages(prev => [...prev, img]);
      } else {
        const uploadId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        for (let i = 0; i < numChunks; i++) {
          const chunk = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await apiClient.post('/reminder-images/chunk', {
            uploadId,
            chunkIndex: i,
            content: chunk
          });
        }
        const img = await apiClient.post('/reminder-images/finalize', {
          uploadId,
          fileType: file.type || 'application/octet-stream',
          fileName: file.name,
          fileSize: file.size
        });
        setReminderImages(prev => [...prev, img]);
      }
      showToast('File added successfully', 'success');
    } catch (err) {
      showToast('Failed to upload file', 'error');
    }
  };

  const addReminderLink = async () => {
    if (!newReminderLinkUrl.trim()) return;
    try {
      const img = await apiClient.post('/reminder-images', { 
        imageData: newReminderLinkUrl,
        fileType: 'link',
        fileName: newReminderLinkTitle || 'Link'
      });
      setReminderImages(prev => [...prev, img]);
      setShowAddReminderLink(false);
      setNewReminderLinkUrl('');
      setNewReminderLinkTitle('');
      showToast('Link added successfully', 'success');
    } catch (err) {
      showToast('Failed to add link', 'error');
    }
  };

  const deleteReminderImage = async (id: string) => {
    try {
      await apiClient.delete(`/reminder-images/${id}`);
      setReminderImages(prev => prev.filter(i => i.id !== id));
      showToast('Image removed', 'success');
    } catch (err) { showToast('Failed to delete', 'error'); }
  };

  const reorderReminderImages = async (fromId: string, toId: string) => {
    const imgs = [...reminderImages];
    const fromIdx = imgs.findIndex(i => i.id === fromId);
    const toIdx = imgs.findIndex(i => i.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = imgs.splice(fromIdx, 1);
    imgs.splice(toIdx, 0, moved);
    setReminderImages(imgs);
    try {
      await apiClient.put('/reminder-images/reorder', { orderedIds: imgs.map(i => i.id) });
    } catch (err) { console.error('Failed to reorder', err); }
  };

  const updateReminderCaption = async (id: string, caption: string) => {
    try {
      await apiClient.put(`/reminder-images/${id}`, { caption });
      setReminderImages(prev => prev.map(i => i.id === id ? { ...i, caption } : i));
    } catch (err) { console.error('Failed to update caption', err); }
  };

  const rotateReminderImage = async (id: string) => {
    const img = reminderImages.find(i => i.id === id);
    if (!img) return;
    const newRotation = ((img.rotation || 0) + 90) % 360;
    setReminderImages(prev => prev.map(i => i.id === id ? { ...i, rotation: newRotation } : i));
    try {
      await apiClient.put(`/reminder-images/${id}`, { rotation: newRotation });
    } catch (err) { console.error('Failed to rotate', err); }
  };

  const ideas = data.ideas || [];

  // Full week (Mon-Sun) for week view
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => dateAddDays(weekStart, i));

  const selectedDateKey = toDateKey(selectedDate);

  // Fetch range that covers both views
  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      const rangeStart = dateAddDays(selectedDate, -90);
      const rangeEnd = dateAddDays(selectedDate, 14);
      const data = await apiClient.get(
        `/daily-todos?from=${rangeStart.toISOString()}&to=${rangeEnd.toISOString()}`
      );
      setAllTodos(data as DailyTodo[]);
    } catch (err) {
      console.error('Failed to fetch todos:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDateKey]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  useEffect(() => {
    document.title = 'Checklist | Idea-CRM';
    return () => { document.title = 'IdeaCRM Tracker'; };
  }, []);

  // Get todos for a specific date
  const todosForDate = (date: Date): DailyTodo[] => {
    const key = toDateKey(date);
    return allTodos.filter(t => t.date && t.date.slice(0, 10) === key);
  };

  // Get overdue (past incomplete) todos
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);
  const overdueTodos = allTodos.filter(t =>
    t.date && t.date.slice(0, 10) < todayKey && !t.completed
  );

  // Floating/Backburner tasks
  const backburnerTodos = allTodos.filter(t => !t.date && !t.completed);

  // --- CRUD ---
  const extractMentions = (text: string): string[] => {
    return extractDelimitedMentions(text, '@');
  };
  
  const extractEntityMentions = (text: string): string[] => {
    return extractDelimitedMentions(text, '#');
  };

  const findContactByName = (name: string) => {
    const lower = name.toLowerCase();
    return contacts.find(c => {
      const full = (c.fullName || '').toLowerCase();
      const first = (c.firstName || '').toLowerCase();
      const last = (c.lastName || '').toLowerCase();
      return full === lower || first === lower || `${first} ${last}`.trim() === lower;
    });
  };

  const autoCreateTaskLinks = (taskText: string) => {
    extractMentions(taskText).forEach(name => {
      const existing = findContactByName(name);
      if (!existing) {
        const parts = name.split(/\s+/);
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ') || undefined;
        addContact({ firstName, lastName, fullName: name })
          .then(() => showToast(`Contact "${name}" created automatically`, 'success'))
          .catch(err => console.error('Failed to auto-create contact:', err));
      }
    });

    extractEntityMentions(taskText).forEach(name => {
      const existing = entities.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (!existing) {
        addEntity({ name })
          .then(() => showToast(`Entity "${name}" created automatically`, 'success'))
          .catch(err => console.error('Failed to auto-create entity:', err));
      }
    });
  };

  const addTodo = async (dateKey?: string | null, block?: string) => {
    const text = newText.trim();
    if (!text || submittingRef.current) return;
    submittingRef.current = true;
    const targetDate = dateKey !== undefined ? dateKey : toDateKey(selectedDate);
    const selectedIdeaId = newIdeaId || null;

    try {
      const todo = await apiClient.post('/daily-todos', {
        text,
        date: targetDate,
        ideaId: selectedIdeaId,
        timeBlock: block || getCurrentBlock(),
      });
      setAllTodos(prev => [...prev, todo]);
      setNewText('');
      setNewIdeaId('');
      setShowTagPicker(false);
      autoCreateTaskLinks(text);
    } catch (err: any) {
      showToast(err.message || 'Failed to add todo', 'error');
    } finally {
      submittingRef.current = false;
    }
  };

  const inlineAddTodo = async (text: string, dateKey: string, block?: string) => {
    const trimmed = text.trim();
    if (!trimmed || submittingRef.current) return;
    submittingRef.current = true;

    try {
      const todo = await apiClient.post('/daily-todos', {
        text: trimmed,
        date: dateKey,
        timeBlock: block || getCurrentBlock(),
      });
      setAllTodos(prev => [...prev, todo]);
      autoCreateTaskLinks(trimmed);
    } catch (err: any) {
      showToast(err.message || 'Failed to add todo', 'error');
    } finally {
      submittingRef.current = false;
    }
  };

  const toggleComplete = async (todo: DailyTodo) => {
    // Optimistic update — flip the UI immediately
    const optimistic = { ...todo, completed: !todo.completed };
    setAllTodos(prev => prev
      .map(t => t.id === todo.id ? optimistic : t)
      .map(t => t.children ? { ...t, children: t.children.map(c => c.id === todo.id ? optimistic : c) } : t)
    );
    if (detailTodo?.id === todo.id) setDetailTodo(optimistic);
    try {
      const updated = await apiClient.put(`/daily-todos/${todo.id}`, { completed: !todo.completed });
      // Reconcile with server response
      setAllTodos(prev => prev
        .map(t => t.id === todo.id ? updated : t)
        .map(t => t.children ? { ...t, children: t.children.map(c => c.id === todo.id ? updated : c) } : t)
      );
      if (detailTodo?.id === todo.id) setDetailTodo(updated);
    } catch (err: any) {
      // Revert on failure
      setAllTodos(prev => prev
        .map(t => t.id === todo.id ? todo : t)
        .map(t => t.children ? { ...t, children: t.children.map(c => c.id === todo.id ? todo : c) } : t)
      );
      if (detailTodo?.id === todo.id) setDetailTodo(todo);
      showToast(err.message || 'Failed to update', 'error');
    }
  };

  const toggleUrgent = async (todo: DailyTodo) => {
    // Optimistic update — flip the UI immediately
    const optimistic = { ...todo, isUrgent: !todo.isUrgent };
    setAllTodos(prev => prev
      .map(t => t.id === todo.id ? optimistic : t)
      .map(t => t.children ? { ...t, children: t.children.map(c => c.id === todo.id ? optimistic : c) } : t)
    );
    if (detailTodo?.id === todo.id) setDetailTodo(optimistic);
    try {
      const updated = await apiClient.put(`/daily-todos/${todo.id}`, { isUrgent: !todo.isUrgent });
      setAllTodos(prev => prev
        .map(t => t.id === todo.id ? updated : t)
        .map(t => t.children ? { ...t, children: t.children.map(c => c.id === todo.id ? updated : c) } : t)
      );
      if (detailTodo?.id === todo.id) setDetailTodo(updated);
    } catch (err: any) {
      // Revert on failure
      setAllTodos(prev => prev
        .map(t => t.id === todo.id ? todo : t)
        .map(t => t.children ? { ...t, children: t.children.map(c => c.id === todo.id ? todo : c) } : t)
      );
      if (detailTodo?.id === todo.id) setDetailTodo(todo);
      showToast(err.message || 'Failed to update', 'error');
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await apiClient.delete(`/daily-todos/${id}`);
      setAllTodos(prev => prev
        .filter(t => t.id !== id)
        .map(t => t.children ? { ...t, children: t.children.filter(c => c.id !== id) } : t)
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  const duplicateTodo = async (id: string) => {
    try {
      await apiClient.post(`/daily-todos/${id}/duplicate`, {});
      await fetchTodos();
      showToast('Duplicated to next day', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to duplicate', 'error');
    }
  };

  const saveEdit = async (id: string, text: string) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${id}`, { text });
      setAllTodos(prev => prev
        .map(t => t.id === id ? updated : t)
        .map(t => t.children ? { ...t, children: t.children.map(c => c.id === id ? updated : c) } : t)
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update', 'error');
    }
  };

  const tagTodoToIdea = async (todoId: string, ideaId: string | null) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${todoId}`, { ideaId });
      setAllTodos(prev => prev
        .map(t => t.id === todoId ? updated : t)
        .map(t => t.children ? { ...t, children: t.children.map(c => c.id === todoId ? updated : c) } : t)
      );
      if (detailTodo?.id === todoId) setDetailTodo(updated);
    } catch (err: any) {
      showToast(err.message || 'Failed to tag todo', 'error');
    }
  };

  const addSubtask = async (parentId: string, text: string) => {
    const parent = allTodos.find(t => t.id === parentId);
    if (!parent) return;
    const dateKey = parent.date.slice(0, 10);
    try {
      const subtask = await apiClient.post('/daily-todos', {
        text, date: dateKey, parentId, ideaId: parent.ideaId || null,
      });
      setAllTodos(prev => prev.map(t =>
        t.id === parentId
          ? { ...t, children: [...(t.children || []), subtask] }
          : t
      ));
      autoCreateTaskLinks(text);
    } catch (err: any) {
      showToast(err.message || 'Failed to add subtask', 'error');
    }
  };

  const carryForward = async () => {
    setCarrying(true);
    try {
      const result = await apiClient.post('/daily-todos/carry-forward', {});
      if (result.carried > 0) {
        showToast(`Carried forward ${result.carried} todo${result.carried > 1 ? 's' : ''} to today`, 'success');
        await fetchTodos();
      } else {
        showToast('Nothing to carry forward — all caught up! ✨', 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Carry forward failed', 'error');
    }
    setCarrying(false);
  };

  // Generic update for the detail modal
  const updateTodo = async (id: string, updates: Record<string, any>) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${id}`, updates);
      setAllTodos(prev => prev
        .map(t => t.id === id ? updated : t)
        .map(t => t.children ? { ...t, children: t.children.map(c => c.id === id ? updated : c) } : t)
      );
      // Keep modal in sync
      if (detailTodo?.id === id) setDetailTodo(updated);
    } catch (err: any) {
      showToast(err.message || 'Failed to update', 'error');
    }
  };

  const openDetail = (todo: DailyTodo) => setDetailTodo(todo);
  const closeDetail = () => setDetailTodo(null);

  // Drag-and-drop between time blocks
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [dragOverBlock, setDragOverBlock] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, todoId: string) => {
    setDraggingTodoId(todoId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', todoId);
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggingTodoId(null);
    setDragOverBlock(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, block: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBlock(block);
  };

  const handleDragLeave = () => {
    setDragOverBlock(null);
  };

  const handleDrop = async (e: React.DragEvent, targetBlock: string) => {
    e.preventDefault();
    setDragOverBlock(null);
    const todoId = e.dataTransfer.getData('text/plain');
    if (!todoId) return;
    const todo = allTodos.find(t => t.id === todoId);
    if (!todo) return;
    const currentBlock = todo.timeBlock || 'morning';
    if (currentBlock === targetBlock) return;
    await updateTodo(todoId, { timeBlock: targetBlock });
    setDraggingTodoId(null);
  };

  const handleReorder = async (draggedId: string, droppedOnId: string) => {
    if (draggedId === droppedOnId) return;
    const sortedList = sortTodos(allTodos);
    const fromIdx = sortedList.findIndex(t => t.id === draggedId);
    const toIdx = sortedList.findIndex(t => t.id === droppedOnId);
    if (fromIdx === -1 || toIdx === -1) return;

    const dragged = sortedList[fromIdx];
    const droppedOn = sortedList[toIdx];
    let blockChanged = false;
    if (dragged.timeBlock !== droppedOn.timeBlock) {
      dragged.timeBlock = droppedOn.timeBlock;
      dragged.date = droppedOn.date;
      blockChanged = true;
    }

    const newList = [...sortedList];
    const [moved] = newList.splice(fromIdx, 1);
    newList.splice(toIdx, 0, moved);

    const orderedIds = newList.map(t => t.id);
    const updated = newList.map((t, i) => ({ ...t, sortOrder: i }));
    setAllTodos(updated);

    try {
      if (blockChanged) {
        await apiClient.put(`/daily-todos/${draggedId}`, { timeBlock: dragged.timeBlock, date: dragged.date });
      }
      await apiClient.put('/daily-todos/reorder', { orderedIds });
    } catch (err) {
      showToast('Failed to reorder', 'error');
    }
  };

  const handleReorderSubtask = async (draggedId: string, droppedOnId: string, parentId: string) => {
    if (draggedId === droppedOnId) return;
    setAllTodos(prev => {
      const newList = [...prev];
      const parentIdx = newList.findIndex(t => t.id === parentId);
      if (parentIdx === -1) return prev;
      
      const parent = { ...newList[parentIdx] };
      if (!parent.children) return prev;
      
      const children = [...parent.children].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      const fromIdx = children.findIndex(c => c.id === draggedId);
      const toIdx = children.findIndex(c => c.id === droppedOnId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      
      const [moved] = children.splice(fromIdx, 1);
      children.splice(toIdx, 0, moved);
      
      parent.children = children.map((c, i) => ({ ...c, sortOrder: i }));
      newList[parentIdx] = parent;
      
      apiClient.put('/daily-todos/reorder', { orderedIds: parent.children.map(c => c.id) }).catch(() => showToast('Failed to reorder subtasks', 'error'));
      
      return newList;
    });
  };

  // Navigate dates
  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setSelectedDate(d); };
  const goPrev = () => setSelectedDate(prev => dateAddDays(prev, viewMode === 'week' ? -7 : -1));
  const goNext = () => setSelectedDate(prev => dateAddDays(prev, viewMode === 'week' ? 7 : 1));

  // Idea tasks (pending across all ideas)
  const todayStr = toDateKey(today);
  const pendingIdeaTodos = (data.ideas || []).flatMap(idea =>
    (idea.todos || []).filter(t => {
      if (!t.completed) return true;
      if (t.completedAt && t.completedAt.slice(0, 10) === todayStr) return true;
      return false;
    }).map(t => ({ ...t, ideaId: idea.id, ideaTitle: idea.title }))
  );
  pendingIdeaTodos.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    return 0;
  });
  const pendingIdeaCount = pendingIdeaTodos.filter(t => !t.completed).length;

  if (loading) {
    return (
      <div className="cl-loading">
        <Loader2 className="cl-loading-spinner" />
        <p>Loading your checklist…</p>
      </div>
    );
  }

  const selectedDayTodos = sortTodos(todosForDate(selectedDate));
  const completedCount = selectedDayTodos.filter(t => t.completed).length;
  const totalCount = selectedDayTodos.length;
  const isSelectedToday = isToday(selectedDate);

  const weekTodos = allTodos.filter(t => t.date && weekDays.some(wd => toDateKey(wd) === String(t.date).slice(0, 10)) && t.status !== 'Archived');
  const weekCompletedCount = weekTodos.filter(t => t.completed).length;
  const weekTotalCount = weekTodos.length;

  const activeTotal = viewMode === 'day' ? totalCount : weekTotalCount;
  const activeCompleted = viewMode === 'day' ? completedCount : weekCompletedCount;

  return (
    <>
    <div className="cl-container">
      {wvActionMenuId && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          onMouseDown={() => { setWvActionMenuId(null); setWvActionSubmenu(null); }}
          onContextMenu={e => { e.preventDefault(); setWvActionMenuId(null); setWvActionSubmenu(null); }}
        />
      )}
      {/* Top bar */}
      <div className="cl-topbar">
        <div className="cl-topbar-left">
          <div className="cl-topbar-title">
            <CalendarDays className="cl-topbar-icon" />
            <h1>Checklist</h1>
          </div>

          {/* View toggle */}
          <div className="cl-view-toggle">
            <button
              className={`cl-view-btn ${viewMode === 'day' ? 'cl-view-btn--active' : ''}`}
              onClick={() => setViewMode('day')}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Day
            </button>
            <button
              className={`cl-view-btn ${viewMode === 'week' ? 'cl-view-btn--active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              <Calendar className="w-3.5 h-3.5" />
              Week
            </button>
          </div>
        </div>

        <div className="cl-topbar-right">
          {/* Dynamic Progress Bar */}
          {activeTotal > 0 && (
            <div className="cl-progress-bar-wrap" style={{ width: '90px', margin: '0 8px 0 0' }}>
              <div className="cl-progress-bar" style={{ height: '4px' }}>
                <div className="cl-progress-bar-fill" style={{ width: `${(activeCompleted / activeTotal) * 100}%` }} />
              </div>
              <span className="cl-progress-label" style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6b7280' }}>
                {activeCompleted} / {activeTotal}
              </span>
            </div>
          )}

          {/* Live clock */}
          <div className="cl-clock">
            <Clock className="w-3.5 h-3.5" />
            <span>{clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span className="cl-clock-tz">{Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace(/_/g, ' ')}</span>
          </div>

          {/* Date nav */}
          <div className="cl-date-nav">
            <button onClick={goPrev} className="cl-date-nav-btn"><ChevronLeft className="w-4 h-4" /></button>
            <span className="cl-date-nav-label">
              {viewMode === 'day'
                ? (isSelectedToday ? `Today — ${format(selectedDate, 'EEEE, do MMMM yyyy')}` : format(selectedDate, 'EEEE, do MMMM yyyy'))
                : `${format(weekDays[0], 'MMM d')} – ${format(weekDays[weekDays.length - 1], 'MMM d')}`
              }
            </span>
            <button onClick={goNext} className="cl-date-nav-btn"><ChevronRight className="w-4 h-4" /></button>
          </div>

          {!isSelectedToday && (
            <button onClick={goToday} className="cl-today-btn">Today</button>
          )}
        </div>
      </div>

      {/* ======= DAY VIEW — 3 columns ======= */}
      {viewMode === 'day' && (
        <div className="cl-day-scroll">
          <div className="cl-day-grid">
            {TIME_BLOCKS.map(block => {
              const blockTodos = sortTodos(selectedDayTodos.filter(t => (t.timeBlock || 'morning') === block));
              return (
                <div
                  key={block}
                  className={`cl-day-col ${dragOverBlock === block ? 'cl-day-col--dragover' : ''}`}
                  onDragOver={(e) => handleDragOver(e, block)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, block)}
                >
                  <div className="cl-day-col-header">
                    <div className="cl-day-col-header-text">
                      <span className={`cl-day-col-label cl-day-col-label--${block}`}>
                        <span className={`cl-block-dot cl-block-dot--${block}`}></span>
                        {BLOCK_LABELS[block]}
                      </span>
                      <span className="cl-day-col-time">{BLOCK_TIMES[block]}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => { setInlineAddTarget(inlineAddTarget === block ? null : block); setNewText(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '2px', borderRadius: '6px', lineHeight: 1, opacity: inlineAddTarget === block ? 1 : 0.5, transition: 'opacity 0.15s' }}
                        title="Add task"
                      >➕</button>
                      <span className="cl-day-col-count">{blockTodos.filter(t => !t.completed).length}</span>
                    </div>
                  </div>
                  {/* Inline add input */}
                  {inlineAddTarget === block && (
                    <div style={{ padding: '0 8px 8px', position: 'relative' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <MentionInput
                          ref={inputRef}
                          value={newText}
                          onChangeValue={setNewText}
                          onSubmit={async () => {
                            await inlineAddTodo(newText, toDateKey(selectedDate), block);
                            setNewText('');
                            setInlineAddTarget(null);
                          }}
                          onCancel={() => { setInlineAddTarget(null); setNewText(''); }}
                          placeholder="New task… (@ contact, # entity)"
                          style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.8rem', outline: 'none' }}
                          autoFocus
                        />
                        <button
                          onClick={async () => {
                            if (!newText.trim()) return;
                            await inlineAddTodo(newText, toDateKey(selectedDate), block);
                            setNewText('');
                            setInlineAddTarget(null);
                          }}
                          disabled={!newText.trim()}
                          title="Add task"
                          style={{
                            width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: newText.trim() ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            background: newText.trim() ? '#22c55e' : '#e5e7eb',
                            color: newText.trim() ? '#fff' : '#9ca3af',
                            transition: 'background 0.15s, color 0.15s',
                          }}
                        >
                          <Send className="w-3.5 h-3.5" style={{ marginLeft: '1px' }} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="cl-day-col-list">
                    {blockTodos.length === 0 && <div className="cl-day-col-empty">{draggingTodoId ? 'Drop here' : 'No tasks'}</div>}
                    {blockTodos.map(todo => (
                      <div
                        key={todo.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, todo.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={async (e) => {
                          e.preventDefault(); e.stopPropagation();
                          const draggedId = e.dataTransfer.getData('text/plain');
                          if (draggedId && draggedId !== todo.id) {
                            await handleReorder(draggedId, todo.id);
                          }
                        }}
                        className={draggingTodoId === todo.id ? 'cl-todo-dragging' : ''}
                      >
                        <DailyTodoItem todo={todo} ideas={ideas} onOpenContact={handleOpenContactByName} onOpenEntity={handleOpenEntityByName} onAssigneeChange={(id, assigneeId) => updateTodo(id, { assigneeId })} onDuplicate={duplicateTodo}
                          onToggleComplete={toggleComplete} onToggleUrgent={toggleUrgent}
                          onDelete={deleteTodo} onSaveEdit={saveEdit} onTagIdea={tagTodoToIdea}
                          onAddSubtask={addSubtask} onOpenDetail={openDetail}
                          onReorderSubtask={(draggedId, droppedOnId) => handleReorderSubtask(draggedId, droppedOnId, todo.id)}
                          onChangeDate={async (id, newDate) => {
                            try {
                              const updated = await apiClient.put(`/daily-todos/${id}`, { date: newDate });
                              setAllTodos(prev => prev.map(t => t.id === id ? updated : t));
                            } catch { showToast('Failed to reschedule', 'error'); }
                          }}
                          onChangeTimeBlock={async (id, block) => {
                            try {
                              const updated = await apiClient.put(`/daily-todos/${id}`, { timeBlock: block });
                              setAllTodos(prev => prev.map(t => t.id === id ? updated : t));
                            } catch { showToast('Failed to change time block', 'error'); }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {totalCount > 0 && completedCount === totalCount && overdueTodos.length === 0 && (
            <div className="cl-caught-up">✨ All caught up! Great work.</div>
          )}

          {/* Bottom 3-column: Idea Tasks | Overdue | Backburner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginTop: '1rem', alignItems: 'start' }}>
            {/* Pending tasks by idea */}
            <div style={{ background: '#fef9e7', borderRadius: '12px', padding: '10px', minHeight: '60px' }}>
              <button className="cl-backlog-toggle" onClick={() => setIdeaBacklogOpen(!ideaBacklogOpen)} style={{ background: 'transparent', marginBottom: ideaBacklogOpen ? '8px' : 0 }}>
                <span style={{ fontSize: '14px', marginRight: '4px' }}>📋</span><span style={{ fontSize: '0.75rem' }}>Pending tasks by idea</span>
                {pendingIdeaCount > 0 && <span className="cl-backlog-badge cl-backlog-badge--amber">{pendingIdeaCount}</span>}
                {ideaBacklogOpen ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
              </button>
              {ideaBacklogOpen && pendingIdeaTodos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(
                    pendingIdeaTodos.reduce((acc, todo) => {
                      if (!acc[todo.ideaId]) acc[todo.ideaId] = { title: todo.ideaTitle || 'Unknown Idea', todos: [] };
                      acc[todo.ideaId].todos.push(todo);
                      return acc;
                    }, {} as Record<string, { title: string, todos: typeof pendingIdeaTodos }>)
                  ).map(([ideaId, group]: [string, any]) => (
                    <div key={ideaId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px', marginTop: '4px' }}>
                        <Lightbulb className="w-3 h-3" /> {group.title}
                      </div>
                      {group.todos.map((todo: any) => (
                        <DailyTodoItem key={todo.id} todo={{ ...todo, idea: null } as any} ideas={ideas} onOpenContact={handleOpenContactByName} onOpenEntity={handleOpenEntityByName} onAssigneeChange={(id, assigneeId) => updateTodo(id, { assigneeId })} onDuplicate={duplicateTodo}
                          customContainerStyle={{ background: '#fef3c7', borderColor: '#fef3c7' }}
                          overrideDateLabel={todo.dueDate ? `Due ${todo.dueDate.slice(5, 10).replace('-', '/')}` : 'No due date'}
                          onToggleComplete={async () => {
                            if (todo.completed) return;
                            const idea = (data.ideas || []).find(i => i.id === todo.ideaId);
                            if (!idea) return;
                            const ut = idea.todos.map(t => t.id === todo.id ? { ...t, completed: true, completedAt: new Date().toISOString() } : t);
                            try { await updateIdea(todo.ideaId, { todos: ut }); } catch (err) {}
                          }}
                          onToggleUrgent={async () => {
                            const idea = (data.ideas || []).find(i => i.id === todo.ideaId);
                            if (!idea) return;
                            const ut = idea.todos.map(t => t.id === todo.id ? { ...t, isUrgent: !t.isUrgent } : t);
                            try { await updateIdea(todo.ideaId, { todos: ut }); } catch (err) {}
                          }}
                          onDelete={async (id) => {
                            const idea = (data.ideas || []).find(i => i.id === todo.ideaId);
                            if (!idea) return;
                            const ut = idea.todos.filter(t => t.id !== id);
                            try { await updateIdea(todo.ideaId, { todos: ut }); } catch (err) {}
                          }}
                          onSaveEdit={async (id, text) => {
                            const idea = (data.ideas || []).find(i => i.id === todo.ideaId);
                            if (!idea) return;
                            const ut = idea.todos.map(t => t.id === id ? { ...t, text } : t);
                            try { await updateIdea(todo.ideaId, { todos: ut }); } catch (err) {}
                          }}
                          onTagIdea={async () => {}} // Idea tasks are already tagged
                          onChangeDate={async (id, newDate) => {
                            // If an idea task gets a date, it should probably become a DailyTodo
                            // But for now, we'll just ignore it or we'd need to migrate it to daily-todos table
                            showToast('Idea tasks must be moved via drag and drop', 'info');
                          }}
                          onChangeTimeBlock={async () => { showToast('Idea tasks do not have time blocks', 'info'); }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {ideaBacklogOpen && pendingIdeaTodos.length === 0 && (
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>No pending tasks</div>
              )}
            </div>

            {/* Overdue */}
            <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '10px', minHeight: '60px' }}>
              <button className="cl-backlog-toggle" onClick={() => setBacklogOpen(!backlogOpen)} style={{ background: 'transparent', marginBottom: backlogOpen ? '8px' : 0 }}>
                <span style={{ fontSize: '14px', marginRight: '4px' }}>⚠️</span><span style={{ fontSize: '0.75rem' }}>Overdue</span>
                <span className="cl-backlog-badge">{overdueTodos.length}</span>
                {backlogOpen ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
              </button>
              {backlogOpen && overdueTodos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(
                    sortTodos(overdueTodos).reduce((acc, todo) => {
                      const d = todo.date || 'No Date';
                      if (!acc[d]) acc[d] = [];
                      acc[d].push(todo);
                      return acc;
                    }, {} as Record<string, DailyTodo[]>)
                  ).sort((a, b) => a[0].localeCompare(b[0])).map(([dateKey, todos]) => (
                    <div key={dateKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px', marginTop: '4px' }}>
                        {dateKey === 'No Date' ? dateKey : format(new Date(dateKey), 'EEE, MMM d')}
                      </div>
                      {todos.map(todo => (
                        <DailyTodoItem key={todo.id} todo={todo} ideas={ideas} onOpenContact={handleOpenContactByName} onOpenEntity={handleOpenEntityByName} onAssigneeChange={(id, assigneeId) => updateTodo(id, { assigneeId })} onDuplicate={duplicateTodo}
                          customContainerStyle={{ background: '#fee2e2', borderColor: '#fee2e2' }}
                          onToggleComplete={toggleComplete} onToggleUrgent={toggleUrgent}
                          onDelete={deleteTodo} onSaveEdit={saveEdit} onTagIdea={tagTodoToIdea}
                          onAddSubtask={addSubtask} onOpenDetail={openDetail}
                          onChangeDate={async (id, newDate) => {
                            try {
                              const updated = await apiClient.put(`/daily-todos/${id}`, { date: newDate });
                              setAllTodos(prev => prev.map(t => t.id === id ? updated : t));
                            } catch { showToast('Failed to reschedule', 'error'); }
                          }}
                          onChangeTimeBlock={async (id, block) => {
                            try {
                              const updated = await apiClient.put(`/daily-todos/${id}`, { timeBlock: block });
                              setAllTodos(prev => prev.map(t => t.id === id ? updated : t));
                            } catch { showToast('Failed to change time block', 'error'); }
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {backlogOpen && overdueTodos.length === 0 && (
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>Nothing overdue 🎉</div>
              )}
            </div>

            {/* Backburner */}
            <div style={{ background: '#f3f4f6', borderRadius: '12px', padding: '10px', minHeight: '60px' }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={async e => {
                e.preventDefault();
                const droppedId = e.dataTransfer.getData('text/plain');
                if (droppedId) {
                  try {
                    const updated = await apiClient.put(`/daily-todos/${droppedId}`, { date: null });
                    setAllTodos(prev => prev.map(t => t.id === droppedId ? updated : t));
                  } catch { /* silent */ }
                }
              }}
            >
              <button className="cl-backlog-toggle" onClick={() => setBackburnerOpen(!backburnerOpen)} style={{ background: 'transparent', color: '#6b7280', marginBottom: backburnerOpen ? '8px' : 0 }}>
                <span style={{ fontSize: '14px', marginRight: '4px' }}>🧊</span><span style={{ fontSize: '0.75rem' }}>Backburner</span>
                <span className="cl-backlog-badge" style={{ background: '#e5e7eb', color: '#374151' }}>{backburnerTodos.length}</span>
                {backburnerOpen ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
              </button>
              {backburnerOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {sortTodos(backburnerTodos).map(todo => (
                    <DailyTodoItem key={todo.id} todo={todo} ideas={ideas} onOpenContact={handleOpenContactByName} onOpenEntity={handleOpenEntityByName} onAssigneeChange={(id, assigneeId) => updateTodo(id, { assigneeId })} onDuplicate={duplicateTodo}
                      onToggleComplete={toggleComplete} onToggleUrgent={toggleUrgent}
                      onDelete={deleteTodo} onSaveEdit={saveEdit} onTagIdea={tagTodoToIdea}
                      onAddSubtask={addSubtask} onOpenDetail={openDetail}
                      onChangeDate={async (id, newDate) => {
                        try {
                          const updated = await apiClient.put(`/daily-todos/${id}`, { date: newDate });
                          setAllTodos(prev => prev.map(t => t.id === id ? updated : t));
                        } catch { showToast('Failed to reschedule', 'error'); }
                      }}
                      onChangeTimeBlock={async (id, block) => {
                        try {
                          const updated = await apiClient.put(`/daily-todos/${id}`, { timeBlock: block });
                          setAllTodos(prev => prev.map(t => t.id === id ? updated : t));
                        } catch { showToast('Failed to change time block', 'error'); }
                      }}
                    />
                  ))}
                  {backburnerTodos.length === 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>Drop tasks here</div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* ===== REMINDER GALLERY ===== */}
          <div className="cl-gallery-section">
            <div className="cl-gallery-header">
              <div className="cl-gallery-title">
                <span style={{ fontSize: '14px', marginRight: '4px' }}>🖼️</span>
                <span>Daily Reminders</span>
                <span className="cl-gallery-count">{reminderImages.length}</span>
              </div>
              <div className="flex gap-2">
                <button className="cl-gallery-upload-btn" onClick={() => setShowAddReminderLink(!showAddReminderLink)}>
                  <Plus className="w-3.5 h-3.5" />
                  Link
                </button>
                <button className="cl-gallery-upload-btn" onClick={() => galleryFileRef.current?.click()}>
                  <Plus className="w-3.5 h-3.5" />
                  File
                </button>
              </div>
              <input
                ref={galleryFileRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                multiple
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files) return;
                  for (let i = 0; i < files.length; i++) {
                    await uploadReminderImage(files[i]);
                  }
                  e.target.value = '';
                }}
              />
            </div>

            {showAddReminderLink && (
              <div className="mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2 animate-in slide-in-from-top-2">
                <input
                  type="text"
                  placeholder="Paste URL (e.g. Google Docs)..."
                  value={newReminderLinkUrl}
                  onChange={(e) => setNewReminderLinkUrl(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Title (optional)"
                    value={newReminderLinkTitle}
                    onChange={(e) => setNewReminderLinkTitle(e.target.value)}
                    className="flex-1 text-xs p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    onKeyDown={(e) => e.key === 'Enter' && addReminderLink()}
                  />
                  <button 
                    onClick={addReminderLink}
                    disabled={!newReminderLinkUrl.trim()}
                    className="px-4 py-1 text-xs font-bold text-white rounded-lg shadow-sm disabled:opacity-50 hover:opacity-90 active:scale-95 transition-all"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {reminderImages.length > 0 && (
              <div className="cl-gallery-layout">
                {/* Pinned (first) image — large */}
                <div className="cl-gallery-pinned">
                  <div
                    className="cl-gallery-card cl-gallery-card--pinned"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (galleryDragId && galleryDragId !== reminderImages[0].id) {
                        reorderReminderImages(galleryDragId, reminderImages[0].id);
                      }
                      setGalleryDragId(null);
                    }}
                  >
                    {(!reminderImages[0].fileType || reminderImages[0].fileType.startsWith('image/')) ? (
                      <img
                        src={reminderImages[0].imageData}
                        alt={reminderImages[0].caption || 'Reminder'}
                        className="cl-gallery-img cl-gallery-img--pinned"
                        style={{ transform: `rotate(${reminderImages[0].rotation || 0}deg)`, cursor: 'pointer' }}
                        onClick={() => setPreviewContent(reminderImages[0])}
                      />
                    ) : (
                      <div 
                        className="cl-gallery-img cl-gallery-img--pinned flex flex-col items-center justify-center bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => setPreviewContent(reminderImages[0])}
                        style={{ height: '300px', display: 'flex', width: '100%' }}
                      >
                        <div className="text-5xl mb-2">{getIconForFile(reminderImages[0].fileType || '', reminderImages[0].fileName || '')}</div>
                        <div className="text-sm font-bold text-gray-700 px-4 text-center truncate w-full">{reminderImages[0].fileName || 'Document'}</div>
                      </div>
                    )}
                    <div className="cl-gallery-card-footer">
                      <input
                        className="cl-gallery-caption"
                        placeholder="Add caption…"
                        value={reminderImages[0].caption || ''}
                        onChange={(e) => setReminderImages(prev => prev.map((i, idx) => idx === 0 ? { ...i, caption: e.target.value } : i))}
                        onBlur={(e) => updateReminderCaption(reminderImages[0].id, e.target.value)}
                      />
                      <button
                        className="cl-gallery-rotate"
                        onClick={() => rotateReminderImage(reminderImages[0].id)}
                        title="Rotate 90°"
                      >
                        <RotateCw className="w-3 h-3" />
                      </button>
                      <button
                        className="cl-gallery-delete"
                        onClick={() => {
                          if (window.confirm('Remove this image?')) deleteReminderImage(reminderImages[0].id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Thumbnails — rest of images */}
                {reminderImages.length > 1 && (
                  <div className="cl-gallery-thumbs">
                    {reminderImages.slice(1).map(img => (
                      <div
                        key={img.id}
                        className={`cl-gallery-card cl-gallery-card--thumb ${galleryDragId === img.id ? 'cl-gallery-card--dragging' : ''}`}
                        draggable
                        onDragStart={() => setGalleryDragId(img.id)}
                        onDragEnd={() => setGalleryDragId(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (galleryDragId && galleryDragId !== img.id) {
                            reorderReminderImages(galleryDragId, img.id);
                          }
                          setGalleryDragId(null);
                        }}
                      >
                        <div className="cl-gallery-card-grip">
                          <GripVertical className="w-3 h-3" />
                        </div>
                        {(!img.fileType || img.fileType.startsWith('image/')) ? (
                          <img
                            src={img.imageData}
                            alt={img.caption || 'Reminder'}
                            className="cl-gallery-img cl-gallery-img--clickable"
                            style={{ transform: `rotate(${img.rotation || 0}deg)` }}
                            onClick={() => reorderReminderImages(img.id, reminderImages[0].id)}
                          />
                        ) : (
                          <div 
                            className="cl-gallery-img cl-gallery-img--clickable flex flex-col items-center justify-center bg-gray-100 h-full"
                            onClick={() => reorderReminderImages(img.id, reminderImages[0].id)}
                            style={{ minHeight: '100px' }}
                          >
                            <div className="text-3xl mb-1">{getIconForFile(img.fileType || '', img.fileName || '')}</div>
                            <div className="text-[10px] font-bold text-gray-700 px-2 text-center truncate w-full">{img.fileName || 'Doc'}</div>
                          </div>
                        )}
                        <div className="cl-gallery-card-footer">
                          <input
                            className="cl-gallery-caption"
                            placeholder="Caption…"
                            value={img.caption || ''}
                            onChange={(e) => setReminderImages(prev => prev.map(i => i.id === img.id ? { ...i, caption: e.target.value } : i))}
                            onBlur={(e) => updateReminderCaption(img.id, e.target.value)}
                          />
                          <button
                            className="cl-gallery-delete"
                            onClick={() => {
                              if (window.confirm('Remove this image?')) deleteReminderImage(img.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======= WEEK VIEW — 3-day sliding ======= */}
      {viewMode === 'week' && (
        <div className="wv-container">
          <div className="wv-grid">
            {weekDays.map(day => {
              const dayKey = toDateKey(day);
              const dayTodos = sortTodos(todosForDate(day));
              const dayCompleted = dayTodos.filter(t => t.completed).length;
              const dayTotal = dayTodos.length;
              const dayIsToday = isToday(day);

              return (
                <div
                  key={dayKey}
                  className={`wv-day ${dayIsToday ? 'wv-day--today' : ''} ${wvDragOverDay === dayKey && wvDragId ? 'wv-day--drop-target' : ''}`}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setWvDragOverDay(dayKey); }}
                  onDragLeave={e => {
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as HTMLElement)) setWvDragOverDay(null);
                  }}
                  onDrop={async e => {
                    e.preventDefault();
                    const droppedId = e.dataTransfer.getData('text/plain');
                    if (droppedId && wvDragSourceDay !== dayKey) {
                      try {
                        const updated = await apiClient.put(`/daily-todos/${droppedId}`, { date: dayKey });
                        setAllTodos(prev => prev.map(t => t.id === droppedId ? updated : t));
                      } catch { /* silent */ }
                    }
                    setWvDragId(null); setWvDragSourceDay(null); setWvDragOverDay(null);
                  }}
                >
                  <div className="wv-day-header">
                    <span className={`wv-day-name ${dayIsToday ? 'wv-day-name--today' : ''}`}>
                      {dayIsToday ? 'Today' : format(day, 'EEE')}
                    </span>
                    <span className="wv-day-date">{format(day, 'd')}</span>
                    <button
                      onClick={() => { setInlineAddTarget(inlineAddTarget === `wk-${dayKey}` ? null : `wk-${dayKey}`); setNewText(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '2px', borderRadius: '6px', lineHeight: 1, opacity: inlineAddTarget === `wk-${dayKey}` ? 1 : 0.5, transition: 'opacity 0.15s', marginLeft: '2px' }}
                      title="Add task"
                    >➕</button>
                    {dayTotal > 0 && (
                      <span className={`wv-day-count ${dayCompleted === dayTotal ? 'wv-day-count--done' : ''}`}>
                        {dayCompleted}/{dayTotal}
                      </span>
                    )}
                  </div>
                  {inlineAddTarget === `wk-${dayKey}` && (
                    <div style={{ padding: '0 8px 6px', position: 'relative' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <MentionInput
                          ref={inputRef}
                          value={newText}
                          onChangeValue={setNewText}
                          onSubmit={async () => {
                            await inlineAddTodo(newText, dayKey);
                            setNewText('');
                            setInlineAddTarget(null);
                          }}
                          onCancel={() => { setInlineAddTarget(null); setNewText(''); }}
                          placeholder="New task… (@ contact, # entity)"
                          style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.78rem', outline: 'none' }}
                          autoFocus
                        />
                        <button
                          onClick={async () => {
                            if (!newText.trim()) return;
                            await inlineAddTodo(newText, dayKey);
                            setNewText('');
                            setInlineAddTarget(null);
                          }}
                          disabled={!newText.trim()}
                          title="Add task"
                          style={{
                            width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: newText.trim() ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            background: newText.trim() ? '#22c55e' : '#e5e7eb',
                            color: newText.trim() ? '#fff' : '#9ca3af',
                            transition: 'background 0.15s, color 0.15s',
                          }}
                        >
                          <Send className="w-3.5 h-3.5" style={{ marginLeft: '1px' }} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="wv-day-list">
                    {dayTodos.length === 0 && <div className="wv-empty">—</div>}
                    {dayTodos.map(todo => {
                      const blockTag = BLOCK_SHORT[(todo.timeBlock as TimeBlock) || 'morning'];
                      // Parse @mentions and #entities for hover cards
                      const mentionNames = extractMentions(todo.text);
                      const entityNames = extractEntityMentions(todo.text);
                      const matchedContacts = mentionNames.map(n => findContactByName(n)).filter(Boolean);
                      const matchedEntities = entityNames.map(n => entities.find(e => e.name.toLowerCase() === n.toLowerCase())).filter(Boolean);

                      return (
                        <div key={todo.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div
                            className={`wv-task ${todo.completed ? 'wv-task--done' : ''} ${todo.isUrgent ? 'wv-task--urgent' : ''}`}
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData('text/plain', todo.id);
                              e.dataTransfer.effectAllowed = 'move';
                              setWvDragId(todo.id); setWvDragSourceDay(dayKey);
                            }}
                            onDragEnd={() => { setWvDragId(null); setWvDragSourceDay(null); setWvDragOverDay(null); }}
                          >
                            <div className="wv-task-row-1">
                              <button
                                className={`wv-task-check ${todo.completed ? 'wv-task-check--done' : ''}`}
                                onClick={e => { e.stopPropagation(); toggleComplete(todo); }}
                              >
                                {todo.completed && <Check className="w-2.5 h-2.5" />}
                              </button>
                              <div className="wv-task-text-container" onClick={() => openDetail(todo)}>
                                <span className="wv-task-text" title={todo.text}>{todo.text}</span>
                              </div>
                              {(todo.children || []).length > 0 && (() => {
                                const children = todo.children || [];
                                const doneCount = children.filter(c => c.completed).length;
                                const allDone = doneCount === children.length;
                                return <span className={`wv-subtask-count ${allDone ? 'wv-subtask-count--done' : ''}`}>{doneCount}/{children.length}</span>;
                              })()}
                              {todo.isUrgent && <Flame className="w-3 h-3" style={{ color: '#ef4444', flexShrink: 0 }} />}
                            </div>

                            <div className="wv-task-row-2">
                              <span className={`wv-task-block wv-task-block--${(todo.timeBlock as TimeBlock) || 'morning'}`}>{blockTag}</span>
                              
                              {todo.ideaId && todo.idea?.title && (
                                <Link to={`/ideas/${todo.ideaId}`} className="wv-task-idea" onClick={e => e.stopPropagation()} title={todo.idea.title} style={{ margin: 0 }}>
                                  <Lightbulb className="w-2.5 h-2.5" />
                                  <span>
                                    {todo.idea.title}
                                  </span>
                                </Link>
                              )}

                              {/* Hover cards for contacts */}
                              {(matchedContacts.length > 0 || matchedEntities.length > 0) && (
                                <div className="wv-task-badges">
                                  {matchedContacts.map((c: any) => (
                                    <span key={c.id} className="wv-hover-anchor">
                                      <span 
                                        className="wv-badge wv-badge--contact"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setContactToEdit(c);
                                          setShowContactModal(true);
                                        }}
                                      >@</span>
                                      <div className="wv-hover-card">
                                        <strong>{c.fullName || `${c.firstName} ${c.lastName}`}</strong>
                                        {c.role && <span className="wv-hover-role">{c.role}</span>}
                                        {c.email && <span className="wv-hover-detail">{c.email}</span>}
                                        {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="wv-hover-link">LinkedIn →</a>}
                                      </div>
                                    </span>
                                  ))}
                                  {matchedEntities.map((ent: any) => (
                                    <span key={ent.id} className="wv-hover-anchor">
                                      <span 
                                        className="wv-badge wv-badge--entity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEntityToEdit(ent);
                                          setShowEntityModal(true);
                                        }}
                                      >#</span>
                                      <div className="wv-hover-card">
                                        <strong>{ent.name}</strong>
                                        {ent.type && <span className="wv-hover-role">{ent.type}</span>}
                                        {ent.description && <span className="wv-hover-detail">{ent.description.slice(0, 100)}</span>}
                                        {ent.website && <a href={ent.website} target="_blank" rel="noopener noreferrer" className="wv-hover-link">{ent.website.replace(/^https?:\/\//, '').slice(0, 30)}</a>}
                                      </div>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Chevron menu + Subtask */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginLeft: 'auto' }}>
                                <button
                                  className="wv-task-action-btn"
                                  onClick={e => { e.preventDefault(); e.stopPropagation(); setWvSubtaskInputId(wvSubtaskInputId === todo.id ? null : todo.id); }}
                                  onPointerDown={e => e.stopPropagation()}
                                  title="Add subtask"
                                  style={wvSubtaskInputId === todo.id ? { color: '#6366f1' } : {}}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <div style={{ position: 'relative' }} ref={wvActionMenuId === todo.id ? wvDropdownRef : undefined}>
                                  <button
                                    className="wv-task-action-btn"
                                    onClick={e => {
                                      e.preventDefault(); e.stopPropagation();
                                      if (wvActionMenuId === todo.id) {
                                        setWvActionMenuId(null); setWvActionSubmenu(null);
                                      } else {
                                        // Detect which side to open submenus
                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        const screenMid = window.innerWidth / 2;
                                        setWvSubmenuSide(rect.left < screenMid ? 'right' : 'left');
                                        setWvActionMenuId(todo.id);
                                        setWvActionSubmenu(null);
                                        setWvCalMonth(todo.date ? new Date(todo.date) : new Date());
                                      }
                                    }}
                                    onPointerDown={e => e.stopPropagation()}
                                  >
                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                  </button>
                                  {wvActionMenuId === todo.id && (
                                  <div className="wv-task-dropdown" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                                    <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); updateTodo(todo.id, { date: null }); setWvActionMenuId(null); }}>
                                      📥 Move to Backburner
                                    </button>
                                    <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); openDetail(todo); setWvActionMenuId(null); }}>
                                      ✏️ Edit task details
                                    </button>
                                    <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); duplicateTodo(todo.id); setWvActionMenuId(null); }}>
                                      📋 Duplicate to next day
                                    </button>
                                    <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); updateTodo(todo.id, { isUrgent: !todo.isUrgent }); setWvActionMenuId(null); }}>
                                      🔥 Toggle priority
                                    </button>
                                    <div className="wv-task-dropdown-has-sub" onMouseEnter={() => openWvSubmenu('idea')} onMouseLeave={cancelWvSubmenuTimer}>
                                      <button className="wv-task-dropdown-item" style={{ justifyContent: 'space-between' }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setWvActionSubmenu(wvActionSubmenu === 'idea' ? null : 'idea'); }}>
                                        <span>🏷️ Tag to idea</span>
                                        <span style={{ color: '#9ca3af', fontSize: '1rem' }}>›</span>
                                      </button>
                                      {wvActionSubmenu === 'idea' && (
                                        <div className={`wv-task-submenu wv-task-submenu--${wvSubmenuSide}`} onMouseDown={e => e.stopPropagation()}>
                                          <div style={{ padding: '4px 8px', fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Select idea</div>
                                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                            {[...ideas].filter(i => i.status !== 'Archived').sort((a, b) => a.title.localeCompare(b.title)).map(idea => (
                                              <button key={idea.id} className="wv-task-dropdown-item" onMouseDown={async (e) => { e.preventDefault(); e.stopPropagation(); await tagTodoToIdea(todo.id, idea.id); setWvActionMenuId(null); setWvActionSubmenu(null); }}>
                                                💡 {idea.title}
                                              </button>
                                            ))}
                                            {ideas.filter(i => i.status !== 'Archived').length === 0 && <div style={{ padding: '8px', fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center' }}>No ideas yet</div>}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    {todo.ideaId && (() => {
                                      const linkedIdea = ideas.find(i => i.id === todo.ideaId);
                                      const collabs = linkedIdea && (linkedIdea as any).collaboratorIds?.length > 0 
                                        ? data.users.filter(u => [(linkedIdea as any).ownerId, ...(linkedIdea as any).collaboratorIds].includes(u.id))
                                        : [];
                                      if (collabs.length === 0) return null;
                                      return (
                                        <div className="wv-task-dropdown-has-sub" onMouseEnter={() => openWvSubmenu('assignee')} onMouseLeave={cancelWvSubmenuTimer}>
                                          <button className="wv-task-dropdown-item" style={{ justifyContent: 'space-between' }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setWvActionSubmenu(wvActionSubmenu === 'assignee' ? null : 'assignee'); }}>
                                            <span>👤 Assign to collaborator</span>
                                            <span style={{ color: '#9ca3af', fontSize: '1rem' }}>›</span>
                                          </button>
                                          {wvActionSubmenu === 'assignee' && (
                                            <div className={`wv-task-submenu wv-task-submenu--${wvSubmenuSide}`} onMouseDown={e => e.stopPropagation()} style={{ minWidth: '180px', padding: '8px' }}>
                                              <div style={{ fontSize: '10px', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>Assign to</div>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <button 
                                                   onClick={() => { updateTodo(todo.id, { assigneeId: null }); setWvActionMenuId(null); setWvActionSubmenu(null); }}
                                                   style={{ textAlign: 'left', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', background: !todo.assigneeId ? '#f3f4f6' : 'transparent', border: 'none', cursor: 'pointer' }}
                                                >
                                                   Unassigned
                                                </button>
                                                {collabs.map(u => (
                                                  <button
                                                    key={u.id}
                                                    onClick={() => { updateTodo(todo.id, { assigneeId: u.id }); setWvActionMenuId(null); setWvActionSubmenu(null); }}
                                                    style={{ textAlign: 'left', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', background: todo.assigneeId === u.id ? '#f3f4f6' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                  >
                                                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: u.avatarColor || '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#fff', fontWeight: 800 }}>
                                                      {getInitials(u.name)}
                                                    </div>
                                                    {u.name}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                    <div className="wv-task-dropdown-has-sub" onMouseEnter={() => openWvSubmenu('date')} onMouseLeave={cancelWvSubmenuTimer}>
                                      <button className="wv-task-dropdown-item" style={{ justifyContent: 'space-between' }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setWvActionSubmenu(wvActionSubmenu === 'date' ? null : 'date'); setWvCalMonth(todo.date ? new Date(todo.date) : new Date()); }}>
                                        <span>📅 Move to different date</span>
                                        <span style={{ color: '#9ca3af', fontSize: '1rem' }}>›</span>
                                      </button>
                                      {wvActionSubmenu === 'date' && (() => {
                                        const monthStart = startOfMonth(wvCalMonth);
                                        const monthEnd = endOfMonth(wvCalMonth);
                                        const startDow = getDay(monthStart); // 0=Sun
                                        const daysInMonth = monthEnd.getDate();
                                        const calDays: (Date | null)[] = [];
                                        for (let i = 0; i < startDow; i++) calDays.push(null);
                                        for (let d = 1; d <= daysInMonth; d++) calDays.push(new Date(wvCalMonth.getFullYear(), wvCalMonth.getMonth(), d));
                                        const selectedDateKey = todo.date ? String(todo.date).slice(0, 10) : '';
                                        return (
                                          <div className={`wv-task-submenu wv-task-submenu--${wvSubmenuSide}`} onMouseDown={e => e.stopPropagation()} style={{ minWidth: '220px', padding: '8px' }}>
                                            <div className="wv-cal-header">
                                              <button className="wv-cal-nav" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setWvCalMonth(prev => subMonths(prev, 1)); }}><ChevronLeft className="w-3.5 h-3.5" /></button>
                                              <span className="wv-cal-title">{format(wvCalMonth, 'MMMM yyyy')}</span>
                                              <button className="wv-cal-nav" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setWvCalMonth(prev => addMonths(prev, 1)); }}><ChevronRight className="w-3.5 h-3.5" /></button>
                                            </div>
                                            <div className="wv-cal-weekdays">
                                              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <span key={d} className="wv-cal-wd">{d}</span>)}
                                            </div>
                                            <div className="wv-cal-grid">
                                              {calDays.map((cd, i) => {
                                                if (!cd) return <span key={`e-${i}`} className="wv-cal-cell wv-cal-cell--empty" />;
                                                const dk = toDateKey(cd);
                                                const isSelected = dk === selectedDateKey;
                                                const isTod = isToday(cd);
                                                return (
                                                  <button
                                                    key={dk}
                                                    className={`wv-cal-cell ${isSelected ? 'wv-cal-cell--selected' : ''} ${isTod ? 'wv-cal-cell--today' : ''}`}
                                                    onMouseDown={async (e) => {
                                                      e.preventDefault(); e.stopPropagation();
                                                      try {
                                                        const updated = await apiClient.put(`/daily-todos/${todo.id}`, { date: dk });
                                                        setAllTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
                                                      } catch { /* silent */ }
                                                      setWvActionMenuId(null);
                                                      setWvActionSubmenu(null);
                                                    }}
                                                  >
                                                    {cd.getDate()}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    <div className="wv-task-dropdown-has-sub" onMouseEnter={() => setWvActionSubmenu('time')}>
                                      <button className="wv-task-dropdown-item" style={{ justifyContent: 'space-between' }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setWvActionSubmenu(wvActionSubmenu === 'time' ? null : 'time'); }}>
                                        <span>⏰ Move to different time of day</span>
                                        <span style={{ color: '#9ca3af', fontSize: '1rem' }}>›</span>
                                      </button>
                                      {wvActionSubmenu === 'time' && (
                                        <div className={`wv-task-submenu wv-task-submenu--${wvSubmenuSide}`} onMouseDown={e => e.stopPropagation()} style={{ minWidth: '140px' }}>
                                          <button className={`wv-task-dropdown-item ${todo.timeBlock === 'morning' ? 'wv-task-dropdown-item--active' : ''}`} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); updateTodo(todo.id, { timeBlock: 'morning' }); setWvActionMenuId(null); setWvActionSubmenu(null); }}>
                                            🌅 Morning
                                          </button>
                                          <button className={`wv-task-dropdown-item ${todo.timeBlock === 'afternoon' ? 'wv-task-dropdown-item--active' : ''}`} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); updateTodo(todo.id, { timeBlock: 'afternoon' }); setWvActionMenuId(null); setWvActionSubmenu(null); }}>
                                            ☀️ Afternoon
                                          </button>
                                          <button className={`wv-task-dropdown-item ${todo.timeBlock === 'evening' ? 'wv-task-dropdown-item--active' : ''}`} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); updateTodo(todo.id, { timeBlock: 'evening' }); setWvActionMenuId(null); setWvActionSubmenu(null); }}>
                                            🌙 Evening
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <button className="wv-task-dropdown-item wv-task-dropdown-item--danger" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); deleteTodo(todo.id); setWvActionMenuId(null); }}>
                                      🗑️ Delete task
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            </div>
                          </div>

                          {/* Subtask tree — separate bubbles with connector lines */}
                          {(todo.children || []).length > 0 && (
                            <div className="wv-subtask-tree">
                              {(todo.children || []).map(child => (
                                <div key={child.id} className="wv-subtask-bubble-wrap">
                                  <div className={`wv-subtask-bubble ${child.completed ? 'wv-subtask-bubble--done' : ''}`}>
                                    <button
                                      className={`wv-task-check ${child.completed ? 'wv-task-check--done' : ''}`}
                                      onClick={e => { e.stopPropagation(); toggleComplete(child); }}
                                      style={{ width: '0.9rem', height: '0.9rem' }}
                                    >
                                      {child.completed && <Check className="w-2.5 h-2.5" />}
                                    </button>
                                    <span className="wv-task-text" style={{ cursor: 'pointer', flex: 1 }} title={child.text} onClick={() => openDetail(child)}>{child.text}</span>
                                    <button
                                      className="wv-task-action-btn"
                                      style={{ padding: '1px', opacity: 0.4 }}
                                      title="Detach as independent task"
                                      onClick={e => { e.stopPropagation(); updateTodo(child.id, { parentId: null }); }}
                                    >
                                      <ArrowDownToLine className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Subtask Input */}
                          {wvSubtaskInputId === todo.id && (
                            <div className="daily-todo-subtask-add" style={{ margin: '0 8px 4px 20px', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MentionInput
                                className="daily-todo-subtask-input"
                                placeholder="Add a subtask..."
                                value={wvSubtaskText}
                                onChangeValue={setWvSubtaskText}
                                onSubmit={() => {
                                  if (wvSubtaskText.trim()) {
                                    addSubtask(todo.id, wvSubtaskText.trim());
                                    setWvSubtaskText('');
                                    setWvSubtaskInputId(null);
                                  }
                                }}
                                onCancel={() => { setWvSubtaskInputId(null); setWvSubtaskText(''); }}
                                autoFocus
                                style={{ flex: 1 }}
                              />
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  if (wvSubtaskText.trim()) {
                                    addSubtask(todo.id, wvSubtaskText.trim());
                                    setWvSubtaskText('');
                                    setWvSubtaskInputId(null);
                                  }
                                }}
                                disabled={!wvSubtaskText.trim()}
                                style={{ background: 'none', border: 'none', cursor: wvSubtaskText.trim() ? 'pointer' : 'not-allowed', padding: '2px', color: wvSubtaskText.trim() ? '#4f46e5' : '#9ca3af', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setWvSubtaskInputId(null); setWvSubtaskText(''); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#ef4444', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>


        </div>
      )}
    </div>



    {/* Task Detail Modal */}
    {detailTodo && (
      <TaskDetailModal
        todo={detailTodo}
        ideas={ideas}
        onClose={closeDetail}
        onUpdate={updateTodo}
        onDelete={async (id) => { await deleteTodo(id); closeDetail(); }}
        onToggleComplete={async (t) => { await toggleComplete(t); }}
        onToggleUrgent={async (t) => { await toggleUrgent(t); }}
        onTagIdea={async (todoId, ideaId) => { await tagTodoToIdea(todoId, ideaId); }}
      />
    )}

    {/* Unified Modals */}
    <ContactModal
      isOpen={showContactModal}
      onClose={() => {
        setShowContactModal(false);
        setContactToEdit(null);
      }}
      contactToEdit={contactToEdit}
    />

    <EntityModal
      isOpen={showEntityModal}
      onClose={() => {
        setShowEntityModal(false);
        setEntityToEdit(null);
      }}
      entityToEdit={entityToEdit}
    />

      {/* Attachment Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-black text-gray-800 text-lg flex items-center gap-2">
                <span>📄</span> {previewContent.fileName || previewContent.caption || 'Preview'}
              </h3>
              <div className="flex items-center gap-3">
                {previewContent.fileType === 'link' ? (
                  <a 
                    href={previewContent.imageData} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    Open Original
                  </a>
                ) : (
                  <a 
                    href={previewContent.imageData} 
                    download={previewContent.fileName || 'reminder-image'}
                    className="text-sm font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    Download
                  </a>
                )}
                <button
                  onClick={() => setPreviewContent(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 bg-white rounded-lg shadow-sm border border-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 p-4 overflow-auto flex items-center justify-center">
              {(!previewContent.fileType || previewContent.fileType.startsWith('image/')) ? (
                <img src={previewContent.imageData} className="max-w-full max-h-full object-contain shadow-sm rounded-xl" style={{ transform: `rotate(${previewContent.rotation || 0}deg)` }} alt="Preview" />
              ) : previewContent.fileType === 'link' ? (
                <iframe src={getGoogleIframeUrl(previewContent.imageData)} className="w-full h-full rounded-xl shadow-sm bg-white" title="Document Preview" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
              ) : previewContent.fileType.includes('pdf') ? (
                <iframe src={previewContent.imageData} className="w-full h-full rounded-xl shadow-sm bg-white" title="Document Preview" />
              ) : isMicrosoftFile(previewContent.fileType, previewContent.fileName || '') ? (
                window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? (
                  <div className="flex flex-col items-center gap-4 text-gray-500 bg-white p-12 rounded-2xl shadow-sm">
                    <div className="text-6xl">🚧</div>
                    <h4 className="text-xl font-black text-gray-800">Localhost Detected</h4>
                    <p className="text-center max-w-sm text-sm leading-relaxed">
                      The Microsoft Office viewer requires a public URL to function. It cannot preview files while you are developing locally. Please download the file instead.
                    </p>
                    <a 
                      href={previewContent.imageData} 
                      download={previewContent.fileName}
                      className="mt-4 px-8 py-3 bg-[var(--primary)] text-white rounded-xl font-black shadow-md hover:scale-105 transition-transform"
                    >
                      Download File
                    </a>
                  </div>
                ) : (
                  <iframe 
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(`${window.location.origin}/api/reminder-images/${previewContent.id}/raw/${encodeURIComponent(previewContent.fileName || 'document.docx')}?token=${apiClient.getToken()}`)}`} 
                    className="w-full h-full rounded-xl shadow-sm bg-white" 
                    title="Microsoft Office Preview" 
                  />
                )
              ) : (
                <div className="flex flex-col items-center gap-4 text-gray-500 bg-white p-12 rounded-2xl shadow-sm">
                  <div className="text-6xl">📝</div>
                  <h4 className="text-xl font-black text-gray-800">Preview not available</h4>
                  <p className="text-center max-w-sm text-sm leading-relaxed">
                    Browser native preview is currently limited to PDFs and Images. For this file type, please download to view.
                  </p>
                  <a 
                    href={previewContent.imageData} 
                    download={previewContent.fileName}
                    className="mt-4 px-8 py-3 bg-[var(--primary)] text-white rounded-xl font-black shadow-md hover:scale-105 transition-transform"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
