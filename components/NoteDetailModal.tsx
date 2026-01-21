import React, { useState } from 'react';
import { X, MessageSquare, Send, Calendar, Clock, Trash2, User as UserIcon } from 'lucide-react';
import { Note, Idea, Contact, User } from '../types';
import { useStore } from '../store/useStore';
import { format } from 'date-fns';

interface NoteDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    note: Note | null;
    idea?: Idea;
    renderNoteBody: (note: Note) => React.ReactNode;
}

const NoteDetailModal: React.FC<NoteDetailModalProps> = ({ isOpen, onClose, note, idea, renderNoteBody }) => {
    const { addComment, deleteComment, data, confirm } = useStore();
    const [commentBody, setCommentBody] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !note) return null;

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentBody.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await addComment(note.id, commentBody);
            setCommentBody('');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
                            style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 15px -3px var(--primary-shadow)' }}
                        >
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Note Insight</h2>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{idea?.title || 'General Insight'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Main Note Content */}
                    <div
                        className="rounded-3xl p-8 shadow-sm border"
                        style={{
                            backgroundColor: note.intent === 'follow_up' ? 'var(--follow-up)' : 'var(--note-bg)',
                            borderColor: note.intent === 'follow_up' ? 'var(--follow-up-border)' : 'var(--note-border)'
                        }}
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold`}
                                style={{ backgroundColor: 'var(--primary-shadow)', color: 'var(--primary)' }}
                            >
                                {note.createdBy?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">{note.createdBy}</p>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(note.createdAt), 'MMM d, yyyy')}
                                </div>
                            </div>
                        </div>

                        <div className="prose max-w-none text-gray-700 leading-relaxed font-medium text-lg" style={{ '--tw-prose-links': 'var(--primary)' } as any}>
                            {renderNoteBody(note)}
                        </div>

                        {note.imageUrl && (
                            <div className="mt-6">
                                <img src={note.imageUrl} alt="Attached" className="rounded-2xl max-h-72 w-full object-cover shadow-lg border-4 border-white" />
                            </div>
                        )}
                    </div>

                    {/* Comments Section */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Comments ({note.comments?.length || 0})
                        </h3>

                        <div className="space-y-4">
                            {note.comments?.length === 0 ? (
                                <div className="text-center py-12 bg-gray-50/50 rounded-[32px] border border-dashed border-gray-200">
                                    <p className="text-sm text-gray-400 font-medium italic">No comments yet. Start the conversation!</p>
                                </div>
                            ) : (
                                note.comments.map((comment) => (
                                    <div key={comment.id} className="flex gap-4 group/comment animate-in slide-in-from-left-2 fade-in">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-gray-500">
                                            {comment.authorName?.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="bg-gray-50 rounded-2xl rounded-tl-none p-4 group-hover/comment:bg-gray-100/80 transition-colors relative">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-black text-gray-900 uppercase tracking-wider">{comment.authorName}</span>
                                                        <span className="text-[9px] font-bold text-gray-400 flex items-center gap-1">
                                                            <Clock className="w-2.5 h-2.5" />
                                                            {format(new Date(comment.createdAt), 'MMM d, p')}
                                                        </span>
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
                                                            className="opacity-0 group-hover/comment:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all focus:opacity-100"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-[13px] text-gray-700 leading-relaxed font-medium">
                                                    {comment.body}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer - Comment Input */}
                <div className="p-6 border-t shrink-0" style={{ backgroundColor: note.intent === 'follow_up' ? 'var(--follow-up)' : 'var(--note-bg)' }}>
                    <form onSubmit={handleAddComment} className="relative">
                        <textarea
                            value={commentBody}
                            onChange={(e) => setCommentBody(e.target.value)}
                            placeholder="Add a comment or perspective..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-3xl py-4 pl-6 pr-16 focus:ring-2 focus:bg-white transition-all outline-none text-sm font-medium resize-none min-h-[60px] max-h-[120px]"
                            style={{ ringColor: 'var(--primary)' }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAddComment(e);
                                }
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!commentBody.trim() || isSubmitting}
                            className="absolute right-3 bottom-3 p-3 text-white rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg"
                            style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 15px -3px var(--primary-shadow)' }}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest text-center mt-3">Press Enter to send, Shift + Enter for new line</p>
                </div>
            </div>
        </div>
    );
};

export default NoteDetailModal;
