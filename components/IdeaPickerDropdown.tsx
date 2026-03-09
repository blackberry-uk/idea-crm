import React from 'react';
import { Lightbulb, X } from 'lucide-react';

interface IdeaOption {
  id: string;
  title: string;
}

interface IdeaPickerDropdownProps {
  ideas: IdeaOption[];
  selectedIdeaId?: string | null;
  onSelect: (ideaId: string) => void;
  onRemove?: () => void;
  showRemove?: boolean;
}

const IdeaPickerDropdown: React.FC<IdeaPickerDropdownProps> = ({
  ideas,
  selectedIdeaId,
  onSelect,
  onRemove,
  showRemove = false
}) => {
  const sorted = [...ideas].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="daily-todo-add-picker">
      {showRemove && onRemove && (
        <button
          onClick={onRemove}
          className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
        >
          <X className="w-3 h-3" /> Remove tag
        </button>
      )}
      {sorted.map(idea => (
        <button
          key={idea.id}
          onClick={() => onSelect(idea.id)}
          className={`daily-todo-add-picker-item ${selectedIdeaId === idea.id ? 'daily-todo-add-picker-item--selected' : ''}`}
        >
          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
          {idea.title}
        </button>
      ))}
      {sorted.length === 0 && (
        <p className="px-3 py-2 text-xs text-gray-400 italic">No ideas yet</p>
      )}
    </div>
  );
};

export default IdeaPickerDropdown;
