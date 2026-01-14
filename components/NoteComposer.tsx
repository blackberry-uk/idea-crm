import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Save, RefreshCw, Calendar, Tag, MapPin, Pin, Plus, AtSign, Search, ClipboardList, Image, X, ChevronDown, Sparkles, MessageSquare, CheckCircle, Zap } from 'lucide-react';
import CallMinuteModal from './CallMinuteModal';
import { format } from 'date-fns';
import { Note, IdeaStatus } from '../types';

interface NoteComposerProps {
  onComplete?: () => void;
  defaultIdeaId?: string;
  defaultContactId?: string;
  editingNote?: Note;
  title?: string;
  titleIcon?: React.ReactNode;
  onCancel?: () => void;
  flat?: boolean;
}

const NoteComposer: React.FC<NoteComposerProps> = ({ onComplete, defaultIdeaId, defaultContactId, editingNote, title, titleIcon, onCancel, flat }) => {
  const { data, addNote, updateNote, updateIdea, showToast } = useStore();
  const [body, setBody] = useState(editingNote?.body || '');
  const [noteDate, setNoteDate] = useState(format(editingNote ? new Date(editingNote.createdAt) : new Date(), 'yyyy-MM-dd'));
  const [selectedCategories, setSelectedCategories] = useState<string[]>(editingNote?.categories || []);
  const [isPinned, setIsPinned] = useState(editingNote?.isPinned || false);
  const [taggedContacts, setTaggedContacts] = useState<string[]>(editingNote?.taggedContactIds || []);
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>(editingNote?.taggedUserIds || []);
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [showCallMinuteModal, setShowCallMinuteModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'tags' | 'templates' | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(editingNote?.imageUrl || null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mention system state
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentIdea = useMemo(() =>
    data.ideas.find(i => i.id === defaultIdeaId || i.id === editingNote?.ideaId),
    [data.ideas, defaultIdeaId, editingNote]
  );

  const availableCategories = useMemo(() => {
    let custom = currentIdea?.customNoteCategories || [];
    // Defensive check if somehow it came back as a string from the API
    if (typeof custom === 'string') {
      try {
        custom = JSON.parse(custom);
      } catch (e) {
        custom = [];
      }
    }
    if (!Array.isArray(custom)) custom = [];

    return Array.from(new Set([...data.globalNoteCategories, ...custom]));
  }, [currentIdea, data.globalNoteCategories]);

  const mentionCandidates = useMemo(() => {
    const list = [
      ...data.contacts.map(c => ({ id: c.id, name: c.fullName, type: 'contact' as const })),
    ];

    if (currentIdea) {
      // Add owner
      const owner = data.users.find(u => u.id === currentIdea.ownerId);
      if (owner) {
        list.push({ id: owner.id, name: owner.name, type: 'user' as const });
      }
      // Add collaborators
      const collabs = data.users.filter(u => currentIdea.collaboratorIds?.includes(u.id));
      collabs.forEach(u => {
        list.push({ id: u.id, name: u.name, type: 'user' as const });
      });
    }

    const unique = Array.from(new Map(list.map(item => [item.id, item])).values());

    if (!mentionQuery) return unique.slice(0, 5);
    return unique.filter(c =>
      c.name.toLowerCase().includes(mentionQuery.toLowerCase())
    ).slice(0, 5);
  }, [data.contacts, data.users, currentIdea, mentionQuery]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    setBody(value);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentionList(true);

      const rect = e.target.getBoundingClientRect();
      const lineHeight = 20;
      const lines = textBeforeCursor.split('\n');
      const currentLineIndex = lines.length - 1;
      setMentionPosition({
        top: Math.min(rect.height - 40, (currentLineIndex + 1) * lineHeight + 20),
        left: Math.min(rect.width - 150, (lines[currentLineIndex].length * 7) + 20)
      });
    } else {
      setShowMentionList(false);
    }
  };

  const insertMention = (entityId: string, name: string, type: 'user' | 'contact') => {
    if (!textareaRef.current) return;
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = body.slice(0, cursorPosition);
    const textAfterCursor = body.slice(cursorPosition);

    const newTextBefore = textBeforeCursor.replace(/@(\w*)$/, `@${name} `);
    setBody(newTextBefore + textAfterCursor);

    if (type === 'contact') {
      setTaggedContacts(prev => Array.from(new Set([...prev, entityId])));
    } else {
      setTaggedUserIds(prev => Array.from(new Set([...prev, entityId])));
    }

    setShowMentionList(false);
    textareaRef.current.focus();
  };

  const handleToggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCustomCategory = () => {
    const targetIdeaId = defaultIdeaId || editingNote?.ideaId;
    if (!newCustomCategory.trim() || !targetIdeaId) return;
    const cat = newCustomCategory.trim();
    let currentCustom = currentIdea?.customNoteCategories || [];
    if (typeof currentCustom === 'string') {
      try {
        currentCustom = JSON.parse(currentCustom);
      } catch (e) {
        currentCustom = [];
      }
    }
    if (!Array.isArray(currentCustom)) currentCustom = [];

    if (!currentCustom.includes(cat) && !data.globalNoteCategories.includes(cat)) {
      updateIdea(targetIdeaId, {
        customNoteCategories: [...currentCustom, cat]
      });
    }

    if (!selectedCategories.includes(cat)) {
      setSelectedCategories(prev => [...prev, cat]);
    }
    setNewCustomCategory('');
  };

  const handleRemoveCustomCategory = (e: React.MouseEvent, cat: string) => {
    e.stopPropagation();
    const targetIdeaId = defaultIdeaId || editingNote?.ideaId;
    if (!targetIdeaId || !currentIdea) return;

    let currentCustom = currentIdea?.customNoteCategories || [];
    if (typeof currentCustom === 'string') {
      try {
        currentCustom = JSON.parse(currentCustom);
      } catch (e) {
        currentCustom = [];
      }
    }
    if (!Array.isArray(currentCustom)) currentCustom = [];

    updateIdea(targetIdeaId, {
      customNoteCategories: currentCustom.filter(c => c !== cat)
    });

    if (selectedCategories.includes(cat)) {
      setSelectedCategories(prev => prev.filter(c => c !== cat));
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        setSelectedImage(compressed);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const [locationStr, setLocationStr] = useState(editingNote?.location || 'Detecting location...');

  useEffect(() => {
    if (editingNote) return;

    const fetchLocation = async () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
              if (!res.ok) throw new Error('Geocode failed');
              const data = await res.json();
              const city = data.address.city || data.address.town || data.address.village || data.address.suburb || "Unknown City";
              const country = data.address.country || "";
              setLocationStr(`${city}${country ? ', ' + country : ''}`);
            } catch (e) {
              fetchIPLocation();
            }
          },
          () => fetchIPLocation(),
          { timeout: 5000 }
        );
      } else {
        fetchIPLocation();
      }
    };

    const fetchIPLocation = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.city) {
          setLocationStr(`${data.city}, ${data.country_name}`);
        } else {
          setLocationStr('Unknown Location');
        }
      } catch (e) {
        setLocationStr('Unknown Location');
      }
    };

    fetchLocation();
  }, [editingNote]);

  const handleSave = async () => {
    if (!body.trim() || isSaving) return;
    setIsSaving(true);

    const finalLocation = locationStr === 'Detecting location...' ? 'Unknown Location' : locationStr;

    const now = new Date();
    const [year, month, day] = noteDate.split('-').map(Number);
    const selectedDateWithCurrentTime = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());

    try {
      if (editingNote) {
        await updateNote(editingNote.id, {
          body,
          categories: selectedCategories,
          isPinned,
          taggedContactIds: taggedContacts,
          taggedUserIds: taggedUserIds,
          imageUrl: selectedImage || undefined,
          createdAt: selectedDateWithCurrentTime.toISOString()
        });
      } else {
        await addNote({
          body,
          ideaId: defaultIdeaId || undefined,
          contactId: defaultContactId || undefined,
          categories: selectedCategories,
          isPinned,
          location: finalLocation,
          taggedContactIds: taggedContacts,
          taggedUserIds: taggedUserIds,
          imageUrl: selectedImage || undefined,
          createdAt: selectedDateWithCurrentTime.toISOString()
        });
      }

      if (!editingNote) {
        setBody('');
        setSelectedCategories([]);
        setTaggedContacts([]);
        setTaggedUserIds([]);
        setIsPinned(false);
        setSelectedImage(null);
        setActiveMenu(null);
      }

      if (onComplete) onComplete();
    } catch (err: any) {
      console.error('Save error:', err);
      const message = err.message || 'Failed to save note';
      const detail = err.details || '';
      showToast(`${message}${detail ? ': ' + detail : ''}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div
      className={`relative group transition-all animate-in fade-in slide-in-from-top-2`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`transition-all relative ${flat ? '' : `rounded-[32px] border border-yellow-300 shadow-sm bg-[#FEFADA] ${isDragging ? 'ring-4 ring-yellow-400 ring-opacity-50' : ''} ${editingNote ? 'border-indigo-100' : ''}`}`}>
        {title && (
          <div className="pt-10 px-10 flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              {titleIcon}
              {title}
            </h3>
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-black/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <div className="relative p-6">
          <textarea
            ref={textareaRef}
            className={`w-full min-h-[160px] p-6 text-sm outline-none resize-none transition-all placeholder:text-gray-400 bg-white rounded-[24px] shadow-sm font-normal leading-relaxed font-sans text-slate-700 border border-yellow-100`}
            placeholder="Capture a thought... (Pro-tip: Type @ to mention someone)"
            value={body}
            onChange={handleTextChange}
          />

          <div className="absolute top-8 right-8 flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm bg-white/80 backdrop-blur-sm border border-gray-100"
              title="Add Image"
            >
              <Image className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => setSelectedImage(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }}
            />
          </div>

          {showMentionList && mentionCandidates.length > 0 && (
            <div
              className="absolute z-50 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95"
              style={{
                top: mentionPosition.top,
                left: mentionPosition.left
              }}
            >
              {mentionCandidates.map((candidate) => (
                <button
                  key={`${candidate.type}-${candidate.id}`}
                  onClick={() => insertMention(candidate.id, candidate.name, candidate.type)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${candidate.type === 'user' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {candidate.name.charAt(0)}
                  </div>
                  <span className="text-[11px] font-bold text-gray-700">{candidate.name}</span>
                </button>
              ))}
            </div>
          )}

          {selectedImage && (
            <div className="mt-4 relative group/img inline-block">
              <img src={selectedImage} alt="Preview" className="max-h-48 rounded-2xl shadow-lg border-4 border-white" />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-lg opacity-0 group-hover/img:opacity-100 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {editingNote && (
          <div className="px-6 py-4 bg-white/50 border-t border-yellow-100/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  max={today}
                  className="pl-9 pr-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                />
              </div>
              <button
                onClick={() => setIsPinned(!isPinned)}
                className={`h-8 px-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border ${isPinned ? 'bg-yellow-100 border-yellow-200 text-yellow-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
              >
                <Pin className={`w-3 h-3 ${isPinned ? 'fill-current' : ''}`} />
                {isPinned ? 'Pinned' : 'Pin Note'}
              </button>
            </div>

            <button
              onClick={onComplete}
              className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase text-gray-400 hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="px-8 pb-8 pt-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'tags' ? null : 'tags')}
                className={`h-11 px-5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 border ${activeMenu === 'tags' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-gray-100/80 border-transparent text-gray-500 hover:bg-gray-200'
                  }`}
              >
                <Tag className="w-3.5 h-3.5" />
                +Tags
                <ChevronDown className={`w-3 h-3 transition-transform ${activeMenu === 'tags' ? 'rotate-180' : ''}`} />
              </button>

              {activeMenu === 'tags' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                  <div className="absolute bottom-full left-0 mb-3 w-64 bg-white border border-gray-200 rounded-3xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2 z-50">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Select Categories</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {availableCategories.map(cat => {
                        const isGlobal = data.globalNoteCategories.includes(cat);
                        return (
                          <div key={cat} className="group/tag relative">
                            <button
                              onClick={() => handleToggleCategory(cat)}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${selectedCategories.includes(cat)
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400 hover:text-indigo-600 shadow-sm'
                                }`}
                            >
                              {cat}
                            </button>
                            {!isGlobal && (
                              <button
                                onClick={(e) => handleRemoveCustomCategory(e, cat)}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-70 group-hover/tag:opacity-100 transition-all hover:bg-red-700 shadow-md z-10 border-2 border-white"
                                title="Delete custom tag"
                              >
                                <X className="w-2.5 h-2.5 stroke-[4px]" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-300">
                      <Plus className="w-3 h-3 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Add custom tag..."
                        className="bg-transparent text-[10px] font-bold outline-none w-full"
                        value={newCustomCategory}
                        onChange={(e) => setNewCustomCategory(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCategory()}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === 'templates' ? null : 'templates')}
                className={`h-11 px-5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 border ${activeMenu === 'templates' ? 'bg-pink-100 border-pink-200 text-pink-700' : 'bg-gray-100/80 border-transparent text-gray-500 hover:bg-gray-200'
                  }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                +Templates
                <ChevronDown className={`w-3 h-3 transition-transform ${activeMenu === 'templates' ? 'rotate-180' : ''}`} />
              </button>

              {activeMenu === 'templates' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                  <div className="absolute bottom-full left-0 mb-3 w-56 bg-white border border-gray-100 rounded-3xl shadow-2xl p-2 animate-in fade-in slide-in-from-bottom-2 z-50 overflow-hidden">
                    <button
                      onClick={() => { setShowCallMinuteModal(true); setActiveMenu(null); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                        <Zap className="w-4 h-4 text-indigo-500" />
                      </div>
                      Meeting (Minutes)
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all group opacity-50 cursor-not-allowed">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-orange-500" />
                      </div>
                      Insight
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all group opacity-50 cursor-not-allowed">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-blue-500" />
                      </div>
                      Follow up
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all group opacity-50 cursor-not-allowed">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-purple-500" />
                      </div>
                      Decision
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all group opacity-50 cursor-not-allowed">
                      <div className="w-8 h-8 rounded-xl bg-pink-50 flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-pink-400" />
                      </div>
                      Generate AI Summary
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            disabled={!body.trim() || isSaving}
            onClick={handleSave}
            className="h-11 px-8 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-indigo-100/50 flex items-center gap-2"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {editingNote ? (isSaving ? 'Updating...' : 'Update') : (isSaving ? 'Saving...' : 'Add Text Note')}
          </button>
        </div>
      </div>

      {!editingNote && (
        <CallMinuteModal
          isOpen={showCallMinuteModal}
          onClose={() => setShowCallMinuteModal(false)}
          ideaId={defaultIdeaId}
          contactId={defaultContactId}
          location={locationStr}
          idea={currentIdea}
        />
      )}
    </div>
  );
};

export default NoteComposer;
