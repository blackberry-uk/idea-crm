
import React, { useState } from 'react';
import { Brain, Sparkles, ChevronRight, Loader2, MessageSquare, ListTodo, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { apiClient } from '../lib/api/client';

interface AICounselorProps {
    ideaId: string;
}

const AICounselor: React.FC<AICounselorProps> = ({ ideaId }) => {
    const [loading, setLoading] = useState(false);
    const [advice, setAdvice] = useState<string | null>(null);
    const { showToast } = useStore();

    const getAdvice = async () => {
        setLoading(true);
        setAdvice(null);
        try {
            const res = await apiClient.post(`/ideas/${ideaId}/counsel`, {});
            setAdvice(res.advice);
        } catch (err: any) {
            console.error('AI Counseling failed:', err);
            showToast('AI Counselor is having a moment. Please set up a GEMINI_API_KEY in your .env or try again later.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-6 mb-8">
            <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 rounded-[2.5rem] p-1 shadow-xl shadow-indigo-500/20 group transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/30">
                <div className="bg-white/95 backdrop-blur-sm rounded-[2.3rem] overflow-hidden">
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110 duration-500">
                                    <Brain className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                        AI Counselor
                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[10px] uppercase font-black tracking-widest animate-pulse">Live Insight</span>
                                    </h2>
                                    <p className="text-sm font-medium text-gray-500 italic">Synthesizing notes, todos, and comments for your next move...</p>
                                </div>
                            </div>
                            {!advice && !loading && (
                                <button
                                    onClick={getAdvice}
                                    className="px-6 py-3 bg-[var(--primary)] text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all flex items-center gap-2 group/btn"
                                    style={{ backgroundColor: 'var(--primary)' }}
                                >
                                    <Sparkles className="w-4 h-4 group-hover/btn:animate-spin" />
                                    Ask Counselor
                                </button>
                            )}
                        </div>

                        {loading && (
                            <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
                                <div className="relative">
                                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                                    <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-violet-400 animate-pulse" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">Deep Thought in Progress</p>
                                    <p className="text-xs text-gray-400">Reviewing {ideaId.substring(0, 8)} data layers...</p>
                                </div>
                            </div>
                        )}

                        {advice && (
                            <div className="animate-in slide-in-from-bottom-4 duration-700">
                                <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-100 rounded-3xl p-8 relative overflow-hidden mb-6">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 pointer-events-none">
                                        <Sparkles className="w-48 h-48" />
                                    </div>

                                    <div className="relative z-10">
                                        <div className="flex items-start gap-4 mb-6">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                                <ChevronRight className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div className="prose prose-sm max-w-none text-gray-700 font-medium leading-[1.8] text-base italic">
                                                {advice.split('\n').map((line, i) => (
                                                    <p key={i} className="mb-4 last:mb-0 leading-relaxed">
                                                        {line.startsWith('- ') ? (
                                                            <span className="flex items-start gap-3">
                                                                <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                                                <span>{line.substring(2)}</span>
                                                            </span>
                                                        ) : line}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex border-t border-gray-100 pt-6 gap-6">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                <MessageSquare className="w-3 h-3" />
                                                Notes Parsed
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                <ListTodo className="w-3 h-3" />
                                                Tasks Weighted
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                <ShieldCheck className="w-3 h-3" />
                                                Evidence Based
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={getAdvice}
                                        className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-2 group"
                                    >
                                        Recalculate Next Step
                                        <Sparkles className="w-3 h-3 group-hover:rotate-45 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AICounselor;
