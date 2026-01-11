
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Save, Calendar, Tag, MapPin, Pin, Plus, AtSign, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Note } from '../types';

interface NoteComposerProps {
  onComplete?: () => void;
  defaultIdeaId?: string;
  defaultContactId?: string;
  editingNote?: Note;
}

const NoteComposer: React.FC<NoteComposerProps> = ({ onComplete, defaultIdeaId, defaultContactId, editingNote }) => {
  const { data, addNote, updateNote, updateIdea } = useStore();
  const [body, setBody] = useState(editingNote?.body || '');
  const [noteDate, setNoteDate] = useState(format(editingNote ? new Date(editingNote.createdAt) : new Date(), 'yyyy-MM-dd'));
  const [selectedCategories, setSelectedCategories] = useState<string[]>(editingNote?.categories || []);
  const [isPinned, setIsPinned] = useState(editingNote?.isPinned || false);
  const [taggedContacts, setTaggedContacts] = useState<string[]>(editingNote?.taggedContactIds || []);
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>(editingNote?.taggedUserIds || []);
  const [newCustomCategory, setNewCustomCategory] = useState('');

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
    const custom = currentIdea?.customNoteCategories || [];
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

    // Deduplicate (someone might be a user and a contact)
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

      // Basic positioning logic (approximate)
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
    const currentCustom = currentIdea?.customNoteCategories || [];
    if (!currentCustom.includes(cat)) {
      updateIdea(targetIdeaId, {
        customNoteCategories: [...currentCustom, cat]
      });
    }
    handleToggleCategory(cat);
    setNewCustomCategory('');
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
    if (!body.trim()) return;

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
          createdAt: selectedDateWithCurrentTime.toISOString()
        });
      }

      if (!editingNote) {
        setBody('');
        setSelectedCategories([]);
        setTaggedContacts([]);
        setTaggedUserIds([]);
        setIsPinned(false);
      }

      if (onComplete) onComplete();
    } catch (err) {
      console.error('Failed to save note:', err);
      alert('Failed to save note. Please check the console for details.');
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className={`space-y-4 p-4 rounded-2xl border transition-all animate-in fade-in slide-in-from-top-2 ${editingNote ? 'bg-white border-indigo-200 shadow-lg' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="w-full min-h-[120px] p-4 text-sm border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-gray-50/50 shadow-inner transition-all font-mono"
          placeholder="Capture a thought... (Pro-tip: Type @ to mention someone)"
          value={body}
          onChange={handleTextChange}
        />

        {/* Mention Dropdown */}
        {showMentionList && (
          <div
            className="absolute z-[100] w-48 bg-white border border-gray-200 rounded-xl shadow-2xl p-1 animate-in zoom-in-95 duration-100"
            style={{ top: mentionPosition.top, left: mentionPosition.left }}
          >
            {mentionCandidates.length > 0 ? mentionCandidates.map(c => (
              <button
                key={`${c.type}-${c.id}`}
                onClick={() => insertMention(c.id, c.name, c.type)}
                className="w-full text-left px-3 py-2 text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2"
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${c.type === 'user' ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {c.type === 'user' ? <AtSign className="w-3 h-3" /> : c.name[0]}
                </div>
                <div className="flex flex-col">
                  <span className="truncate">{c.name}</span>
                  <span className="text-[8px] uppercase tracking-tighter opacity-50">{c.type}</span>
                </div>
              </button>
            )) : (
              <div className="px-3 py-2 text-xs text-gray-400 italic">No candidates found</div>
            )}
          </div>
        )}

        <button
          onClick={() => setIsPinned(!isPinned)}
          className={`absolute top-4 right-4 p-2 rounded-lg transition-all ${isPinned ? 'bg-yellow-100 text-yellow-600 shadow-sm' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
          title="Pin this note (only one per idea)"
        >
          <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Category Chips */}
      <div className="flex flex-wrap gap-2">
        {availableCategories.map(cat => (
          <button
            key={cat}
            onClick={() => handleToggleCategory(cat)}
            className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${selectedCategories.includes(cat)
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
              : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600'
              }`}
          >
            {cat}
          </button>
        ))}
        {(defaultIdeaId || editingNote?.ideaId) && (
          <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
            <input
              type="text"
              placeholder="Custom tag..."
              className="bg-transparent text-[10px] outline-none w-20 py-0.5"
              value={newCustomCategory}
              onChange={(e) => setNewCustomCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCategory()}
            />
            <button onClick={handleAddCustomCategory} className="text-gray-400 hover:text-indigo-600">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2 border-t border-gray-50">
        <div className="flex items-center gap-4">
          <div className="relative group/date">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none group-hover/date:text-indigo-500 transition-colors" />
            <input
              type="date"
              max={today}
              className="pl-9 pr-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
            <MapPin className="w-3 h-3" />
            {locationStr}
          </div>
          {taggedContacts.length + taggedUserIds.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500">
              <AtSign className="w-3 h-3" />
              {taggedContacts.length + taggedUserIds.length} Linked
            </div>
          )}
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {editingNote && onComplete && (
            <button
              onClick={onComplete}
              className="flex-1 sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
          )}
          <button
            disabled={!body.trim()}
            onClick={handleSave}
            className="flex-2 sm:w-auto bg-indigo-600 text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            {editingNote ? 'Update Note' : 'Add Note'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoteComposer;
