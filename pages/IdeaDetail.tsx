
import React, { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { format } from 'date-fns';
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
  Eye,
  EyeOff
} from 'lucide-react';
import NoteComposer from '../components/NoteComposer';
import { getInitials, getAvatarColor } from '../lib/utils';
import KanbanModal from '../components/KanbanModal';

import { getStagesForType } from '../lib/idea-utils';

const INTENT_CONFIG: Record<string, { icon: any, label: string, color: string }> = {
  follow_up: { icon: RotateCcw, label: 'Follow up', color: 'text-red-500' },
  acted_upon: { icon: CheckCheck, label: 'Acted upon', color: 'text-emerald-500' },
  reflection: { icon: Brain, label: 'Reflection', color: 'text-gray-400' },
  memoir: { icon: Mountain, label: 'Memoir', color: 'text-yellow-600' },
};

const IdeaDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, updateIdea, updateNote, togglePinNote, toggleHideNote, shareIdea, resendInvitation, uninviteCollaborator, deleteInvitation, showToast, confirm, deleteNote, deleteIdea, leaveIdea } = useStore();
  const idea = data.ideas.find(i => i.id === id);


  if (!idea) {
    return <div className="text-center py-20">Idea not found or you don't have access.</div>;
  }

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
  const [todoInput, setTodoInput] = useState('');
  const [todoDueDate, setTodoDueDate] = useState('');
  const [todoAssigneeId, setTodoAssigneeId] = useState<string>('');
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

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoInput.trim()) return;
    const now = new Date().toISOString();
    const newTodo = {
      id: Math.random().toString(36).substr(2, 9),
      text: todoInput.trim(),
      completed: false,
      isUrgent: isUrlUrgent,
      date: now, // Deprecated
      createdAt: now,
      dueDate: todoDueDate || undefined,
      assigneeId: todoAssigneeId || data.currentUser?.id,
      status: 'Not Started'
    };
    updateIdea(idea.id, {
      todos: [...(idea.todos || []), newTodo]
    });
    setTodoInput('');
    setTodoDueDate('');
    setTodoAssigneeId('');
    setIsUrlUrgent(false);
    setIsAddingTodo(false);
  };

  const toggleTodo = (todoId: string) => {
    const updatedTodos = (idea.todos || []).map(t => {
      if (t.id === todoId) {
        const newCompleted = !t.completed;
        return {
          ...t,
          completed: newCompleted,
          completedAt: newCompleted ? new Date().toISOString() : undefined,
          status: newCompleted ? 'Done' : 'Working'
        };
      }
      return t;
    });
    updateIdea(idea.id, { todos: updatedTodos });
  };

  const toggleUrgent = (todoId: string) => {
    const updatedTodos = (idea.todos || []).map(t =>
      t.id === todoId ? { ...t, isUrgent: !t.isUrgent } : t
    );
    updateIdea(idea.id, { todos: updatedTodos });
  };

  const deleteTodo = (todoId: string) => {
    const updatedTodos = (idea.todos || []).filter(t => t.id !== todoId);
    updateIdea(idea.id, { todos: updatedTodos });
  };

  const startEditingTodo = (todo: any) => {
    setEditingTodoId(todo.id);
    setEditingTodoText(todo.text);
    setEditingTodoDueDate(todo.dueDate || '');
    setEditingTodoAssigneeId(todo.assigneeId || '');
  };

  const handleSaveEditTodo = (todoId: string) => {
    if (!editingTodoText.trim()) return;
    const updatedTodos = (idea.todos || []).map(t =>
      t.id === todoId ? {
        ...t,
        text: editingTodoText.trim(),
        dueDate: editingTodoDueDate || undefined,
        assigneeId: editingTodoAssigneeId || undefined
      } : t
    );
    updateIdea(idea.id, { todos: updatedTodos });
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

      // 2. Simple URL linkification in HTML (avoiding splitting existing tags)
      const urlRegex = /(?![^<]*>)(https?:\/\/[^\s]+)/g;
      html = html.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline inline-flex items-center gap-1 font-sans">${url}</a>`);

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
            <a key={`url-${i}`} href={sub} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-sans">
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
          'Data Point': 'bg-indigo-50 text-indigo-700 border-indigo-100',
          'Reference': 'bg-gray-50 text-gray-700 border-gray-100'
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

            <div className="space-y-0 border-l border-gray-100 ml-1.5 pl-4 flex flex-col">
              {segments.map((seg: any, i: number) => {
                const isLast = i === (displayedSegments.length - 1) && !hasMore;
                return (
                  <div key={i} className="flex items-center gap-3 h-8 relative group/seg">
                    {/* Tree Node Indicator */}
                    <div className="absolute -left-[19.5px] top-1/2 -translate-y-1/2 w-2.5 h-[1px] bg-gray-300"></div>
                    <div className="absolute -left-[21px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white border border-gray-300 shadow-sm z-10"></div>

                    <span className="w-20 px-1.5 py-0.5 text-[9px] uppercase rounded border bg-gray-50 text-gray-500 border-gray-200 shrink-0 text-center tracking-widest shadow-sm whitespace-nowrap">
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
                  <div className="absolute -left-[20px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gray-50 border border-gray-200"></div>
                  <p className="text-[10px] text-gray-400 font-medium italic translate-x-[76px]">
                    + {segments.length - 5} more items...
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 ml-1.5">
              <button
                onClick={() => setViewingCallMinute(note)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-100/50 text-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-sm group"
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

    return (
      <div key={note.id} className={`group relative p-8 mb-6 rounded-[2rem] transition-all border
        ${isPinned
          ? 'bg-indigo-50/40 border-indigo-100 shadow-sm'
          : currentIntent === 'follow_up'
            ? 'bg-[#FEFADA] border-yellow-200 shadow-md ring-1 ring-yellow-200/50'
            : 'bg-white border-gray-200 border-dotted shadow-sm'
        }
        ${note.isHidden ? 'opacity-50 grayscale' : ''}
      `}>
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-3 text-[13px] leading-none">
          <div className="relative">
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
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1.5 min-w-[140px] animate-in fade-in zoom-in-95 duration-100">
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

          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
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
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-all"
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

            {note.categories && note.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {note.categories.map(cat => (
                  <span key={cat} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-black uppercase tracking-tighter border border-indigo-200">
                    {cat}
                  </span>
                ))}
              </div>
            )}
            {note.createdById === data.currentUser?.id && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleHideNote(note.id)}
                  className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${note.isHidden ? 'bg-gray-100 text-gray-700 border border-gray-200 shadow-sm' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
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

        <div className={`text-[14.5px] ${currentIntent === 'follow_up' ? 'text-slate-950' : 'text-slate-800'} font-[450] leading-relaxed whitespace-pre-wrap font-sans px-10`}>
          {note.imageUrl && (
            <div className="mb-4 rounded-2xl overflow-hidden border border-gray-100 shadow-lg max-w-xl">
              <img src={note.imageUrl} alt="Attached" className="w-full h-auto" />
            </div>
          )}
          {isStructured && structuredData
            ? renderStructuredBody(structuredData)
            : <div>{renderBodyWithLinks(note.body, note)}</div>
          }
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in transition-all px-6">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md rounded-b-[32px] border-x border-b border-gray-100 shadow-md pt-5 pb-3 -mx-6 mb-10 px-12">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                {isEditingIdea ? (
                  <div className="flex gap-2">
                    <select
                      className="text-[10px] font-bold uppercase bg-white border border-gray-200 rounded px-2 py-1 outline-indigo-500 shadow-sm"
                      value={editedIdea.type}
                      onChange={e => setEditedIdea({ ...editedIdea, type: e.target.value })}
                    >
                      {(data.currentUser?.ideaConfigs || []).map(config => (
                        <option key={config.type} value={config.type}>{config.type}</option>
                      ))}
                    </select>
                    <select
                      className="text-[10px] font-bold uppercase bg-white border border-gray-200 rounded px-2 py-1 outline-indigo-500 shadow-sm"
                      value={editedIdea.entity}
                      onChange={e => setEditedIdea({ ...editedIdea, entity: e.target.value })}
                    >
                      {personalEntities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-tight border border-indigo-100 shadow-sm">
                      {idea.type}
                    </span>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-tight border border-indigo-100 shadow-sm">
                      {idea.entity}
                    </span>
                  </>
                )}
              </div>

              {!isEditingIdea && owner && (
                <div className="flex items-center gap-2 pl-3 border-l border-gray-100">
                  <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Owner</span>
                  <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-tight border border-amber-100 shadow-sm">
                    {owner.name}
                  </span>
                </div>
              )}
            </div>

            {isEditingIdea ? (
              <div className="space-y-3 mb-6">
                <input
                  className="text-3xl font-extrabold w-full outline-none border-b-2 border-indigo-500 bg-transparent"
                  value={editedIdea.title}
                  onChange={e => setEditedIdea({ ...editedIdea, title: e.target.value })}
                  placeholder="Idea Title"
                />
              </div>
            ) : (
              <h1 className="text-3xl font-extrabold text-gray-900 truncate tracking-tight mb-4">{idea.title}</h1>
            )}

            <div className="flex-col flex sm:flex-row items-center gap-4 mb-2">
              <div className="flex-1 flex items-center h-8 font-bold text-[10px] sm:text-[11px] tracking-tight rounded-lg border border-gray-100 shadow-sm w-full bg-slate-50/50 p-[1px]">
                {getStagesForType(idea.type, data.currentUser?.ideaConfigs || []).map((s, idx, arr) => {
                  const statusOrder = getStagesForType(idea.type, data.currentUser?.ideaConfigs || []);
                  const currentIdx = statusOrder.indexOf(idea.status as any);
                  const isPassed = currentIdx > idx;
                  const isCurrent = currentIdx === idx;
                  const isUntouched = currentIdx < idx;

                  return (
                    <div
                      key={s}
                      onClick={() => {
                        if (isOwner) {
                          updateIdea(idea.id, { status: s as any });
                          showToast(`Moved to ${s}`, 'success');
                        }
                      }}
                      className={`relative flex-1 flex items-center justify-center h-full transition-all cursor-pointer group/status border-r last:border-r-0 border-white/20 ${isCurrent
                        ? 'bg-indigo-100 text-indigo-700 z-20 shadow-sm rounded-md border border-indigo-200' :
                        isPassed
                          ? 'bg-indigo-50/30 text-indigo-400 z-10' :
                          'bg-transparent text-slate-300'
                        } hover:brightness-95`}
                      title={isOwner ? `Set status to ${s}` : undefined}
                    >
                      <span>{s}</span>
                      {!isPassed && isOwner && (
                        <div className="absolute inset-0 bg-emerald-50/0 group-hover/status:bg-emerald-50/50 transition-colors" />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => isOwner && updateIdea(idea.id, { status: 'On Hold' })}
                  className={`px-4 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${idea.status === 'On Hold'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-100'
                    : 'bg-white text-amber-500 border-amber-100 hover:bg-amber-50'
                    }`}
                >
                  On Hold
                </button>
                <button
                  onClick={() => isOwner && updateIdea(idea.id, { status: 'Dead' })}
                  className={`px-4 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${idea.status === 'Dead'
                    ? 'bg-red-500 text-white border-red-600 shadow-lg shadow-red-100'
                    : 'bg-white text-red-500 border-red-100 hover:bg-red-50'
                    }`}
                >
                  Dead
                </button>
              </div>
            </div>

          </div>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingIdea(!isEditingIdea)}
                  className={`p-1.5 rounded-lg transition-all flex items-center justify-center bg-transparent ${isEditingIdea
                    ? 'text-red-400 hover:bg-red-50'
                    : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100 active:scale-95'
                    }`}
                  title={isEditingIdea ? 'Cancel' : 'Edit Idea'}
                >
                  {isEditingIdea ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
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
                    className="p-1.5 rounded-lg transition-all flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 active:scale-95"
                    title="Delete Idea"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
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
                className="flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                Leave
              </button>
            )}
            {isEditingIdea && (
              <button
                onClick={handleSaveIdea}
                className="px-6 h-[46px] bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                <span>Save</span>
              </button>
            )}
          </div>
        </div>
      </div >

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        <div className="space-y-6 idea-thread">

          <div className="bg-white rounded-[32px] border border-gray-200 shadow-sm overflow-hidden">
            {showComposer && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-[#FEFADA]">
                <NoteComposer
                  defaultIdeaId={idea.id}
                  onComplete={() => setShowComposer(false)}
                  title="New Note"
                  titleIcon={<StickyNote className="w-4 h-4 text-indigo-500" />}
                  onCancel={toggleComposer}
                  flat
                />
              </div>
            )}

            <div className="p-10">
              <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-500" />
                      Activity
                    </h2>
                    {!showComposer && (
                      <button
                        onClick={toggleComposer}
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-all hover:underline"
                      >
                        ( + Add Note )
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setVisibilityFilter(v => v === 'visible' ? 'all' : 'visible')}
                    className={`p-2 rounded-xl transition-all ${visibilityFilter !== 'visible' ? 'bg-amber-100 text-amber-700 border border-amber-200 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    title={visibilityFilter === 'visible' ? "Reveal hidden notes" : "Mask hidden notes"}
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className={`p-2 rounded-xl transition-all ${isFilterOpen ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    title="Filters"
                  >
                    <SlidersHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {isFilterOpen && (
                <div className="mb-10 p-6 bg-gray-50/50 rounded-[24px] border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Search Field */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Search Keywords</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          className="pl-11 pr-4 py-2.5 w-full bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${!activeCategoryFilter ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                        >
                          All Tags
                        </button>
                        {Array.from(new Set(data.notes.filter(n => n.ideaId === idea.id).flatMap(n => n.categories || []))).map(cat => (
                          <button
                            key={cat}
                            onClick={() => setActiveCategoryFilter(activeCategoryFilter === cat ? null : cat)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${activeCategoryFilter === cat ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
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
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${!activeIntentFilter ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                        >
                          All Intents
                        </button>
                        {Object.entries(INTENT_CONFIG).map(([key, config]) => (
                          <button
                            key={key}
                            onClick={() => setActiveIntentFilter(activeIntentFilter === key ? null : key)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${activeIntentFilter === key ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
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
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${visibilityFilter === 'all' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setVisibilityFilter('visible')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${visibilityFilter === 'visible' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                        >
                          Visible
                        </button>
                        <button
                          onClick={() => setVisibilityFilter('hidden')}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${visibilityFilter === 'hidden' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                        >
                          <EyeOff className={`w-3 h-3 ${visibilityFilter === 'hidden' ? 'text-white' : 'text-gray-400'}`} />
                          Hidden
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {pinnedNote && renderNote(pinnedNote)}
                {ideaNotes.map(renderNote)}
                {ideaNotes.length === 0 && !pinnedNote && (
                  <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-[28px]">
                    <p className="text-gray-400 font-bold text-sm tracking-tight italic">No activity logged yet. Share your first thought above.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Program Brief Area */}
          <section className="bg-white rounded-2xl border p-6 shadow-sm">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-500" />
              Program Brief
            </h2>
            {isEditingIdea ? (
              <textarea
                className="w-full text-sm text-gray-700 leading-relaxed font-medium bg-gray-50 p-4 rounded-xl outline-indigo-500 min-h-[100px] resize-none border border-gray-100"
                value={editedIdea.oneLiner ?? ''}
                onChange={e => setEditedIdea({ ...editedIdea, oneLiner: e.target.value })}
                placeholder="Describe the mission..."
              />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed font-medium">
                {idea.oneLiner || <span className="text-gray-400 italic">No mission statement defined.</span>}
              </p>
            )}
          </section>

          {/* Checklist Area - Moved up */}
          <section className="bg-white rounded-2xl border p-6 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-indigo-500" />
                TO DOS
              </h2>
              <button
                onClick={() => setIsKanbanOpen(true)}
                className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition-all flex items-center gap-1.5 bg-indigo-50/50 px-3 py-1.5 rounded-xl border border-indigo-100/50 hover:bg-indigo-50 group active:scale-95"
              >
                <Layout className="w-3.5 h-3.5 transition-transform group-hover:rotate-12" />
                Kanban Board
              </button>
            </div>

            <div className="mb-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!todoInput.trim()) return;
                  handleAddTodo(e);
                }}
                className="flex gap-2"
              >
                <input
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  placeholder="What needs to be done? (+ Enter to add)"
                  value={todoInput}
                  onChange={e => setTodoInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!todoInput.trim()}
                  className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </form>
            </div>

            <div className="space-y-2 mb-6">
              {useMemo(() => {
                const weights = { 'Working': 0, 'Not Started': 1, 'Done': 2, 'Archived': 3 };
                return [...(idea.todos || [])]
                  .filter(t => t.status !== 'Archived')
                  .sort((a, b) => {
                    const statusA = a.status || (a.completed ? 'Done' : 'Not Started');
                    const statusB = b.status || (b.completed ? 'Done' : 'Not Started');

                    if (weights[statusA] !== weights[statusB]) {
                      return (weights[statusA] ?? 1) - (weights[statusB] ?? 1);
                    }
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  });
              }, [idea.todos]).map((todo, idx) => {
                const isUrgent = todo.isUrgent;
                const isDone = todo.completed;
                const assignee = data.users.find(u => u.id === todo.assigneeId);
                const isEditing = editingTodoId === todo.id;

                if (isEditing) {
                  return (
                    <div key={todo.id} className="bg-gray-50 p-4 rounded-xl space-y-3 border border-indigo-100">
                      <input
                        type="text"
                        autoFocus
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                        value={editingTodoText}
                        onChange={e => setEditingTodoText(e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                          <input
                            type="date"
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] outline-none focus:ring-2 focus:ring-indigo-500"
                            value={editingTodoDueDate}
                            onChange={e => setEditingTodoDueDate(e.target.value)}
                          />
                        </div>
                        <div className="relative">
                          <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                          <select
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                            value={editingTodoAssigneeId}
                            onChange={e => setEditingTodoAssigneeId(e.target.value)}
                          >
                            <option value="">Assign to...</option>
                            <option value={owner?.id}>{owner?.name} (Owner)</option>
                            {collaborators.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingTodoId(null)}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-gray-200 text-gray-400 hover:bg-white transition-all flex items-center justify-center gap-1"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEditTodo(todo.id)}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-600 text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Save
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={todo.id}
                    draggable
                    onDragStart={() => handleTodoDragStart(idx)}
                    onDragOver={(e) => handleTodoDragOver(e, idx)}
                    onDragEnd={handleTodoDragEnd}
                    className={`group relative transition-all ${draggedTodoIndex === idx ? 'opacity-30 scale-95' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleTodo(todo.id)}
                        className={`mt-0.5 transition-colors ${isDone ? 'text-green-500' : isUrgent ? 'text-red-500' : 'text-gray-300 hover:text-indigo-400'}`}
                      >
                        {isDone ? <CheckCircle2 className="w-5 h-5" /> : isUrgent ? <AlertCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-[13px] leading-snug break-words flex-1 cursor-pointer transition-colors ${isDone
                              ? 'text-gray-300 line-through font-normal'
                              : todo.status === 'Working'
                                ? 'text-gray-900 font-medium'
                                : 'text-gray-600 font-normal'
                              }`}
                            onClick={() => startEditingTodo(todo)}
                          >
                            {todo.text}
                          </p>
                          {assignee && (
                            <div
                              className={`w-7 h-7 rounded-lg ${getAvatarColor(assignee.id)} flex items-center justify-center text-[11px] text-white font-black shrink-0 shadow-md premium-tooltip premium-tooltip-right ring-1 ring-white/20`}
                              data-tooltip={assignee.name}
                            >
                              {getInitials(assignee.name)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {todo.dueDate && (
                            <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-tight ${isDone ? 'text-gray-200' : 'text-orange-500'}`}>
                              <Calendar className="w-2.5 h-2.5" />
                              Due {format(new Date(todo.dueDate), 'MMM d')}
                            </div>
                          )
                          }
                          <div className="flex items-center gap-2">
                            {isUrgent && (
                              <button
                                onClick={() => toggleUrgent(todo.id)}
                                className="text-[8px] font-black uppercase px-2 py-0.5 rounded transition-all bg-red-50 text-red-600 border border-red-100"
                              >
                                Urgent
                              </button>
                            )}
                            {isDone && todo.completedAt && (
                              <span className="text-[8px] text-gray-300 font-bold uppercase tracking-tighter ml-auto">
                                Completed {format(new Date(todo.completedAt), 'MMM d, h:mm a')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {(idea.todos || []).length === 0 && (
                <p className="text-[10px] text-gray-400 italic text-center py-4">No tasks yet. Ready to start?</p>
              )}
            </div>
          </section>

          {/* Collaborators Panel */}
          <section className="bg-white rounded-2xl border p-6 shadow-sm">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-indigo-500" />
              Collaborators
            </h2>

            <div className="space-y-3">
              {collaborators.map(collab => (
                <div key={collab.id} className="group flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-indigo-100 transition-colors">
                  <div
                    className={`w-9 h-9 rounded-lg ${getAvatarColor(collab.id)} flex items-center justify-center text-white text-[13px] font-black shadow-md premium-tooltip premium-tooltip-left ring-1 ring-white/20`}
                    data-tooltip={collab.name}
                  >
                    {getInitials(collab.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-700 truncate">{collab.name}</p>
                    <p className="text-[9px] text-gray-400 truncate">{collab.email}</p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => {
                        confirm({
                          title: 'Remove Collaborator',
                          message: `Are you sure you want to remove ${collab.name}? They will lose access to this workspace.`,
                          confirmLabel: 'Remove',
                          type: 'danger',
                          onConfirm: async () => {
                            await uninviteCollaborator(idea.id, collab.id);
                            showToast(`${collab.name} removed from project`, 'info');
                          }
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50"
                      title="Uninvite"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {/* Pending Invitations */}
              {data.invitations.filter(inv => inv.ideaId === idea.id && inv.status === 'Pending').map(inv => (
                <div key={inv.id} className="group flex items-center gap-3 p-3 border border-dashed border-gray-100 rounded-xl hover:border-indigo-100 transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 opacity-60">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-gray-500 truncate">{inv.email}</p>
                      <span className="text-[8px] bg-gray-100 text-gray-400 px-1 rounded font-bold uppercase">Pending</span>
                    </div>
                    <p className="text-[9px] text-gray-400 truncate tracking-tighter">Waiting for response...</p>
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={async () => {
                          try {
                            await resendInvitation(inv.id);
                            showToast('Invitation resent successfully', 'success');
                          } catch (err: any) {
                            showToast(err.message || 'Failed to resend', 'error');
                          }
                        }}
                        className="p-1.5 text-gray-300 hover:text-indigo-600 transition-all rounded-lg hover:bg-indigo-50"
                        title="Resend Invite"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          confirm({
                            title: 'Revoke Invitation',
                            message: `Delete this pending invitation for ${inv.email}?`,
                            confirmLabel: 'Delete',
                            type: 'danger',
                            onConfirm: async () => {
                              try {
                                await deleteInvitation(inv.id);
                                showToast('Invitation deleted', 'info');
                              } catch (err: any) {
                                showToast(err.message || 'Failed to delete invitation', 'error');
                              }
                            }
                          });
                        }}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50"
                        title="Delete Invitation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {collaborators.length === 0 && data.invitations.filter(i => i.ideaId === idea.id && i.status === 'Pending').length === 0 && (
                <p className="text-[10px] text-gray-400 italic text-center py-2">Private workspace</p>
              )}
            </div>

            {isOwner && (
              <form onSubmit={handleShare} className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Invite Collaborator</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    placeholder="Email address..."
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                  />
                  <button type="submit" className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-all shadow-md active:scale-95">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
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
    </div>
  );
};

export default IdeaDetail;
