import React, { useState } from 'react';
import { X, Layout, Plus, Trash2, Calendar, Users, AlertCircle, CheckCircle2, Circle, MoreVertical, Archive, ClipboardList, Zap, Flag, MessageSquare, Save, Clock } from 'lucide-react';
import { Idea, Todo, User, Note } from '../types';
import { format, parseISO } from 'date-fns';
import { getInitials, getAvatarColor } from '../lib/utils';

interface KanbanModalProps {
    isOpen: boolean;
    onClose: () => void;
    idea: Idea;
    users: User[];
    notes: Note[];
    onUpdateIdea: (id: string, updates: Partial<Idea>) => Promise<any>;
}

type ColumnType = 'Not Started' | 'Working' | 'Done' | 'Archived';

const COLUMNS: ColumnType[] = ['Not Started', 'Working', 'Done', 'Archived'];

const KanbanModal: React.FC<KanbanModalProps> = ({ isOpen, onClose, idea, users, notes, onUpdateIdea }) => {
    const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
    const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);
    const [editingComments, setEditingComments] = useState<{ [key: string]: string }>({});

    if (!isOpen) return null;

    const todos = idea.todos || [];

    const getTodosByStatus = (status: ColumnType) => {
        return todos
            .filter(t => {
                const currentStatus = t.status || (t.completed ? 'Done' : 'Not Started');
                if (status === 'Done') return currentStatus === 'Done' && t.status !== 'Archived';
                if (status === 'Archived') return t.status === 'Archived';
                if (status === 'Not Started') return currentStatus === 'Not Started';
                if (status === 'Working') return currentStatus === 'Working';
                return false;
            })
            .sort((a, b) => {
                // Urgent first
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                // Then by creation date (newest first)
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedTodoId(id);
        e.dataTransfer.setData('todoId', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetStatus: ColumnType) => {
        e.preventDefault();
        const todoId = e.dataTransfer.getData('todoId');
        if (!todoId) return;

        const newTodos = todos.map(t => {
            if (t.id === todoId) {
                const isCompleted = targetStatus === 'Done' || targetStatus === 'Archived';
                return {
                    ...t,
                    status: targetStatus,
                    completed: targetStatus === 'Done' ? true : (targetStatus === 'Archived' ? t.completed : false),
                    completedAt: targetStatus === 'Done' ? (t.completedAt || new Date().toISOString()) : (t.completed ? t.completedAt : undefined)
                };
            }
            return t;
        });

        await onUpdateIdea(idea.id, { todos: newTodos });
        setDraggedTodoId(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const toggleTodoDone = async (todoId: string) => {
        const newTodos = todos.map(t => {
            if (t.id === todoId) {
                const nowDone = !t.completed;
                return {
                    ...t,
                    completed: nowDone,
                    completedAt: nowDone ? new Date().toISOString() : undefined,
                    status: nowDone ? 'Done' : 'Working'
                };
            }
            return t;
        });
        await onUpdateIdea(idea.id, { todos: newTodos });
    };

    const toggleUrgent = async (todoId: string) => {
        const newTodos = todos.map(t =>
            t.id === todoId ? { ...t, isUrgent: !t.isUrgent } : t
        );
        await onUpdateIdea(idea.id, { todos: newTodos });
    };

    const updateDueDate = async (todoId: string, dueDate: string) => {
        const newTodos = todos.map(t =>
            t.id === todoId ? { ...t, dueDate } : t
        );
        await onUpdateIdea(idea.id, { todos: newTodos });
    };

    const saveComments = async (todoId: string) => {
        const newTodos = todos.map(t =>
            t.id === todoId ? { ...t, comments: editingComments[todoId] } : t
        );
        await onUpdateIdea(idea.id, { todos: newTodos });
        setExpandedTodoId(null);
    };

    const deleteTodo = async (todoId: string) => {
        const newTodos = todos.filter(t => t.id !== todoId);
        await onUpdateIdea(idea.id, { todos: newTodos });
        setExpandedTodoId(null);
    };

    const getSourceReference = (originNoteId?: string) => {
        if (!originNoteId) return null;
        const note = notes.find(n => n.id === originNoteId);
        if (!note) return "Meeting Minute";
        return `Meeting on ${format(new Date(note.createdAt), 'MMM d, yyyy')}`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-hidden">
            <div className="bg-[#F8F9FA] rounded-[32px] shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-gray-100 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{ backgroundColor: 'var(--primary-shadow)', color: 'var(--primary)' }}
                        >
                            <Layout className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                                {idea.title} <span className="text-gray-300 font-normal">/</span> Kanban Board
                            </h2>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">Visual Workflow Management</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all active:scale-95"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Board */}
                <div className="flex-1 overflow-x-auto p-8 flex gap-6 scrollbar-hide">
                    {COLUMNS.map(status => (
                        <div
                            key={status}
                            className="flex-shrink-0 w-80 flex flex-col h-full bg-gray-100/50 rounded-[28px] border border-gray-200/50"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, status)}
                        >
                            <div className="p-5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                                        {status}
                                    </h3>
                                    <span className="bg-white border border-gray-200 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                        {getTodosByStatus(status).length}
                                    </span>
                                </div>
                                <button
                                    className="p-1 px-2 text-[10px] font-bold hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                                    style={{ color: 'var(--primary)' }}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 custom-scrollbar">
                                {getTodosByStatus(status).map(todo => {
                                    const assignee = users.find(u => u.id === todo.assigneeId);
                                    const isExpanded = expandedTodoId === todo.id;
                                    const sourceRef = getSourceReference(todo.originNoteId);

                                    return (
                                        <div
                                            key={todo.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, todo.id)}
                                            className={`group bg-white rounded-2xl border border-white shadow-sm hover:shadow-md hover:border-[var(--primary)]/40 cursor-grab active:cursor-grabbing transition-all ${draggedTodoId === todo.id ? 'opacity-30 scale-95' : 'animate-in fade-in slide-in-from-bottom-2'} ${isExpanded ? 'ring-2 ring-[var(--primary)]' : ''}`}
                                        >
                                            <div className="p-5" onClick={() => {
                                                if (!isExpanded) {
                                                    setExpandedTodoId(todo.id);
                                                    setEditingComments(prev => ({ ...prev, [todo.id]: todo.comments || '' }));
                                                }
                                            }}>
                                                <div className="flex items-start gap-4">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleTodoDone(todo.id); }}
                                                        className={`mt-0.5 shrink-0 transition-colors ${todo.completed ? 'text-green-500' : todo.isUrgent ? 'text-red-500' : 'text-gray-200 hover:text-[var(--primary)]'}`}
                                                    >
                                                        {todo.completed ? <CheckCircle2 className="w-5 h-5" /> : todo.isUrgent ? <AlertCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                            <p className={`text-[13px] leading-tight break-words ${todo.completed
                                                                ? 'text-gray-400 line-through font-normal'
                                                                : todo.status === 'Working'
                                                                    ? 'text-slate-800 font-medium'
                                                                    : 'text-slate-600 font-normal'
                                                                }`}>
                                                                {todo.text}
                                                            </p>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); toggleUrgent(todo.id); }}
                                                                className={`shrink-0 p-1 rounded-md transition-colors ${todo.isUrgent ? 'bg-red-50 text-red-600' : 'text-gray-200 hover:text-red-400 hover:bg-gray-50'}`}
                                                                title="Mark as Urgent"
                                                            >
                                                                <Flag className="w-3.5 h-3.5 fill-current" />
                                                            </button>
                                                        </div>

                                                        {isExpanded ? (
                                                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200" onClick={e => e.stopPropagation()}>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Due Date</label>
                                                                    <input
                                                                        type="date"
                                                                        className="w-full text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 outline-none focus:ring-2"
                                                                        style={{ ringColor: 'var(--primary)' }}
                                                                        value={todo.dueDate || ''}
                                                                        onChange={(e) => updateDueDate(todo.id, e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                                                        <MessageSquare className="w-3 h-3" />
                                                                        Internal Comments
                                                                    </label>
                                                                    <textarea
                                                                        className="w-full text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:ring-2 min-h-[80px] font-normal leading-relaxed"
                                                                        style={{ ringColor: 'var(--primary)' }}
                                                                        placeholder="Add more details, links, or context..."
                                                                        value={editingComments[todo.id] || ''}
                                                                        onChange={(e) => setEditingComments(prev => ({ ...prev, [todo.id]: e.target.value }))}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-2 pt-2">
                                                                    <button
                                                                        onClick={() => saveComments(todo.id)}
                                                                        className="flex-[2] text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                                                                        style={{ backgroundColor: 'var(--primary)', boxShadow: '0 4px 6px -1px var(--primary-shadow)' }}
                                                                    >
                                                                        <Save className="w-3.5 h-3.5" /> Save Details
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteTodo(todo.id)}
                                                                        className="flex-1 bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl hover:bg-red-100 transition-all active:scale-95 border border-red-100 flex items-center justify-center gap-2"
                                                                        title="Delete Task"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setExpandedTodoId(null)}
                                                                        className="flex-1 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl hover:bg-gray-100 transition-all active:scale-95 flex items-center justify-center"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between gap-2 mt-auto">
                                                                <div className="flex items-center gap-3">
                                                                    {todo.dueDate && (
                                                                        <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-tight ${todo.completed ? 'text-gray-200' : 'text-orange-500'}`}>
                                                                            <Calendar className="w-3 h-3" />
                                                                            {format(new Date(todo.dueDate), 'MMM d')}
                                                                        </div>
                                                                    )}
                                                                    {todo.isUrgent && !todo.completed && (
                                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-100 tracking-tighter">Urgent</span>
                                                                    )}
                                                                    {todo.comments && (
                                                                        <MessageSquare className="w-3 h-3 text-gray-300" />
                                                                    )}
                                                                </div>

                                                                {assignee && (
                                                                    <div
                                                                        className={`w-8 h-8 rounded-lg ${getAvatarColor(assignee.id)} flex items-center justify-center text-[13px] text-white font-black shadow-md shrink-0 premium-tooltip premium-tooltip-right ring-1 ring-white/20`}
                                                                        data-tooltip={assignee.name}
                                                                    >
                                                                        {getInitials(assignee.name)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {sourceRef && !isExpanded && (
                                                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                                                                <span
                                                                    className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.1em]"
                                                                    style={{ color: 'var(--primary)' }}
                                                                >
                                                                    <ClipboardList className="w-3 h-3" />
                                                                    Source: {sourceRef}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {getTodosByStatus(status).length === 0 && (
                                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl">
                                        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest text-center px-4">Drag tasks here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.05);
          border-radius: 10px;
        }
      `}</style>
        </div>
    );
};

export default KanbanModal;
