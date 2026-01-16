
import React from 'react';
import { useStore } from '../store/useStore';
import { AlertCircle, ShieldAlert, Info, X } from 'lucide-react';

const ConfirmDialog: React.FC = () => {
    const { data, closeConfirmation } = useStore();
    const conf = data.confirmation;

    if (!conf) return null;

    const handleConfirm = () => {
        const currentId = conf.id;
        conf.onConfirm();
        // Only close if onConfirm didn't open a NEW confirmation (nested check)
        if (data.confirmation?.id === currentId) {
            closeConfirmation();
        }
    };

    const handleCancel = () => {
        if (conf.onCancel) conf.onCancel();
        closeConfirmation();
    };

    const styles = {
        danger: 'text-red-600 bg-red-50 border-red-100',
        warning: 'text-amber-600 bg-amber-50 border-amber-100',
        info: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    };

    const buttonStyles = {
        danger: 'bg-red-600 hover:bg-red-700 shadow-red-100 text-white',
        warning: 'bg-amber-600 hover:bg-amber-700 shadow-amber-100 text-white',
        info: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 text-white',
    };

    const icons = {
        danger: <ShieldAlert className="w-6 h-6" />,
        warning: <AlertCircle className="w-6 h-6" />,
        info: <Info className="w-6 h-6" />,
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={handleCancel}
            />

            {/* Modal */}
            <div className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <div className="p-8">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className={`p-4 rounded-2xl border ${styles[conf.type]}`}>
                            {icons[conf.type]}
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">
                                {conf.title}
                            </h3>
                            <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                {conf.message}
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col gap-3">
                        <button
                            onClick={handleConfirm}
                            className={`w-full py-4 rounded-2xl font-black text-sm shadow-xl transition-all active:scale-[0.98] ${buttonStyles[conf.type]}`}
                        >
                            {conf.confirmLabel || 'Confirm'}
                        </button>
                        <button
                            onClick={handleCancel}
                            className="w-full py-4 bg-gray-50 text-gray-400 font-bold text-sm rounded-2xl hover:bg-gray-100 transition-all active:scale-[0.98]"
                        >
                            {conf.cancelLabel || 'Cancel'}
                        </button>
                    </div>
                </div>

                <button
                    onClick={handleCancel}
                    className="absolute top-6 right-6 p-2 text-gray-300 hover:text-gray-600 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default ConfirmDialog;
