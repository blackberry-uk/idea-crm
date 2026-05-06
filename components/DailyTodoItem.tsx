import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, Flame, Trash2, X, Lightbulb, GripVertical, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { TaskChevronMenu } from './TaskChevronMenu';
import { MentionInput } from './MentionInput';
import { useStore } from '../store/useStore';
import { mentionVariantsForName } from '../lib/taskMentions';
import { getInitials } from '../lib/utils';

export interface DailyTodoData {
  id: string;
  text: string;
  completed: boolean;
  isUrgent: boolean;
  date: string;
  completedAt: string | null;
  createdAt: string;
  ideaId: string | null;
  idea: { id: string; title: string } | null;
  parentId?: string | null;
  children?: DailyTodoData[];
  comments?: string | null;
  dueDate?: string | null;
  timeBlock?: string | null;
  assigneeId?: string | null;
  assignee?: { id: string; name: string; avatarColor: string; email: string } | null;
  completedById?: string | null;
  completedBy?: { id: string; name: string; avatarColor: string; email: string } | null;
}

const BLOCK_SHORT: Record<string, string> = {
  morning: 'AM',
  afternoon: 'PM',
  evening: 'EVE',
};

interface DailyTodoItemProps {
  todo: DailyTodoData;
  ideas: { id: string; title: string }[];
  onToggleComplete: (todo: DailyTodoData) => Promise<void>;
  onToggleUrgent: (todo: DailyTodoData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSaveEdit: (id: string, text: string) => Promise<void>;
  onTagIdea: (todoId: string, ideaId: string | null) => Promise<void>;
  onAddSubtask?: (parentId: string, text: string) => Promise<void>;
  onOpenDetail?: (todo: DailyTodoData) => void;
  onOpenContact?: (contactName: string) => void;
  onOpenEntity?: (entityName: string) => void;
  onChangeDate?: (id: string, dateKey: string | null) => Promise<void>;
  onChangeTimeBlock?: (id: string, block: string) => Promise<void>;
  onAssigneeChange?: (todoId: string, assigneeId: string | null) => void;
  dragHandleProps?: Record<string, any>;
  isDragging?: boolean;
  isSubtask?: boolean;
  customContainerStyle?: React.CSSProperties;
  overrideDateLabel?: string | null;
}

const DailyTodoItem: React.FC<DailyTodoItemProps> = ({
  todo, ideas, onToggleComplete, onToggleUrgent, onDelete, onSaveEdit, onTagIdea, onAddSubtask, onOpenDetail, onOpenContact, onOpenEntity, onChangeDate, onChangeTimeBlock, onAssigneeChange, dragHandleProps, isDragging, isSubtask, customContainerStyle, overrideDateLabel
}) => {
  const { data } = useStore();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  const [subtasksExpanded, setSubtasksExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const startEdit = () => {
    if (onOpenDetail && !isSubtask) {
      onOpenDetail(todo);
      return;
    }
    setEditing(true);
    setEditText(todo.text);
  };

  const commitEdit = async () => {
    if (editText.trim() && editText.trim() !== todo.text) {
      await onSaveEdit(todo.id, editText.trim());
    }
    setEditing(false);
  };

  const handleAddSubtask = async () => {
    if (!subtaskText.trim() || !onAddSubtask) return;
    await onAddSubtask(todo.id, subtaskText.trim());
    setSubtaskText('');
    setShowSubtaskInput(false);
  };

  const renderTextWithMentions = (text: string) => {
    const rawContacts = (data.contacts || [])
      .map(c => {
        const name = (c.fullName || c.firstName + ' ' + (c.lastName || '')).trim();
        return { name, isStub: !c.email && !c.phone && !c.company && !c.backgroundInfo };
      })
      .filter(c => c.name.length > 1);
      
    const rawEntities = (data.entities || [])
      .map(e => ({ name: e.name, isStub: !e.description && !e.website && !e.linkedinUrl }))
      .filter(e => e.name.length > 1);

    const knownContacts = rawContacts.flatMap(c =>
      mentionVariantsForName('@', c.name).map(text => ({ text, rawName: c.name, isStub: c.isStub }))
    );

    const knownEntities = rawEntities.flatMap(e =>
      mentionVariantsForName('#', e.name).map(text => ({ text, rawName: e.name, isStub: e.isStub }))
    );

    // Sort by length descending so longest phrases match first
    const allKnown = [...knownContacts, ...knownEntities].sort((a, b) => b.text.length - a.text.length);

    let parts = [text];
    if (allKnown.length > 0) {
      const escaped = allKnown.map(k => k.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const regex = new RegExp(`(${escaped})`, 'g');
      parts = text.split(regex);
    }

    return parts.map((part, i) => {
      const contactMatch = knownContacts.find(c => c.text === part);
      if (contactMatch) {
        return (
          <span 
            key={i} 
            title={contactMatch.isStub ? "Temporary Contact - Click to add details" : undefined}
            style={{ 
              color: contactMatch.isStub ? '#9ca3af' : '#3b82f6', 
              borderBottom: contactMatch.isStub ? '1px dashed #9ca3af' : 'none',
              cursor: onOpenContact ? 'pointer' : 'inherit' 
            }}
            onClick={(e) => { 
              if (onOpenContact) { 
                e.stopPropagation(); 
                onOpenContact(contactMatch.rawName); 
              } 
            }}
          >
            @{contactMatch.rawName}
          </span>
        );
      }
      
      const entityMatch = knownEntities.find(e => e.text === part);
      if (entityMatch) {
        return (
          <span 
            key={i} 
            title={entityMatch.isStub ? "Temporary Entity - Click to add details" : undefined}
            style={{ 
              color: entityMatch.isStub ? '#9ca3af' : '#8b5cf6', 
              borderBottom: entityMatch.isStub ? '1px dashed #9ca3af' : 'none',
              cursor: onOpenEntity ? 'pointer' : 'inherit' 
            }}
            onClick={(e) => { 
              if (onOpenEntity) { 
                e.stopPropagation(); 
                onOpenEntity(entityMatch.rawName); 
              } 
            }}
          >
            #{entityMatch.rawName}
          </span>
        );
      }
      
      // Fallback for remaining text to find unmatched temporary pills
      const fallbackRegex = /(@[^@\n\r]+@|#[^#\n\r]+#|@\[[^\]]+\]|@"[^"]+"|@[a-zA-ZÀ-ÖØ-Þß-öø-ÿ0-9][a-zA-ZÀ-ÖØ-Þß-öø-ÿ0-9'’.-]*|#\[[^\]]+\]|#"[^"]+"|#[a-zA-ZÀ-ÖØ-Þß-öø-ÿ0-9][a-zA-ZÀ-ÖØ-Þß-öø-ÿ0-9'’.-]*)/g;
      const subParts = part.split(fallbackRegex);
      if (subParts.length === 1) return part;
      
      return subParts.map((subPart, j) => {
        if (subPart.startsWith('@') || subPart.startsWith('#')) {
          const isEntity = subPart.startsWith('#');
          const rawName = subPart.replace(/^[@#]\[|^[@#]"|^[@#]|[@#]$|\]$|"$/g, '').trim();
          return (
            <span 
              key={`${i}-${j}`} 
              style={{ color: '#9ca3af', borderBottom: '1px dashed #9ca3af', cursor: (isEntity ? onOpenEntity : onOpenContact) ? 'pointer' : 'inherit' }}
              title={`Click to create ${isEntity ? 'entity' : 'contact'}`}
              onClick={(e) => { 
                e.stopPropagation(); 
                if (isEntity && onOpenEntity) onOpenEntity(rawName); 
                else if (!isEntity && onOpenContact) onOpenContact(rawName);
              }}
            >
              {isEntity ? '#' : '@'}{rawName}
            </span>
          );
        }
        return subPart;
      });
    });
  };

  const children = todo.children || [];
  const hasChildren = children.length > 0;
  const completedChildren = children.filter(c => c.completed).length;
  const blockTag = BLOCK_SHORT[(todo.timeBlock as string) || 'morning'] || 'AM';

  return (
    <div style={{ position: 'relative' }}>
      {/* Click-away backdrop for chevron menu */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
      )}

      {isSubtask && (
        <div style={{ position: 'absolute', left: '0.6rem', top: '-10px', height: '30px', width: '12px', borderLeft: '2px solid #9ca3af', borderBottom: '2px solid #9ca3af', borderBottomLeftRadius: '6px', zIndex: 1 }} />
      )}

      <div
        className={`wv-task ${todo.completed ? 'wv-task--done' : ''} ${todo.isUrgent && !todo.completed ? 'wv-task--urgent' : ''} ${isDragging ? 'cl-todo-dragging' : ''} ${isSubtask ? 'wv-task--subtask' : ''}`}
        style={{ position: 'relative', zIndex: menuOpen ? 50 : (isSubtask ? 2 : 1), ...(isSubtask ? { marginLeft: '1.5rem' } : {}), ...customContainerStyle }}
      >
        {/* Row 1: checkbox + text + subtask count + urgent icon */}
        <div className="wv-task-row-1">
          {!isSubtask && hasChildren && (
            <button
              className="daily-todo-expand-btn"
              onClick={() => setSubtasksExpanded(!subtasksExpanded)}
              style={{ marginRight: '2px' }}
            >
              {subtasksExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            className={`wv-task-check ${todo.completed ? 'wv-task-check--done' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleComplete(todo); }}
          >
            {todo.completed && <Check className="w-2.5 h-2.5" />}
          </button>

          {editing ? (
            <input
              className="daily-todo-edit-input"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onBlur={() => commitEdit()}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
              style={{ flex: 1 }}
            />
          ) : (
            <div className="wv-task-text-container" onClick={startEdit} style={{ display: 'flex', alignItems: 'center' }}>
              <span className="wv-task-text" title={todo.text}>
                {renderTextWithMentions(todo.text)}
                {todo.comments && !isSubtask && <span style={{ marginLeft: '4px', opacity: 0.5 }}>📝</span>}
              </span>
              {todo.assignee && (
                <div
                  title={`Assigned to ${todo.assignee.name}`}
                  style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    backgroundColor: todo.assignee.avatarColor || '#ec4899', // Default to bright pink if no color
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', fontWeight: 800, color: '#fff', marginLeft: '6px',
                    flexShrink: 0
                  }}
                >
                  {getInitials(todo.assignee.name)}
                </div>
              )}
            </div>
          )}

          {hasChildren && !isSubtask && (() => {
            const allDone = completedChildren === children.length;
            return <span className={`wv-subtask-count ${allDone ? 'wv-subtask-count--done' : ''}`}>{completedChildren}/{children.length}</span>;
          })()}

          {todo.isUrgent && <Flame className="w-3 h-3" style={{ color: '#ef4444', flexShrink: 0 }} />}
        </div>

        {/* Row 2: time block pill + idea tag + add subtask + chevron menu — hidden for subtasks */}
        <div className="wv-task-row-2" style={isSubtask ? { minHeight: 0, padding: '0 8px 4px', gap: '4px' } : {}}>
          {!isSubtask && (
            overrideDateLabel ? (
              <span className="wv-task-block wv-task-block--morning" style={{ background: '#e5e7eb', color: '#4b5563' }}>{overrideDateLabel}</span>
            ) : todo.dueDate ? (
              <span className="wv-task-block wv-task-block--morning" style={{ background: '#fee2e2', color: '#991b1b' }}>Due {todo.dueDate.slice(5, 10).replace('-', '/')}</span>
            ) : (
              <span className={`wv-task-block wv-task-block--${(todo.timeBlock as string) || 'morning'}`}>{blockTag}</span>
            )
          )}

          {!isSubtask && todo.ideaId && todo.idea?.title && (
            <Link to={`/ideas/${todo.ideaId}`} className="wv-task-idea" onClick={e => e.stopPropagation()} title={todo.idea.title} style={{ margin: 0 }}>
              <Lightbulb className="w-2.5 h-2.5" />
              <span>{todo.idea.title}</span>
            </Link>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginLeft: 'auto' }}>
            {todo.completed && todo.completedBy && (
              <span style={{ fontSize: '10px', fontWeight: 400, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                ✓ {todo.completedBy.name.split(' ')[0]}
              </span>
            )}
            {/* Add subtask button */}
            {!isSubtask && onAddSubtask && !todo.completed && (
              <button
                className="wv-task-action-btn"
                onClick={e => { e.preventDefault(); e.stopPropagation(); setShowSubtaskInput(!showSubtaskInput); }}
                title="Add subtask"
                style={showSubtaskInput ? { color: '#6366f1' } : {}}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Chevron dropdown menu */}
            <div style={{ position: 'relative' }}>
              <button
                className="wv-task-action-btn"
                onClick={e => {
                  e.preventDefault(); e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
              >
                <ChevronDown className="w-4 h-4 text-gray-600" />
              </button>

              {menuOpen && (
                <TaskChevronMenu
                  todo={todo}
                  ideas={ideas}
                  onClose={() => setMenuOpen(false)}
                  onOpenDetail={onOpenDetail}
                  onToggleUrgent={onToggleUrgent}
                  onTagIdea={onTagIdea}
                  onChangeDate={onChangeDate}
                  onChangeTimeBlock={onChangeTimeBlock}
                  onAssigneeChange={onAssigneeChange}
                  onDelete={onDelete}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subtask input */}
      {showSubtaskInput && !isSubtask && (
        <div className="daily-todo-subtask-add" style={{ marginLeft: '1.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <MentionInput
            className="daily-todo-subtask-input"
            placeholder="Add a subtask..."
            value={subtaskText}
            onChangeValue={setSubtaskText}
            onSubmit={handleAddSubtask}
            onCancel={() => { setShowSubtaskInput(false); setSubtaskText(''); }}
            autoFocus
            style={{ flex: 1 }}
          />
          <button
            onClick={handleAddSubtask}
            disabled={!subtaskText.trim()}
            style={{ 
              background: 'none', border: 'none', 
              cursor: subtaskText.trim() ? 'pointer' : 'not-allowed', 
              padding: '2px', 
              color: subtaskText.trim() ? '#4f46e5' : '#9ca3af', 
              flexShrink: 0, display: 'flex', alignItems: 'center' 
            }}
            title="Save"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowSubtaskInput(false); setSubtaskText(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#ef4444', flexShrink: 0, display: 'flex', alignItems: 'center' }}
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Render subtasks */}
      {!isSubtask && subtasksExpanded && children.map(child => (
        <DailyTodoItem
          key={child.id}
          todo={child}
          ideas={ideas}
          onToggleComplete={onToggleComplete}
          onToggleUrgent={onToggleUrgent}
          onDelete={onDelete}
          onSaveEdit={onSaveEdit}
          onTagIdea={onTagIdea}
          onOpenDetail={onOpenDetail}
          onOpenContact={onOpenContact}
          onOpenEntity={onOpenEntity}
          onChangeDate={onChangeDate}
          onChangeTimeBlock={onChangeTimeBlock}
          onAssigneeChange={onAssigneeChange}
          isSubtask
          customContainerStyle={customContainerStyle}
        />
      ))}
    </div>
  );
};

export default DailyTodoItem;
