
import React, { useState } from 'react';
import { useStore, CURRENT_DATA_MODEL_VERSION } from '../store/useStore';
import { Settings as SettingsIcon, Save, Trash2, Plus, GripVertical, User as UserIcon, Tag } from 'lucide-react';

const Settings: React.FC = () => {
  const { data, updateGlobalCategories, updatePersonalSettings } = useStore();
  const [categories, setCategories] = useState<string[]>(data.globalNoteCategories);
  const [personalEntities, setPersonalEntities] = useState<string[]>(data.currentUser?.personalEntities || []);
  const [newCat, setNewCat] = useState('');
  const [newEntity, setNewEntity] = useState('');

  const handleSave = () => {
    updateGlobalCategories(categories.filter(c => c.trim() !== ''));
    updatePersonalSettings({ personalEntities: personalEntities.filter(e => e.trim() !== '') });
    alert('Settings saved successfully!');
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Settings</h1>
          <p className="text-gray-500 mt-1">Configure your personal workspace</p>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Save className="w-5 h-5" />
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Info */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm col-span-1 lg:col-span-2">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-16 h-16 rounded-2xl ${data.currentUser?.avatarColor || 'bg-indigo-600'} flex items-center justify-center text-white text-2xl font-bold`}>
              {data.currentUser?.name[0]}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{data.currentUser?.name}</h2>
              <p className="text-sm text-gray-500">{data.currentUser?.email}</p>
            </div>
          </div>
        </section>

        {/* Note Categories */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Tag className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold">Global Note Tags</h2>
          </div>
          <div className="space-y-2">
            {categories.map((cat, i) => (
              <div key={i} className="flex gap-2">
                <input 
                  className="flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-sm" 
                  value={cat} 
                  onChange={e => {
                    const next = [...categories];
                    next[i] = e.target.value;
                    setCategories(next);
                  }}
                />
                <button onClick={() => setCategories(categories.filter((_, idx) => idx !== i))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <input 
                className="flex-1 border rounded-lg px-3 py-2 text-sm" 
                placeholder="New Tag..." 
                value={newCat} 
                onChange={e => setNewCat(e.target.value)}
                onKeyDown={e => { if(e.key === 'Enter') { setCategories([...categories, newCat]); setNewCat(''); } }}
              />
              <button onClick={() => { setCategories([...categories, newCat]); setNewCat(''); }} className="bg-gray-900 text-white p-2 rounded-lg"><Plus className="w-5 h-5" /></button>
            </div>
          </div>
        </section>

        {/* Personal Entities */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <SettingsIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold">Personal Labels</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4 uppercase font-bold tracking-widest">e.g. Interfrontera, Stackable, Side Project</p>
          <div className="space-y-2">
            {personalEntities.map((ent, i) => (
              <div key={i} className="flex gap-2">
                <input 
                  className="flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-sm" 
                  value={ent} 
                  onChange={e => {
                    const next = [...personalEntities];
                    next[i] = e.target.value;
                    setPersonalEntities(next);
                  }}
                />
                <button onClick={() => setPersonalEntities(personalEntities.filter((_, idx) => idx !== i))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <input 
                className="flex-1 border rounded-lg px-3 py-2 text-sm" 
                placeholder="New Label..." 
                value={newEntity} 
                onChange={e => setNewEntity(e.target.value)}
                onKeyDown={e => { if(e.key === 'Enter') { setPersonalEntities([...personalEntities, newEntity]); setNewEntity(''); } }}
              />
              <button onClick={() => { setPersonalEntities([...personalEntities, newEntity]); setNewEntity(''); }} className="bg-gray-900 text-white p-2 rounded-lg"><Plus className="w-5 h-5" /></button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
