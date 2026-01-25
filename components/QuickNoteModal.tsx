
import React from 'react';
import { X, MessageSquarePlus } from 'lucide-react';
import NoteComposer from './NoteComposer';

interface QuickNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    ideaId: string;
    ideaTitle: string;
}

const QuickNoteModal: React.FC<QuickNoteModalProps> = ({ isOpen, onClose, ideaId, ideaTitle }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-[#FDFCFB] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 border border-white/20">
                <div className="bg-white px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm border border-amber-100/50">
                            <MessageSquarePlus className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 tracking-tight">Quick Note</h2>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{ideaTitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-gray-900"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-2">
                    <NoteComposer
                        defaultIdeaId={ideaId}
                        onComplete={onClose}
                        onCancel={onClose}
                        flat
                    />
                </div>
            </div>
        </div>
    );
};

export default QuickNoteModal;
