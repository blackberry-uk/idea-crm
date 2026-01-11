
import React from 'react';
import { useStore } from '../store/useStore';
import { Mail, Check, X, Users, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';

const Invitations: React.FC = () => {
  const { data, handleInvitation } = useStore();
  const myInvs = data.invitations.filter(i =>
    i.email.toLowerCase() === data.currentUser?.email.toLowerCase() && i.status === 'Pending'
  );

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
          <Mail className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Invitations</h1>
          <p className="text-gray-500">Collaborate with your team on new ventures</p>
        </div>
      </div>

      {myInvs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-20 text-center space-y-4">
          <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8" />
          </div>
          <p className="text-gray-400 font-medium">Your inbox is empty.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myInvs.map(inv => {
            const sender = data.users.find(u => u.id === inv.senderId);
            const idea = data.ideas.find(i => i.id === inv.ideaId);
            return (
              <div key={inv.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    {inv.type === 'IdeaAccess' ? <Lightbulb className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">
                      {sender?.name || 'Someone'} invited you to collaborate
                    </h3>
                    <p className="text-sm text-gray-500">
                      Project: <span className="font-bold text-indigo-600">{idea?.title || 'Unknown Idea'}</span>
                    </p>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                      Sent {format(new Date(inv.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                  <button
                    onClick={() => handleInvitation(inv.id, false)}
                    className="flex-1 md:flex-none px-6 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </button>
                  <button
                    onClick={() => handleInvitation(inv.id, true)}
                    className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Accept Access
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Outgoing Invitations Section */}
      <div className="mt-20">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Pending Outgoing Invites</h2>
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          {data.invitations.filter(i => i.senderId === data.currentUser?.id && i.status === 'Pending').length === 0 ? (
            <p className="text-sm text-gray-400 italic">No outgoing invitations pending.</p>
          ) : (
            <div className="space-y-3">
              {data.invitations.filter(i => i.senderId === data.currentUser?.id && i.status === 'Pending').map(inv => (
                <div key={inv.id} className="flex items-center justify-between text-sm bg-white p-3 rounded-lg border border-gray-100">
                  <span className="font-medium text-gray-700">{inv.email}</span>
                  <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">Sent {format(new Date(inv.createdAt), 'MMM d')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Invitations;
