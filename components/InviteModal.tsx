
import React, { useState } from 'react';
import { X, Send, Mail, MessageSquare } from 'lucide-react';

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (message: string) => void;
    email: string;
    name: string;
}

const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, onConfirm, email, name }) => {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    if (!isOpen) return null;

    const handleSend = async () => {
        setIsSending(true);
        try {
            await onConfirm(message);
            onClose();
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg p-0 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                            <Mail className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Personalize Invite</h2>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">To: {name} &lt;{email}&gt;</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                            Your Message (Optional)
                        </label>
                        <textarea
                            className="w-full border border-gray-200 rounded-2xl px-5 py-4 focus:ring-2 outline-none bg-gray-50 min-h-[160px] resize-none text-[15px] leading-relaxed font-medium transition-all"
                            style={{ ringColor: 'var(--primary)' }}
                            placeholder={`Hey ${name}, I'd like to invite you to collaborate on some projects in Idea-CRM...`}
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                    </div>

                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3 items-start">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <p className="text-xs text-amber-800 font-medium leading-relaxed">
                            This will send an official invitation email to <strong>{email}</strong>. Once they accept, they will have access to shared project resources.
                        </p>
                    </div>
                </div>

                <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
                    <button
                        disabled={isSending}
                        onClick={onClose}
                        className="flex-1 py-4 text-gray-600 font-bold hover:bg-gray-200 rounded-2xl transition-all disabled:opacity-50"
                    >
                        Go Back
                    </button>
                    <button
                        disabled={isSending}
                        onClick={handleSend}
                        className="flex-[1.5] py-4 text-white font-extrabold rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 15px -3px var(--primary-shadow)' }}
                    >
                        {isSending ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Send Invitation
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InviteModal;
