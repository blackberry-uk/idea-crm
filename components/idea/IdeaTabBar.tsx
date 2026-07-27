import React from 'react';
import { Sparkles, CheckSquare, BookOpen, Activity } from 'lucide-react';

export type IdeaTab = 'overview' | 'checklist' | 'library' | 'activity';

const TABS: { key: IdeaTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'AI Overview', icon: Sparkles },
  { key: 'checklist', label: 'Checklist', icon: CheckSquare },
  { key: 'library', label: 'Library', icon: BookOpen },
  { key: 'activity', label: 'Activity', icon: Activity },
];

const IdeaTabBar: React.FC<{ active: IdeaTab; onChange: (t: IdeaTab) => void }> = ({ active, onChange }) => (
  <div className="flex items-center gap-1.5 bg-white border border-[var(--border)] rounded-2xl p-1.5 shadow-sm mb-6 w-fit max-w-full overflow-x-auto">
    {TABS.map(t => {
      const isActive = active === t.key;
      return (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
            isActive ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
          style={isActive ? { background: 'var(--primary)' } : {}}
        >
          <t.icon className="w-4 h-4" />
          {t.label}
        </button>
      );
    })}
  </div>
);

export default IdeaTabBar;
