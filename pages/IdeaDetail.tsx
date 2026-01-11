
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { format } from 'date-fns';
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
  Check
} from 'lucide-react';
import NoteComposer from '../components/NoteComposer';
import { Note, IdeaType } from '../types';

const IdeaDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, updateIdea, togglePinNote, shareIdea } = useStore();
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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [todoInput, setTodoInput] = useState('');
  const [todoDueDate, setTodoDueDate] = useState('');
  const [todoAssigneeId, setTodoAssigneeId] = useState<string>('');
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [isUrlUrgent, setIsUrlUrgent] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoText, setEditingTodoText] = useState('');
  const [editingTodoDueDate, setEditingTodoDueDate] = useState('');
  const [editingTodoAssigneeId, setEditingTodoAssigneeId] = useState('');

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
      .filter(n => n.body.toLowerCase().includes(noteSearchQuery.toLowerCase()))
      .filter(n => !activeCategoryFilter || n.categories?.includes(activeCategoryFilter))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data.notes, id, noteSearchQuery, activeCategoryFilter]);

  const pinnedNote = useMemo(() =>
    data.notes.find(n => n.ideaId === id && n.isPinned),
    [data.notes, id]
  );

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      await shareIdea(idea.id, inviteEmail.trim());
      setInviteEmail('');
      alert('Invitation sent to ' + inviteEmail);
    } catch (err) {
      console.error('Failed to send invitation:', err);
      alert('Failed to send invitation. Please check the console.');
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
      assigneeId: todoAssigneeId || data.currentUser?.id
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
          completedAt: newCompleted ? new Date().toISOString() : undefined
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
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const taggedContacts = data.contacts.filter(c => note.taggedContactIds?.includes(c.id));
    const taggedUsers = data.users.filter(u => note.taggedUserIds?.includes(u.id));

    // Fixed: Replaced JSX.Element with React.ReactElement to resolve "Cannot find namespace 'JSX'" error.
    let parts: (string | React.ReactElement)[] = [text];

    // 1. Process URLs
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

    // 2. Process Mentions for contacts specifically tagged in this note
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
              <Link
                key={`mention-contact-${contact.id}-${i}`}
                to={`/contacts/${contact.id}`}
                className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold hover:bg-indigo-100 transition-colors border border-indigo-100 inline-flex items-center gap-0.5 no-underline mx-0.5 align-baseline"
              >
                <AtSign className="w-2.5 h-2.5" />
                {contact.fullName}
              </Link>
            );
          }
          return sub;
        });
      });
    });

    // 3. Process Mentions for users (Owner/Collaborators) specifically tagged in this note
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
                key={`mention-user-${user.id}-${i}`}
                className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-md font-bold border border-purple-100 inline-flex items-center gap-0.5 no-underline mx-0.5 align-baseline cursor-default"
                title={`${user.name} (Collaborator)`}
              >
                <AtSign className="w-2.5 h-2.5" />
                {user.name}
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

    const isPinned = note.isPinned;
    const author = data.users.find(u => u.id === note.createdById);

    return (
      <div key={note.id} className={`group relative p-6 rounded-2xl border transition-all ${isPinned ? 'bg-indigo-50 border-indigo-200 mb-8 shadow-md' : 'bg-white border-gray-100 shadow-sm mb-4 hover:border-indigo-100'}`}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className={`w-6 h-6 rounded-full ${author?.avatarColor || 'bg-gray-400'} flex items-center justify-center text-[10px] text-white font-bold`}>
            {note.createdBy[0]}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">
              {note.createdBy}
            </span>
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
              {format(new Date(note.createdAt), 'MMM d · h:mm a')}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {note.location && (
              <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                <MapPin className="w-2.5 h-2.5" />
                {note.location}
              </div>
            )}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              {note.createdById === data.currentUser?.id && (
                <button onClick={() => setEditingNoteId(note.id)} className="p-1.5 rounded hover:bg-indigo-100 text-indigo-600"><Edit3 className="w-3.5 h-3.5" /></button>
              )}
              <button onClick={() => togglePinNote(note.id)} className={`p-1.5 rounded hover:bg-yellow-100 transition-all ${isPinned ? 'text-yellow-600' : 'text-gray-300'}`}><Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} /></button>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-800 leading-relaxed font-mono whitespace-pre-wrap">
          {renderBodyWithLinks(note.body, note)}
        </div>

        {note.categories && note.categories.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-2">
            {note.categories.map(cat => (
              <span key={cat} className="px-2 py-1 bg-gray-50 text-gray-400 rounded-lg text-[10px] font-bold border border-gray-100">
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 px-6">
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md pt-6 pb-4 mb-8 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {isEditingIdea ? (
                <div className="flex gap-2">
                  <select
                    className="text-[10px] font-bold uppercase bg-white border border-gray-200 rounded px-2 py-0.5 outline-indigo-500"
                    value={editedIdea.type}
                    onChange={e => setEditedIdea({ ...editedIdea, type: e.target.value as IdeaType })}
                  >
                    <option value="Product">Product</option>
                    <option value="Consulting">Consulting</option>
                    <option value="New Business">New Business</option>
                  </select>
                  <select
                    className="text-[10px] font-bold uppercase bg-white border border-gray-200 rounded px-2 py-0.5 outline-indigo-500"
                    value={editedIdea.entity}
                    onChange={e => setEditedIdea({ ...editedIdea, entity: e.target.value })}
                  >
                    {personalEntities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
                  </select>
                </div>
              ) : (
                <>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-600 border border-indigo-100">
                    {idea.type}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-600">
                    {idea.entity}
                  </span>
                </>
              )}
            </div>
            {isEditingIdea ? (
              <div className="space-y-3">
                <input
                  className="text-3xl font-extrabold w-full outline-none border-b-2 border-indigo-500 bg-transparent"
                  value={editedIdea.title}
                  onChange={e => setEditedIdea({ ...editedIdea, title: e.target.value })}
                  placeholder="Idea Title"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tags:</span>
                  <input
                    className="text-xs font-bold bg-white border border-gray-200 rounded px-2 py-0.5 outline-indigo-500 w-full"
                    value={Array.isArray(editedIdea.tags) ? editedIdea.tags.join(', ') : ''}
                    onChange={e => setEditedIdea({ ...editedIdea, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Enter tags separated by commas..."
                  />
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 truncate tracking-tight mb-2">{idea.title}</h1>
                {idea.tags && idea.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {idea.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold uppercase tracking-wider">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {isOwner && (
              <button onClick={() => setIsEditingIdea(!isEditingIdea)} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold flex items-center gap-2 transition-colors hover:bg-indigo-100">
                <Edit3 className="w-4 h-4" />
                {isEditingIdea ? 'Cancel' : 'Edit Idea'}
              </button>
            )}
            {isEditingIdea && <button onClick={handleSaveIdea} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700">Save Changes</button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border p-8 shadow-sm">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Idea Brief</h2>
            {isEditingIdea ? (
              <textarea
                className="w-full text-lg text-gray-700 leading-relaxed font-medium bg-gray-50 p-4 rounded-xl outline-indigo-500 min-h-[100px] resize-none"
                value={editedIdea.oneLiner ?? ''}
                onChange={e => setEditedIdea({ ...editedIdea, oneLiner: e.target.value })}
              />
            ) : (
              <p className="text-xl text-gray-700 leading-relaxed font-medium">{idea.oneLiner ?? ''}</p>
            )}
          </div>

          <div className="bg-white rounded-3xl border p-8 shadow-sm">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight">Timeline</h2>
              <div className="relative">
                <Edit3 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input className="pl-8 pr-4 py-1.5 border border-gray-100 rounded-xl text-xs bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-48" placeholder="Search logs..." value={noteSearchQuery} onChange={e => setNoteSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="mb-10"><NoteComposer defaultIdeaId={idea.id} /></div>
            <div className="space-y-4">
              {pinnedNote && renderNote(pinnedNote)}
              {ideaNotes.map(renderNote)}
              {ideaNotes.length === 0 && !pinnedNote && (
                <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                  <p className="text-gray-400 font-medium">No logs recorded yet. Start the conversation above.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Owner Info - Dotted Pill Styling */}
          <section className="bg-white rounded-2xl border p-6 shadow-sm">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Ownership</h2>
            <div className="border-2 border-dashed border-indigo-100 p-4 rounded-2xl flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${owner?.avatarColor || 'bg-indigo-600'} flex items-center justify-center text-white text-lg font-bold shadow-inner`}>
                {owner?.name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{owner?.name}</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">{owner?.email}</p>
              </div>
            </div>
          </section>

          {/* Checklist Area */}
          <section className="bg-white rounded-2xl border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ListChecks className="w-4 h-4" />
                Checklist
              </h2>
              <button
                onClick={() => setIsAddingTodo(!isAddingTodo)}
                className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider hover:text-indigo-700 transition-colors"
              >
                {isAddingTodo ? 'Cancel' : 'Add Task'}
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {(idea.todos || []).map(todo => {
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
                  <div key={todo.id} className="group relative">
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
                            className={`text-sm leading-snug break-words flex-1 cursor-pointer ${isDone ? 'text-gray-400 line-through font-normal' : 'text-gray-700 font-bold'}`}
                            onClick={() => startEditingTodo(todo)}
                          >
                            {todo.text}
                          </p>
                          {assignee && (
                            <div
                              className={`w-5 h-5 rounded-full ${assignee.avatarColor || 'bg-gray-400'} flex items-center justify-center text-[8px] text-white font-bold shrink-0 shadow-sm`}
                              title={`Assigned to ${assignee.name}`}
                            >
                              {assignee.name[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {todo.dueDate && (
                            <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-tight ${isDone ? 'text-gray-300' : 'text-orange-500'}`}>
                              <Calendar className="w-2.5 h-2.5" />
                              Due {format(new Date(todo.dueDate), 'MMM d')}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleUrgent(todo.id)}
                              className={`text-[8px] font-black uppercase px-2 py-0.5 rounded transition-all ${isUrgent ? 'bg-red-50 text-red-600 border border-red-100' : 'text-gray-300 hover:text-red-400 border border-transparent'}`}
                            >
                              Urgent
                            </button>
                            {isDone && todo.completedAt && (
                              <span className="text-[8px] text-gray-300 font-bold uppercase tracking-tighter">
                                Completed {format(new Date(todo.completedAt), 'MMM d, h:mm a')}
                              </span>
                            )}
                            <button
                              onClick={() => deleteTodo(todo.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {(idea.todos || []).length === 0 && !isAddingTodo && (
                <p className="text-[10px] text-gray-400 italic text-center py-4">No tasks yet. Ready to start?</p>
              )}
            </div>

            {isAddingTodo && (
              <form onSubmit={handleAddTodo} className="bg-gray-50 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                  placeholder="What needs to be done?"
                  value={todoInput}
                  onChange={e => setTodoInput(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <input
                      type="date"
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] outline-none focus:ring-2 focus:ring-indigo-500"
                      value={todoDueDate}
                      onChange={e => setTodoDueDate(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <select
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                      value={todoAssigneeId}
                      onChange={e => setTodoAssigneeId(e.target.value)}
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
                    type="button"
                    onClick={() => setIsUrlUrgent(!isUrlUrgent)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${isUrlUrgent ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-400 border-gray-100'}`}
                  >
                    Mark as Urgent
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white px-6 py-1.5 rounded-lg text-[10px] font-bold shadow-md shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
                  >
                    Add Task
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Collaborators Panel */}
          <section className="bg-white rounded-2xl border p-6 shadow-sm">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Collaborators
            </h2>

            <div className="space-y-3">
              {collaborators.map(collab => (
                <div key={collab.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-indigo-100 transition-colors">
                  <div className={`w-8 h-8 rounded-lg ${collab.avatarColor || 'bg-gray-400'} flex items-center justify-center text-white text-xs font-bold`}>
                    {collab.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-700 truncate">{collab.name}</p>
                    <p className="text-[9px] text-gray-400 truncate">{collab.email}</p>
                  </div>
                </div>
              ))}

              {/* Pending Invitations */}
              {data.invitations.filter(inv => inv.ideaId === idea.id && inv.status === 'Pending').map(inv => (
                <div key={inv.id} className="flex items-center gap-3 p-3 border border-dashed border-gray-100 rounded-xl opacity-60">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-gray-500 truncate">{inv.email}</p>
                      <span className="text-[8px] bg-gray-100 text-gray-400 px-1 rounded font-bold uppercase">Pending</span>
                    </div>
                    <p className="text-[9px] text-gray-400 truncate tracking-tighter">Waiting for response...</p>
                  </div>
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
    </div>
  );
};

export default IdeaDetail;
