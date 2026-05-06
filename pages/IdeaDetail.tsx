
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { format, isToday, isTomorrow, isPast, addDays, parseISO, startOfDay, formatDistanceToNow } from 'date-fns';
import CallMinuteModal from '../components/CallMinuteModal';
import CallMinuteViewer from '../components/CallMinuteViewer';
import { Note, Idea, Contact, User, IdeaType, IdeaStatus } from '../types';
import {
  Trash2,
  Plus,
  MessageSquare,
  Edit3,
  Users,
  Building,
  Pin,
  Share2,
  MapPin,
  AtSign,
  ExternalLink,
  ListChecks,
  CheckCircle2,
  Circle,
  AlertCircle,
  Calendar,
  Clock,
  X,
  Check,
  RefreshCw,
  UserMinus,
  ClipboardList,
  Search,
  Save,
  Activity,
  StickyNote,
  LogOut,
  Layout,
  RotateCcw,
  CheckCheck,
  Brain,
  Mountain,
  SlidersHorizontal,
  Microscope,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Send,
  CalendarCheck,
  MoreHorizontal,
  FileText,
  Link2
} from 'lucide-react';
import NoteComposer from '../components/NoteComposer';
import NoteDetailModal from '../components/NoteDetailModal';
import { getInitials, getAvatarColor } from '../lib/utils';
import KanbanModal from '../components/KanbanModal';
import DailyTodoItem, { DailyTodoData } from '../components/DailyTodoItem';
import { MentionInput } from '../components/MentionInput';
import ContactModal from '../components/ContactModal';
import EntityModal from '../components/EntityModal';
import { TaskQuickAdd } from '../components/TaskQuickAdd';

import { getStagesForType } from '../lib/idea-utils';
import AICounselor from '../components/AICounselor';
import { apiClient } from '../lib/api/client';

const INTENT_CONFIG: Record<string, { icon: any, label: string, color: string }> = {
  follow_up: { icon: RotateCcw, label: 'Follow up', color: 'text-green-600' },
  acted_upon: { icon: CheckCheck, label: 'Acted upon', color: 'text-emerald-500' },
  reflection: { icon: Microscope, label: 'Reflection', color: 'text-gray-400' },
  memoir: { icon: Mountain, label: 'Memoir', color: 'text-amber-600' },
};

const IdeaDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    data, updateIdea, updateNote, togglePinNote, toggleHideNote,
    shareIdea, resendInvitation, uninviteCollaborator, deleteInvitation,
    showToast, confirm, deleteNote, deleteIdea, leaveIdea, addComment, deleteComment
  } = useStore();

  const idea = data.ideas.find(i => i.id === id);

  if (!idea) {
    return <div className="text-center py-20">Idea not found or you don't have access.</div>;
  }

  // Update document title dynamically based on idea
  React.useEffect(() => {
    if (idea?.title) {
      document.title = `${idea.title} | Idea-CRM`;
    }
    return () => {
      document.title = 'IdeaCRM Tracker';
    };
  }, [idea?.title]);

  const isOwner = idea.ownerId === data.currentUser?.id;
  const [isEditingIdea, setIsEditingIdea] = useState(false);
  const [editedIdea, setEditedIdea] = useState(idea);
  const [inviteEmail, setInviteEmail] = useState('');
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [activeIntentFilter, setActiveIntentFilter] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingCallMinute, setEditingCallMinute] = useState<Note | null>(null);
  const [viewingCallMinute, setViewingCallMinute] = useState<Note | null>(null);
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [isUrlUrgent, setIsUrlUrgent] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoText, setEditingTodoText] = useState('');
  const [editingTodoDueDate, setEditingTodoDueDate] = useState('');
  const [editingTodoAssigneeId, setEditingTodoAssigneeId] = useState('');
  const [draggedTodoIndex, setDraggedTodoIndex] = useState<number | null>(null);
  const [isKanbanOpen, setIsKanbanOpen] = useState(false);
  const [openIntentMenuId, setOpenIntentMenuId] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<'visible' | 'hidden' | 'all'>('visible');
  const [expandedCommentsNoteId, setExpandedCommentsNoteId] = useState<string | null>(null);
  const [selectedNoteForDetail, setSelectedNoteForDetail] = useState<Note | null>(null);
  const [commentBody, setCommentBody] = useState<Record<string, string>>({});
  const [expandedNoteActionsId, setExpandedNoteActionsId] = useState<string | null>(null);

  // --- Documents & Links ---
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);

  // --- Contact/Entity modal for mention clicks ---
  const [contactToEdit, setContactToEdit] = useState<any | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [entityToEdit, setEntityToEdit] = useState<any | null>(null);
  const [showEntityModal, setShowEntityModal] = useState(false);

  const findContactByName = (name: string) => {
    return data.contacts.find(c => {
      const full = (c.fullName || '').toLowerCase();
      const first = (c.firstName || '').toLowerCase();
      const last = (c.lastName || '').toLowerCase();
      return full === name.toLowerCase() || first === name.toLowerCase() || `${first} ${last}`.trim() === name.toLowerCase();
    });
  };

  const findEntityByName = (name: string) => {
    return data.entities?.find(e => e.name.toLowerCase() === name.toLowerCase());
  };

  const handleOpenContactByName = async (name: string) => {
    const existing = findContactByName(name);
    if (existing) {
      setContactToEdit(existing);
      setShowContactModal(true);
    }
  };

  const handleOpenEntityByName = async (name: string) => {
    const existing = findEntityByName(name);
    if (existing) {
      setEntityToEdit(existing);
      setShowEntityModal(true);
    }
  };

  // Fetch daily todos tagged to this idea
  const [linkedDailyTodos, setLinkedDailyTodos] = useState<any[]>([]);
  useEffect(() => {
    if (!idea?.id) return;
    const fetchLinked = async () => {
      try {
        const from = new Date();
        from.setDate(from.getDate() - 365);
        const to = new Date();
        to.setDate(to.getDate() + 365);
        const all = await apiClient.get(
          `/daily-todos?from=${from.toISOString()}&to=${to.toISOString()}`
        ) as any[];
        setLinkedDailyTodos(all.filter(t => t.ideaId === idea.id));
      } catch (err) {
        console.error('Failed to fetch linked daily todos:', err);
      }
    };
    fetchLinked();
  }, [idea?.id]);

  const toggleLinkedDailyTodo = async (todo: any) => {
    try {
      const updated = await apiClient.put(`/daily-todos/${todo.id}`, {
        completed: !todo.completed
      });
      setLinkedDailyTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
    } catch (err) {
      console.error('Failed to toggle daily todo:', err);
    }
  };

  const handleTodoDragStart = (idx: number) => {
    setDraggedTodoIndex(idx);
  };

  const handleTodoDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedTodoIndex === null || draggedTodoIndex === idx) return;

    const newTodos = [...(idea?.todos || [])];
    const draggedItem = newTodos[draggedTodoIndex];
    newTodos.splice(draggedTodoIndex, 1);
    newTodos.splice(idx, 0, draggedItem);

    if (idea) {
      updateIdea(idea.id, { todos: newTodos });
    }
    setDraggedTodoIndex(idx);
  };

  const handleTodoDragEnd = () => {
    setDraggedTodoIndex(null);
  };
  const [showComposer, setShowComposer] = useState(() => {
    const saved = localStorage.getItem('hideComposer');
    return saved !== 'true';
  });
  const [showAICounselor, setShowAICounselor] = useState(false);

  const toggleComposer = () => {
    const newVal = !showComposer;
    setShowComposer(newVal);
    localStorage.setItem('hideComposer', (!newVal).toString());
  };

  // Sync editedIdea when entering edit mode
  React.useEffect(() => {
    if (isEditingIdea) {
      setEditedIdea(idea);
    }
  }, [isEditingIdea, idea]);

  const owner = data.users.find(u => u.id === idea.ownerId);
  const collaborators = data.users.filter(u => idea.collaboratorIds?.includes(u.id) ?? false);
  const personalEntities = data.currentUser?.personalEntities || ['Personal'];

  const ideaNotes = useMemo(() => {
    return data.notes
      .filter(n => n.ideaId === id)
      .filter(n => !n.isPinned)
      .filter(n => {
        if (visibilityFilter === 'visible') return !n.isHidden;
        if (visibilityFilter === 'hidden') return n.isHidden;
        return true; // 'all'
      })
      .filter(n => n.body.toLowerCase().includes(noteSearchQuery.toLowerCase()))
      .filter(n => !activeCategoryFilter || n.categories?.includes(activeCategoryFilter))
      .filter(n => !activeIntentFilter || (n.intent || 'memoir') === activeIntentFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data.notes, id, noteSearchQuery, activeCategoryFilter, activeIntentFilter, visibilityFilter]);

  const pinnedNote = useMemo(() =>
    data.notes.find(n => n.ideaId === id && n.isPinned),
    [data.notes, id]
  );

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      await shareIdea(idea.id, inviteEmail.trim());
      const email = inviteEmail.trim();
      setInviteEmail('');
      showToast(`Invitation sent to ${email}`, 'success');
    } catch (err: any) {
      console.error('Failed to send invitation:', err);
      showToast(err.message || 'Failed to send invitation', 'error');
    }
  };

  const handleSaveIdea = () => {
    updateIdea(idea.id, editedIdea);
    setIsEditingIdea(false);
  };

  const handleAddTodo = async (text: string) => {
    if (!text.trim()) return;
    try {
      const newTodo = await apiClient.post('/daily-todos', {
        text: text.trim(),
        date: new Date().toISOString().split('T')[0],
        ideaId: idea.id,
        assigneeId: data.currentUser?.id || null,
        status: 'Not Started'
      });
      setLinkedDailyTodos(prev => [...prev, newTodo]);
    } catch (err: any) {
      console.error('Failed to add todo:', err);
    }
  };

  const toggleTodo = async (todoId: string) => {
    const todo = linkedDailyTodos.find(t => t.id === todoId);
    if (!todo) return;
    try {
      const updated = await apiClient.put(`/daily-todos/${todoId}`, {
        completed: !todo.completed,
        status: !todo.completed ? 'Done' : 'Working'
      });
      setLinkedDailyTodos(prev => prev.map(t => t.id === todoId ? updated : t));
    } catch (err) {
      console.error('Failed to toggle todo:', err);
    }
  };

  const toggleUrgent = async (todoId: string) => {
    const todo = linkedDailyTodos.find(t => t.id === todoId);
    if (!todo) return;
    try {
      const updated = await apiClient.put(`/daily-todos/${todoId}`, {
        isUrgent: !todo.isUrgent
      });
      setLinkedDailyTodos(prev => prev.map(t => t.id === todoId ? updated : t));
    } catch (err) {
      console.error('Failed to toggle urgent:', err);
    }
  };

  const deleteTodo = async (todoId: string) => {
    try {
      await apiClient.delete(`/daily-todos/${todoId}`);
      setLinkedDailyTodos(prev => prev.filter(t => t.id !== todoId));
    } catch (err) {
      console.error('Failed to delete todo:', err);
    }
  };

  const startEditingTodo = (todo: any) => {
    setEditingTodoId(todo.id);
    setEditingTodoText(todo.text);
    setEditingTodoDueDate(todo.dueDate || '');
    setEditingTodoAssigneeId(todo.assigneeId || '');
  };

  const handleSaveEditTodo = async (todoId: string) => {
    if (!editingTodoText.trim()) return;
    try {
      const updated = await apiClient.put(`/daily-todos/${todoId}`, {
        text: editingTodoText.trim(),
        dueDate: editingTodoDueDate || null,
        assigneeId: editingTodoAssigneeId || null
      });
      setLinkedDailyTodos(prev => prev.map(t => t.id === todoId ? updated : t));
    } catch (err) {
      console.error('Failed to save todo:', err);
    }
    setEditingTodoId(null);
  };

  const renderBodyWithLinks = (text: string, note: Note) => {
    const isHtml = /<[a-z][\s\S]*>/i.test(text);

    if (isHtml) {
      // Process HTML content with string replacements for mentions and links
      let html = text;

      // 1. Process Mentions - Replace with HTML links/spans
      const taggedContacts = data.contacts.filter(c => note.taggedContactIds?.includes(c.id));
      taggedContacts.forEach(contact => {
        const mentionText = `@${contact.fullName}`;
        const mentionHtml = `<a href="/contacts/${contact.id}" class="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-md font-bold hover:bg-violet-100 transition-colors border border-violet-100 inline-flex items-center gap-0.5 no-underline mx-0.5 align-baseline">@${contact.fullName}</a>`;
        html = html.split(mentionText).join(mentionHtml);
      });

      const taggedUsers = data.users.filter(u => note.taggedUserIds?.includes(u.id));
      taggedUsers.forEach(user => {
        const mentionText = `@${user.name}`;
        const mentionHtml = `<span class="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-bold border border-blue-100 inline-flex items-center gap-0.5 no-underline mx-0.5 align-baseline cursor-default" title="${user.name} (Idea-crm user)">@${user.name}</span>`;
        html = html.split(mentionText).join(mentionHtml);
      });

      // 1b. Entity mentions (#)
      const taggedEntitiesHtml = (data.entities || []).filter(e => note.taggedEntityIds?.includes(e.id));
      taggedEntitiesHtml.forEach(entity => {
        const mentionText = `#${entity.name}`;
        const mentionHtml = `<span class="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold border border-indigo-100 inline-flex items-center gap-0.5 no-underline mx-0.5 align-baseline cursor-default" title="${entity.name}">#${entity.name}</span>`;
        html = html.split(mentionText).join(mentionHtml);
      });

      // 2. Simple URL linkification in HTML (avoiding splitting existing tags)
      const urlRegex = /(?![^<]*>)(https?:\/\/[^\s]+)/g;
      html = html.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="hover:underline inline-flex items-center gap-1 font-sans" style="color: var(--primary)">${url}</a>`);

      // 3. Process dashes to bullets
      // Match lines starting with a dash (potentially after some HTML tags like <div> or <p>)
      const dashRegex = /(?:^|<div>|<p>|<br>)\s*-\s+([^<]+)/g;
      if (dashRegex.test(html)) {
        // Wrap blocks of dashes in <ul> if they aren't already
        html = html.replace(/((\s*-\s+[^<]+(?:<br>|<div>|<\/div>|<p>|<\/p>)?)+)/g, (match) => {
          const items = match.split(/[-]\s+/).filter(i => i.trim()).map(i => `<li>${i.trim()}</li>`).join('');
          return `<ul>${items}</ul>`;
        });
      }

      return <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: html }} />;
    }

    // Original plain text processing
    // 1. Process dashes in plain text
    const processedText = text.split('\n').map(line => {
      if (line.trim().startsWith('- ')) {
        return `• ${line.trim().slice(2)}`;
      }
      return line;
    }).join('\n');

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const taggedContacts = data.contacts.filter(c => note.taggedContactIds?.includes(c.id));
    const taggedUsers = data.users.filter(u => note.taggedUserIds?.includes(u.id));

    let parts: (string | React.ReactElement)[] = [processedText];

    // 1. URLs
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      const subParts = part.split(urlRegex);
      return subParts.map((sub, i) => {
        if (sub.match(urlRegex)) {
          return (
            <a key={`url-${i}`} href={sub} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1 font-sans" style={{ color: 'var(--primary)' }}>
              {sub} <ExternalLink className="w-3 h-3" />
            </a>
          );
        }
        return sub;
      });
    });

    // 2. Mentions
    taggedContacts.forEach(contact => {
      const mentionText = `@${contact.fullName}`;
      parts = parts.flatMap(part => {
        if (typeof part !== 'string') return part;
        if (!part.includes(mentionText)) return part;
        const regex = new RegExp(`(${mentionText})`, 'g');
        const subParts = part.split(regex);
        return subParts.map((sub, i) => {
          if (sub === mentionText) {
            return (
              <Link key={`mc-${contact.id}-${i}`} to={`/contacts/${contact.id}`} className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-md font-bold hover:bg-violet-100 transition-colors border border-violet-100 inline-flex items-center gap-0.5 no-underline mx-0.5 align-baseline">
                <AtSign className="w-2.5 h-2.5" />{contact.fullName}
              </Link>
            );
          }
          return sub;
        });
      });
    });

    taggedUsers.forEach(user => {
      const mentionText = `@${user.name}`;
      parts = parts.flatMap(part => {
        if (typeof part !== 'string') return part;
        if (!part.includes(mentionText)) return part;
        const regex = new RegExp(`(${mentionText})`, 'g');
        const subParts = part.split(regex);
        return subParts.map((sub, i) => {
          if (sub === mentionText) {
            return (
              <span
                key={`mu-${user.id}-${i}`}
                className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-bold border border-blue-100 inline-flex items-center gap-0.5 no-underline mx-0.5 align-baseline cursor-default"
                title={`${user.name} (Idea-crm user)`}
              >
                <AtSign className="w-2.5 h-2.5" />{user.name}
              </span>
            );
          }
          return sub;
        });
      });
    });

    // 3. Entity mentions (#)
    const taggedEntities = (data.entities || []).filter(e => note.taggedEntityIds?.includes(e.id));
    taggedEntities.forEach(entity => {
      const mentionText = `#${entity.name}`;
      parts = parts.flatMap(part => {
        if (typeof part !== 'string') return part;
        if (!part.includes(mentionText)) return part;
        const regex = new RegExp(`(${mentionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
        const subParts = part.split(regex);
        return subParts.map((sub, i) => {
          if (sub === mentionText) {
            return (
              <span
                key={`me-${entity.id}-${i}`}
                className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold border border-indigo-100 inline-flex items-center gap-0.5 no-underline mx-0.5 align-baseline cursor-default"
                title={entity.name}
              >
                #{entity.name}
              </span>
            );
          }
          return sub;
        });
      });
    });

    return parts;
  };

  const renderNote = (note: Note) => {
    if (editingNoteId === note.id) {
      return (
        <div key={note.id} className="mb-6">
          <NoteComposer
            editingNote={note}
            onComplete={() => setEditingNoteId(null)}
          />
        </div>
      );
    }

    const isStructured = note.body.startsWith('{') && note.body.includes('"template"');
    let structuredData: any = null;
    if (isStructured) {
      try {
        structuredData = JSON.parse(note.body);
      } catch (e) { }
    }

    const isPinned = note.isPinned;
    const author = data.users.find(u => u.id === note.createdById);

    const renderStructuredBody = (data: any) => {
      if (data.template === 'call-minute') {
        const typeColors: Record<string, string> = {
          'Insight': 'bg-blue-50 text-blue-700 border-blue-100',
          'Agreement': 'bg-emerald-50 text-emerald-700 border-emerald-100',
          'To do': 'bg-amber-50 text-amber-700 border-amber-100',
          'Decision': 'bg-purple-50 text-purple-700 border-purple-100',
          'Data Point': 'bg-[var(--primary-shadow)] text-[var(--primary)] border-[var(--primary)]/20',
          'Reference': 'bg-gray-50 text-gray-700 border-[var(--border)]'
        };

        const segments = data.segments || (data.data ? [data.data] : []);
        const displayedSegments = segments.slice(0, 5);
        const hasMore = segments.length > 5;

        return (
          <div className="space-y-1 font-sans py-2">
            {data.attendees && (
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 mb-4">
                <Users className="w-3 h-3" />
                Attendees: <span className="text-gray-500 font-bold">{data.attendees}</span>
              </div>
            )}

            <div className="space-y-0 border-l border-[var(--border)] ml-1.5 pl-4 flex flex-col">
              {segments.map((seg: any, i: number) => {
                const isLast = i === (displayedSegments.length - 1) && !hasMore;
                return (
                  <div key={i} className="flex items-center gap-3 h-8 relative group/seg">
                    {/* Tree Node Indicator */}
                    <div className="absolute -left-[19.5px] top-1/2 -translate-y-1/2 w-2.5 h-[1px] bg-gray-300"></div>
                    <div className="absolute -left-[21px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white border border-gray-300 shadow-sm z-10"></div>

                    <span className="w-20 px-1.5 py-0.5 text-[9px] uppercase rounded border bg-gray-50 text-gray-500 border-[var(--border)] shrink-0 text-center tracking-widest shadow-sm whitespace-nowrap">
                      {seg.type}
                    </span>
                    <p className="text-xs font-normal text-gray-500 truncate max-w-lg transition-colors group-hover/seg:text-gray-900">
                      {seg.topic || 'No topic specified'}
                    </p>
                  </div>
                );
              })}
              {hasMore && (
                <div className="flex items-center gap-3 h-8 relative group/seg opacity-60">
                  <div className="absolute -left-[19.5px] top-1/2 -translate-y-1/2 w-2.5 h-[1px] bg-gray-300"></div>
                  <div className="absolute -left-[20px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gray-50 border border-[var(--border)]"></div>
                  <p className="text-[10px] text-gray-400 font-medium italic translate-x-[76px]">
                    + {segments.length - 5} more items...
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 ml-1.5">
              <button
                onClick={() => setViewingCallMinute(note)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-[var(--border)] text-[10px] font-black uppercase tracking-widest transition-all shadow-sm group"
                style={{ color: 'var(--text-main)' }}
              >
                Read full note
                <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        );
      }
      return <p className="text-xs text-red-400 italic">Unsupported Template</p>;
    };

    const currentIntent = note.intent || 'memoir';
    const IntentIcon = INTENT_CONFIG[currentIntent]?.icon || Mountain;

    const isNoteExpanded = expandedNoteActionsId === note.id;

    return (
      <div
        key={note.id}
        onDoubleClick={() => setSelectedNoteForDetail(note)}
        className={`group relative p-6 mb-4 mx-6 rounded-[2rem] transition-all border cursor-default
        ${currentIntent === 'follow_up'
            ? 'shadow-md shadow-green-900/5'
            : isPinned
              ? 'shadow-sm'
              : 'shadow-sm border-dotted'
          }
        ${isPinned ? 'ring-2 ring-[var(--primary)]/20' : ''}
        ${note.isHidden ? 'opacity-50 grayscale' : ''}
        ${isNoteExpanded ? 'note-card--expanded' : ''}
      `}
        style={{
          backgroundColor: currentIntent === 'follow_up' ? 'var(--follow-up)' : isPinned ? 'var(--primary-shadow)' : 'var(--note-bg)',
          borderColor: currentIntent === 'follow_up' ? 'var(--follow-up-border)' : isPinned ? 'var(--primary)' : 'var(--note-border)'
        }}
      >
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-3 text-[13px] leading-none">
          <div className="relative" onDoubleClick={e => e.stopPropagation()}>
            <button
              onClick={() => setOpenIntentMenuId(openIntentMenuId === note.id ? null : note.id)}
              className={`p-1 rounded-md hover:bg-gray-100 transition-colors ${INTENT_CONFIG[currentIntent]?.color}`}
              title={`Intent: ${INTENT_CONFIG[currentIntent]?.label}`}
            >
              <IntentIcon className="w-3.5 h-3.5" />
            </button>
            {openIntentMenuId === note.id && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenIntentMenuId(null)} />
                <div className="absolute top-full left-0 mt-1 bg-white border border-[var(--border)] rounded-xl shadow-xl z-50 py-1.5 min-w-[140px] animate-in fade-in zoom-in-95 duration-100">
                  {Object.entries(INTENT_CONFIG).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => {
                        updateNote(note.id, { intent: key as any });
                        setOpenIntentMenuId(null);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-2 text-[11px] font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors uppercase tracking-tight"
                    >
                      <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
                      <span>{config.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <span className="text-blue-400 hover:underline cursor-default transition-colors" title={note.location || undefined}>
            {format(new Date(note.createdAt), "EEE, MMM d ''yy · h:mm a")}
          </span>
          <span className="text-blue-400">{note.createdBy}</span>

          <div className="ml-auto flex items-center gap-4" onDoubleClick={e => e.stopPropagation()}>
            {/* Mobile: overflow toggle */}
            {note.createdById === data.currentUser?.id && (
              <button
                className="note-card-overflow-btn"
                onClick={() => setExpandedNoteActionsId(isNoteExpanded ? null : note.id)}
                title="More actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )}

            {/* Categories — always visible */}
            {note.categories && note.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {note.categories.map(cat => (
                  <span key={cat} className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border" style={{ backgroundColor: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }}>
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Desktop: hover-revealed. Mobile: hidden until overflow tap */}
            <div className="note-card-actions-secondary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              {note.createdById === data.currentUser?.id && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (isStructured && structuredData?.template === 'call-minute') {
                        setEditingCallMinute(note);
                      } else {
                        setEditingNoteId(note.id);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-[var(--primary)]/10 text-gray-400 hover:text-[var(--primary)] transition-all"
                    title="Edit Note"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      confirm({
                        title: 'Delete Note',
                        message: 'Are you sure you want to permanently delete this insight? This action cannot be undone.',
                        confirmLabel: 'Delete Permanently',
                        type: 'danger',
                        onConfirm: () => deleteNote(note.id)
                      });
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                    title="Delete Note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Hide/Pin — Desktop: always. Mobile: behind overflow */}
            {note.createdById === data.currentUser?.id && (
              <div className="note-card-actions-secondary flex items-center gap-1">
                <button
                  onClick={() => toggleHideNote(note.id)}
                  className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${note.isHidden ? 'bg-gray-100 text-gray-700 border border-[var(--border)] shadow-sm' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
                  title={note.isHidden ? 'Unhide' : 'Hide from thread'}
                >
                  <EyeOff className={`w-4 h-4 ${note.isHidden ? 'text-gray-900' : ''}`} />
                </button>
                <button
                  onClick={() => togglePinNote(note.id)}
                  className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${isPinned ? 'bg-amber-50 text-amber-600 border border-amber-200 shadow-sm' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
                  title={isPinned ? 'Unpin' : 'Pin'}
                >
                  <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`text-sm ${currentIntent === 'follow_up' ? 'text-slate-950' : 'text-slate-800'} font-[450] leading-relaxed whitespace-pre-wrap font-sans px-10`}>
          {note.imageUrl && (
            <div className="mb-4 rounded-2xl overflow-hidden border border-[var(--border)] shadow-lg max-w-xl">
              <img src={note.imageUrl} alt="Attached" className="w-full h-auto" />
            </div>
          )}
          {isStructured && structuredData
            ? renderStructuredBody(structuredData)
            : <div>{renderBodyWithLinks(note.body, note)}</div>
          }
        </div>

        {/* Comments Section */}
        <div className="mt-8 pt-4 border-t border-[var(--border)] px-10" onDoubleClick={e => e.stopPropagation()}>
          <button
            onClick={() => setExpandedCommentsNoteId(expandedCommentsNoteId === note.id ? null : note.id)}
            className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest transition-colors group"
            style={{ color: 'var(--text-main)' }}
          >
            {expandedCommentsNoteId === note.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />}
            <MessageSquare className="w-3.5 h-3.5" />
            Comments ({note.comments?.length || 0})
          </button>

          {expandedCommentsNoteId === note.id && (
            <div className="mt-6 space-y-6 animate-in slide-in-from-top-2 duration-200">
              {note.comments?.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-[9px] font-bold text-gray-500">
                    {comment.authorName?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 group/comment relative">
                    <div className="bg-gray-50/50 rounded-2xl rounded-tl-none p-3 border border-[var(--border)]/50">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-900 uppercase tracking-wider">{comment.authorName}</span>
                          <span className="text-[8px] font-bold text-gray-400">{format(new Date(comment.createdAt), 'MMM d, p')}</span>
                        </div>
                        {(comment.authorId === data.currentUser?.id || idea?.ownerId === data.currentUser?.id || note.createdById === data.currentUser?.id) && (
                          <button
                            onClick={() => {
                              confirm({
                                title: 'Delete Comment',
                                message: 'Are you sure you want to delete this comment?',
                                confirmLabel: 'Delete',
                                type: 'danger',
                                onConfirm: () => deleteComment(comment.id)
                              });
                            }}
                            className="opacity-0 group-hover/comment:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[12px] text-gray-600 leading-relaxed font-medium">{comment.body}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: 'var(--primary-shadow)', color: 'var(--primary)' }}>
                  {data.currentUser?.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    disabled={!data.currentUser}
                    placeholder={data.currentUser ? "Write a comment..." : "Login to comment"}
                    className="w-full bg-white border border-[var(--border)] rounded-xl px-4 py-2 text-[12px] outline-none focus:ring-2 transition-all font-medium pr-10 shadow-sm"
                    style={{ ringColor: 'var(--primary)' }}
                    value={commentBody[note.id] || ''}
                    onChange={e => setCommentBody({ ...commentBody, [note.id]: e.target.value })}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && commentBody[note.id]?.trim()) {
                        const body = commentBody[note.id];
                        setCommentBody({ ...commentBody, [note.id]: '' });
                        await addComment(note.id, body);
                      }
                    }}
                  />
                  <button
                    disabled={!commentBody[note.id]?.trim()}
                    onClick={async () => {
                      const body = commentBody[note.id];
                      setCommentBody({ ...commentBody, [note.id]: '' });
                      await addComment(note.id, body);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 disabled:text-gray-300 transition-colors"
                    style={{ color: 'var(--primary)' }}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-20 transition-all bg-[var(--ui-bg)] min-h-screen">
      {/* Sticky Header - Peninsula Style */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[var(--border)] shadow-md rounded-b-[40px] max-w-[1600px] mx-auto w-full">
        <div className="max-w-[1600px] mx-auto px-8 pt-8 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-10">
            
            {/* Left Header: Identification + Description + Sub-projects */}
            <div className="min-w-0 flex flex-col gap-4">
              {/* Title and Identification */}
              <div className="flex flex-wrap items-center gap-3">
                {isEditingIdea ? (
                  <div className="space-y-3 w-full">
                    <div className="flex gap-2">
                      <select
                        className="text-[10px] font-bold uppercase bg-white border border-[var(--border)] rounded px-2 py-1 shadow-sm"
                        value={editedIdea.type}
                        onChange={e => setEditedIdea({ ...editedIdea, type: e.target.value })}
                      >
                        {(data.currentUser?.ideaConfigs || []).map(config => (
                          <option key={config.type} value={config.type}>{config.type}</option>
                        ))}
                      </select>
                      <select
                        className="text-[10px] font-bold uppercase bg-white border border-[var(--border)] rounded px-2 py-1 shadow-sm"
                        value={editedIdea.entity}
                        onChange={e => setEditedIdea({ ...editedIdea, entity: e.target.value })}
                      >
                        {personalEntities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
                      </select>
                    </div>
                    <input
                      className="text-3xl font-extrabold w-full outline-none border-b-2 bg-transparent border-[var(--primary)]"
                      value={editedIdea.title}
                      onChange={e => setEditedIdea({ ...editedIdea, title: e.target.value })}
                      placeholder="Idea Title"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-3xl font-extrabold text-gray-900 truncate tracking-tight">{idea.title}</h1>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight border bg-gray-50 text-gray-500 border-gray-200">
                        {idea.type}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight border bg-gray-50 text-gray-500 border-gray-200">
                        {idea.entity}
                      </span>
                      {owner && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight border bg-amber-50 text-amber-600 border-amber-200 flex items-center gap-1">
                          👑 {owner.name}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Description (Gray background) */}
              {isEditingIdea ? (
                <textarea
                  className="w-full text-sm text-gray-700 leading-relaxed font-normal bg-gray-50 p-4 rounded-xl outline-none border border-[var(--border)]"
                  value={editedIdea.oneLiner ?? ''}
                  onChange={e => setEditedIdea({ ...editedIdea, oneLiner: e.target.value })}
                  placeholder="Describe the mission..."
                />
              ) : idea.oneLiner && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 font-normal leading-relaxed shadow-sm flex gap-2">
                  <span>📝</span>
                  <span className="flex-1">{idea.oneLiner}</span>
                </div>
              )}

              {/* Sub-projects */}
              {(() => {
                const subProjects = data.ideas.filter(i => i.parentId === idea.id);
                return subProjects.length > 0 ? (
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Sub-projects</div>
                    <div className="flex flex-wrap gap-4">
                      {subProjects.map(sp => (
                        <Link key={sp.id} to={`/ideas/${sp.id}`} className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5">
                          • {sp.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Right Header: Status, Last Update, Collaborators */}
            <div className="flex flex-col gap-4">
              
              {/* Actions Box */}
              <div className="flex justify-end gap-2">
                {isOwner ? (
                  <>
                    <button
                      onClick={() => setIsEditingIdea(!isEditingIdea)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-all text-sm grayscale"
                      title={isEditingIdea ? 'Cancel' : 'Edit Project'}
                    >
                      {isEditingIdea ? '❌' : '✏️'}
                    </button>
                    {!isEditingIdea && (
                      <button
                        onClick={() => {
                          confirm({
                            title: 'Delete Idea',
                            message: `Permanently delete "${idea.title}"? This action cannot be undone.`,
                            confirmLabel: 'Delete',
                            type: 'danger',
                            onConfirm: async () => {
                              try {
                                await deleteIdea(idea.id);
                                showToast('Idea deleted', 'success');
                                navigate('/ideas');
                              } catch (err: any) {
                                showToast(err.message || 'Failed to delete idea', 'error');
                              }
                            }
                          });
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all text-sm grayscale hover:grayscale-0"
                        title="Delete Project"
                      >
                        🗑️
                      </button>
                    )}
                    {isEditingIdea && (
                      <button onClick={handleSaveIdea} className="px-3 py-1 bg-[var(--primary)] text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:brightness-110 transition-all">
                        💾 Save
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => {
                      confirm({
                        title: 'Leave Project',
                        message: `Stop collaborating on "${idea.title}"?`,
                        confirmLabel: 'Leave',
                        type: 'danger',
                        onConfirm: async () => {
                          try {
                            await leaveIdea(idea.id);
                            showToast('You have left the project', 'info');
                            navigate('/ideas');
                          } catch (err: any) {
                            showToast(err.message || 'Failed to leave project', 'error');
                          }
                        }
                      });
                    }}
                    className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 transition-all"
                  >
                    🚪 Leave
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <div className="text-sm text-gray-500 font-medium flex items-center gap-2">
                  <span>📅</span>
                  <span className="text-gray-400">Last update:</span> 
                  {(() => {
                    const ideaDate = new Date(idea.updatedAt).getTime();
                    const maxNoteDate = data.notes.filter(n => n.ideaId === idea.id).reduce((max, n) => Math.max(max, new Date(n.createdAt).getTime()), 0);
                    const maxTodoDate = linkedDailyTodos.reduce((max, t) => Math.max(max, new Date(t.updatedAt).getTime()), 0);
                    const lastUpdateTimestamp = Math.max(ideaDate, maxNoteDate, maxTodoDate);
                    return (
                      <>
                        <span>{format(new Date(lastUpdateTimestamp), 'd MMM yyyy')}</span>
                        <span className="text-[10px] text-gray-400">({formatDistanceToNow(new Date(lastUpdateTimestamp))} ago)</span>
                      </>
                    );
                  })()}
                </div>
                <div className="text-sm text-gray-500 font-medium flex items-center gap-2">
                  <span>📊</span>
                  <span className="text-gray-400">Current stage:</span>
                  <select
                    className="font-normal text-gray-800 bg-transparent outline-none cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded"
                    value={idea.status}
                    onChange={e => updateIdea(idea.id, { status: e.target.value } as any)}
                  >
                    {getStagesForType(idea.type, data.currentUser?.ideaConfigs || []).map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Collaborators Box */}
              <div className="border border-[var(--border)] rounded-2xl p-4 bg-white shadow-sm flex flex-col gap-3 mt-1">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  👥 Collaborators
                </div>
                <div className="flex flex-col gap-2">
                  {[owner, ...collaborators].filter(Boolean).map((c: any) => c && (
                    <div key={c.id} className="flex items-center justify-between text-sm text-gray-700 font-semibold">
                      <span>{c.name}</span>
                      <div className={`w-6 h-6 rounded-full ${getAvatarColor(c.id)} flex items-center justify-center text-white text-[9px] font-black shadow-sm`}>
                        {getInitials(c.name)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-10">
          {/* LEFT COLUMN: Task Calendar */}
          <div className="space-y-6">
            {/* Task Calendar — CENTERPIECE */}
            <section className="bg-white rounded-2xl border shadow-sm">
              <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-50">
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <span>✅</span> Checklist Calendar
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddingTodo(!isAddingTodo)}
                    className="text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-xl border group active:scale-95"
                    style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-shadow)', borderColor: 'var(--primary)' }}
                  >
                    ➕ Add Task
                  </button>
                  <button
                    onClick={() => setIsKanbanOpen(true)}
                    className="text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-xl border group active:scale-95"
                    style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-shadow)', borderColor: 'var(--primary)' }}
                  >
                    🗂️ Kanban
                  </button>
                </div>
              </div>

              {isAddingTodo && (
                <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-50">
                  <TaskQuickAdd 
                    onSubmit={async (text) => {
                      await handleAddTodo(text);
                      setIsAddingTodo(false);
                    }}
                    onCancel={() => setIsAddingTodo(false)}
                    autoFocus
                  />
                </div>
              )}

              <div className="px-4 py-6 space-y-6">
                {(() => {
                  const sorted = [...linkedDailyTodos]
                    .filter(t => (t.status || (t.completed ? 'Done' : 'Not Started')) !== 'Archived')
                    .sort((a, b) => {
                      const dateA = a.date || '9999-12-31';
                      const dateB = b.date || '9999-12-31';
                      if (dateA !== dateB) return dateA.localeCompare(dateB);
                      
                      const weights: Record<string, number> = { 'Working': 0, 'Not Started': 1, 'Done': 2 };
                      const sA = a.status || (a.completed ? 'Done' : 'Not Started');
                      const sB = b.status || (b.completed ? 'Done' : 'Not Started');
                      if (weights[sA] !== weights[sB]) return (weights[sA] ?? 1) - (weights[sB] ?? 1);
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    });

                  if (sorted.length === 0) {
                    return <p className="text-[10px] text-gray-400 italic text-center py-8">No tasks yet. Ready to start?</p>;
                  }

                  const groups: Record<string, typeof sorted> = {};
                  sorted.forEach(t => {
                    const d = t.date || 'No Date';
                    if (!groups[d]) groups[d] = [];
                    groups[d].push(t);
                  });

                  const sortedGroups = Object.entries(groups).sort((a, b) => {
                    if (a[0] === 'No Date') return 1;
                    if (b[0] === 'No Date') return -1;
                    return b[0].localeCompare(a[0]); // Most recent date first
                  });

                  return sortedGroups.map(([dateStr, todos]) => {
                    let displayDay = dateStr;
                    let displayDate = "";
                    let isTodayFlag = false;
                    
                    if (dateStr !== 'No Date') {
                      const d = parseISO(dateStr);
                      isTodayFlag = isToday(d);
                      
                      displayDay = format(d, 'EEE');
                      displayDate = format(d, 'MMM d');
                      
                      if (isTodayFlag) displayDate += ' (today)';
                    }

                    return (
                      <div key={dateStr} className="flex gap-4">
                        {/* Date Divider Column */}
                        <div className="w-24 shrink-0 flex flex-col pt-2 items-end text-right">
                           <span className={`text-sm font-black ${isTodayFlag ? 'text-[var(--primary)]' : 'text-gray-600'} capitalize tracking-tight`}>
                             {displayDay}
                           </span>
                           <span className={`text-xs font-bold ${isTodayFlag ? 'text-[var(--primary)]' : 'text-gray-400'} tracking-tight`}>
                             {displayDate}
                           </span>
                        </div>
                        
                        {/* Tasks Column */}
                        <div className="flex-1 space-y-1 border-l-2 border-gray-100 pl-4 pb-4">
                          {todos.map(todo => (
                            <DailyTodoItem
                              key={todo.id}
                              todo={todo as DailyTodoData}
                              ideas={data.ideas.map(i => ({ id: i.id, title: i.title }))}
                              onToggleComplete={async (t) => {
                                const updated = await apiClient.put(`/daily-todos/${t.id}`, { completed: !t.completed, status: !t.completed ? 'Done' : 'Working' });
                                setLinkedDailyTodos(prev => prev.map(x => x.id === t.id ? updated : x));
                              }}
                              onToggleUrgent={async (t) => {
                                const updated = await apiClient.put(`/daily-todos/${t.id}`, { isUrgent: !t.isUrgent });
                                setLinkedDailyTodos(prev => prev.map(x => x.id === t.id ? updated : x));
                              }}
                              onDelete={async (id) => {
                                await apiClient.delete(`/daily-todos/${id}`);
                                setLinkedDailyTodos(prev => prev.filter(x => x.id !== id));
                              }}
                              onSaveEdit={async (id, text) => {
                                const updated = await apiClient.put(`/daily-todos/${id}`, { text });
                                setLinkedDailyTodos(prev => prev.map(x => x.id === id ? updated : x));
                              }}
                              onTagIdea={async (todoId, ideaId) => {
                                const updated = await apiClient.put(`/daily-todos/${todoId}`, { ideaId });
                                setLinkedDailyTodos(prev => prev.map(x => x.id === todoId ? updated : x));
                              }}
                              onAddSubtask={async (parentId, text) => {
                                const subtask = await apiClient.post('/daily-todos', {
                                  text, date: new Date().toISOString().split('T')[0],
                                  ideaId: idea.id, parentId
                                });
                                setLinkedDailyTodos(prev => prev.map(t =>
                                  t.id === parentId ? { ...t, children: [...(t.children || []), subtask] } : t
                                ));
                              }}
                              onOpenContact={handleOpenContactByName}
                              onOpenEntity={handleOpenEntityByName}
                              onAssigneeChange={async (todoId, assigneeId) => {
                                const updated = await apiClient.put(`/daily-todos/${todoId}`, { assigneeId });
                                setLinkedDailyTodos(prev => prev.map(x => x.id === todoId ? updated : x));
                              }}
                              onChangeDate={async (id, dateKey) => {
                                const updated = await apiClient.put(`/daily-todos/${id}`, { date: dateKey });
                                setLinkedDailyTodos(prev => prev.map(x => x.id === id ? updated : x));
                              }}
                              onChangeTimeBlock={async (id, block) => {
                                const updated = await apiClient.put(`/daily-todos/${id}`, { timeBlock: block });
                                setLinkedDailyTodos(prev => prev.map(x => x.id === id ? updated : x));
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Documents + Activity Log */}
          <div className="space-y-6">
            
            {/* Documents & Links */}
            <section className="bg-white rounded-2xl border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <span>📁</span> Documents & Attachments
                </h2>
                <button
                  onClick={() => setShowAddLink(!showAddLink)}
                  className="text-[10px] font-black uppercase tracking-widest transition-all hover:underline"
                  style={{ color: 'var(--primary)' }}
                >
                  {showAddLink ? '❌ Cancel' : '➕ Add'}
                </button>
              </div>

              {showAddLink && (
                <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-[var(--border)] space-y-2">
                  <input
                    className="w-full text-xs border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:ring-2 bg-white"
                    style={{ ringColor: 'var(--primary)' }}
                    placeholder="Title (e.g. Business Plan Draft)"
                    value={newLinkTitle}
                    onChange={e => setNewLinkTitle(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <input
                      className="flex-1 text-xs border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:ring-2 bg-white"
                      style={{ ringColor: 'var(--primary)' }}
                      placeholder="https://docs.google.com/..."
                      value={newLinkUrl}
                      onChange={e => setNewLinkUrl(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        if (!newLinkUrl.trim()) return;
                        let title = newLinkTitle.trim();
                        let finalUrl = newLinkUrl.trim();
                        if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
                        if (!title) {
                          try {
                            title = new URL(finalUrl).hostname;
                          } catch {
                            title = finalUrl;
                          }
                        }
                        const currentLinks = idea.links || [];
                        updateIdea(idea.id, { links: [...currentLinks, { title, url: finalUrl }] } as any);
                        setNewLinkTitle('');
                        setNewLinkUrl('');
                        setShowAddLink(false);
                      }}
                      disabled={!newLinkUrl.trim()}
                      className="text-white p-2 rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-40"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      ➕
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {(idea.links || []).map((link: { title: string; url: string }, idx: number) => (
                  <div key={idx} className="group flex items-center gap-3 p-3 border border-[var(--border)] rounded-xl hover:border-[var(--primary)] transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--primary-shadow)' }}>
                      <span>🔗</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-gray-700 hover:underline truncate block">
                        {link.title}
                      </a>
                      <p className="text-[9px] text-gray-400 truncate">{link.url}</p>
                    </div>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-300 hover:text-[var(--primary)] transition-colors shrink-0">
                      ↗️
                    </a>
                    {isOwner && (
                      <button
                        onClick={() => {
                          const currentLinks = [...(idea.links || [])];
                          currentLinks.splice(idx, 1);
                          updateIdea(idea.id, { links: currentLinks } as any);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all shrink-0"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
                {(!idea.links || idea.links.length === 0) && !showAddLink && (
                  <p className="text-[10px] text-gray-400 italic text-center py-3">No documents linked yet.</p>
                )}
              </div>
            </section>

            {/* Activity Log */}
            <div className="bg-white rounded-[40px] border border-[var(--border)] shadow-sm overflow-hidden flex flex-col">
              {/* Working Area (Amber) */}
              {showComposer && (
                <div style={{ backgroundColor: 'var(--secondary)' }} className="border-b border-[var(--border)] animate-in fade-in transition-all">
                  <NoteComposer
                    defaultIdeaId={idea.id}
                    onComplete={() => setShowComposer(false)}
                    title="New Note"
                    titleIcon={<span className="text-base">📝</span>}
                    onCancel={toggleComposer}
                    flat
                  />
                </div>
              )}

              {/* History Area (White) */}
              <div className="bg-white flex flex-col min-h-[400px]">
                {/* Simplified Activity Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-10 pt-6 pb-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <span>⚡</span> Activity
                    </h2>
                    {!showComposer && (
                      <button
                        onClick={toggleComposer}
                        className="text-[10px] font-black uppercase tracking-widest transition-all hover:underline"
                        style={{ color: 'var(--primary)' }}
                      >
                        ( ➕ Add Note )
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowAICounselor(prev => !prev)}
                      className={`text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${showAICounselor ? 'border-[var(--primary)] text-white' : 'border-[var(--border)] text-gray-500 hover:bg-gray-50'}`}
                      style={showAICounselor ? { backgroundColor: 'var(--primary)' } : {}}
                    >
                      <span>✨</span> AI
                    </button>
                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className={`p-1.5 rounded-xl border transition-all ${isFilterOpen ? 'bg-gray-100 border-gray-200 text-gray-600' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                    >
                      <span>🔍</span>
                    </button>
                  </div>
                </div>

                {showAICounselor && (
                  <div className="mx-6 mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <AICounselor ideaId={idea.id} />
                  </div>
                )}

                {isFilterOpen && (
                  <div className="mx-10 mb-10 p-6 bg-white/50 rounded-[24px] border border-[var(--border)] animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm backdrop-blur-sm">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Search Field */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Search Keywords</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm">🔍</span>
                          <input
                            className="pl-11 pr-4 py-2.5 w-full bg-white border border-[var(--border)] rounded-xl text-xs outline-none focus:ring-2 transition-all"
                            style={{ ringColor: 'var(--primary)' }}
                            placeholder="Type to search..."
                            value={noteSearchQuery}
                            onChange={e => setNoteSearchQuery(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Tag Filter */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Filter by Tag</label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setActiveCategoryFilter(null)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${!activeCategoryFilter ? 'text-white' : 'bg-white border-[var(--border)] text-gray-400'}`}
                            style={!activeCategoryFilter ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
                          >
                            All Tags
                          </button>
                          {Array.from(new Set(data.notes.filter(n => n.ideaId === idea.id).flatMap(n => n.categories || []))).map(cat => (
                            <button
                              key={cat}
                              onClick={() => setActiveCategoryFilter(activeCategoryFilter === cat ? null : cat)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${activeCategoryFilter === cat ? 'text-white' : 'bg-white border-[var(--border)] text-gray-400'}`}
                              style={activeCategoryFilter === cat ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Intent Filter */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Filter by Intent</label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setActiveIntentFilter(null)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${!activeIntentFilter ? 'text-white' : 'bg-white border-[var(--border)] text-gray-400'}`}
                            style={!activeIntentFilter ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
                          >
                            All Intents
                          </button>
                          {Object.entries(INTENT_CONFIG).map(([key, config]) => (
                            <button
                              key={key}
                              onClick={() => setActiveIntentFilter(activeIntentFilter === key ? null : key)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${activeIntentFilter === key ? 'text-white' : 'bg-white border-[var(--border)] text-gray-500 hover:border-[var(--primary)]'}`}
                              style={activeIntentFilter === key ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
                            >
                              <config.icon className={`w-3 h-3 ${activeIntentFilter === key ? 'text-white' : config.color}`} />
                              {config.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Visibility Filter */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Visibility</label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setVisibilityFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${visibilityFilter === 'all' ? 'text-white' : 'bg-white border-[var(--border)] text-gray-500 hover:border-[var(--primary)]'}`}
                            style={visibilityFilter === 'all' ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
                          >
                            All
                          </button>
                          <button
                            onClick={() => setVisibilityFilter('visible')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${visibilityFilter === 'visible' ? 'text-white' : 'bg-white border-[var(--border)] text-gray-500 hover:border-[var(--primary)]'}`}
                            style={visibilityFilter === 'visible' ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
                          >
                            Visible
                          </button>
                          <button
                            onClick={() => setVisibilityFilter('hidden')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${visibilityFilter === 'hidden' ? 'text-white' : 'bg-white border-[var(--border)] text-gray-500 hover:border-[var(--primary)]'}`}
                            style={visibilityFilter === 'hidden' ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
                          >
                            <span>👁️‍🗨️</span>
                            Hidden
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4 pb-10">
                  {pinnedNote && renderNote(pinnedNote)}
                  {ideaNotes.map(renderNote)}
                  {ideaNotes.length === 0 && !pinnedNote && (
                    <div className="py-20 mx-10 text-center border-2 border-dashed border-[var(--border)] rounded-[28px]">
                      <p className="text-gray-400 font-bold text-sm tracking-tight italic">No activity logged yet. Share your first thought above.</p>
                    </div>
                  )}
                </div>
            </div>
          </div>
        </div>
        {/* End of grid */}

        <CallMinuteModal
          isOpen={!!editingCallMinute}
          onClose={() => setEditingCallMinute(null)}
          ideaId={idea.id}
          idea={idea}
          editingNote={editingCallMinute || undefined}
        />

        <KanbanModal
          isOpen={isKanbanOpen}
          onClose={() => setIsKanbanOpen(false)}
          idea={idea}
          users={data.users}
          notes={data.notes}
          onUpdateIdea={updateIdea}
        />

        <CallMinuteViewer
          isOpen={!!viewingCallMinute}
          onClose={() => setViewingCallMinute(null)}
          note={viewingCallMinute}
          idea={idea}
          contacts={data.contacts}
          users={data.users}
        />

        <NoteDetailModal
          isOpen={!!selectedNoteForDetail}
          onClose={() => setSelectedNoteForDetail(null)}
          note={selectedNoteForDetail}
          idea={idea}
          renderNoteBody={(n) => {
            const isStructured = n.body.startsWith('{') && n.body.includes('"template"');
            if (isStructured) {
              try {
                const structured = JSON.parse(n.body);
                if (structured.template === 'call-minute') {
                  return (
                    <div className="space-y-4">
                      {structured.attendees && (
                        <div className="text-sm font-bold text-gray-500">Attendees: {structured.attendees}</div>
                      )}
                      <div className="space-y-2">
                        {structured.segments?.map((seg: any, i: number) => (
                          <div key={i} className="flex gap-3">
                            <span className="text-[10px] font-black uppercase text-gray-400 w-20 shrink-0">{seg.type}</span>
                            <span className="text-sm">{seg.topic}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              } catch (e) { }
            }
            return renderBodyWithLinks(n.body, n);
          }}
        />

        {showContactModal && contactToEdit && (
          <ContactModal isOpen={showContactModal} contactToEdit={contactToEdit} onClose={() => { setShowContactModal(false); setContactToEdit(null); }} />
        )}
        {showEntityModal && entityToEdit && (
          <EntityModal isOpen={showEntityModal} entityToEdit={entityToEdit} onClose={() => { setShowEntityModal(false); setEntityToEdit(null); }} />
        )}
      </div>
      </div>
    </div>
  );
};

export default IdeaDetail;
