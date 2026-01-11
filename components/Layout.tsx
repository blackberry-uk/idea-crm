
import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Lightbulb, 
  Users, 
  Plus, 
  Search, 
  LogOut, 
  X,
  Keyboard,
  Download,
  Upload,
  Trash2,
  Settings as SettingsIcon,
  Mail
} from 'lucide-react';
import { useStore } from '../store/useStore.ts';
import NoteComposer from './NoteComposer';
import ImportModal from './ImportModal';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { logout, data } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  const pendingInvs = data.invitations.filter(i => 
    i.email === data.currentUser?.email && i.status === 'Pending'
  ).length;

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Ideas', path: '/ideas', icon: Lightbulb },
    { name: 'Contacts', path: '/contacts', icon: Users },
    { name: 'Invitations', path: '/invitations', icon: Mail, badge: pendingInvs },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  if (!data.currentUser) return <>{children}</>;

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white flex flex-col hidden md:flex shrink-0">
        <div className="p-6 flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm">
            <Lightbulb className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">IdeaCRM</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors relative ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
                {item.badge ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl mb-4">
            <div className={`w-8 h-8 rounded-lg ${data.currentUser.avatarColor || 'bg-indigo-600'} flex items-center justify-center text-white text-xs font-bold`}>
              {data.currentUser.name[0]}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{data.currentUser.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{data.currentUser.email}</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors text-sm font-medium">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
