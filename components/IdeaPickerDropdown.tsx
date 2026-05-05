import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb, X, Search, ChevronRight } from 'lucide-react';

interface IdeaOption {
  id: string;
  title: string;
  status?: string;
  parentId?: string | null;
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
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-focus search on mount
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  // Filter out archived, then search
  const activeIdeas = ideas.filter(i => i.status !== 'Archived');
  const query = search.toLowerCase();

  // Build parent → children map
  const parentIdeas = activeIdeas.filter(i => !i.parentId);
  const childMap = new Map<string, IdeaOption[]>();
  for (const idea of activeIdeas) {
    if (idea.parentId) {
      const siblings = childMap.get(idea.parentId) || [];
      siblings.push(idea);
      childMap.set(idea.parentId, siblings);
    }
  }

  // Build hierarchical list: parent followed by its children
  // When searching, show all matching ideas (flat search across parents and children)
  const buildList = (): { idea: IdeaOption; isChild: boolean }[] => {
    if (query) {
      // Flat search: show matching parents and children, but still indent children
      const matching = activeIdeas
        .filter(i => i.title.toLowerCase().includes(query))
        .sort((a, b) => a.title.localeCompare(b.title));
      return matching.map(i => ({ idea: i, isChild: !!i.parentId }));
    }

    // Hierarchical: parents sorted, each followed by sorted children
    const result: { idea: IdeaOption; isChild: boolean }[] = [];
    const sortedParents = parentIdeas.sort((a, b) => a.title.localeCompare(b.title));
    for (const parent of sortedParents) {
      result.push({ idea: parent, isChild: false });
      const children = (childMap.get(parent.id) || []).sort((a, b) => a.title.localeCompare(b.title));
      for (const child of children) {
        result.push({ idea: child, isChild: true });
      }
    }
    return result;
  };

  const items = buildList();

  return (
    <div className="daily-todo-add-picker">
      {/* Search input */}
      <div className="idea-picker-search">
        <Search className="idea-picker-search-icon" />
        <input
          ref={searchRef}
          type="text"
          className="idea-picker-search-input"
          placeholder="Search projects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && items.length === 1) {
              onSelect(items[0].idea.id);
            }
          }}
        />
        {search && (
          <button className="idea-picker-search-clear" onClick={() => setSearch('')}>
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {showRemove && onRemove && (
        <button
          onClick={onRemove}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          className="daily-todo-add-picker-item daily-todo-add-picker-item--remove"
        >
          <X className="w-3 h-3" /> Remove tag
        </button>
      )}

      {/* Scrollable list */}
      <div className="idea-picker-list">
        {items.map(({ idea, isChild }) => (
          <button
            key={idea.id}
            onClick={() => onSelect(idea.id)}
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onSelect(idea.id); }}
            className={`daily-todo-add-picker-item ${selectedIdeaId === idea.id ? 'daily-todo-add-picker-item--selected' : ''} ${isChild ? 'daily-todo-add-picker-item--child' : ''}`}
          >
            {isChild ? (
              <span className="idea-picker-tree-connector">└</span>
            ) : (
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="idea-picker-item-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '100%' }}>{idea.title}</span>
          </button>
        ))}
        {items.length === 0 && (
          <p className="idea-picker-empty">
            {search ? `No ideas matching "${search}"` : 'No active ideas'}
          </p>
        )}
      </div>

      {/* Count footer */}
      <div className="idea-picker-footer">
        {items.length} of {activeIdeas.length} projects
      </div>
    </div>
  );
};

export default IdeaPickerDropdown;
