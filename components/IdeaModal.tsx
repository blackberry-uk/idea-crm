
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Lightbulb } from 'lucide-react';
import { IdeaType } from '../types';

interface IdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContactIds?: string[];
}

const IdeaModal: React.FC<IdeaModalProps> = ({ isOpen, onClose, initialContactIds = [] }) => {
  const { data, addIdea } = useStore();
  const entities = data.currentUser?.personalEntities || [];
  
  const [newIdea, setNewIdea] = useState({ 
    title: '', 
    type: 'Product' as IdeaType, 
    entity: entities[0] || 'Personal',
    tags: [] as string[],
    linkedContactIds: initialContactIds
  });

  if (!isOpen) return null;

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newIdea.title.trim()) {
      alert("Please provide a title.");
      return;
    }
    addIdea({
      ...newIdea,
      title: newIdea.title.trim(),
      status: 'Backlog',
      priority: 3,
      linkedContactIds: JSON.stringify(newIdea.linkedContactIds ?? []),
    });
    onClose();
    setNewIdea({ 
      title: '', type: 'Product', entity: entities[0] || 'Personal', tags: [],
      linkedContactIds: initialContactIds
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold tracking-tight">New Idea</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={handleCreate} className="p-8 space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Idea Title</label>
            <input 
              placeholder="e.g. Revolutionizing Coffee Delivery"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-gray-50" 
              value={newIdea.title} 
              onChange={e => setNewIdea({...newIdea, title: e.target.value})} 
              autoFocus 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Category</label>
               <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50" value={newIdea.type} onChange={e => setNewIdea({...newIdea, type: e.target.value as IdeaType})}>
                  <option value="Product">Product</option>
                  <option value="Consulting">Consulting</option>
                  <option value="New Business">New Business</option>
               </select>
             </div>
             <div>
               <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Association</label>
               <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50" value={newIdea.entity} onChange={e => setNewIdea({...newIdea, entity: e.target.value})}>
                  {entities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
               </select>
             </div>
          </div>

          <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
            Create Idea
          </button>
        </form>
      </div>
    </div>
  );
};

export default IdeaModal;
