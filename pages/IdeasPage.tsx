
import React, { useState } from 'react';
import { useStore } from '../store/useStore.ts';
import { Link } from 'react-router-dom';
import { Plus, Users, Trash2, LogOut } from 'lucide-react';
import IdeaModal from '../components/IdeaModal';

const IdeasPage: React.FC = () => {
  const { data, myIdeas, deleteIdea, leaveIdea, confirm, showToast } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Idea Pipeline</h1>
          <p className="text-gray-500">{myIdeas.length} Active Ideas</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold shadow-indigo-200 shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Create New Idea
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {myIdeas.map(idea => {
          const owner = data.users.find(u => u.id === idea.ownerId);
          const isOwner = idea.ownerId === data.currentUser?.id;
          return (
            <div key={idea.id} className="relative group">
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
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${['Ideation', 'Scoping'].includes(idea.status) ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        ['Research'].includes(idea.status) ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          ['Prototype', 'Proposal', 'Business Plan'].includes(idea.status) ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                            ['Testing', 'Approval', 'Capital Raise'].includes(idea.status) ? 'bg-purple-50 text-purple-600 border-purple-100' :
                              ['Launched', 'Execution', 'Active'].includes(idea.status) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                idea.status === 'Dead' ? 'bg-red-50 text-red-600 border-red-100' :
                                  'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                        {idea.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {idea.type}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {idea.entity}
                      </span>
                    </div>
                    {(idea.collaboratorIds?.length ?? 0) > 0 && <Users className="w-4 h-4 text-indigo-400" />}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
                    {idea.title}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4">{idea.oneLiner ?? ''}</p>

                  <div className="flex items-center gap-3 mt-auto pt-4 border-t border-gray-200">
                    <div className="border-2 border-dashed border-gray-200 px-3 py-1 rounded-full flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${owner?.avatarColor || 'bg-indigo-600'}`}></div>
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                        {owner?.name || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
        {myIdeas.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400 font-medium">No ideas accessible. Create one or wait for an invite.</p>
          </div>
        )}
      </div>

      <IdeaModal isOpen={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
};

export default IdeasPage;
