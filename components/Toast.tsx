
import React from 'react';
import { useStore } from '../store/useStore';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const Toast: React.FC = () => {
    const { data, hideToast } = useStore();
    const toast = data.toast;

    if (!toast) return null;

    const styles = {
        success: 'bg-emerald-50 border-emerald-100 text-emerald-700',
        error: 'bg-red-50 border-red-100 text-red-700',
        info: 'bg-[var(--primary-shadow)] border-[var(--primary)] text-[var(--primary)]'
    };

    const icons = {
        success: <CheckCircle className="w-4 h-4" />,
        error: <AlertCircle className="w-4 h-4" />,
        info: <Info className="w-4 h-4" />
    };

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-5 duration-300">
            <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl border shadow-2xl backdrop-blur-md min-w-[320px] max-w-[90vw] ${styles[toast.type]}`}>
                <div className="shrink-0">
                    {icons[toast.type]}
                </div>
                <p className="text-sm font-bold flex-1 tracking-tight">
                    {toast.message}
                </p>
                <button
                    onClick={hideToast}
                    className="p-1 hover:bg-black/5 rounded-lg transition-colors"
                >
                    <X className="w-4 h-4 opacity-50" />
                </button>
            </div>
        </div>
    );
};

export default Toast;
