
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { format } from 'date-fns';
import { Note, Idea, Contact, User } from '../types';
import {
  ChevronLeft,
  Mail,
  Linkedin,
  Instagram,
  Twitter,
  BookOpen,
  Phone,
  MapPin,
  MessageSquare,
  MessageCircle,
  Edit3,
  Trash2,
  Pin,
  Lightbulb,
  Briefcase,
  ExternalLink,
  History,
  ClipboardList,
  Plus,
  X,
  Users,
  AtSign,
  RotateCcw,
  CheckCheck,
  Brain,
  Mountain,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Send,
  Microscope,
  StickyNote,
  Activity,
  LogOut,
  History as HistoryIcon
} from 'lucide-react';
import NoteComposer from '../components/NoteComposer';
import NoteDetailModal from '../components/NoteDetailModal';
import IdeaModal from '../components/IdeaModal';
import ContactModal from '../components/ContactModal';
import InviteModal from '../components/InviteModal';

const ContactDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, updateContact, deleteContact, updateNote, deleteNote, togglePinNote, toggleHideNote, confirm, addComment, deleteComment, showToast, shareIdea } = useStore();
  const contact = data.contacts.find(c => c.id === id);

  if (!contact) {
    return <div className="text-center py-20 text-gray-500">Contact not found.</div>;
  }

  // Update document title dynamically based on contact
  React.useEffect(() => {
    if (contact?.fullName) {
      document.title = `${contact.firstName} ${contact.lastName}`.trim() || 'Idea-CRM';
    }
    return () => {
      document.title = 'IdeaCRM Tracker';
    };
  }, [contact.firstName, contact.lastName]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddIdeaModal, setShowAddIdeaModal] = useState(false);
  const [showLinkIdeaPicker, setShowLinkIdeaPicker] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [openIntentMenuId, setOpenIntentMenuId] = useState<string | null>(null);
  const [showHiddenNotes, setShowHiddenNotes] = useState(false);
  const [expandedCommentsNoteId, setExpandedCommentsNoteId] = useState<string | null>(null);
  const [selectedNoteForDetail, setSelectedNoteForDetail] = useState<Note | null>(null);
  const [commentBody, setCommentBody] = useState<Record<string, string>>({});
  const [showComposer, setShowComposer] = useState(() => {
    const saved = localStorage.getItem('hideComposer_contact');
    return saved !== 'true';
  });

  const toggleComposer = () => {
    const newVal = !showComposer;
    setShowComposer(newVal);
    localStorage.setItem('hideComposer_contact', (!newVal).toString());
  };

  const pinnedNote = data.notes.find(n => n.contactId === id && n.isPinned);
  const contactNotes = data.notes
    .filter(n => n.contactId === id && !n.isPinned)
    .filter(n => showHiddenNotes || !n.isHidden)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const interactions = data.interactions
    .filter(int => int.relatedContactId === id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const linkedIdeas = data.ideas.filter(idea =>
    (contact.linkedIdeaIds || []).includes(idea.id) ||
    data.interactions.some(int => int.relatedContactId === id && int.relatedIdeaId === idea.id) ||
    data.notes.some(note => note.contactId === id && note.ideaId === idea.id)
  );

  const renderBodyWithLinks = (text: string, note: any) => {
    const isHtml = /<[a-z][\s\S]*>/i.test(text);

    if (isHtml) {
      let html = text;
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

      const urlRegex = /(?![^<]*>)(https?:\/\/[^\s]+)/g;
      html = html.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="hover:underline inline-flex items-center gap-1 font-sans" style="color: var(--primary)">${url}</a>`);

      const dashRegex = /(?:^|<div>|<p>|<br>)\s*-\s+([^<]+)/g;
      if (dashRegex.test(html)) {
        html = html.replace(/((\s*-\s+[^<]+(?:<br>|<div>|<\/div>|<p>|<\/p>)?)+)/g, (match) => {
          const items = match.split(/[-]\s+/).filter(i => i.trim()).map(i => `<li>${i.trim()}</li>`).join('');
          return `<ul>${items}</ul>`;
        });
      }

      return <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: html }} />;
    }

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

        return (
          <div className="space-y-4 font-sans py-2">
            {data.attendees && (
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 mb-4 px-2">
                <Users className="w-3 h-3" />
                Attendees: <span className="text-gray-500 font-bold">{data.attendees}</span>
              </div>
            )}

            <div className="space-y-6">
              {segments.map((seg: any, i: number) => (
                <div key={i} className="relative pl-6 border-l-2 py-1 space-y-2" style={{ borderColor: 'var(--primary-shadow)' }}>
                  <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: 'var(--primary)' }}></div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${typeColors[seg.type] || 'bg-gray-50 text-gray-500 border-gray-300'}`}>
                      {seg.type}
                    </span>
                  </div>
                  {seg.topic && <h4 className="text-sm font-bold text-gray-900 leading-snug">{seg.topic}</h4>}
                  {seg.comments && <div className="text-[13px] text-gray-600 leading-relaxed italic">{renderBodyWithLinks(seg.comments, note)}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      }
      return <p className="text-xs text-red-400 italic">Unsupported Template</p>;
    };

    const INTENT_CONFIG: Record<string, { icon: any, label: string, color: string }> = {
      follow_up: { icon: RotateCcw, label: 'Follow up', color: 'text-green-600' },
      acted_upon: { icon: CheckCheck, label: 'Acted upon', color: 'text-emerald-500' },
      reflection: { icon: Microscope, label: 'Reflection', color: 'text-gray-400' },
      memoir: { icon: Mountain, label: 'Memoir', color: 'text-amber-600' },
    };

    const currentIntent = note.intent || 'memoir';
    const IntentIcon = INTENT_CONFIG[currentIntent]?.icon || Mountain;

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

          <span className="text-blue-400 hover:underline cursor-default transition-colors">
            {format(new Date(note.createdAt), "EEE, MMM d ''yy · h:mm a")}
          </span>
          <span className="text-blue-400">{note.createdBy || 'Unknown'}</span>

          <div className="ml-auto flex items-center gap-4" onDoubleClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              {note.createdById === data.currentUser?.id && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      showToast("Note editing from here is not yet available. Use the detailed view if needed.", "info");
                    }}
                    className="p-1.5 rounded-lg hover:bg-[var(--primary)]/10 text-gray-400 hover:text-[var(--primary)] transition-all"
                    title="Edit Note"
                    disabled
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
                  <span key={cat} className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border font-sans" style={{ backgroundColor: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }}>
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {note.createdById === data.currentUser?.id && (
              <div className="flex items-center gap-1 font-sans">
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

        <div className="text-[14.5px] text-gray-800 leading-relaxed font-[450] whitespace-pre-wrap premium-context-note">
          {isStructured ? renderStructuredBody(structuredData) : renderBodyWithLinks(note.body, note)}
        </div>

        {/* Comments Section */}
        <div className="mt-8 pt-4 border-t border-[var(--border)]" onDoubleClick={e => e.stopPropagation()}>
          <button
            onClick={() => setExpandedCommentsNoteId(expandedCommentsNoteId === note.id ? null : note.id)}
            className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-[var(--primary)] transition-colors group"
          >
            {expandedCommentsNoteId === note.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />}
            <MessageSquare className="w-3.5 h-3.5" />
            Comments ({note.comments?.length || 0})
          </button>

          {expandedCommentsNoteId === note.id && (
            <div className="mt-6 space-y-6 animate-in slide-in-from-top-2 duration-200">
              {note.comments?.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-sm bg-gray-100 flex items-center justify-center shrink-0 text-[10px] font-black text-gray-400 shadow-sm uppercase">
                    {comment.authorName?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 group/comment relative">
                    <div className="bg-gray-50/50 rounded-2xl rounded-tl-none p-4 border border-[var(--border)]/50">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-900 uppercase tracking-wider">{comment.authorName}</span>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{format(new Date(comment.createdAt), 'MMM d · p')}</span>
                        </div>
                        {(comment.authorId === data.currentUser?.id || contact?.ownerId === data.currentUser?.id || note.createdById === data.currentUser?.id) && (
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
                            className="opacity-0 group-hover/comment:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-[13px] text-gray-600 leading-relaxed font-medium">{comment.body}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <div className="w-7 h-7 rounded-sm flex items-center justify-center shrink-0 text-[10px] font-black shadow-md uppercase" style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
                  {data.currentUser?.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    disabled={!data.currentUser}
                    placeholder={data.currentUser ? "Add a thought..." : "Login to comment"}
                    className="w-full bg-white border border-[var(--border)] rounded-xl px-4 py-2.5 text-[12px] outline-none focus:ring-2 transition-all font-medium pr-10 shadow-sm"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 disabled:text-gray-300 transition-colors"
                    style={{ color: 'var(--primary)' }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleLinkExistingIdea = (ideaId: string) => {
    const currentLinks = contact.linkedIdeaIds || [];
    if (!currentLinks.includes(ideaId)) {
      updateContact(contact.id, { linkedIdeaIds: [...currentLinks, ideaId] });
    }
    setShowLinkIdeaPicker(false);
  };

  const handleUnlinkIdea = (e: React.MouseEvent, ideaId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const currentLinks = contact.linkedIdeaIds || [];
    updateContact(contact.id, { linkedIdeaIds: currentLinks.filter(iid => iid !== ideaId) });
  };

  const availableIdeas = data.ideas.filter(i => !(contact.linkedIdeaIds || []).includes(i.id));

  return (
    <>
      <div className="max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 px-8 pt-8">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/contacts')}
            className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-[var(--primary)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to contacts
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                confirm({
                  title: 'Delete Contact',
                  message: `Are you sure you want to delete ${contact.fullName}? This will permanently remove them from your CRM.`,
                  confirmLabel: 'Delete Contact',
                  type: 'danger',
                  onConfirm: async () => {
                    await deleteContact(contact.id);
                    showToast('Contact deleted', 'success');
                    navigate('/contacts');
                  }
                });
              }}
              className="p-2 border border-[var(--border)] rounded-lg text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
              title="Delete Contact"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-semibold hover:bg-gray-50 flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              Edit Profile
            </button>
            {contact.email && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 text-white border rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
                style={{ backgroundColor: 'var(--primary)', borderColor: 'var(--primary)', boxShadow: '0 4px 6px -1px var(--primary-shadow)' }}
              >
                <Plus className="w-4 h-4" />
                Invite to CRM
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[40px] border border-[var(--border)] shadow-sm overflow-hidden mb-8">
          <div className="p-10 border-b border-[var(--border)] flex flex-col md:flex-row gap-10 items-start md:items-center">
            <div
              className="w-28 h-28 rounded-[2rem] flex items-center justify-center text-4xl font-bold border-4 shadow-inner"
              style={{ backgroundColor: 'var(--primary-shadow)', color: 'var(--primary)', borderColor: 'var(--primary)' }}
            >
              {contact.firstName?.[0] || contact.fullName?.[0] || '?'}
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-4">
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{contact.fullName}</h1>
              </div>

              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2 text-gray-600 font-semibold">
                  <Briefcase className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <span>{contact.role} @ {contact.org}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 font-semibold">
                  <MapPin className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <span>{contact.country || 'No location set'}</span>
                </div>
                {contact.isWhatsApp && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-100 text-green-700 rounded-full text-xs font-bold">
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp Contact
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50/50 p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-4">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact Methods</div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm text-gray-600 font-medium">
                  <Mail className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  {contact.email}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 font-medium">
                  <Phone className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  {contact.phone || 'No phone set'}
                </div>
              </div>
            </div>

            <div className="space-y-4 md:col-span-1 lg:col-span-3">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Social Channels</div>
              <div className="flex flex-wrap gap-4">
                {contact.linkedinUrl && (
                  <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2 bg-white border border-[var(--border)] rounded-xl text-xs font-bold text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm group break-all">
                    <Linkedin className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-medium text-xs text-gray-600 group-hover:text-blue-600">{contact.linkedinUrl}</span>
                  </a>
                )}
                {contact.twitterUrl && (
                  <a href={contact.twitterUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-white border border-[var(--border)] rounded-xl text-xs font-bold text-gray-700 hover:border-gray-900 transition-all shadow-sm">
                    <Twitter className="w-4 h-4 text-gray-900" />
                    X
                  </a>
                )}
                {contact.instagramUrl && (
                  <a href={contact.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-white border border-[var(--border)] rounded-xl text-xs font-bold text-gray-700 hover:border-pink-400 hover:text-pink-600 transition-all shadow-sm">
                    <Instagram className="w-4 h-4 text-pink-600" />
                    Instagram
                  </a>
                )}
                {contact.substackUrl && (
                  <a href={contact.substackUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-white border border-[var(--border)] rounded-xl text-xs font-bold text-gray-700 hover:border-orange-400 hover:text-orange-600 transition-all shadow-sm">
                    <BookOpen className="w-4 h-4 text-orange-600" />
                    Substack
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8 idea-thread">
            {/* Unified Block Strategy */}
            <div className="bg-white rounded-[40px] border border-[var(--border)] shadow-sm overflow-hidden flex flex-col">
              {/* Working Area (Amber) */}
              {showComposer && (
                <div style={{ backgroundColor: 'var(--secondary)' }} className="border-b border-[var(--border)] animate-in fade-in transition-all">
                  <NoteComposer
                    defaultContactId={contact.id}
                    onComplete={() => setShowComposer(false)}
                    title="New Note"
                    titleIcon={<StickyNote className="w-4 h-4 text-amber-900" />}
                    onCancel={toggleComposer}
                    flat
                  />
                </div>
              )}

              {/* History Area (White) */}
              <div className="bg-white flex flex-col min-h-[400px]">
                {/* Simplified Activity Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-10 pt-8 pb-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Activity className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                      Activity
                    </h2>
                    {!showComposer && (
                      <button
                        onClick={toggleComposer}
                        className="text-[10px] font-black uppercase tracking-widest transition-all hover:underline"
                        style={{ color: 'var(--primary)' }}
                      >
                        ( + Add Note )
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowHiddenNotes(!showHiddenNotes)}
                      className={`p-2 rounded-xl transition-all shadow-sm ${showHiddenNotes ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white text-gray-400 border border-[var(--border)]'}`}
                      title={showHiddenNotes ? "Mask hidden notes" : "Reveal hidden notes"}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pb-10">
                  {pinnedNote && renderNote(pinnedNote)}
                  {contactNotes.map(renderNote)}
                  {contactNotes.length === 0 && !pinnedNote && (
                    <div className="py-20 mx-10 text-center border-2 border-dashed border-[var(--border)] rounded-[28px]">
                      <p className="text-gray-400 font-bold text-sm tracking-tight italic">No activity logged yet. Share your first thought above.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {contact.notes && (
              <section className="bg-white rounded-3xl border border-[var(--border)] p-8 shadow-sm">
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2 font-sans">
                  <ClipboardList className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                  Contact Description
                </h2>
                <div className="text-gray-700 leading-relaxed font-medium whitespace-pre-wrap bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                  {contact.notes}
                </div>
              </section>
            )}

            <section className="bg-white rounded-3xl border border-[var(--border)] p-8 shadow-sm relative">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2 font-sans">
                  Linked Ideas
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold shadow-sm" style={{ backgroundColor: 'var(--primary-shadow)', color: 'var(--primary)' }}>{linkedIdeas.length}</span>
                </h2>
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowLinkIdeaPicker(!showLinkIdeaPicker)}
                    className="p-1.5 transition-colors"
                    style={{ color: 'var(--primary)' }}
                    title="Link Existing Idea"
                  >
                    <Lightbulb className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowAddIdeaModal(true)}
                    className="p-1.5 transition-colors"
                    style={{ color: 'var(--primary)' }}
                    title="Create New Idea"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {showLinkIdeaPicker && (
                <div className="absolute top-16 right-8 w-64 bg-white border border-[var(--border)] rounded-xl shadow-xl z-40 p-2 animate-in fade-in zoom-in-95 font-sans">
                  <div className="flex items-center justify-between px-2 py-1 mb-2 border-b">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Link Existing Idea</span>
                    <button onClick={() => setShowLinkIdeaPicker(false)}><X className="w-3 h-3 text-gray-400" /></button>
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {availableIdeas.length > 0 ? availableIdeas.map(idea => (
                      <button
                        key={idea.id}
                        onClick={() => handleLinkExistingIdea(idea.id)}
                        className="w-full text-left p-2 hover:bg-[var(--primary)]/10 rounded-lg flex flex-col group transition-colors"
                      >
                        <span className="text-xs font-bold text-gray-700 group-hover:text-[var(--primary)]">{idea.title}</span>
                        <span className="text-[9px] text-gray-400 uppercase">{idea.status}</span>
                      </button>
                    )) : (
                      <p className="text-[10px] text-gray-400 text-center py-4">All ideas are already linked.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {linkedIdeas.map(idea => (
                  <div key={idea.id} className="relative group">
                    <Link
                      to={`/ideas/${idea.id}`}
                      className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border)] hover:bg-[var(--primary)]/5 transition-all group"
                      style={{ borderColor: 'var(--primary-shadow)' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner transition-colors" style={{ backgroundColor: 'var(--primary-shadow)', color: 'var(--primary)' }}>
                          <Lightbulb className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-gray-900 truncate group-hover:text-[var(--primary)]">{idea.title}</span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-[var(--primary)]/60" />
                    </Link>
                    {(contact.linkedIdeaIds || []).includes(idea.id) && (
                      <button
                        onClick={(e) => handleUnlinkIdea(e, idea.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                        title="Unlink Idea"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {linkedIdeas.length === 0 && <p className="text-sm text-gray-400 py-4 text-center italic">No ideas associated yet.</p>}
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-[var(--border)] p-8 shadow-sm">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <HistoryIcon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                Recent Interactions
              </h2>
              <div className="space-y-4">
                {interactions.map(int => (
                  <div key={int.id} className="p-4 bg-gray-50 rounded-2xl border border-[var(--border)] hover:bg-white hover:shadow-md transition-all font-sans">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg" style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-shadow)' }}>{int.type}</span>
                      <span className="text-[10px] font-bold text-gray-400">{format(new Date(int.date), 'MMM d, yyyy')}</span>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-3 mb-3 font-medium">"{int.outcome}"</p>
                    {int.nextAction && (
                      <div className="pt-3 border-t border-[var(--border)] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                        <p className="text-[10px] font-black text-orange-600 uppercase">Action: {int.nextAction}</p>
                      </div>
                    )}
                  </div>
                ))}
                {interactions.length === 0 && <p className="text-[10px] text-gray-400 py-4 text-center italic tracking-widest uppercase font-black opacity-50">No recorded interactions.</p>}
              </div>
            </section>
          </div>
        </div>
      </div>

      <NoteDetailModal
        isOpen={!!selectedNoteForDetail}
        onClose={() => setSelectedNoteForDetail(null)}
        note={selectedNoteForDetail}
        renderNoteBody={(n) => renderBodyWithLinks(n.body, n)}
      />

      <IdeaModal
        isOpen={showAddIdeaModal}
        onClose={() => setShowAddIdeaModal(false)}
        initialContactIds={[id as string]}
      />

      <ContactModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        contactToEdit={contact}
      />

      {contact.email && (
        <InviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          email={contact.email}
          name={contact.fullName || 'there'}
          onConfirm={async (message) => {
            try {
              await shareIdea(null, contact.email!, message);
              showToast(`Invitation sent to ${contact.email}`, 'success');
            } catch (e: any) {
              showToast('Failed to send invitation', 'error');
            }
          }}
        />
      )}
    </>
  );
};

export default ContactDetail;
