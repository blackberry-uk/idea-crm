import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { apiClient } from '../lib/api/client';
import { format } from 'date-fns';
import { Users, Mail, RefreshCw, Send, CheckCircle, Clock } from 'lucide-react';

export default function AdminPage() {
  const { data, showToast } = useStore();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);

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

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-10">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Users Section */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50 shrink-0">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Registered Users ({users.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-gray-100">
              {users.map(u => (
                <div key={u.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{u.name || 'Unnamed User'}</h3>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs mt-3">
                    <div className="bg-white p-2 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Joined</span>
                      <span className="font-medium text-gray-700">{format(new Date(u.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="bg-white p-2 border border-gray-100 rounded-lg">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Last Login</span>
                      <span className="font-medium text-gray-700">
                        {u.lastLoginAt ? format(new Date(u.lastLoginAt), 'MMM d, yyyy h:mm a') : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Invitations Section */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50 shrink-0">
            <Mail className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Invitations ({invitations.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-gray-100">
              {invitations.map(inv => (
                <div key={inv.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{inv.email}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Invited by <span className="font-medium">{inv.sender?.name}</span></p>
                    </div>
                    {inv.status === 'Accepted' ? (
                      <span className="px-2 py-1 bg-green-50 text-green-700 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1 border border-green-100">
                        <CheckCircle className="w-3 h-3" /> Accepted
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1 border border-amber-100">
                        <Clock className="w-3 h-3" /> {inv.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {format(new Date(inv.createdAt), 'MMM d, yyyy')}
                    </span>
                    {inv.status !== 'Accepted' && (
                      <button
                        onClick={() => handleResend(inv.id)}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                      >
                        <Send className="w-3 h-3" /> Resend
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {invitations.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No invitations sent yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
