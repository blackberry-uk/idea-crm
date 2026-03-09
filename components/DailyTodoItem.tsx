import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, Flame, Trash2, Tag, X, Lightbulb, GripVertical, Plus, ChevronDown, ChevronRight } from 'lucide-react';

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
}

interface DailyTodoItemProps {
  todo: DailyTodoData;
  ideas: { id: string; title: string }[];
  onToggleComplete: (todo: DailyTodoData) => Promise<void>;
  onToggleUrgent: (todo: DailyTodoData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSaveEdit: (id: string, text: string) => Promise<void>;
  onTagIdea: (todoId: string, ideaId: string | null) => Promise<void>;
  onAddSubtask?: (parentId: string, text: string) => Promise<void>;
  dragHandleProps?: Record<string, any>;
  isDragging?: boolean;
  isSubtask?: boolean;
}

const DailyTodoItem: React.FC<DailyTodoItemProps> = ({
  todo, ideas, onToggleComplete, onToggleUrgent, onDelete, onSaveEdit, onTagIdea, onAddSubtask, dragHandleProps, isDragging, isSubtask
}) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  const [subtasksExpanded, setSubtasksExpanded] = useState(true);

  const startEdit = () => {
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

  const children = todo.children || [];
  const hasChildren = children.length > 0;
  const completedChildren = children.filter(c => c.completed).length;

  return (
    <div>
      <div
        className={`daily-todo-item ${todo.completed ? 'daily-todo-item--done' : ''} ${todo.isUrgent && !todo.completed ? 'daily-todo-item--urgent' : ''} ${isDragging ? 'daily-todo-item--dragging' : ''} ${isSubtask ? 'daily-todo-item--subtask' : ''}`}
      >
        {/* Drag handle — only for parent tasks */}
        {!isSubtask && (
          <span className="daily-todo-drag-handle" {...(dragHandleProps || {})}>
            <GripVertical className="w-4 h-4" />
          </span>
        )}

        {/* Subtask expand/collapse toggle */}
        {!isSubtask && hasChildren && (
          <button
            className="daily-todo-expand-btn"
            onClick={() => setSubtasksExpanded(!subtasksExpanded)}
          >
            {subtasksExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          onClick={() => onToggleComplete(todo)}
          className={`daily-todo-check ${todo.completed ? 'daily-todo-check--done' : ''}`}
        >
          {todo.completed ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
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
          />
        ) : (
          <div className="flex-1 min-w-0">
            <span
              className={`daily-todo-text ${todo.completed ? 'daily-todo-text--done' : ''}`}
              onClick={startEdit}
            >
              {todo.text}
            </span>
            {hasChildren && !isSubtask && (
              <span className="daily-todo-subtask-count">
                {completedChildren}/{children.length}
              </span>
            )}
            {todo.idea && (
              <Link
                to={`/ideas/${todo.idea.id}`}
                className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'var(--primary-shadow, #eef2ff)', color: 'var(--primary, #6366f1)' }}
                onClick={e => e.stopPropagation()}
              >
                <Lightbulb className="w-2.5 h-2.5" />
                {todo.idea.title.length > 20 ? todo.idea.title.slice(0, 20) + '\u2026' : todo.idea.title}
              </Link>
            )}
          </div>
        )}

        <div className="daily-todo-actions">
          {/* Add subtask — only for parent tasks */}
          {!isSubtask && onAddSubtask && !todo.completed && (
            <button
              onClick={() => setShowSubtaskInput(!showSubtaskInput)}
              className="daily-todo-action-btn"
              title="Add subtask"
              style={showSubtaskInput ? { color: 'var(--primary, #6366f1)' } : {}}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Tag to idea */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTagMenu(!showTagMenu)}
              className="daily-todo-action-btn"
              title={todo.ideaId ? 'Change idea tag' : 'Tag to idea'}
              style={todo.ideaId ? { color: 'var(--primary, #6366f1)' } : {}}
            >
              <Tag className="w-3.5 h-3.5" />
            </button>
            {showTagMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 50,
                background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '0.5rem',
                minWidth: '200px', maxHeight: '200px', overflowY: 'auto'
              }}>
                {todo.ideaId && (
                  <button
                    onClick={() => { onTagIdea(todo.id, null); setShowTagMenu(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <X className="w-3 h-3" /> Remove tag
                  </button>
                )}
                {[...ideas].sort((a, b) => a.title.localeCompare(b.title)).map(idea => (
                  <button
                    key={idea.id}
                    onClick={() => { onTagIdea(todo.id, idea.id); setShowTagMenu(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors truncate ${todo.ideaId === idea.id ? 'font-bold' : ''}`}
                    style={todo.ideaId === idea.id ? { color: 'var(--primary)' } : { color: '#374151' }}
                  >
                    {idea.title}
                  </button>
                ))}
                {ideas.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-400 italic">No ideas yet</p>
                )}
              </div>
            )}
          </div>
          {!isSubtask && (
            <button
              onClick={() => onToggleUrgent(todo)}
              className={`daily-todo-action-btn ${todo.isUrgent ? 'daily-todo-action-btn--urgent' : ''}`}
              title={todo.isUrgent ? 'Remove urgency' : 'Mark urgent'}
            >
              <Flame className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(todo.id)}
            className="daily-todo-action-btn daily-todo-action-btn--delete"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Subtask input */}
      {showSubtaskInput && !isSubtask && (
        <div className="daily-todo-subtask-add">
          <input
            className="daily-todo-subtask-input"
            placeholder="Add a subtask..."
            value={subtaskText}
            onChange={e => setSubtaskText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddSubtask();
              if (e.key === 'Escape') { setShowSubtaskInput(false); setSubtaskText(''); }
            }}
            autoFocus
          />
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
          isSubtask
        />
      ))}
    </div>
  );
};

export default DailyTodoItem;
