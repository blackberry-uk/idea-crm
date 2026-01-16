import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Settings as SettingsIcon, Save, Trash2, Plus, Layout, Tag, X } from 'lucide-react';
import { DEFAULT_IDEA_CONFIGS } from '../lib/idea-utils';
import { IdeaConfig } from '../types';

const Settings: React.FC = () => {
  const { data, updateGlobalCategories, updatePersonalSettings, showToast } = useStore();
  const [categories, setCategories] = useState<string[]>(data.globalNoteCategories);
  const [personalEntities, setPersonalEntities] = useState<string[]>(data.currentUser?.personalEntities || []);
  const [ideaConfigs, setIdeaConfigs] = useState<IdeaConfig[]>(data.currentUser?.ideaConfigs || DEFAULT_IDEA_CONFIGS);
  const [newCat, setNewCat] = useState('');
  const [newEntity, setNewEntity] = useState('');

  // Sync state when data is loaded
  React.useEffect(() => {
    if (data.currentUser) {
      if (data.globalNoteCategories.length > 0) setCategories(data.globalNoteCategories);

      // Ensure we pick up the latest even if local state has some items (e.g. ['Personal'])
      const serverEntities = data.currentUser.personalEntities;
      if (Array.isArray(serverEntities) && serverEntities.length > 0) {
        setPersonalEntities(serverEntities);
      }

      const serverConfigs = data.currentUser.ideaConfigs;
      if (Array.isArray(serverConfigs) && serverConfigs.length > 0) {
        setIdeaConfigs(serverConfigs);
      }
    }
  }, [data.currentUser?.id, data.currentUser?.personalEntities, data.currentUser?.ideaConfigs, data.globalNoteCategories]);

  const handleSave = () => {
    const finalCategories = [...categories];
    if (newCat.trim()) finalCategories.push(newCat.trim());

    const finalEntities = [...personalEntities];
    if (newEntity.trim()) finalEntities.push(newEntity.trim());

    updateGlobalCategories(finalCategories.filter(c => c.trim() !== ''));
    updatePersonalSettings({
      personalEntities: finalEntities.filter(e => e.trim() !== ''),
      ideaConfigs: ideaConfigs
    });

    setNewCat('');
    setNewEntity('');
    showToast('Settings saved successfully!', 'success');
  };

  const addIdeaType = () => {
    setIdeaConfigs([...ideaConfigs, { type: 'New Type', stages: ['Backlog', 'Done'] }]);
  };

  const removeIdeaType = (index: number) => {
    setIdeaConfigs(ideaConfigs.filter((_, i) => i !== index));
  };

  const updateIdeaType = (index: number, type: string) => {
    const next = [...ideaConfigs];
    next[index].type = type;
    setIdeaConfigs(next);
  };

  const addStage = (typeIndex: number) => {
    const next = [...ideaConfigs];
    if (next[typeIndex].stages.length >= 5) {
      showToast('Max 5 stages allowed for best visibility', 'info');
      return;
    }
    next[typeIndex].stages.push('New Stage');
    setIdeaConfigs(next);
  };

  const removeStage = (typeIndex: number, stageIndex: number) => {
    const next = [...ideaConfigs];
    if (next[typeIndex].stages.length <= 2) {
      showToast('Min 2 stages required (e.g. Start & Finish)', 'info');
      return;
    }
    next[typeIndex].stages = next[typeIndex].stages.filter((_, i) => i !== stageIndex);
    setIdeaConfigs(next);
  };

  const updateStage = (typeIndex: number, stageIndex: number, value: string) => {
    const next = [...ideaConfigs];
    next[typeIndex].stages[stageIndex] = value;
    setIdeaConfigs(next);
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

        {/* Idea Types & Stages - Full Width */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Layout className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold">Idea Types & Pipeline Stages</h2>
            </div>
            <button
              onClick={addIdeaType}
              className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" /> Add Type
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ideaConfigs.map((config, typeIdx) => (
              <div key={typeIdx} className="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <input
                    className="bg-transparent text-sm font-black text-gray-900 tracking-tight uppercase border-b-2 border-transparent focus:border-indigo-500 outline-none w-2/3"
                    value={config.type}
                    onChange={e => updateIdeaType(typeIdx, e.target.value)}
                    placeholder="Type Name (e.g. Books)"
                  />
                  <button
                    onClick={() => removeIdeaType(typeIdx)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {config.stages.map((stage, stageIdx) => (
                    <div key={stageIdx} className="flex items-center gap-2 group">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-200 group-focus-within:bg-indigo-500" />
                      <input
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                        value={stage}
                        onChange={e => updateStage(typeIdx, stageIdx, e.target.value)}
                      />
                      <button
                        onClick={() => removeStage(typeIdx, stageIdx)}
                        className="p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {config.stages.length < 5 && (
                    <button
                      onClick={() => addStage(typeIdx)}
                      className="w-full py-1.5 border border-dashed border-gray-300 rounded-lg text-[10px] font-bold text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-all uppercase tracking-widest mt-2"
                    >
                      + Add Stage
                    </button>
                  )}
                </div>
              </div>
            ))}
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
                onKeyDown={e => { if (e.key === 'Enter') { setCategories([...categories, newCat]); setNewCat(''); } }}
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
                onKeyDown={e => { if (e.key === 'Enter') { setPersonalEntities([...personalEntities, newEntity]); setNewEntity(''); } }}
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
