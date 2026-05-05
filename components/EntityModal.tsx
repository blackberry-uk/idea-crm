import React, { useState, useEffect } from 'react';
import { Entity } from '../types';
import { X, Hash, Save, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';

interface EntityModalProps {
  isOpen: boolean;
  onClose: (savedEntity?: Entity) => void;
  entityToEdit?: Entity | null;
}

const EntityModal: React.FC<EntityModalProps> = ({ isOpen, onClose, entityToEdit }) => {
  const { addEntity, updateEntity, deleteEntity, showToast } = useStore();
  const [formData, setFormData] = useState({
    name: '',
    type: 'company',
    description: '',
    website: '',
    linkedinUrl: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (entityToEdit) {
      setFormData({
        name: entityToEdit.name || '',
        type: entityToEdit.type || 'company',
        description: entityToEdit.description || '',
        website: entityToEdit.website || '',
        linkedinUrl: entityToEdit.linkedinUrl || ''
      });
    } else {
      setFormData({
        name: '',
        type: 'company',
        description: '',
        website: '',
        linkedinUrl: ''
      });
    }
  }, [entityToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (entityToEdit?.id) {
        const updated = await updateEntity(entityToEdit.id, formData);
        showToast('Entity updated', 'success');
        onClose(updated);
      } else {
        const created = await addEntity(formData);
        showToast('Entity created', 'success');
        onClose(created);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save entity', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!entityToEdit?.id) return;
    if (window.confirm('Are you sure you want to delete this entity?')) {
      setIsSubmitting(true);
      try {
        await deleteEntity(entityToEdit.id);
        showToast('Entity deleted', 'success');
        onClose();
      } catch (err: any) {
        showToast(err.message || 'Failed to delete entity', 'error');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div 
        style={{ padding: '24px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', width: '100%', maxWidth: '540px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} 
        className="animate-in zoom-in-95 duration-200"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            {entityToEdit ? 'Edit Entity' : 'New Entity'}
          </h4>
          <button onClick={() => onClose()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X className="w-4 h-4 hover:text-gray-700 transition-colors" />
          </button>
        </div>
        
        <div style={{ overflowY: 'auto', paddingRight: '4px' }}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Name</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                <input
                  autoFocus
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="e.g. Acme Corp"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="company">Company</option>
                  <option value="school">School</option>
                  <option value="university">University</option>
                  <option value="organization">Organization</option>
                  <option value="vendor">Vendor</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Website</label>
                <input
                  type="text"
                  value={formData.website}
                  onChange={e => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[80px]"
                placeholder="Details about this entity..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">LinkedIn URL</label>
              <input
                type="text"
                value={formData.linkedinUrl}
                onChange={e => setFormData({ ...formData, linkedinUrl: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder="linkedin.com/company/..."
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Save Entity
              </button>
              <button
                type="button"
                onClick={() => onClose()}
                className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold transition-all"
              >
                Cancel
              </button>
              {entityToEdit?.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="px-3 py-2 bg-white hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-200 text-gray-400 rounded-xl transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EntityModal;
