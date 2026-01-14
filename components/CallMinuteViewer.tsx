import React, { useRef } from 'react';
import { X, Printer, Download, Users, ClipboardList, Calendar, MapPin, AtSign } from 'lucide-react';
import { format } from 'date-fns';
import { Note, Idea, Contact, User } from '../types';

interface CallMinuteViewerProps {
    isOpen: boolean;
    onClose: () => void;
    note: Note | null;
    idea?: Idea;
    contacts: Contact[];
    users: User[];
}

const CallMinuteViewer: React.FC<CallMinuteViewerProps> = ({ isOpen, onClose, note, idea, contacts, users }) => {
    const printRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !note) return null;

    let data: any = null;
    try {
        data = JSON.parse(note.body);
    } catch (e) {
        return null;
    }

    const segments = data.segments || [];
    const attendees = data.attendees || '';

    const typeColors: Record<string, string> = {
        'Insight': 'bg-blue-50 text-blue-700 border-blue-100',
        'Agreement': 'bg-emerald-50 text-emerald-700 border-emerald-100',
        'To do': 'bg-amber-50 text-amber-700 border-amber-100',
        'Decision': 'bg-purple-50 text-purple-700 border-purple-100',
        'Data Point': 'bg-indigo-50 text-indigo-700 border-indigo-100',
        'Reference': 'bg-gray-50 text-gray-700 border-gray-100'
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 my-8 print:my-0 print:shadow-none print:rounded-none print:border-none print:max-w-none">

                {/* Header - Hidden on Print */}
                <div className="flex items-center justify-between p-6 border-b bg-gray-50/50 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <ClipboardList className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Meeting Minutes</h2>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Professional Report</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
                        >
                            <Printer className="w-4 h-4" /> Print / PDF
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors ml-2">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-8 print:p-0 overflow-y-auto max-h-[80vh] print:max-h-none" ref={printRef}>
                    <div className="space-y-8">
                        {/* Report Header */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-200 pb-6">
                            <div className="space-y-4">
                                <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none">
                                    Meeting Minute - {idea?.title || 'Project Record'}
                                </h1>
                                <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-medium text-gray-400">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-gray-300" />
                                        {format(new Date(note.createdAt), "MMMM do, yyyy")}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-gray-300" />
                                        {note.location || 'Remote'}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <AtSign className="w-3.5 h-3.5 text-gray-300" />
                                        Reported by {note.createdBy}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <span className="text-[10px] font-bold text-gray-300 tracking-wider">www.idea-crm.com (c) 2026</span>
                            </div>
                        </div>

                        {/* Attendees */}
                        {attendees && (
                            <div className="py-4 border-b border-gray-50 flex items-baseline gap-4">
                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest shrink-0">Meeting Attendees</span>
                                <span className="text-xs font-medium text-gray-600">
                                    {attendees}
                                </span>
                            </div>
                        )}

                        {/* Main Segments */}
                        <div className="space-y-6">
                            {segments.map((seg: any, idx: number) => (
                                <div key={idx} className="group relative pl-6 border-l-2 border-gray-100 py-1">
                                    <div className="absolute -left-[5px] top-2.5 w-2 h-2 rounded-full bg-white border border-gray-200"></div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className="w-[60px] text-center px-1.5 py-0.5 text-[7px] font-black uppercase rounded border bg-gray-50 text-gray-400 border-gray-100 shrink-0 tracking-tighter shadow-sm">
                                                {seg.type}
                                            </span>
                                            {seg.topic && (
                                                <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                                                    {seg.topic}
                                                </h3>
                                            )}
                                        </div>

                                        {seg.comments && (
                                            <div className="text-xs text-gray-600 leading-relaxed pl-[72px] font-medium whitespace-pre-wrap">
                                                {seg.comments}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="pt-8 border-t border-gray-50 text-center">
                            <p className="text-[8px] text-gray-300 italic flex items-center justify-center gap-1">
                                Generated on {format(new Date(), "PPpp")}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .fixed.inset-0, .fixed.inset-0 * {
                        visibility: visible;
                    }
                    .fixed.inset-0 {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .shadow-2xl, .shadow-sm {
                        box-shadow: none !important;
                    }
                    .rounded-\\[40px\\], .rounded-[40px], .rounded-3xl, .rounded-\\[24px\\], .rounded-lg, .rounded-md {
                        border-radius: 0 !important;
                    }
                    .p-12 {
                        padding: 0 !important;
                    }
                    .bg-gray-50\\/50, .bg-gray-50, .bg-white {
                        background-color: transparent !important;
                    }
                    .max-h-\\[80vh\\] {
                        max-h: none !important;
                    }
                }
            `}} />
        </div>
    );
};

export default CallMinuteViewer;
