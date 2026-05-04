
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Search, Hash, Globe, Edit3, Trash2, Check, X, Building2 } from 'lucide-react';

const EntitiesPage: React.FC = () => {
  const { data, addEntity, updateEntity, deleteEntity, showToast, confirm } = useStore();
  const [filterQuery, setFilterQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', type: '', website: '', linkedinUrl: '' });

  const [sortField, setSortField] = useState<'createdAt' | 'name' | 'type'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const handleSort = (field: 'createdAt' | 'name' | 'type') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const entities = (data.entities || [])
    .filter(e =>
      e.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (e.type || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
      (e.description || '').toLowerCase().includes(filterQuery.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'type') {
        comparison = (a.type || '').localeCompare(b.type || '');
      } else if (sortField === 'createdAt') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = dateA - dateB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  React.useEffect(() => {
    document.title = 'Entities | Idea-CRM';
    return () => { document.title = 'IdeaCRM Tracker'; };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await addEntity({ name: newName.trim() });
      setNewName('');
      setShowAddForm(false);
      showToast('Entity created', 'success');
    } catch (err) {
      showToast('Failed to create entity', 'error');
    }
  };

  const startEditing = (entity: any) => {
    setEditingId(entity.id);
    setEditForm({
      name: entity.name || '',
      description: entity.description || '',
      type: entity.type || '',
      website: entity.website || '',
      linkedinUrl: entity.linkedinUrl || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.name.trim()) return;
    try {
      await updateEntity(editingId, editForm);
      setEditingId(null);
      showToast('Entity updated', 'success');
    } catch (err) {
      showToast('Failed to update entity', 'error');
    }
  };

  const handleDelete = (entity: any) => {
    confirm({
      title: 'Delete Entity',
      message: `Are you sure you want to delete "${entity.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteEntity(entity.id);
          showToast('Entity deleted', 'success');
        } catch (err) {
          showToast('Failed to delete entity', 'error');
        }
      }
    });
  };

  return (
    <div style={{ maxWidth: '100%', padding: '2rem' }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Entities</h1>
          <p className="text-gray-500">Managing {entities.length} entities — tag with # in notes</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-2 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg transition-all active:scale-95"
          style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 15px -3px var(--primary-shadow)' }}
        >
          <Plus className="w-5 h-5" />
          New Entity
        </button>
      </div>

      {/* Inline create form */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 animate-in slide-in-from-top-2">
          <Hash className="w-5 h-5 text-indigo-500" />
          <input
            type="text"
            autoFocus
            placeholder="Entity name..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2"
            style={{ ringColor: 'var(--primary)' }}
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button type="submit" className="px-4 py-2 rounded-lg text-white text-sm font-bold" style={{ backgroundColor: 'var(--primary)' }}>Create</button>
          <button type="button" onClick={() => { setShowAddForm(false); setNewName(''); }} className="px-4 py-2 rounded-lg text-gray-500 text-sm font-bold hover:bg-gray-100">Cancel</button>
        </form>
      )}

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by name, type, description..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm transition-all focus:outline-none focus:ring-2"
            style={{ ringColor: 'var(--primary)' }}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Entity list */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {entities.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No entities yet</p>
            <p className="text-xs mt-1">Create one here or type <strong>#name</strong> in any note</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="text-left px-6 py-3 cursor-pointer hover:text-gray-600 transition-colors" onClick={() => handleSort('createdAt')}>
                  Date Added {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left px-6 py-3 cursor-pointer hover:text-gray-600 transition-colors" onClick={() => handleSort('name')}>
                  Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left px-6 py-3 cursor-pointer hover:text-gray-600 transition-colors" onClick={() => handleSort('type')}>
                  Type {sortField === 'type' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left px-6 py-3">Description</th>
                <th className="text-left px-6 py-3">Website</th>
                <th className="text-left px-6 py-3">LinkedIn</th>
                <th className="text-center px-6 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entities.map(entity => (
                <tr key={entity.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  {editingId === entity.id ? (
                    <>
                      <td className="px-6 py-3 text-sm text-gray-400 whitespace-nowrap">
                        {entity.createdAt ? new Date(entity.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-6 py-3" style={{ minWidth: '350px' }}>
                        <input className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm font-bold outline-none focus:ring-1" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
                      </td>
                      <td className="px-6 py-3">
                        <input className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:ring-1" placeholder="e.g. Company, Place..." value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} />
                      </td>
                      <td className="px-6 py-3">
                        <input className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:ring-1" placeholder="Brief description..." value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                      </td>
                      <td className="px-6 py-3">
                        <input className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:ring-1" placeholder="https://..." value={editForm.website} onChange={e => setEditForm({ ...editForm, website: e.target.value })} />
                      </td>
                      <td className="px-6 py-3">
                        <input className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:ring-1" placeholder="LinkedIn URL..." value={editForm.linkedinUrl} onChange={e => setEditForm({ ...editForm, linkedinUrl: e.target.value })} />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={handleSaveEdit} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {entity.createdAt ? new Date(entity.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-6 py-3" style={{ minWidth: '350px' }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold bg-indigo-50 text-indigo-600 shrink-0">
                            #
                          </div>
                          <span className="font-bold text-sm text-gray-900 truncate" style={{ maxWidth: '300px' }}>{entity.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">
                        {entity.type ? (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">{entity.type}</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500 max-w-xs truncate">{entity.description || <span className="text-gray-300 text-xs">—</span>}</td>
                      <td className="px-6 py-3 text-sm">
                        {entity.website ? (
                          <a href={entity.website} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline flex items-center gap-1 text-xs">
                            <Globe className="w-3 h-3" /> {entity.website.replace(/^https?:\/\//, '').slice(0, 30)}
                          </a>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        {entity.linkedinUrl ? (
                          <a href={entity.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline flex items-center gap-1 text-xs">
                            🔗 {entity.linkedinUrl.replace(/^https?:\/\//, '').slice(0, 30)}
                          </a>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEditing(entity)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(entity)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EntitiesPage;
