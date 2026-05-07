import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { apiClient } from '../lib/api/client';
import { format } from 'date-fns';
import { Users, Mail, RefreshCw, Send, CheckCircle, Clock, Trash2, ArrowUpDown } from 'lucide-react';

export default function AdminPage() {
  const { data, showToast } = useStore();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users');
  const [userSort, setUserSort] = useState<{ field: string, dir: 'asc' | 'desc' }>({ field: 'lastLoginAt', dir: 'desc' });
  const [invSort, setInvSort] = useState<{ field: string, dir: 'asc' | 'desc' }>({ field: 'createdAt', dir: 'desc' });

  const MASTER_EMAIL = 'fernando.mora.uk@gmail.com';
  const isAdmin = data.currentUser?.email === MASTER_EMAIL;

  useEffect(() => {
    document.title = 'Admin Console | Idea-CRM';
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/users');
      setUsers(res.users);
      setInvitations(res.invitations);
    } catch (err) {
      showToast('Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (id: string) => {
    try {
      await apiClient.post(`/invitations/${id}/resend`, {});
      showToast('Invitation resent successfully!', 'success');
      fetchAdminData();
    } catch (err) {
      showToast('Failed to resend invitation', 'error');
    }
  };

  const handleDeleteInvitation = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this invitation?')) return;
    try {
      await apiClient.delete(`/admin/invitations/${id}`);
      showToast('Invitation deleted', 'success');
      fetchAdminData();
    } catch (err) {
      showToast('Failed to delete invitation', 'error');
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`CRITICAL WARNING: Are you completely sure you want to permanently delete user "${name}" and ALL their associated data (Projects, Notes, Contacts)? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/admin/users/${id}`);
      showToast('User deleted successfully', 'success');
      fetchAdminData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete user', 'error');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-2xl font-bold text-gray-800">403 Forbidden</h2>
        <p className="text-gray-500">You do not have access to this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading admin data...
      </div>
    );
  }

  const sortedUsers = [...users].sort((a, b) => {
    const aVal = a[userSort.field];
    const bVal = b[userSort.field];
    if (!aVal && bVal) return userSort.dir === 'asc' ? -1 : 1;
    if (aVal && !bVal) return userSort.dir === 'asc' ? 1 : -1;
    if (aVal < bVal) return userSort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return userSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const sortedInvitations = [...invitations].sort((a, b) => {
    const aVal = a[invSort.field];
    const bVal = b[invSort.field];
    if (aVal < bVal) return invSort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return invSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleUserSort = (field: string) => {
    setUserSort(prev => ({ field, dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc' }));
  };

  const toggleInvSort = (field: string) => {
    setInvSort(prev => ({ field, dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc' }));
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Admin Console</h1>
          <p className="text-gray-500 mt-1">Monitor users and invitations</p>
        </div>
        <button
          onClick={fetchAdminData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="flex border-b border-gray-200 bg-gray-50/50 shrink-0">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'users' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-b-2 border-transparent'}`}
          >
            <Users className="w-4 h-4" />
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'invitations' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-b-2 border-transparent'}`}
          >
            <Mail className="w-4 h-4" />
            Invitations ({invitations.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'users' ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-black text-[10px] text-gray-400 uppercase tracking-widest">Name & Email</th>
                  <th className="px-6 py-4 font-black text-[10px] text-gray-400 uppercase tracking-widest">Invited By</th>
                  <th className="px-6 py-4 font-black text-[10px] text-gray-400 uppercase tracking-widest text-center">Projects (Own / Collab)</th>
                  <th className="px-6 py-4 font-black text-[10px] text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-700" onClick={() => toggleUserSort('createdAt')}>
                    <div className="flex items-center gap-1">Joined <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-6 py-4 font-black text-[10px] text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-700" onClick={() => toggleUserSort('lastLoginAt')}>
                    <div className="flex items-center gap-1">Last Used <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-6 py-4 font-black text-[10px] text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedUsers.map(u => {
                  const invite = invitations.slice().reverse().find(i => i.email.toLowerCase() === u.email.toLowerCase());
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{u.name || 'Unnamed User'}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-400">
                        {invite ? invite.sender?.name : 'Self-registered'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-700">
                          <span>{u._count?.ideasOwned || 0}</span>
                          <span className="text-gray-300">/</span>
                          <span>{u._count?.ideasCollaborating || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-600">
                        {format(new Date(u.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-600">
                        {u.lastLoginAt ? format(new Date(u.lastLoginAt), 'MMM d, yyyy h:mm a') : <span className="text-gray-400 italic">Never</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {u.email !== MASTER_EMAIL && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name || u.email)}
                            className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-black text-[10px] text-gray-400 uppercase tracking-widest">Recipient</th>
                  <th className="px-6 py-4 font-black text-[10px] text-gray-400 uppercase tracking-widest">Context</th>
                  <th className="px-6 py-4 font-black text-[10px] text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-700" onClick={() => toggleInvSort('status')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-6 py-4 font-black text-[10px] text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-700" onClick={() => toggleInvSort('createdAt')}>
                    <div className="flex items-center gap-1">Sent Date <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-6 py-4 font-black text-[10px] text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedInvitations.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{inv.email}</div>
                      <div className="text-xs text-gray-500">From: {inv.sender?.name}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700 text-xs">
                      {inv.idea ? `Project: ${inv.idea.title}` : 'System Join'}
                    </td>
                    <td className="px-6 py-4">
                      {inv.status === 'Accepted' ? (
                        <span className="inline-flex px-2 py-1 bg-green-50 text-green-700 rounded-md text-[10px] font-black uppercase tracking-widest items-center gap-1 border border-green-100">
                          <CheckCircle className="w-3 h-3" /> Accepted
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-[10px] font-black uppercase tracking-widest items-center gap-1 border border-amber-100">
                          <Clock className="w-3 h-3" /> {inv.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-600">
                      {format(new Date(inv.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {inv.status !== 'Accepted' && (
                        <button
                          onClick={() => handleResend(inv.id)}
                          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                        >
                          <Send className="w-3 h-3" /> Resend
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteInvitation(inv.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {sortedInvitations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                      No invitations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
