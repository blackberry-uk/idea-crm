
import React, { useState } from 'react';
import { useStore } from '../store/useStore.ts';
import { Link } from 'react-router-dom';
import { Plus, Users, Trash2, LogOut, Lightbulb } from 'lucide-react';
import IdeaModal from '../components/IdeaModal';
import { getInitials } from '../lib/utils';

const IdeasPage: React.FC = () => {
  const { data, myIdeas, deleteIdea, leaveIdea, confirm, showToast } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeEntity, setActiveEntity] = useState('All');

  const entities = ['All', ...(data.currentUser?.personalEntities || [])];
  const filteredIdeas = myIdeas.filter(idea =>
    activeEntity === 'All' || idea.entity === activeEntity
  );

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Idea Pipeline</h1>
          <p className="text-gray-500">{filteredIdeas.length} Active Ideas</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold shadow-indigo-200 shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Create New Idea
        </button>
      </div>

      {/* Bucket Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
        {entities.map(entity => (
          <button
            key={entity}
            onClick={() => setActiveEntity(entity)}
            className={`px-5 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all border shadow-sm ${activeEntity === entity
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100/50'
              : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-200 hover:text-indigo-600'
              }`}
          >
            {entity}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredIdeas.map(idea => {
          const owner = data.users.find(u => u.id === idea.ownerId);
          const isOwner = idea.ownerId === data.currentUser?.id;
          return (
            <div key={idea.id} className="relative group animate-in fade-in slide-in-from-bottom-4 duration-300">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (isOwner) {
                    confirm({
                      title: 'Delete Idea',
                      message: `Are you sure you want to permanently delete "${idea.title}"? This action cannot be undone.`,
                      confirmLabel: 'Delete',
                      type: 'danger',
                      onConfirm: async () => {
                        try {
                          await deleteIdea(idea.id);
                          showToast('Idea deleted successfully', 'success');
                        } catch (err: any) {
                          showToast(err.message || 'Failed to delete idea', 'error');
                        }
                      }
                    });
                  } else {
                    confirm({
                      title: 'Leave Project',
                      message: `Stop collaborating on "${idea.title}"?`,
                      confirmLabel: 'Leave',
                      type: 'danger',
                      onConfirm: async () => {
                        try {
                          await leaveIdea(idea.id);
                          showToast('You have left the project', 'info');
                        } catch (err: any) {
                          showToast(err.message || 'Failed to leave project', 'error');
                        }
                      }
                    });
                  }
                }}
                className="absolute top-4 right-4 z-10 p-2 bg-white rounded-xl border border-gray-100 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-100 active:scale-90"
                title={isOwner ? "Delete Idea" : "Leave Project"}
              >
                {isOwner ? <Trash2 className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
              </button>

              <Link to={`/ideas/${idea.id}`} className="block h-full">
                <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm hover:shadow-xl hover:border-indigo-100 group-hover:-translate-y-1 transition-all h-full flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${['Ideation', 'Scoping', 'Backlog'].includes(idea.status) ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        ['Research'].includes(idea.status) ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          ['Prototype', 'Proposal', 'Business Plan'].includes(idea.status) ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                            ['Testing', 'Approval', 'Capital Raise'].includes(idea.status) ? 'bg-purple-50 text-purple-600 border-purple-100' :
                              ['Launched', 'Execution', 'Active', 'Done'].includes(idea.status) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                idea.status === 'Dead' ? 'bg-red-50 text-red-600 border-red-100' :
                                  'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                        {idea.status}
                      </span>
                      <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-400 border border-slate-100">
                        {idea.entity}
                      </span>
                    </div>
                    {(idea.collaboratorIds?.length ?? 0) > 0 && <Users className="w-4 h-4 text-indigo-300" />}
                  </div>

                  <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight tracking-tight">
                    {idea.title}
                  </h3>
                  <p className="text-sm text-gray-400 font-medium line-clamp-2 mb-6 leading-relaxed">{idea.oneLiner ?? ''}</p>

                  <div className="flex items-center gap-3 mt-auto pt-6 border-t border-gray-50">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl ${owner?.avatarColor || 'bg-indigo-600'} flex items-center justify-center text-white text-[10px] font-black shadow-md`}>
                        {getInitials(owner?.name || 'U')}
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {owner?.name || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
        {filteredIdeas.length === 0 && (
          <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lightbulb className="w-8 h-8 text-gray-200" />
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No ideas found in this bucket</p>
          </div>
        )}
      </div>

      <IdeaModal isOpen={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
};

export default IdeasPage;
