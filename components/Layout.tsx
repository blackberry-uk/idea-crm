
import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
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
  Mail,
  Brain,
  Building2,
  Menu,
  ChevronLeft,
  Star
} from 'lucide-react';
import { CalendarCheck } from 'lucide-react';
import { useStore } from '../store/useStore.ts';
import { getInitials, getAvatarColor } from '../lib/utils';
import NoteComposer from './NoteComposer';
import ImportModal from './ImportModal';
import MobileBottomNav from './MobileBottomNav';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { logout, data } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return localStorage.getItem('ideaCrm_sidebar') !== 'closed';
  });

  useEffect(() => {
    localStorage.setItem('ideaCrm_sidebar', isSidebarOpen ? 'open' : 'closed');
  }, [isSidebarOpen]);

  const pendingInvs = data.invitations.filter(i =>
    i.email === data.currentUser?.email && i.status === 'Pending'
  ).length;

  const navItems = [
    { name: 'Checklist', path: '/', icon: CalendarDays },
    { name: 'Projects', path: '/ideas', icon: Lightbulb },
    { name: 'Contacts', path: '/contacts', icon: Users },
    { name: 'Entities', path: '/entities', icon: Building2 },
    { name: 'Calendar', path: '/daily', icon: CalendarCheck },
    { name: 'Invitations', path: '/invitations', icon: Mail, badge: pendingInvs },
    { name: 'Training', path: '/?training=true', icon: Brain },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  if (!data.currentUser) return <>{children}</>;

  return (
    <div className="flex h-screen bg-transparent text-gray-900 overflow-hidden transition-colors duration-500">
      {/* Sidebar */}
      {isSidebarOpen ? (
        <aside className="w-64 border-r border-gray-200 bg-white flex flex-col hidden md:flex shrink-0">
          <div className="p-6 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg shadow-sm" style={{ backgroundColor: 'var(--primary)' }}>
                <Lightbulb className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">IdeaCRM</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1" title="Hide Menu">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const hasTrainingParam = new URLSearchParams(location.search).get('training') === 'true';
            const isTrainingItem = item.name === 'Training';
            const isChecklistItem = item.name === 'Checklist';

            let isActive = false;
            if (isTrainingItem) {
              isActive = hasTrainingParam;
            } else if (isChecklistItem) {
              isActive = location.pathname === '/' && !hasTrainingParam;
            } else {
              isActive = location.pathname.startsWith(item.path);
            }

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors relative ${isActive
                  ? 'text-white font-medium shadow-md shadow-[var(--primary)]/20'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                style={isActive ? { backgroundColor: 'var(--primary)' } : {}}
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

        {/* Favorite Projects */}
        {data.ideas.filter(i => i.isFavorite && i.status !== 'Archived').length > 0 && (
          <div className="px-4 py-2">
            <p className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Favorites</p>
            <div className="space-y-1">
              {data.ideas.filter(i => i.isFavorite && i.status !== 'Archived').map(idea => (
                <Link
                  key={idea.id}
                  to={`/ideas/${idea.id}`}
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-md transition-colors relative ${location.pathname === `/ideas/${idea.id}`
                    ? 'text-white font-medium shadow-md shadow-[var(--primary)]/20'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  style={location.pathname === `/ideas/${idea.id}` ? { backgroundColor: 'var(--primary)' } : {}}
                >
                  <Star className={`w-4 h-4 ${location.pathname === `/ideas/${idea.id}` ? 'text-white' : 'text-yellow-400 fill-yellow-400'}`} />
                  <span className="truncate text-sm">{idea.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t border-gray-200 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl mb-4">
            <div
              className={`w-9 h-9 rounded-lg ${getAvatarColor(data.currentUser.id)} flex items-center justify-center text-white text-[13px] font-black shadow-md premium-tooltip premium-tooltip-left ring-1 ring-white/20`}
              data-tooltip={data.currentUser.name}
            >
              {getInitials(data.currentUser.name)}
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
      ) : (
        <div className="hidden md:flex flex-col border-r border-gray-200 bg-white items-center py-6 px-3 shrink-0 transition-all duration-300">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors" title="Show Menu">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto mobile-main-content">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav />
    </div>
  );
};

export default Layout;
