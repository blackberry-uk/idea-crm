
import React from 'react';
import { Contact } from '../types';
import { X, UserPlus } from 'lucide-react';
import ContactEditPanel from './ContactEditPanel';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIdeaIds?: string[];
  contactToEdit?: Contact | null;
}

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, initialIdeaIds = [], contactToEdit = null }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div 
        style={{ padding: '24px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', width: '100%', maxWidth: '540px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} 
        className="animate-in zoom-in-95 duration-200"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            {contactToEdit ? 'Edit Contact' : 'New Contact'}
          </h4>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X className="w-4 h-4 hover:text-gray-700 transition-colors" />
          </button>
        </div>
        
        <div style={{ overflowY: 'auto', paddingRight: '4px' }}>
          <ContactEditPanel
            contact={contactToEdit}
            onSaved={onClose}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
