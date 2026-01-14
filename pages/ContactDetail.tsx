
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { format } from 'date-fns';
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
  Star,
  Lightbulb,
  Briefcase,
  ExternalLink,
  History,
  ClipboardList,
  Plus,
  X,
  Users,
  AtSign
} from 'lucide-react';
import NoteComposer from '../components/NoteComposer';
import IdeaModal from '../components/IdeaModal';

const ContactDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, updateContact, deleteNote, togglePinNote, confirm } = useStore();
  const contact = data.contacts.find(c => c.id === id);

  if (!contact) {
    return <div className="text-center py-20 text-gray-500">Contact not found.</div>;
  }

  const [isEditing, setIsEditing] = useState(false);
  const [editedContact, setEditedContact] = useState(contact);
  const [showAddIdeaModal, setShowAddIdeaModal] = useState(false);
  const [showLinkIdeaPicker, setShowLinkIdeaPicker] = useState(false);

  const contactNotes = data.notes
    .filter(n => n.contactId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const interactions = data.interactions
    .filter(int => int.relatedContactId === id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const linkedIdeas = data.ideas.filter(idea =>
    (contact.linkedIdeaIds || []).includes(idea.id) ||
    data.interactions.some(int => int.relatedContactId === id && int.relatedIdeaId === idea.id) ||
    data.notes.some(note => note.contactId === id && note.ideaId === idea.id)
  );

  const handleSave = () => {
    updateContact(contact.id, editedContact);
    setIsEditing(false);
  };

  const renderBodyWithLinks = (text: string, note: any) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const taggedContacts = data.contacts.filter(c => note.taggedContactIds?.includes(c.id));
    const taggedUsers = data.users.filter(u => note.taggedUserIds?.includes(u.id));

    let parts: (string | React.ReactElement)[] = [text];

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
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 px-6">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/contacts')}
          className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to contacts
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
          {isEditing && (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-md"
            >
              Save Profile
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-10 border-b border-gray-100 flex flex-col md:flex-row gap-10 items-start md:items-center">
          <div className="w-28 h-28 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-indigo-700 text-4xl font-bold border-4 border-indigo-100 shadow-inner">
            {contact.fullName[0]}
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-4">
              {isEditing ? (
                <input
                  className="text-3xl font-extrabold text-gray-900 bg-gray-50 rounded px-2 outline-indigo-500"
                  value={editedContact.fullName}
                  onChange={e => setEditedContact({ ...editedContact, fullName: e.target.value })}
                />
              ) : (
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{contact.fullName}</h1>
              )}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    disabled={!isEditing}
                    onClick={() => setEditedContact({ ...editedContact, relationshipStrength: s })}
                  >
                    <Star
                      className={`w-5 h-5 ${s <= editedContact.relationshipStrength ? 'text-yellow-400 fill-yellow-400' : 'text-gray-100'}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-2 text-gray-600 font-semibold">
                <Briefcase className="w-4 h-4 text-indigo-500" />
                {isEditing ? (
                  <div className="flex gap-2 items-center">
                    <input className="bg-gray-50 px-2 py-1 rounded border border-gray-200" value={editedContact.role} onChange={e => setEditedContact({ ...editedContact, role: e.target.value })} />
                    <span className="text-gray-400 font-normal">@</span>
                    <input className="bg-gray-50 px-2 py-1 rounded border border-gray-200" value={editedContact.org} onChange={e => setEditedContact({ ...editedContact, org: e.target.value })} />
                  </div>
                ) : (
                  <span>{contact.role} @ {contact.org}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-gray-600 font-semibold">
                <MapPin className="w-4 h-4 text-indigo-500" />
                {isEditing ? (
                  <input className="bg-gray-50 px-2 py-1 rounded border border-gray-200" value={editedContact.country} onChange={e => setEditedContact({ ...editedContact, country: e.target.value })} />
                ) : (
                  <span>{contact.country || 'No location set'}</span>
                )}
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
                <Mail className="w-4 h-4 text-indigo-500" />
                {isEditing ? <input className="bg-white border rounded px-2 py-1 flex-1" value={editedContact.email} onChange={e => setEditedContact({ ...editedContact, email: e.target.value })} /> : contact.email}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600 font-medium">
                <Phone className="w-4 h-4 text-indigo-500" />
                {isEditing ? <input className="bg-white border rounded px-2 py-1 flex-1" value={editedContact.phone} onChange={e => setEditedContact({ ...editedContact, phone: e.target.value })} /> : (contact.phone || 'No phone set')}
              </div>
            </div>
          </div>

          <div className="space-y-4 md:col-span-1 lg:col-span-2">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Social Channels</div>
            <div className="flex flex-wrap gap-4">
              {contact.linkedinUrl && (
                <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm">
                  <Linkedin className="w-4 h-4 text-blue-600" />
                  LinkedIn
                </a>
              )}
              {contact.twitterUrl && (
                <a href={contact.twitterUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-gray-900 transition-all shadow-sm">
                  <Twitter className="w-4 h-4 text-gray-900" />
                  X
                </a>
              )}
              {contact.instagramUrl && (
                <a href={contact.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-pink-400 hover:text-pink-600 transition-all shadow-sm">
                  <Instagram className="w-4 h-4 text-pink-600" />
                  Instagram
                </a>
              )}
              {contact.substackUrl && (
                <a href={contact.substackUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-orange-400 hover:text-orange-600 transition-all shadow-sm">
                  <BookOpen className="w-4 h-4 text-orange-600" />
                  Substack
                </a>
              )}
            </div>
          </div>

          {contact.notes && !isEditing && (
            <div className="space-y-4">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" />
                Context Notes
              </div>
              <p className="text-xs text-gray-600 leading-relaxed font-medium bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                {contact.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Activity Journal
            </h2>

            <div className="mb-10 pb-10 border-b border-gray-100">
              <NoteComposer defaultContactId={contact.id} />
            </div>

            <div className="space-y-10">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                <History className="w-3.5 h-3.5" />
                History for {contact.fullName}
              </div>

              {contactNotes.map((note, index) => {
                const isStructured = note.body.startsWith('{') && note.body.includes('"template"');
                let structuredData: any = null;
                if (isStructured) {
                  try {
                    structuredData = JSON.parse(note.body);
                  } catch (e) { }
                }

                const renderStructuredBody = (data: any, note: any) => {
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

                    return (
                      <div className="space-y-6 font-sans py-2">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          {data.attendees && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 bg-gray-50/50 px-3 py-2 rounded-xl border border-gray-300 shadow-inner">
                              <Users className="w-3.5 h-3.5 text-indigo-500" />
                              Attendees: <span className="text-gray-900 font-black">{data.attendees}</span>
                            </div>
                          )}

                          {note.categories && note.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 ml-auto">
                              {note.categories.map(cat => (
                                <span key={cat} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-black uppercase tracking-tighter border border-indigo-200">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-8">
                          {segments.map((seg: any, idx: number) => (
                            <div key={idx} className="relative pl-6 border-l-2 border-indigo-50 py-1 space-y-3">
                              <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-indigo-200"></div>
                              <div className="flex items-center gap-2">
                                {idx === 0 && (
                                  <span className="px-2 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase rounded shadow-sm flex items-center gap-1">
                                    <ClipboardList className="w-3 h-3" /> Call Minute
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${typeColors[seg.type] || 'bg-gray-50 text-gray-500 border-gray-300'}`}>
                                  {seg.type}
                                </span>
                              </div>
                              {seg.topic && (
                                <h4 className="text-md font-black text-gray-900 tracking-tight leading-relaxed">
                                  {seg.topic}
                                </h4>
                              )}
                              {seg.comments && (
                                <div className="text-sm text-gray-600 leading-relaxed bg-white p-4 rounded-2xl border border-gray-300 shadow-sm italic font-medium whitespace-pre-wrap">
                                  {renderBodyWithLinks(seg.comments, note)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return <p className="text-xs text-red-400 italic">Unsupported Template</p>;
                };

                return (
                  <div key={note.id} className="relative group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm"></div>
                        <span className="text-xs font-bold text-gray-900">
                          {format(new Date(note.createdAt), 'MMM d, yyyy')}
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(note.createdAt), 'h:mm a')}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {note.categories && note.categories.length > 0 && !isStructured && (
                          <div className="flex flex-wrap gap-1.5">
                            {note.categories.map(cat => (
                              <span key={cat} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-black uppercase tracking-tighter border border-indigo-200">
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}

                        {note.ideaId && (
                          <Link
                            to={`/ideas/${note.ideaId}`}
                            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                          >
                            RE: {data.ideas.find(i => i.id === note.ideaId)?.title}
                          </Link>
                        )}

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all ml-2">
                          {note.createdById === data.currentUser?.id && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {/* Handle Edit - need to add state for this in ContactDetail */ }}
                                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                                title="Edit Note"
                                disabled // For now as ContactDetail doesn't have editingCallMinute yet
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  confirm({
                                    title: 'Delete Note',
                                    message: 'Are you sure you want to delete this note? This action cannot be undone.',
                                    confirmLabel: 'Delete',
                                    type: 'danger',
                                    onConfirm: () => {
                                      confirm({
                                        title: 'Final Confirmation',
                                        message: 'Please confirm one last time. This will permanently remove this insight.',
                                        confirmLabel: 'Delete Permanently',
                                        type: 'danger',
                                        onConfirm: () => deleteNote(note.id)
                                      });
                                    }
                                  });
                                }}
                                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                                title="Delete Note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => togglePinNote(note.id)}
                            className={`p-1 rounded hover:bg-gray-100 transition-all ${note.isPinned ? 'text-yellow-600' : 'text-gray-300'}`}
                            title={note.isPinned ? 'Unpin' : 'Pin'}
                          >
                            <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-800 leading-relaxed font-medium bg-gray-50/70 p-5 rounded-2xl border border-gray-400 group-hover:bg-white group-hover:shadow-md transition-all">
                      {note.imageUrl && (
                        <div className="mb-4 rounded-2xl overflow-hidden border border-gray-100 shadow-lg">
                          <img src={note.imageUrl} alt="Attached" className="w-full h-auto" />
                        </div>
                      )}
                      {isStructured && structuredData
                        ? renderStructuredBody(structuredData, note)
                        : <div className="font-mono whitespace-pre-wrap">{renderBodyWithLinks(note.body, note)}</div>
                      }
                    </div>
                    {index !== contactNotes.length - 1 && (
                      <div className="absolute left-[5px] top-10 bottom-[-40px] w-0.5 bg-gray-400"></div>
                    )}
                  </div>
                );
              })}

              {contactNotes.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-3xl">
                  <p className="text-sm text-gray-400 italic">No activity logged yet for this contact.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <section className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                Linked Ideas
                <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{linkedIdeas.length}</span>
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowLinkIdeaPicker(!showLinkIdeaPicker)}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Link Existing Idea"
                >
                  <Lightbulb className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowAddIdeaModal(true)}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Create New Idea"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Existing Idea Picker Dropdown - Symmetric mechanism */}
            {showLinkIdeaPicker && (
              <div className="absolute top-16 right-8 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-40 p-2 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between px-2 py-1 mb-2 border-b">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Link Existing Idea</span>
                  <button onClick={() => setShowLinkIdeaPicker(false)}><X className="w-3 h-3 text-gray-400" /></button>
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  {availableIdeas.length > 0 ? availableIdeas.map(idea => (
                    <button
                      key={idea.id}
                      onClick={() => handleLinkExistingIdea(idea.id)}
                      className="w-full text-left p-2 hover:bg-indigo-50 rounded-lg flex flex-col group transition-colors"
                    >
                      <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600">{idea.title}</span>
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
                    className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Lightbulb className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600">{idea.title}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
                  </Link>
                  {/* Symmetric unlinking mechanism */}
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

          <section className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
            <h2 className="text-lg font-bold mb-6">Recent Interactions</h2>
            <div className="space-y-4">
              {interactions.map(int => (
                <div key={int.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-indigo-600 uppercase px-2 py-1 bg-indigo-50 rounded-lg">{int.type}</span>
                    <span className="text-[10px] font-bold text-gray-400">{format(new Date(int.date), 'MMM d, yyyy')}</span>
                  </div>
                  <p className="text-xs text-gray-700 line-clamp-3 mb-3 font-medium">"{int.outcome}"</p>
                  {int.nextAction && (
                    <div className="pt-3 border-t border-gray-200 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                      <p className="text-[10px] font-black text-orange-600 uppercase">Action: {int.nextAction}</p>
                    </div>
                  )}
                </div>
              ))}
              {interactions.length === 0 && <p className="text-sm text-gray-400 py-4 text-center italic">No recorded interactions.</p>}
            </div>
          </section>
        </div>
      </div>

      <IdeaModal
        isOpen={showAddIdeaModal}
        onClose={() => setShowAddIdeaModal(false)}
        initialContactIds={[id as string]}
      />
    </div>
  );
};

export default ContactDetail;
