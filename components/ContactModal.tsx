
import React, { useState } from 'react';
import { Contact } from '../types';
import { X, UserPlus, ClipboardList, Activity } from 'lucide-react';
import ContactEditPanel from './ContactEditPanel';
import ContactActivityPanel from './ContactActivityPanel';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIdeaIds?: string[];
  contactToEdit?: Contact | null;
}

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, initialIdeaIds = [], contactToEdit = null }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');

  // Reset tab when modal opens/closes or contact changes
  React.useEffect(() => {
    setActiveTab('details');
  }, [isOpen, contactToEdit?.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div 
        style={{ padding: '24px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', width: '100%', maxWidth: '640px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} 
        className="animate-in zoom-in-95 duration-200"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="flex items-center gap-4">
            <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              {contactToEdit ? contactToEdit.fullName : 'New Contact'}
            </h4>
            
            {contactToEdit && (
              <div className="flex bg-gray-200/50 p-0.5 rounded-lg">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'details' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <ClipboardList className="w-3 h-3" /> Details
                </button>
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'activity' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Activity className="w-3 h-3" /> Activity
                </button>
              </div>
            )}
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X className="w-4 h-4 hover:text-gray-700 transition-colors" />
          </button>
        </div>
        
        <div style={{ overflowY: 'auto', paddingRight: '4px', flex: 1, minHeight: '300px' }}>
          {activeTab === 'details' || !contactToEdit ? (
            <ContactEditPanel
              contact={contactToEdit}
              onSaved={onClose}
              onCancel={onClose}
            />
          ) : (
            <ContactActivityPanel contact={contactToEdit} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
