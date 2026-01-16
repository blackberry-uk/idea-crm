import React, { useState, useMemo, useRef } from 'react';
import { X, ClipboardList, Type, MessageSquare, Info, Users, Plus, Trash2, AtSign, ChevronDown, ChevronUp, Minus, Eye, EyeOff, Calendar, Edit2, RotateCcw, CircleDot, Brain, Mountain, SlidersHorizontal, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { format } from 'date-fns';
import { Idea, Note } from '../types';

interface CallMinuteModalProps {
    isOpen: boolean;
    onClose: () => void;
    ideaId?: string;
    contactId?: string;
    location?: string;
    idea?: Idea;
    editingNote?: Note;
}

const INPUT_TYPES = [
    { id: 'Insight', label: 'Insight', icon: Brain, color: 'text-indigo-500', bg: 'bg-indigo-50', hover: 'hover:bg-indigo-50' },
    { id: 'Agreement', label: 'Agreement', icon: Check, color: 'text-emerald-500', bg: 'bg-emerald-50', hover: 'hover:bg-emerald-50' },
    { id: 'To do', label: 'To do', icon: SlidersHorizontal, color: 'text-orange-500', bg: 'bg-orange-50', hover: 'hover:bg-orange-50' },
    { id: 'Data Point', label: 'Data Point', icon: Info, color: 'text-blue-500', bg: 'bg-blue-50', hover: 'hover:bg-blue-50' },
    { id: 'Reference', label: 'Reference', icon: MessageSquare, color: 'text-gray-500', bg: 'bg-gray-50', hover: 'hover:bg-gray-50' },
    { id: 'Decision', label: 'Decision', icon: CircleDot, color: 'text-purple-500', bg: 'bg-purple-50', hover: 'hover:bg-purple-50' }
];

const CallMinuteModal: React.FC<CallMinuteModalProps> = ({ isOpen, onClose, ideaId, contactId, location, idea, editingNote }) => {
    const { data, addNote, updateNote, updateIdea, showToast } = useStore();
    const [attendees, setAttendees] = useState('');
    const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
    const [attendeeSearch, setAttendeeSearch] = useState('');
    const [showAttendeeList, setShowAttendeeList] = useState(false);
    const [meetingDate, setMeetingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [segments, setSegments] = useState<{ type: string; topic: string; comments: string }[]>([]);
    const [currentSegment, setCurrentSegment] = useState({
        type: 'Insight',
        topic: '',
        comments: ''
    });
    const [collapsedItems, setCollapsedItems] = useState<number[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [showComposer, setShowComposer] = useState(true);
    const [typeSelectorOpen, setTypeSelectorOpen] = useState(false);
    const [editingSegmentIdx, setEditingSegmentIdx] = useState<number | null>(null);

    // Mention system state for segments
    const [mentionQuery, setMentionQuery] = useState('');
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
    const [taggedContactIdsState, setTaggedContactIdsState] = useState<string[]>([]);
    const [taggedUserIdsState, setTaggedUserIdsState] = useState<string[]>([]);
    const segmentTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Initialize state from editingNote
    React.useEffect(() => {
        if (isOpen && editingNote) {
            try {
                const structuredData = JSON.parse(editingNote.body);
                if (structuredData.template === 'call-minute') {
                    setAttendees(structuredData.attendees || '');
                    setSegments(structuredData.segments || []);
                    setMeetingDate(structuredData.date || format(new Date(editingNote.createdAt), 'yyyy-MM-dd'));
                    setTaggedContactIdsState(editingNote.taggedContactIds || []);
                    setTaggedUserIdsState(editingNote.taggedUserIds || []);

                    // Match attendee names back to IDs if possible
                    const attendeeNames = (structuredData.attendees || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                    const ids: string[] = [];
                    attendeeNames.forEach((name: string) => {
                        const match = [...data.contacts.map(c => ({ id: c.id, name: c.fullName })), ...data.users.map(u => ({ id: u.id, name: u.name }))].find(c => c.name === name);
                        if (match) ids.push(match.id);
                    });
                    setSelectedAttendeeIds(ids);
                }
            } catch (e) {
                console.error('Failed to parse editing note', e);
            }
        } else if (isOpen) {
            setSegments([]);
            setAttendees('');
            setMeetingDate(format(new Date(), 'yyyy-MM-dd'));
            setTaggedContactIdsState([]);
            setTaggedUserIdsState([]);
            setSelectedAttendeeIds([]);
            setCurrentSegment({ type: 'Insight', topic: '', comments: '' });
            setEditingSegmentIdx(null);
        }
    }, [isOpen, editingNote, data.contacts, data.users]);

    const mentionCandidates = useMemo(() => {
        const list: { id: string; name: string; type: 'user' | 'contact' }[] = [
            ...data.contacts.map(c => ({ id: c.id, name: c.fullName, type: 'contact' as const })),
        ];

        if (idea) {
            const owner = data.users.find(u => u.id === idea.ownerId);
            if (owner) list.push({ id: owner.id, name: owner.name, type: 'user' as const });
            const collabs = data.users.filter(u => idea.collaboratorIds?.includes(u.id));
            collabs.forEach(u => list.push({ id: u.id, name: u.name, type: 'user' as const }));
        }

        const unique = Array.from(new Map(list.map(item => [item.id, item])).values());

        if (!mentionQuery) return unique.slice(0, 5);
        return unique.filter(c =>
            c.name.toLowerCase().includes(mentionQuery.toLowerCase())
        ).slice(0, 5);
    }, [data.contacts, data.users, idea, mentionQuery]);

    const attendeeCandidates = useMemo(() => {
        const list: { id: string; name: string; type: 'user' | 'contact' }[] = [
            ...data.contacts.map(c => ({ id: c.id, name: c.fullName, type: 'contact' as const })),
        ];

        if (idea) {
            const owner = data.users.find(u => u.id === idea.ownerId);
            if (owner) list.push({ id: owner.id, name: owner.name, type: 'user' as const });
            const collabs = data.users.filter(u => idea.collaboratorIds?.includes(u.id));
            collabs.forEach(u => list.push({ id: u.id, name: u.name, type: 'user' as const }));
        }

        const unique = Array.from(new Map(list.map(item => [item.id, item])).values());
        const filtered = unique.filter(c => !selectedAttendeeIds.includes(c.id));

        if (!attendeeSearch) return [];
        return filtered.filter(c => c.name.toLowerCase().includes(attendeeSearch.toLowerCase())).slice(0, 8);
    }, [data.contacts, data.users, idea, attendeeSearch, selectedAttendeeIds]);

    if (!isOpen) return null;

    const addAttendee = (candidate: { id: string; name: string }) => {
        setSelectedAttendeeIds([...selectedAttendeeIds, candidate.id]);
        const current = attendees ? attendees.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (!current.includes(candidate.name)) {
            setAttendees([...current, candidate.name].join(', '));
        }
        setAttendeeSearch('');
        setShowAttendeeList(false);
    };

    const removeAttendeeTag = (name: string, id: string) => {
        setSelectedAttendeeIds(selectedAttendeeIds.filter(idx => idx !== id));
        const current = attendees.split(',').map(s => s.trim()).filter(Boolean);
        setAttendees(current.filter(n => n !== name).join(', '));
    };

    const handleCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPosition);
        const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

        setCurrentSegment({ ...currentSegment, comments: value });

        if (mentionMatch) {
            setMentionQuery(mentionMatch[1]);
            setShowMentionList(true);

            const rect = e.target.getBoundingClientRect();
            const parentRect = e.target.offsetParent?.getBoundingClientRect();
            if (parentRect) {
                const lineHeight = 20;
                const lines = textBeforeCursor.split('\n');
                const currentLineIndex = lines.length - 1;
                setMentionPosition({
                    top: (currentLineIndex + 1) * lineHeight + 10,
                    left: (lines[currentLineIndex].length * 7) + 30
                });
            }
        } else {
            setShowMentionList(false);
        }
    };

    const insertMention = (entityId: string, name: string, type: 'user' | 'contact') => {
        if (!segmentTextareaRef.current) return;
        const cursorPosition = segmentTextareaRef.current.selectionStart;
        const textBeforeCursor = currentSegment.comments.slice(0, cursorPosition);
        const textAfterCursor = currentSegment.comments.slice(cursorPosition);

        const newTextBefore = textBeforeCursor.replace(/@(\w*)$/, `@${name} `);
        setCurrentSegment({ ...currentSegment, comments: newTextBefore + textAfterCursor });

        if (type === 'contact') {
            setTaggedContactIdsState(prev => Array.from(new Set([...prev, entityId])));
        } else {
            setTaggedUserIdsState(prev => Array.from(new Set([...prev, entityId])));
        }

        setShowMentionList(false);
        segmentTextareaRef.current.focus();
    };

    const handleAddSegment = () => {
        if (!currentSegment.topic.trim() && !currentSegment.comments.trim()) {
            showToast('Please add at least a topic or comments to this item', 'error');
            return;
        }
        if (editingSegmentIdx !== null) {
            const newSegments = [...segments];
            newSegments[editingSegmentIdx] = currentSegment;
            setSegments(newSegments);
            setEditingSegmentIdx(null);
            showToast('Item updated', 'success');
        } else {
            setSegments([...segments, currentSegment]);
            showToast('Item added to call log', 'success');
        }
        setCurrentSegment({ type: 'Insight', topic: '', comments: '' });
    };

    const handleEditSegment = (idx: number) => {
        setCurrentSegment(segments[idx]);
        setEditingSegmentIdx(idx);
        setShowComposer(true);
    };

    const removeSegment = (idx: number) => {
        setSegments(segments.filter((_, i) => i !== idx));
        if (editingSegmentIdx === idx) {
            setEditingSegmentIdx(null);
            setCurrentSegment({ type: 'Insight', topic: '', comments: '' });
        }
    };

    const handleDragStart = (idx: number) => {
        setDraggedIndex(idx);
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === idx) return;

        const newSegments = [...segments];
        const draggedItem = newSegments[draggedIndex];
        newSegments.splice(draggedIndex, 1);
        newSegments.splice(idx, 0, draggedItem);

        setSegments(newSegments);
        setDraggedIndex(idx);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalSegments = segments;
        if (currentSegment.topic.trim() || currentSegment.comments.trim()) {
            if (editingSegmentIdx !== null) {
                finalSegments = [...segments];
                finalSegments[editingSegmentIdx] = currentSegment;
            } else {
                finalSegments = [...segments, currentSegment];
            }
        }

        if (finalSegments.length === 0) {
            showToast('Please add at least one item to the call log', 'error');
            return;
        }

        const structuredBody = JSON.stringify({
            template: 'call-minute',
            date: meetingDate,
            attendees,
            segments: finalSegments
        });

        try {
            let savedNote: any;
            if (editingNote) {
                savedNote = await updateNote(editingNote.id, {
                    body: structuredBody,
                    taggedContactIds: Array.from(new Set([...taggedContactIdsState, ...selectedAttendeeIds.filter(id => data.contacts.some(c => c.id === id))])),
                    taggedUserIds: Array.from(new Set([...taggedUserIdsState, ...selectedAttendeeIds.filter(id => data.users.some(u => u.id === id))])),
                    createdAt: new Date(meetingDate + 'T12:00:00Z').toISOString()
                });
                showToast('Call Minute updated', 'success');
            } else {
                savedNote = await addNote({
                    body: structuredBody,
                    ideaId,
                    contactId,
                    location: location || 'Unknown Location',
                    categories: ['Call Minute'],
                    taggedContactIds: Array.from(new Set([...taggedContactIdsState, ...selectedAttendeeIds.filter(id => data.contacts.some(c => c.id === id))])),
                    taggedUserIds: Array.from(new Set([...taggedUserIdsState, ...selectedAttendeeIds.filter(id => data.users.some(u => u.id === id))])),
                    createdAt: new Date(meetingDate + 'T12:00:00Z').toISOString()
                });
                showToast('Call Minute saved', 'success');
            }

            const resolvedIdeaId = ideaId || editingNote?.ideaId;
            if (resolvedIdeaId && savedNote?.id) {
                const latestIdea = data.ideas.find(i => i.id === resolvedIdeaId);
                const currentTodos = latestIdea?.todos || [];

                const newTodos = finalSegments
                    .filter(seg => seg.type === 'To do')
                    .filter(seg => !currentTodos.some(t => t.text.includes(seg.topic) && t.originNoteId === savedNote.id))
                    .map(seg => ({
                        id: Math.random().toString(36).substring(7),
                        text: seg.topic + (seg.comments ? `: ${seg.comments}` : ''),
                        completed: false,
                        isUrgent: false,
                        createdAt: new Date().toISOString(),
                        status: 'Not Started' as const,
                        originNoteId: savedNote.id
                    }));

                if (newTodos.length > 0) {
                    await updateIdea(resolvedIdeaId, {
                        todos: [...currentTodos, ...newTodos]
                    });
                    showToast(`${newTodos.length} task(s) added to your TO DOS`, 'info');
                }
            }
            onClose();
        } catch (err: any) {
            showToast(err.message || 'Failed to save', 'error');
        }
    };

    const renderComposer = (isInline: boolean = false) => (
        <div className={`${isInline ? 'bg-indigo-50/50 border-indigo-200' : 'bg-[#FEFADA] border-yellow-200'} border rounded-3xl p-6 shadow-sm space-y-3 relative animate-in fade-in slide-in-from-top-2 duration-200`}>
            <div className={`flex items-center justify-between border-b ${isInline ? 'border-indigo-200/30' : 'border-yellow-200/30'} pb-4`}>
                <div className="flex items-center gap-2">
                    <label className={`text-[10px] font-black ${isInline ? 'text-indigo-700/60' : 'text-yellow-700/60'} uppercase tracking-[0.15em]`}>
                        {editingSegmentIdx !== null ? 'Editing Item Detail' : 'New Item Detail'}
                    </label>
                </div>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setTypeSelectorOpen(!typeSelectorOpen)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${isInline ? 'bg-indigo-600' : 'bg-indigo-600'} text-white shadow-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors`}
                    >
                        {currentSegment.type}
                        <ChevronDown className={`w-3 h-3 transition-transform ${typeSelectorOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {typeSelectorOpen && (
                        <>
                            <div className="fixed inset-0 z-[110]" onClick={() => setTypeSelectorOpen(false)} />
                            <div className="absolute top-full right-0 mt-3 bg-white border border-gray-100 rounded-[24px] shadow-2xl z-[120] p-2 w-48 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-3 pt-2">Item Type</h4>
                                {INPUT_TYPES.map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => {
                                            setCurrentSegment({ ...currentSegment, type: t.id });
                                            setTypeSelectorOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2.5 text-[11px] font-bold rounded-xl transition-all flex items-center gap-3 ${currentSegment.type === t.id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${currentSegment.type === t.id ? 'bg-white/20' : t.bg}`}>
                                            <t.icon className={`w-3.5 h-3.5 ${currentSegment.type === t.id ? 'text-white' : t.color}`} />
                                        </div>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                    <div className="relative">
                        <Type className={`absolute left-3 top-3 w-3.5 h-3.5 ${isInline ? 'text-indigo-700/50' : 'text-yellow-700/50'}`} />
                        <input
                            className={`w-full border ${isInline ? 'border-indigo-500/30' : 'border-yellow-500/30'} rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none bg-white placeholder:text-gray-400 font-medium text-gray-700 focus:border-indigo-400 transition-all shadow-sm`}
                            placeholder="Topic of this item..."
                            value={currentSegment.topic}
                            onChange={e => setCurrentSegment({ ...currentSegment, topic: e.target.value })}
                        />
                    </div>

                    <div className="relative">
                        <MessageSquare className={`absolute left-3 top-3 w-3.5 h-3.5 ${isInline ? 'text-indigo-700/50' : 'text-yellow-700/50'}`} />
                        <textarea
                            ref={segmentTextareaRef}
                            className={`w-full border ${isInline ? 'border-indigo-500/30' : 'border-yellow-500/30'} rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none bg-white placeholder:text-gray-400 font-normal min-h-[100px] resize-none text-gray-600 focus:border-indigo-400 transition-all shadow-sm`}
                            placeholder="Add comments, data, or next steps... (Type @ to mention)"
                            value={currentSegment.comments}
                            onChange={handleCommentsChange}
                        />

                        {showMentionList && (
                            <div
                                className="absolute z-[120] w-56 bg-white border border-gray-200 rounded-2xl shadow-2xl p-1 animate-in zoom-in-95"
                                style={{ top: mentionPosition.top, left: mentionPosition.left }}
                            >
                                {mentionCandidates.map(c => (
                                    <button
                                        key={`${c.type}-${c.id}`}
                                        type="button"
                                        onClick={() => insertMention(c.id, c.name, c.type)}
                                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 rounded-xl flex items-center gap-3"
                                    >
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${c.type === 'user' ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                            {c.type === 'user' ? <AtSign className="w-3.5 h-3.5" /> : c.name[0]}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="truncate">{c.name}</span>
                                            <span className="text-[8px] uppercase tracking-tighter opacity-50">{c.type}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    {isInline && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingSegmentIdx(null);
                                setCurrentSegment({ type: 'Insight', topic: '', comments: '' });
                            }}
                            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl shadow-sm border border-gray-200 transition-all flex items-center justify-center active:scale-95"
                            title="Cancel edit"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleAddSegment}
                        className={`w-10 h-10 ${isInline ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-yellow-400 text-yellow-950 border-yellow-500/50'} rounded-xl shadow-md border transition-all flex items-center justify-center active:scale-95 group/add`}
                        title={isInline ? "Update item" : "Add this item"}
                    >
                        {isInline ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 my-8">
                <div className="flex items-center justify-between p-4 border-b bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-bold tracking-tight text-gray-900">Call Minute Template</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-0 max-h-[75vh] overflow-y-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] divide-x divide-gray-100 min-h-[500px]">
                        <div className="p-8 space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Note Workspace</label>
                                        <button
                                            onClick={() => setShowComposer(!showComposer)}
                                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                                            title={showComposer ? "Hide Workspace" : "Show Workspace"}
                                        >
                                            {showComposer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                        <input
                                            type="date"
                                            value={meetingDate}
                                            onChange={(e) => setMeetingDate(e.target.value)}
                                            className="bg-transparent text-[11px] font-bold text-gray-600 outline-none w-32"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Main Composer for NEW Items (only shown when not editing) */}
                            {showComposer && editingSegmentIdx === null && (
                                renderComposer()
                            )}

                            {/* Display Stacked Items - Draggable */}
                            {segments.length > 0 && (
                                <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="flex items-center justify-between px-2">
                                        <label className="text-sm font-black text-gray-400 uppercase tracking-widest">Stacked Items ({segments.length})</label>
                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest italic">Drag to reorder</span>
                                    </div>
                                    <div className="space-y-4">
                                        {segments.map((seg, i) => {
                                            const isCollapsed = collapsedItems.includes(i);
                                            const toggleCollapse = () => setCollapsedItems(prev =>
                                                prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                                            );

                                            if (editingSegmentIdx === i) {
                                                return (
                                                    <div key={`edit-${i}`} className="animate-in fade-in zoom-in-95 duration-200">
                                                        {renderComposer(true)}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={i}
                                                    draggable={editingSegmentIdx === null}
                                                    onDragStart={() => handleDragStart(i)}
                                                    onDragOver={(e) => handleDragOver(e, i)}
                                                    onDragEnd={handleDragEnd}
                                                    className={`bg-white rounded-2xl border border-gray-400 overflow-hidden group transition-all ${editingSegmentIdx === null ? 'cursor-move' : 'cursor-default'} ${draggedIndex === i ? 'opacity-30 scale-95' : 'hover:border-indigo-200 hover:shadow-lg shadow-sm'}`}
                                                >
                                                    <div className="flex items-center justify-between p-4 px-5">
                                                        <div className="flex items-center gap-4">
                                                            {editingSegmentIdx === null && (
                                                                <div className="flex flex-col gap-1 opacity-10 group-hover:opacity-40 transition-opacity shrink-0">
                                                                    <div className="w-3 h-0.5 bg-gray-400" />
                                                                    <div className="w-3 h-0.5 bg-gray-400" />
                                                                    <div className="w-3 h-0.5 bg-gray-400" />
                                                                </div>
                                                            )}
                                                            <span className="text-sm font-bold text-gray-700 truncate">{seg.topic || 'Unspecified Topic'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded border border-indigo-200">{seg.type}</span>
                                                            <div className="h-4 w-[1px] bg-gray-100" />
                                                            <div className="flex items-center gap-2">
                                                                {seg.comments && (
                                                                    <button
                                                                        onClick={toggleCollapse}
                                                                        className="p-2 bg-gray-50 text-indigo-400 hover:text-indigo-600 rounded-lg transition-all border border-transparent hover:border-indigo-100"
                                                                    >
                                                                        {isCollapsed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleEditSegment(i)}
                                                                    className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                                    disabled={editingSegmentIdx !== null}
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => removeSegment(i)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {!isCollapsed && seg.comments && (
                                                        <div className="p-6 pt-0 border-t border-gray-200 mt-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap animate-in slide-in-from-top-2">
                                                            {seg.comments}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-[#F2F3F4] p-10 space-y-8">
                            <div className="space-y-6">
                                <label className="block text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Users className="w-4 h-4 text-indigo-500" />
                                    Meeting Attendees
                                </label>

                                <div className="relative">
                                    <input
                                        className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-medium transition-all"
                                        placeholder="Add attendee..."
                                        value={attendeeSearch}
                                        onChange={e => {
                                            setAttendeeSearch(e.target.value);
                                            setShowAttendeeList(true);
                                        }}
                                        onFocus={() => setShowAttendeeList(true)}
                                    />
                                    {showAttendeeList && attendeeSearch.length > 0 && attendeeCandidates.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-gray-100 rounded-[24px] shadow-2xl z-[130] overflow-hidden animate-in fade-in slide-in-from-top-3">
                                            <div className="p-3 space-y-1">
                                                {attendeeCandidates.map(c => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => addAttendee(c)}
                                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-all rounded-[16px] text-left border border-transparent hover:border-indigo-100"
                                                    >
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${c.type === 'user' ? 'bg-indigo-500' : 'bg-violet-500'}`}>
                                                            {c.name[0]}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-900">{c.name}</p>
                                                            <p className="text-[9px] font-black text-gray-300 uppercase tracking-tighter">
                                                                {c.type}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2.5">
                                    {attendees.split(',').map(s => s.trim()).filter(Boolean).map((name, i) => {
                                        const candidate = [...data.contacts.map(c => ({ id: c.id, name: c.fullName })), ...data.users.map(u => ({ id: u.id, name: u.name }))].find(c => c.name === name);
                                        return (
                                            <div key={i} className="flex items-center justify-between bg-white border border-indigo-100/50 p-4 rounded-2xl shadow-sm group animate-in slide-in-from-right-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[9px] font-black">
                                                        {name[0]}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700">{name}</span>
                                                </div>
                                                <button
                                                    onClick={() => removeAttendeeTag(name, candidate?.id || '')}
                                                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {(!attendees || attendees.split(',').filter(Boolean).length === 0) && (
                                        <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-[28px]">
                                            <Users className="w-8 h-8 text-gray-100 mx-auto mb-3" />
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">No Attendees</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-gray-50/80 border-t flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 flex items-start gap-3">
                        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                            Stack multiple insights, decisions, and todos from a single call. These will be logged as one structured note.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="w-full md:w-auto px-8 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div >
    );
};

export default CallMinuteModal;
